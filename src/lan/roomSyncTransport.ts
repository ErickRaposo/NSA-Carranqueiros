import { LanPeerInfo, SyncNetworkMode } from '../experience/types';
import {
  CloudRoomHandle,
  CloudRoomMessageEnvelope,
  isSupabaseRealtimeConfigured,
  subscribeCloudRoom,
} from './roomRealtimeClient';

export interface ThrottledSender<T> {
  send: (value: T) => void;
  flush: () => void;
  cancel: () => void;
}

/**
 * Throttle com envio imediato na borda de subida + envio garantido do último valor (trailing)
 * após `intervalMs` (~35–45 ms), evitando inundar o barramento Realtime ao arrastar Corner-Pin ou faders.
 */
export function createTrailingThrottle<T>(
  intervalMs: number,
  dispatch: (value: T) => void,
  nowFn: () => number = () => Date.now()
): ThrottledSender<T> {
  let lastSentAt = 0;
  let pendingValue: T | undefined;
  let hasPending = false;
  let timerId: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
    if (!hasPending) return;
    const val = pendingValue as T;
    hasPending = false;
    pendingValue = undefined;
    lastSentAt = nowFn();
    dispatch(val);
  };

  const send = (value: T) => {
    const now = nowFn();
    const elapsed = now - lastSentAt;
    if (elapsed >= intervalMs && timerId === null) {
      lastSentAt = now;
      hasPending = false;
      pendingValue = undefined;
      dispatch(value);
      return;
    }

    pendingValue = value;
    hasPending = true;
    if (timerId === null) {
      const wait = Math.max(5, intervalMs - Math.max(0, elapsed));
      timerId = setTimeout(flush, wait);
    }
  };

  const cancel = () => {
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
    hasPending = false;
    pendingValue = undefined;
  };

  return { send, flush, cancel };
}

export function isHostCapableRole(role: string): boolean {
  return role === 'admin' || role === 'setup' || role === 'controller';
}

export interface HostStateSnapshot {
  sync?: unknown;
  projection?: unknown;
  speakerCalib?: unknown;
  calibSignal?: unknown;
}

export interface RoomSyncTransportCallbacks {
  mode: SyncNetworkMode;
  roomCode: string | null;
  peerId: string;
  role: string;
  wsHost?: string;
  getHostSnapshot?: () => HostStateSnapshot;
  onSync: (payload: unknown) => void;
  onProjection: (payload: unknown) => void;
  onSpeakerCalib: (payload: unknown) => void;
  onCalibSignal: (cmd: unknown) => void;
  onPresence: (peers: LanPeerInfo[]) => void;
  onConnectionChange: (connected: boolean) => void;
}

export interface RoomSyncTransportHandle {
  sendSync: (payload: unknown) => void;
  sendProjection: (payload: unknown, immediate?: boolean) => void;
  sendSpeakerCalib: (payload: unknown, immediate?: boolean) => void;
  sendCalibSignal: (cmd: unknown) => void;
  requestStateSnapshot: () => void;
  dispose: () => void;
}

/**
 * Unifica os 3 modos de operação (Isolado, LAN WebSocket `/ws-earth-sync` e Sala Online Supabase Realtime)
 * mantendo os mesmos 4 eventos (`sync`, `projection`, `speaker-calib`, `calib-signal`) + `presence` e Late Join (`request-state`).
 */
export function createRoomSyncTransport(
  opts: RoomSyncTransportCallbacks
): RoomSyncTransportHandle {
  let disposed = false;
  let ws: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let lateJoinReplyTimer: ReturnType<typeof setTimeout> | null = null;
  const retryTimers: Array<ReturnType<typeof setTimeout>> = [];
  let hasReceivedRemoteState = false;
  const knownPeerIds = new Set<string>();
  let cloudHandle: CloudRoomHandle | null = null;

  const isPrimaryHostRole = opts.role === 'setup' || opts.role === 'admin';

  const clearRetryTimers = () => {
    while (retryTimers.length > 0) {
      const t = retryTimers.pop();
      if (t !== undefined) clearTimeout(t);
    }
  };

  const rawSend = (envelope: CloudRoomMessageEnvelope) => {
    if (disposed || opts.mode === 'isolated') return;
    if (opts.mode === 'cloud-room') {
      cloudHandle?.send({ ...envelope, senderId: opts.peerId });
      return;
    }
    if (opts.mode === 'lan-ws' && ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ ...envelope, senderId: opts.peerId }));
      } catch {
        // ignore broken socket
      }
    }
  };

  const pushHostSnapshotNow = () => {
    if (disposed || !opts.getHostSnapshot) return;
    const snap = opts.getHostSnapshot();
    if (snap.sync) rawSend({ type: 'sync', payload: snap.sync });
    if (snap.projection) rawSend({ type: 'projection', payload: snap.projection });
    if (snap.speakerCalib) rawSend({ type: 'speaker-calib', payload: snap.speakerCalib });
    if (snap.calibSignal) rawSend({ type: 'calib-signal', cmd: snap.calibSignal });
  };

  const scheduleHostSnapshotPush = (delayMs: number) => {
    if (disposed || !opts.getHostSnapshot) return;
    if (lateJoinReplyTimer !== null) clearTimeout(lateJoinReplyTimer);
    lateJoinReplyTimer = setTimeout(() => {
      lateJoinReplyTimer = null;
      pushHostSnapshotNow();
    }, delayMs);
  };

  const sendStateRequestWithRetries = () => {
    const requestOnce = () => {
      if (disposed) return;
      rawSend({
        type: 'request-state',
        requesterId: opts.peerId,
        role: opts.role,
      });
    };
    requestOnce();
    if (isPrimaryHostRole) return;
    clearRetryTimers();
    for (const waitMs of [550, 1450]) {
      const t = setTimeout(() => {
        if (!disposed && !hasReceivedRemoteState) {
          requestOnce();
        }
      }, waitMs);
      retryTimers.push(t);
    }
  };

  const handlePresenceUpdate = (peers: LanPeerInfo[]) => {
    let hasNewRemotePeer = false;
    for (const peer of peers) {
      if (peer.id !== opts.peerId && !knownPeerIds.has(peer.id)) {
        hasNewRemotePeer = true;
      }
      knownPeerIds.add(peer.id);
    }
    opts.onPresence(peers);

    if (hasNewRemotePeer && opts.getHostSnapshot) {
      const anotherPrimaryHostOnline = peers.some(
        (p) => p.id !== opts.peerId && (p.role === 'setup' || p.role === 'admin')
      );
      if (isPrimaryHostRole || (opts.role === 'controller' && !anotherPrimaryHostOnline)) {
        scheduleHostSnapshotPush(isPrimaryHostRole ? 80 : 200);
      }
    }
  };

  const projectionThrottled = createTrailingThrottle<unknown>(40, (payload) => {
    rawSend({ type: 'projection', payload });
  });

  const speakerCalibThrottled = createTrailingThrottle<unknown>(40, (payload) => {
    rawSend({ type: 'speaker-calib', payload });
  });

  const handleIncomingEnvelope = (msg: CloudRoomMessageEnvelope & { clients?: LanPeerInfo[] }) => {
    if (disposed || !msg || typeof msg !== 'object') return;
    if (msg.senderId && msg.senderId === opts.peerId) return;

    if (msg.type === 'sync' && msg.payload) {
      hasReceivedRemoteState = true;
      clearRetryTimers();
      opts.onSync(msg.payload);
    } else if (msg.type === 'projection' && msg.payload) {
      hasReceivedRemoteState = true;
      opts.onProjection(msg.payload);
    } else if (msg.type === 'speaker-calib' && msg.payload) {
      opts.onSpeakerCalib(msg.payload);
    } else if (msg.type === 'calib-signal' && msg.cmd) {
      opts.onCalibSignal(msg.cmd);
    } else if (msg.type === 'request-state') {
      // Late Join: o host ativo (setup/admin imediatamente, controller com pequeno atraso) envia o snapshot completo
      if (!isHostCapableRole(opts.role) || !opts.getHostSnapshot) return;
      if (msg.requesterId === opts.peerId) return;
      const delayMs = opts.role === 'controller' ? 110 : 15;
      scheduleHostSnapshotPush(delayMs);
    }
  };

  if (opts.mode === 'isolated') {
    opts.onConnectionChange(false);
    opts.onPresence([]);
  } else if (opts.mode === 'cloud-room' && opts.roomCode) {
    if (isSupabaseRealtimeConfigured()) {
      cloudHandle = subscribeCloudRoom({
        roomCode: opts.roomCode,
        peerId: opts.peerId,
        role: opts.role,
        onMessage: handleIncomingEnvelope,
        onPresence: handlePresenceUpdate,
        onConnectionChange: opts.onConnectionChange,
        onSubscribed: () => {
          if (isPrimaryHostRole) {
            pushHostSnapshotNow();
          }
          sendStateRequestWithRetries();
        },
      });
    } else {
      opts.onConnectionChange(false);
      opts.onPresence([]);
    }
  } else if (opts.mode === 'lan-ws' && typeof WebSocket !== 'undefined') {
    const host =
      opts.wsHost ?? (typeof window !== 'undefined' ? window.location.host : 'localhost:5173');

    const connectLan = () => {
      if (disposed) return;
      const params = new URLSearchParams();
      params.set('role', opts.role);
      if (opts.roomCode) params.set('room', opts.roomCode);
      const wsProtocol =
        typeof window !== 'undefined' && window.location?.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${wsProtocol}//${host}/ws-earth-sync?${params.toString()}`;
      try {
        const socket = new WebSocket(wsUrl);
        ws = socket;

        socket.onopen = () => {
          if (disposed) return;
          opts.onConnectionChange(true);
          try {
            socket.send(
              JSON.stringify({
                type: 'hello',
                role: opts.role,
                room: opts.roomCode ?? 'default',
              })
            );
          } catch {
            // ignore
          }
          if (isPrimaryHostRole) {
            pushHostSnapshotNow();
          }
          sendStateRequestWithRetries();
        };

        socket.onmessage = (ev) => {
          if (typeof ev.data !== 'string') return;
          try {
            const parsed = JSON.parse(ev.data) as CloudRoomMessageEnvelope & {
              type?: string;
              clients?: LanPeerInfo[];
            };
            if ((parsed as { type?: string }).type === 'presence' && Array.isArray(parsed.clients)) {
              handlePresenceUpdate(parsed.clients);
              return;
            }
            handleIncomingEnvelope(parsed);
          } catch {
            // ignore malformed JSON
          }
        };

        socket.onclose = () => {
          opts.onConnectionChange(false);
          ws = null;
          if (!disposed) {
            reconnectTimer = setTimeout(connectLan, 2500);
          }
        };

        socket.onerror = () => {
          socket.close();
        };
      } catch {
        // ignore WebSocket creation failure in test environments
      }
    };

    connectLan();
  }

  return {
    sendSync: (payload) => {
      rawSend({ type: 'sync', payload });
    },
    sendProjection: (payload, immediate = false) => {
      if (immediate) {
        projectionThrottled.cancel();
        rawSend({ type: 'projection', payload });
      } else {
        projectionThrottled.send(payload);
      }
    },
    sendSpeakerCalib: (payload, immediate = false) => {
      if (immediate) {
        speakerCalibThrottled.cancel();
        rawSend({ type: 'speaker-calib', payload });
      } else {
        speakerCalibThrottled.send(payload);
      }
    },
    sendCalibSignal: (cmd) => {
      rawSend({ type: 'calib-signal', cmd });
    },
    requestStateSnapshot: () => {
      rawSend({
        type: 'request-state',
        requesterId: opts.peerId,
        role: opts.role,
      });
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      projectionThrottled.cancel();
      speakerCalibThrottled.cancel();
      clearRetryTimers();
      if (reconnectTimer !== null) clearTimeout(reconnectTimer);
      if (lateJoinReplyTimer !== null) clearTimeout(lateJoinReplyTimer);
      cloudHandle?.dispose();
      cloudHandle = null;
      ws?.close();
      ws = null;
    },
  };
}
