import crypto from 'node:crypto';
import fs from 'node:fs';
import type { IncomingMessage } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import type { Duplex } from 'node:stream';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface LanClientMeta {
  id: string;
  role: string;
  room: string;
  ip: string;
  connectedAt: number;
  socket: Duplex;
}

function getLocalLanIpv4s(): string[] {
  const nets = os.networkInterfaces();
  const ips: string[] = [];
  for (const name of Object.keys(nets)) {
    for (const iface of nets[name] ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  return ips;
}

function countRenderedCountries(): { count: number; ids: string[] } {
  const dir = path.join(__dirname, 'public/countries');
  if (!fs.existsSync(dir)) return { count: 0, ids: [] };
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const ids = entries
      .filter((e) => e.isDirectory() && fs.existsSync(path.join(dir, e.name, 'meta.json')))
      .map((e) => e.name)
      .sort();
    return { count: ids.length, ids };
  } catch {
    return { count: 0, ids: [] };
  }
}

function encodeWsTextFrame(jsonText: string): Buffer {
  const payload = Buffer.from(jsonText, 'utf8');
  const len = payload.length;
  if (len < 126) {
    const header = Buffer.from([0x81, len]);
    return Buffer.concat([header, payload]);
  }
  if (len < 65536) {
    const header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
    return Buffer.concat([header, payload]);
  }
  const header = Buffer.alloc(10);
  header[0] = 0x81;
  header[1] = 127;
  header.writeBigUInt64BE(BigInt(len), 2);
  return Buffer.concat([header, payload]);
}

function decodeWsFrames(buffer: Buffer): { messages: string[]; rest: Buffer; closed: boolean } {
  const messages: string[] = [];
  let offset = 0;
  let closed = false;

  while (offset + 2 <= buffer.length) {
    const b0 = buffer[offset];
    const b1 = buffer[offset + 1];
    const opcode = b0 & 0x0f;
    const masked = (b1 & 0x80) !== 0;
    let payloadLen = b1 & 0x7f;
    let headerLen = 2;

    if (opcode === 0x08) {
      closed = true;
      break;
    }

    if (payloadLen === 126) {
      if (offset + 4 > buffer.length) break;
      payloadLen = buffer.readUInt16BE(offset + 2);
      headerLen = 4;
    } else if (payloadLen === 127) {
      if (offset + 10 > buffer.length) break;
      payloadLen = Number(buffer.readBigUInt64BE(offset + 2));
      headerLen = 10;
    }

    const maskLen = masked ? 4 : 0;
    const totalFrameLen = headerLen + maskLen + payloadLen;
    if (offset + totalFrameLen > buffer.length) break;

    const dataStart = offset + headerLen + maskLen;
    const rawPayload = Buffer.from(buffer.subarray(dataStart, dataStart + payloadLen));

    if (masked) {
      const mask = buffer.subarray(offset + headerLen, offset + headerLen + 4);
      for (let i = 0; i < rawPayload.length; i++) {
        rawPayload[i] ^= mask[i & 3];
      }
    }

    if (opcode === 0x01) {
      messages.push(rawPayload.toString('utf8'));
    }
    offset += totalFrameLen;
  }

  return { messages, rest: buffer.subarray(offset), closed };
}

function earthJukeboxLanPlugin(): Plugin {
  const clients = new Map<string, LanClientMeta>();
  const registeredRooms = new Map<
    string,
    { code: string; active: boolean; createdAt: number; updatedAt: number }
  >();
  const roomSnapshots = new Map<
    string,
    {
      sync: string | null;
      projection: string | null;
      speakerCalib: string | null;
    }
  >();

  const touchRegisteredRoom = (rawRoom: string, active = true) => {
    const clean = rawRoom.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    if (clean.length < 3 || clean.length > 24) return null;
    const now = Date.now();
    const prev = registeredRooms.get(clean);
    const next = {
      code: clean,
      active,
      createdAt: prev?.createdAt ?? now,
      updatedAt: now,
    };
    registeredRooms.set(clean, next);
    return next;
  };

  const getRoomSnap = (room: string) => {
    let entry = roomSnapshots.get(room);
    if (!entry) {
      entry = { sync: null, projection: null, speakerCalib: null };
      roomSnapshots.set(room, entry);
    }
    return entry;
  };

  const broadcastPresence = (targetRoom?: string) => {
    const roomsToUpdate = targetRoom
      ? [targetRoom]
      : Array.from(new Set(Array.from(clients.values()).map((c) => c.room)));

    for (const room of roomsToUpdate) {
      const roomClients = Array.from(clients.values()).filter((c) => c.room === room);
      const list = roomClients.map((c) => ({
        id: c.id,
        role: c.role,
        ip: c.ip,
        connectedAt: c.connectedAt,
      }));
      const frame = encodeWsTextFrame(JSON.stringify({ type: 'presence', clients: list }));
      for (const c of roomClients) {
        try {
          c.socket.write(frame);
        } catch {
          // ignore broken socket
        }
      }
    }
  };

  const attachServer = (
    middlewares: { use: (fn: (req: IncomingMessage, res: { setHeader: (k: string, v: string) => void; end: (s: string) => void }, next: () => void) => void) => void },
    httpServer: { on: (event: string, cb: (req: IncomingMessage, socket: Duplex) => void) => void } | null
  ) => {
    middlewares.use((req, res, next) => {
      if (req.url?.startsWith('/api/lan-info')) {
        const reqUrl = new URL(req.url, 'http://localhost');
        const queryRoom = (reqUrl.searchParams.get('room') ?? '').trim().toUpperCase();
        const rendered = countRenderedCountries();
        const visibleClients = Array.from(clients.values()).filter(
          (c) => !queryRoom || c.room === queryRoom
        );
        const payload = {
          lanIps: getLocalLanIpv4s(),
          port: 5173,
          renderedCountryCount: rendered.count,
          renderedCountryIds: rendered.ids,
          clients: visibleClients.map((c) => ({
            id: c.id,
            role: c.role,
            ip: c.ip,
            connectedAt: c.connectedAt,
          })),
        };
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.end(JSON.stringify(payload));
        return;
      }

      if (req.url?.startsWith('/api/rooms')) {
        const reqUrl = new URL(req.url, 'http://localhost');
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');

        if (req.method === 'POST') {
          let body = '';
          req.on('data', (chunk: Buffer) => {
            body += chunk.toString('utf8');
          });
          req.on('end', () => {
            try {
              const parsed = JSON.parse(body || '{}') as { room?: string; active?: boolean };
              const saved = touchRegisteredRoom(parsed.room ?? '', parsed.active !== false);
              if (!saved) {
                res.end(JSON.stringify({ ok: false, exists: false }));
                return;
              }
              res.end(JSON.stringify({ ok: true, exists: saved.active, room: saved }));
            } catch {
              res.end(JSON.stringify({ ok: false, exists: false }));
            }
          });
          return;
        }

        const queryRoom = (reqUrl.searchParams.get('room') ?? '')
          .trim()
          .toUpperCase()
          .replace(/[^A-Z0-9_-]/g, '');
        const entry = queryRoom ? registeredRooms.get(queryRoom) : undefined;
        const exists = Boolean(entry?.active);
        res.end(JSON.stringify({ ok: true, exists, room: entry ?? null }));
        return;
      }
      next();
    });

    if (!httpServer) return;

    httpServer.on('upgrade', (req, socket) => {
      if (!req.url?.startsWith('/ws-earth-sync')) return;
      const wsKey = req.headers['sec-websocket-key'];
      if (!wsKey || typeof wsKey !== 'string') {
        socket.destroy();
        return;
      }

      const accept = crypto
        .createHash('sha1')
        .update(`${wsKey}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
        .digest('base64');

      socket.write(
        [
          'HTTP/1.1 101 Switching Protocols',
          'Upgrade: websocket',
          'Connection: Upgrade',
          `Sec-WebSocket-Accept: ${accept}`,
          '\r\n',
        ].join('\r\n')
      );

      const urlObj = new URL(req.url, 'http://localhost');
      const role = urlObj.searchParams.get('role') ?? 'unknown';
      const rawRoom = (urlObj.searchParams.get('room') ?? 'default')
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9_-]/g, '');
      const room = rawRoom || 'DEFAULT';
      if ((role === 'setup' || role === 'admin') && room !== 'DEFAULT') {
        touchRegisteredRoom(room, true);
      }
      const clientId = `ws-${Math.random().toString(36).slice(2, 9)}`;
      const remoteIp = (req.socket.remoteAddress ?? 'local').replace(/^::ffff:/, '');

      clients.set(clientId, {
        id: clientId,
        role,
        room,
        ip: remoteIp,
        connectedAt: Date.now(),
        socket,
      });

      const snapObj = getRoomSnap(room);
      for (const snap of [snapObj.sync, snapObj.projection, snapObj.speakerCalib]) {
        if (snap) {
          try {
            socket.write(encodeWsTextFrame(snap));
          } catch {
            // ignore
          }
        }
      }
      broadcastPresence(room);

      let recvBuf: Buffer = Buffer.alloc(0);
      socket.on('data', (chunk: Buffer) => {
        recvBuf = Buffer.concat([recvBuf, chunk]);
        const decoded = decodeWsFrames(recvBuf);
        recvBuf = Buffer.from(decoded.rest);
        if (decoded.closed) {
          const prev = clients.get(clientId);
          clients.delete(clientId);
          socket.end();
          if (prev) broadcastPresence(prev.room);
          return;
        }

        for (const msg of decoded.messages) {
          try {
            const parsed = JSON.parse(msg) as { type?: string; role?: string; room?: string };
            const currentMeta = clients.get(clientId);
            const activeRoom = currentMeta?.room ?? room;

            if (parsed.type === 'hello' && parsed.role) {
              if (currentMeta) {
                currentMeta.role = parsed.role;
                broadcastPresence(currentMeta.room);
              }
            } else if (
              parsed.type === 'sync' ||
              parsed.type === 'projection' ||
              parsed.type === 'speaker-calib' ||
              parsed.type === 'calib-signal' ||
              parsed.type === 'request-state'
            ) {
              const roomSnap = getRoomSnap(activeRoom);
              if (parsed.type === 'sync') {
                roomSnap.sync = msg;
              } else if (parsed.type === 'projection') {
                roomSnap.projection = msg;
              } else if (parsed.type === 'speaker-calib') {
                roomSnap.speakerCalib = msg;
              }
              const outFrame = encodeWsTextFrame(msg);
              for (const [otherId, peer] of clients.entries()) {
                if (otherId === clientId || peer.room !== activeRoom) continue;
                try {
                  peer.socket.write(outFrame);
                } catch {
                  // ignore
                }
              }
            }
          } catch {
            // ignore malformed JSON
          }
        }
      });

      const cleanup = () => {
        const prev = clients.get(clientId);
        if (clients.delete(clientId) && prev) {
          broadcastPresence(prev.room);
        }
      };
      socket.on('close', cleanup);
      socket.on('error', cleanup);
    });
  };

  return {
    name: 'earth-jukebox-lan-sync',
    configureServer(server) {
      attachServer(server.middlewares as never, server.httpServer as never);
    },
    configurePreviewServer(server) {
      attachServer(server.middlewares as never, server.httpServer as never);
    },
  };
}

export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react(), tailwindcss(), earthJukeboxLanPlugin()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
  },
  preview: {
    host: true,
    port: 5173,
  },
});
