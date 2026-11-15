import {
  ProjectorOutId,
  SpeakerNodeIndex,
  SyncNetworkMode,
  ViewRole,
} from '../experience/types';

/**
 * Alfabeto sem caracteres ambíguos (sem 0/O/1/I) para leitura rápida em projetores, tablets e voz.
 */
const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export type { SyncNetworkMode };

/**
 * Normaliza e valida um código de sala vindo da URL (`?room=XXXXXX`).
 * Aceita de 3 a 24 caracteres alfanuméricos/hífen; retorna `null` se vazio ou inválido.
 */
export function normalizeRoomCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  if (cleaned.length < 3 || cleaned.length > 24) return null;
  return cleaned;
}

/**
 * Gera um código curto de 6 caracteres legíveis (ex.: `K7M4P9`) usando CSPRNG quando disponível.
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
 * Lê o parâmetro `?room=` de uma string `window.location.search`.
 */
export function readRoomCodeFromSearch(search: string): string | null {
  const params = new URLSearchParams(search);
  return normalizeRoomCode(params.get('room'));
}

/**
 * Verifica se o host atual é um servidor local LAN / localhost HTTP (`npm run dev` / `npm run preview`).
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
 * Regra canônica dos Modos de Rede convivendo no mesmo domínio:
 * 1. Visitante Público (`demo` ou `portal` sem `?room=`): `'isolated'` (zero rede compartilhada).
 * 2. Sala com Supabase configurado no `.env` (ou `?transport=cloud`): `'cloud-room'` (Supabase Realtime + tabela `rooms`, inclusive em localhost).
 * 3. Servidor LAN Local sem Supabase configurado (`isLocalLanHost()`): `'lan-ws'` (`/ws-earth-sync` + `/api/rooms`).
 * 4. Domínio Público HTTPS com `?room=XXXXXX`: `'cloud-room'`.
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

  // Visitante público explorando Portal ou Demo Web sem código de sala nunca entra em barramento compartilhado
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
 * Monta URL relativa ou absoluta preservando sempre `&room=XXXXXX` quando ativo.
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
