import React from 'react';
import {
  Activity,
  Check,
  Cloud,
  Copy,
  Database,
  Lock,
  QrCode,
  RefreshCw,
  RotateCcw,
  Wifi,
} from 'lucide-react';
import { LanPeerInfo, SyncNetworkMode } from '../../experience/types';
import { isSupabaseRealtimeConfigured } from '../../lan/roomRealtimeClient';
import { ADMIN_FOCUS, ADMIN_PANEL_CLASS, ADMIN_WELL_CLASS, LanServerInfo } from './adminMeta';

interface NetworkModuleProps {
  isPt: boolean;
  lanInfo: LanServerInfo;
  tabletUrl: string;
  qrModules: boolean[][];
  copiedKey: string | null;
  lanClients: LanPeerInfo[];
  roomCode?: string | null;
  syncNetworkMode?: SyncNetworkMode;
  lanConnected?: boolean;
  onRegenerateRoomCode?: () => void;
  onCopyText: (key: string, text: string) => void;
  onRefreshLan: () => void;
}

export const NetworkModule: React.FC<NetworkModuleProps> = ({
  isPt,
  lanInfo,
  tabletUrl,
  qrModules,
  copiedKey,
  lanClients,
  roomCode,
  syncNetworkMode = 'lan-ws',
  lanConnected = false,
  onRegenerateRoomCode,
  onCopyText,
  onRefreshLan,
}) => {
  const cloudReady = isSupabaseRealtimeConfigured();

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      {/* Coluna Esquerda: Código da Sala + QR Pairing */}
      <div className="flex flex-col gap-4 lg:col-span-5">
        <section className={`flex flex-col gap-3.5 p-4 ${ADMIN_PANEL_CLASS}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold tracking-[-0.01em] text-slate-50">
              <QrCode size={16} className="text-slate-300" />
              <h2>
                {isPt
                  ? 'Sala Exclusiva & Pareamento Mobile'
                  : 'Dedicated Room & Mobile Pairing'}
              </h2>
            </div>

            {roomCode && (
              <span className="rounded-lg border border-[#2563eb]/55 bg-[#0c1a36] px-2.5 py-1 text-xs font-semibold tracking-wider text-[#7dd3fc] [font-variant-numeric:tabular-nums]">
                {roomCode}
              </span>
            )}
          </div>

          <div className={`flex flex-wrap items-center justify-between gap-2 p-3 ${ADMIN_WELL_CLASS}`}>
            <div className="flex items-center gap-2 text-xs">
              {syncNetworkMode === 'cloud-room' ? (
                <Cloud size={15} className={lanConnected ? 'text-emerald-400' : 'text-amber-300'} />
              ) : syncNetworkMode === 'lan-ws' ? (
                <Wifi size={15} className={lanConnected ? 'text-emerald-400' : 'text-sky-400'} />
              ) : (
                <Lock size={15} className="text-slate-400" />
              )}
              <div>
                <div className="font-semibold text-slate-100">
                  {syncNetworkMode === 'cloud-room'
                    ? isPt
                      ? `Sala Online (room=${roomCode ?? '—'})`
                      : `Cloud Room (room=${roomCode ?? '—'})`
                    : syncNetworkMode === 'lan-ws'
                      ? isPt
                        ? `LAN Local (/ws-earth-sync${roomCode ? ` · ${roomCode}` : ''})`
                        : `Local LAN (/ws-earth-sync${roomCode ? ` · ${roomCode}` : ''})`
                      : isPt
                        ? 'Isolado (Sem Sala)'
                        : 'Isolated (No Room)'}
                </div>
                <div className="text-[11px] text-slate-400">
                  {syncNetworkMode === 'cloud-room'
                    ? cloudReady
                      ? lanConnected
                        ? isPt
                          ? 'Conectado via HTTPS/WSS (Wi-Fi ou 4G/5G)'
                          : 'Connected via HTTPS/WSS (Wi-Fi or 4G/5G)'
                        : isPt
                          ? 'Conectando ao canal Realtime...'
                          : 'Connecting to Realtime channel...'
                      : isPt
                        ? 'Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY para sincronia na nuvem'
                        : 'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY for cloud sync'
                    : syncNetworkMode === 'lan-ws'
                      ? isPt
                        ? 'Sincronia offline direta na rede local'
                        : 'Direct offline sync on local network'
                      : isPt
                        ? 'Apenas abas locais deste navegador'
                        : 'Local browser tabs only'}
                </div>
              </div>
            </div>

            {onRegenerateRoomCode && (
              <button
                type="button"
                onClick={onRegenerateRoomCode}
                className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-[#1e3a66] bg-[#060c1a] px-3 text-xs font-medium text-slate-200 transition hover:border-[#2563eb] hover:text-white ${ADMIN_FOCUS}`}
              >
                <RotateCcw size={12} />
                <span>{isPt ? 'Gerar nova sala' : 'New room'}</span>
              </button>
            )}
          </div>

          <div className="mx-auto flex items-center justify-center rounded-xl border border-[#1e3a66]/55 bg-white p-3.5">
            <svg
              viewBox={`0 0 ${qrModules.length + 8} ${qrModules.length + 8}`}
              shapeRendering="crispEdges"
              className="h-40 w-40"
              role="img"
              aria-label="Tablet Controller QR Code"
            >
              <rect
                x={0}
                y={0}
                width={qrModules.length + 8}
                height={qrModules.length + 8}
                fill="#ffffff"
              />
              {qrModules.map((row, r) =>
                row.map((dark, c) =>
                  dark ? (
                    <rect
                      key={`${r}-${c}`}
                      x={c + 4}
                      y={r + 4}
                      width={1}
                      height={1}
                      fill="#000000"
                    />
                  ) : null
                )
              )}
            </svg>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={tabletUrl}
              className={`h-10 flex-1 rounded-xl border border-[#1e3a66] bg-[#0c1a36] px-3 text-xs text-slate-100 [font-variant-numeric:tabular-nums] ${ADMIN_FOCUS}`}
            />
            <button
              type="button"
              onClick={() => onCopyText('net-tablet', tabletUrl)}
              className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[#1e3a66] bg-[#060c1a] px-3.5 text-xs font-semibold text-slate-100 transition hover:border-[#2563eb] hover:text-white ${ADMIN_FOCUS}`}
            >
              {copiedKey === 'net-tablet' ? (
                <Check size={13} className="text-[#7dd3fc]" />
              ) : (
                <Copy size={13} />
              )}
              <span>{copiedKey === 'net-tablet' ? 'OK' : isPt ? 'Copiar' : 'Copy'}</span>
            </button>
          </div>
        </section>
      </div>

      {/* Coluna Direita: Barramento WS + Lote Global */}
      <div className="flex flex-col gap-4 lg:col-span-7">
        <section className={`p-4 ${ADMIN_PANEL_CLASS}`}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold tracking-[-0.01em] text-slate-50">
              <Activity size={16} className="text-slate-300" />
              <h2>
                {syncNetworkMode === 'cloud-room'
                  ? isPt
                    ? `Dispositivos na Sala · ${roomCode ?? 'Online'}`
                    : `Connected Room Peers · ${roomCode ?? 'Cloud'}`
                  : isPt
                    ? 'Dispositivos no Barramento · /ws-earth-sync'
                    : 'Connected Room Bus Nodes · /ws-earth-sync'}
              </h2>
            </div>
            <button
              type="button"
              onClick={onRefreshLan}
              className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-full border border-[#1e3a66] bg-[#060c1a] px-3.5 text-xs font-medium text-slate-200 transition hover:border-[#2563eb] hover:text-white ${ADMIN_FOCUS}`}
            >
              <RefreshCw size={12} />
              <span>{isPt ? 'Atualizar' : 'Refresh'}</span>
            </button>
          </div>

          {lanClients.length === 0 ? (
            <div className={`p-4 text-xs leading-relaxed text-slate-400 ${ADMIN_WELL_CLASS}`}>
              {syncNetworkMode === 'cloud-room'
                ? isPt
                  ? `Sala ${roomCode ?? ''} pronta. Assim que você abrir o QR Code no celular ou um projetor com &room=${roomCode ?? ''}, os aparelhos conectados aparecem aqui em tempo real.`
                  : `Room ${roomCode ?? ''} ready. Once a phone or projector opens with &room=${roomCode ?? ''}, active peers appear here live.`
                : isPt
                  ? 'Sincronização local ativa. Quando `npm run dev` ou `npm run preview` estiver rodando, os aparelhos conectados nesta sala aparecem aqui.'
                  : 'Local sync active. Connected room devices appear here when `npm run dev` or `npm run preview` is running.'}
            </div>
          ) : (
            <div className={`divide-y divide-[#1e3a66]/45 p-2 ${ADMIN_WELL_CLASS}`}>
              {lanClients.map((peer) => (
                <div
                  key={peer.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-2 text-xs [font-variant-numeric:tabular-nums]"
                >
                  <span className="inline-flex items-center gap-2 font-medium text-slate-100">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    <span>{peer.role}</span>
                  </span>
                  <span className="text-slate-300">{peer.ip}</span>
                  <span className="text-[11px] text-slate-400">{peer.id}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <details className={`p-4 ${ADMIN_PANEL_CLASS}`}>
          <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold text-slate-200 select-none">
            <span className="flex items-center gap-2">
              <Database size={15} className="text-slate-300" />
              <span>
                {isPt
                  ? 'Logs & Sistema · Lote Global ~177 Países'
                  : 'Logs & System · Global Batch ~177 Countries'}
              </span>
            </span>
            <span className="rounded-lg border border-[#1e3a66] bg-[#060c1a] px-2.5 py-0.5 text-xs font-semibold text-slate-200 [font-variant-numeric:tabular-nums]">
              {lanInfo.renderedCountryCount} / 177
            </span>
          </summary>

          <div className="mt-3 border-t border-[#1e3a66]/45 pt-3">
            <div className="h-1 w-full overflow-hidden rounded-full bg-[#1e293b]">
              <div
                className="h-full rounded-full bg-[#2563eb] transition-all duration-300"
                style={{
                  width: `${Math.min(100, Math.max(2, (lanInfo.renderedCountryCount / 177) * 100))}%`,
                }}
              />
            </div>

            <p className="mt-3 text-xs leading-relaxed text-slate-300">
              {isPt
                ? 'Os países piloto ativos Brasil 076 e Egito 818 estão prontos para validação no Simulador 3D. Para gerar o catálogo completo:'
                : 'Active pilot countries Brazil 076 and Egypt 818 are ready for 3D Simulator validation. To generate the full catalog:'}
            </p>

            <pre className="mt-2.5 overflow-x-auto rounded-xl border border-[#1e3a66]/60 bg-[#040b1a] px-3.5 py-2.5 text-xs text-slate-200 [font-variant-numeric:tabular-nums]">
              npm run gen:countries
            </pre>
          </div>
        </details>
      </div>
    </div>
  );
};
