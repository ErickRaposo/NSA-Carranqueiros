import { createClient, RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { LanPeerInfo } from '../experience/types';

export interface CloudRoomMessageEnvelope {
  type: 'sync' | 'projection' | 'speaker-calib' | 'calib-signal' | 'request-state';
  senderId?: string;
  requesterId?: string;
  role?: string;
  payload?: unknown;
  cmd?: unknown;
}

export interface CloudRoomSubscriptionOptions {
  roomCode: string;
  peerId: string;
  role: string;
  onMessage: (msg: CloudRoomMessageEnvelope) => void;
  onPresence: (peers: LanPeerInfo[]) => void;
  onConnectionChange: (connected: boolean) => void;
  onSubscribed?: () => void;
}

export interface CloudRoomHandle {
  send: (msg: CloudRoomMessageEnvelope) => void;
  dispose: () => void;
}

let cachedClient: SupabaseClient | null = null;
let cachedCredentialsKey = '';

/**
 * Garante apenas a origem limpa do projeto Supabase (ex.: `https://xyz.supabase.co`),
 * removendo sufixos colados por engano como `/rest/v1/` que quebram REST e Realtime.
 */
export function normalizeSupabaseOrigin(rawUrl: string | null | undefined): string | null {
  if (!rawUrl) return null;
  const trimmed = rawUrl.trim().replace(/^['"]|['"]$/g, '');
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

function readSupabaseCredentials(): { url: string; anonKey: string } | null {
  const env =
    typeof import.meta !== 'undefined'
      ? ((import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {})
      : {};
  const url = normalizeSupabaseOrigin(env.VITE_SUPABASE_URL);
  const anonKey = (env.VITE_SUPABASE_ANON_KEY ?? '').trim().replace(/^['"]|['"]$/g, '');
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export function isSupabaseRealtimeConfigured(): boolean {
  return readSupabaseCredentials() !== null;
}

export function getSupabaseClient(): SupabaseClient | null {
  return getOrCreateSupabaseClient();
}

function getOrCreateSupabaseClient(): SupabaseClient | null {
  const creds = readSupabaseCredentials();
  if (!creds) return null;
  const key = `${creds.url}::${creds.anonKey}`;
  if (!cachedClient || cachedCredentialsKey !== key) {
    cachedClient = createClient(creds.url, creds.anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      realtime: {
        params: {
          eventsPerSecond: 35,
        },
      },
    });
    cachedCredentialsKey = key;
  }
  return cachedClient;
}

interface PresenceTrackPayload {
  id?: string;
  role?: string;
  ip?: string;
  connectedAt?: number;
}

export function subscribeCloudRoom(opts: CloudRoomSubscriptionOptions): CloudRoomHandle | null {
  const supabase = getOrCreateSupabaseClient();
  if (!supabase) {
    opts.onConnectionChange(false);
    return null;
  }

  let disposed = false;
  let isSubscribed = false;
  const channelName = `earth-jukebox-room:${opts.roomCode}`;

  const channel: RealtimeChannel = supabase.channel(channelName, {
    config: {
      broadcast: { self: false, ack: false },
      presence: { key: opts.peerId },
    },
  });

  const emitPresenceList = () => {
    if (disposed) return;
    const state = channel.presenceState<PresenceTrackPayload>();
    const peers: LanPeerInfo[] = [];
    for (const [key, entries] of Object.entries(state)) {
      if (!Array.isArray(entries) || entries.length === 0) continue;
      const item = entries[entries.length - 1];
      peers.push({
        id: item.id ?? key,
        role: item.role ?? 'peer',
        ip: item.ip ?? 'cloud',
        connectedAt: typeof item.connectedAt === 'number' ? item.connectedAt : Date.now(),
      });
    }
    peers.sort((a, b) => a.connectedAt - b.connectedAt);
    opts.onPresence(peers);
  };

  channel
    .on('broadcast', { event: 'room-msg' }, (event) => {
      if (disposed) return;
      const raw = event?.payload as CloudRoomMessageEnvelope | undefined;
      if (!raw || typeof raw !== 'object' || !raw.type) return;
      if (raw.senderId && raw.senderId === opts.peerId) return;
      opts.onMessage(raw);
    })
    .on('presence', { event: 'sync' }, emitPresenceList)
    .subscribe((status) => {
      if (disposed) return;
      if (status === 'SUBSCRIBED') {
        isSubscribed = true;
        opts.onConnectionChange(true);
        void channel
          .track({
            id: opts.peerId,
            role: opts.role,
            ip: 'cloud',
            connectedAt: Date.now(),
          })
          .catch(() => {});
        opts.onSubscribed?.();
      } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        isSubscribed = false;
        opts.onConnectionChange(false);
      }
    });

  return {
    send: (msg) => {
      if (disposed || !isSubscribed) return;
      void channel
        .send({
          type: 'broadcast',
          event: 'room-msg',
          payload: msg,
        })
        .catch(() => {});
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      isSubscribed = false;
      opts.onConnectionChange(false);
      void supabase.removeChannel(channel).catch(() => {});
    },
  };
}
