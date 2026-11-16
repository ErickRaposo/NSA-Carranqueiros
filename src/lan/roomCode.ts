import {
  ProjectorOutId,
  SpeakerNodeIndex,
  SyncNetworkMode,
  ViewRole,
} from '../experience/types';

/**
 * Alphabet without ambiguous characters (no 0/O/1/I) for quick reading on projectors, tablets, and by voice.
 */
const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export type { SyncNetworkMode };

/**
 * Normalizes and validates a room code from the URL (`?room=XXXXXX`).
 * Accepts 3 to 24 alphanumeric/hyphen characters; returns `null` if empty or invalid.
 */
export function normalizeRoomCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  if (cleaned.length < 3 || cleaned.length > 24) return null;
  return cleaned;
}

/**
 * Generates a short 6-character readable code (e.g., `K7M4P9`) using CSPRNG when available.
 */
export function generateRoomCode(length = 6): string {
  const n = Math.max(4, Math.min(12, Math.floor(length)));
  const bytes = new Uint8Array(n);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < n; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  let out = '';
  for (let i = 0; i < n; i++) {
    out += ROOM_ALPHABET[bytes[i] % ROOM_ALPHABET.length];
  }
  return out;
}

/**
 * Reads the `?room=` parameter from a `window.location.search` string.
 */
export function readRoomCodeFromSearch(search: string): string | null {
  const params = new URLSearchParams(search);
  return normalizeRoomCode(params.get('room'));
}

/**
 * Checks whether the current host is a local LAN / localhost HTTP server (`npm run dev` / `npm run preview`).
 */
export function isLocalLanHost(
  loc: Pick<Location, 'protocol' | 'hostname'> | null = typeof window !== 'undefined'
    ? window.location
    : null
): boolean {
  if (!loc) return false;
  const { protocol, hostname } = loc;
  if (protocol !== 'http:') return false;
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('10.') ||
    hostname.startsWith('172.') ||
    hostname.endsWith('.local')
  );
}

/**
 * Canonical rule for Network Modes coexisting on the same domain:
 * 1. Public Visitor (`demo` or `portal` without `?room=`): `'isolated'` (zero shared network).
 * 2. Room with Supabase configured in `.env` (or `?transport=cloud`): `'cloud-room'` (Supabase Realtime + `rooms` table, including on localhost).
 * 3. Local LAN Server without Supabase configured (`isLocalLanHost()`): `'lan-ws'` (`/ws-earth-sync` + `/api/rooms`).
 * 4. Public HTTPS Domain with `?room=XXXXXX`: `'cloud-room'`.
 */
export function resolveSyncNetworkMode(opts: {
  view: ViewRole;
  roomCode: string | null;
  isLocalHost: boolean;
  forceCloud?: boolean;
  supabaseConfigured?: boolean;
}): SyncNetworkMode {
  const {
    view,
    roomCode,
    isLocalHost,
    forceCloud = false,
    supabaseConfigured = false,
  } = opts;

  // Public visitor exploring Portal or Web Demo without a room code never joins a shared bus
  if (!roomCode && (view === 'demo' || view === 'portal')) {
    return 'isolated';
  }

  if (roomCode && (forceCloud || supabaseConfigured)) {
    return 'cloud-room';
  }

  if (isLocalHost) {
    return 'lan-ws';
  }

  if (roomCode) {
    return 'cloud-room';
  }

  return 'isolated';
}

/**
 * Builds a relative or absolute URL while always preserving `&room=XXXXXX` when active.
 */
export function buildViewUrl(
  baseOrigin: string | null,
  view: ViewRole,
  options?: {
    outId?: ProjectorOutId;
    spk?: SpeakerNodeIndex;
    roomCode?: string | null;
    pathname?: string;
  }
): string {
  const params = new URLSearchParams();
  params.set('view', view);
  if (view === 'projector' && options?.outId) {
    params.set('out', String(options.outId));
  }
  if (view === 'audio-node' && options?.spk) {
    params.set('spk', String(options.spk));
  }
  const normalizedRoom = normalizeRoomCode(options?.roomCode);
  if (normalizedRoom) {
    params.set('room', normalizedRoom);
  }
  const query = `?${params.toString()}`;
  if (!baseOrigin) {
    const path = options?.pathname ?? '/';
    return `${path}${query}`;
  }
  const cleanOrigin = baseOrigin.replace(/\/+$/, '');
  const rawPath = options?.pathname ?? '/';
  const cleanPath = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
  return `${cleanOrigin}${cleanPath}${query}`;
}
