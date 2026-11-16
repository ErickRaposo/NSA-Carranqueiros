import { LanPeerInfo, SyncNetworkMode } from '../experience/types';
import { normalizeRoomCode } from './roomCode';
import { getSupabaseClient } from './roomRealtimeClient';

const LOCAL_CREATED_ROOMS_KEY = 'earth-jukebox-created-rooms-v1';
const ROOM_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours

export type RoomValidationResult =
  | { status: 'valid'; missingSchema?: boolean }
  | { status: 'missing-code' }
  | { status: 'not-found' }
  | { status: 'missing-schema' };

interface LocalRoomRecord {
  active: boolean;
  updatedAt: number;
}

const memoryRoomsMap = new Map<string, LocalRoomRecord>();

function readLocalRoomsMap(): Record<string, LocalRoomRecord> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(LOCAL_CREATED_ROOMS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, LocalRoomRecord>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeLocalRoomRecord(code: string, active: boolean): void {
  const now = Date.now();
  memoryRoomsMap.set(code, { active, updatedAt: now });
  if (typeof window === 'undefined') return;
  try {
    const map = readLocalRoomsMap();
    // Purge expired entries (> 24h)
    for (const [k, v] of Object.entries(map)) {
      if (!v || now - v.updatedAt > ROOM_TTL_MS) {
        delete map[k];
      }
    }
    map[code] = { active, updatedAt: now };
    window.localStorage.setItem(LOCAL_CREATED_ROOMS_KEY, JSON.stringify(map));
  } catch {
    // ignore storage quota
  }
}

function hasLocalCreatedRoom(code: string): boolean {
  const memEntry = memoryRoomsMap.get(code);
  if (memEntry && memEntry.active && Date.now() - memEntry.updatedAt <= ROOM_TTL_MS) {
    return true;
  }
  const entry = readLocalRoomsMap()[code];
  if (!entry || !entry.active) return false;
  return Date.now() - entry.updatedAt <= ROOM_TTL_MS;
}

function isMissingRoomsTableError(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  const code = (err.code ?? '').toUpperCase();
  const msg = (err.message ?? '').toLowerCase();
  return (
    code === 'PGRST205' ||
    code === '42P01' ||
    msg.includes('schema cache') ||
    (msg.includes('relation') && msg.includes('does not exist'))
  );
}

async function postLanRoomStatus(code: string, active: boolean): Promise<boolean> {
  if (
    typeof window === 'undefined' ||
    typeof window.fetch !== 'function' ||
    !window.location?.origin ||
    window.location.origin === 'null'
  ) {
    return false;
  }
  try {
    const res = await window.fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room: code, active }),
    });
    if (!res.ok) return false;
    const json = (await res.json()) as { ok?: boolean };
    return Boolean(json?.ok);
  } catch {
    return false;
  }
}

async function checkLocalApiRoomExists(code: string): Promise<boolean> {
  if (
    typeof window === 'undefined' ||
    typeof window.fetch !== 'function' ||
    !window.location?.origin ||
    window.location.origin === 'null'
  ) {
    return false;
  }
  try {
    const res = await window.fetch(`/api/rooms?room=${encodeURIComponent(code)}`, {
      cache: 'no-store',
    });
    if (!res.ok) return false;
    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) return false;
    const json = (await res.json()) as { ok?: boolean; exists?: boolean };
    return Boolean(json?.ok && json?.exists);
  } catch {
    return false;
  }
}

/**
 * Officially registers a room created by Setup or Technical Panel (`setup` / `admin`)
 * in the Supabase `public.rooms` table and/or in the local LAN registry (`/api/rooms`).
 */
export async function registerActiveRoom(
  rawRoomCode: string | null | undefined,
  mode: SyncNetworkMode
): Promise<{ ok: boolean; missingSchema?: boolean }> {
  const code = normalizeRoomCode(rawRoomCode);
  if (!code) return { ok: false };

  writeLocalRoomRecord(code, true);
  const lanSavedPromise = postLanRoomStatus(code, true);

  if (mode === 'cloud-room') {
    const supabase = getSupabaseClient();
    if (!supabase) {
      const lanOk = await lanSavedPromise;
      return { ok: lanOk };
    }
    try {
      const nowIso = new Date().toISOString();
      const [{ error }] = await Promise.all([
        supabase
          .from('rooms')
          .upsert({ code, active: true, updated_at: nowIso }, { onConflict: 'code' }),
        lanSavedPromise,
      ]);
      if (error) {
        if (isMissingRoomsTableError(error)) {
          return { ok: false, missingSchema: true };
        }
        return { ok: false };
      }
      return { ok: true };
    } catch {
      await lanSavedPromise;
      return { ok: false };
    }
  }

  await lanSavedPromise;
  return { ok: true };
}

/**
 * Keeps the room alive (`updated_at`) while already-validated Projectors or Controller remain open,
 * allowing the Setup tab to be closed without interrupting the presentation.
 */
export async function touchActiveRoom(
  rawRoomCode: string | null | undefined,
  mode: SyncNetworkMode
): Promise<void> {
  const code = normalizeRoomCode(rawRoomCode);
  if (!code) return;

  writeLocalRoomRecord(code, true);
  void postLanRoomStatus(code, true);

  if (mode === 'cloud-room') {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    try {
      await supabase
        .from('rooms')
        .update({ updated_at: new Date().toISOString(), active: true })
        .eq('code', code);
    } catch {
      // ignore heartbeat failures
    }
  }
}

/**
 * Verifies whether a room code was actually created and is active before unlocking
 * client screens (`?view=projector`, `?view=controller`, `?view=audio-node`).
 */
export async function validateRoomAccess(
  rawRoomCode: string | null | undefined,
  mode: SyncNetworkMode,
  livePeers: ReadonlyArray<LanPeerInfo> = []
): Promise<RoomValidationResult> {
  const code = normalizeRoomCode(rawRoomCode);
  if (!code) {
    return { status: 'missing-code' };
  }

  const hasActiveSetupHost = livePeers.some(
    (p) => p.role === 'setup' || p.role === 'admin'
  );

  if (mode === 'cloud-room') {
    let missingSchema = false;
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('rooms')
          .select('code, active, updated_at')
          .eq('code', code)
          .maybeSingle();

        if (!error && data && data.active) {
          return { status: 'valid' };
        }

        if (isMissingRoomsTableError(error)) {
          missingSchema = true;
        }
      } catch {
        // fallback below
      }
    }

    if (hasActiveSetupHost || (await checkLocalApiRoomExists(code))) {
      return missingSchema ? { status: 'valid', missingSchema: true } : { status: 'valid' };
    }

    if (missingSchema) {
      if (hasLocalCreatedRoom(code)) {
        return { status: 'valid', missingSchema: true };
      }
      return { status: 'missing-schema' };
    }

    return { status: 'not-found' };
  }

  // Local LAN Mode (/api/rooms) or offline preview
  if (await checkLocalApiRoomExists(code)) {
    return { status: 'valid' };
  }

  if (hasLocalCreatedRoom(code) || hasActiveSetupHost) {
    return { status: 'valid' };
  }

  return { status: 'not-found' };
}
