import React, { useMemo } from 'react';
import { Activity, Check, Copy, Database, QrCode, RefreshCw } from 'lucide-react';
import { LanPeerInfo } from '../../experience/types';
import { AdminSelect } from './AdminSelect';
import { ADMIN_FOCUS, ADMIN_PANEL_CLASS, ADMIN_WELL_CLASS, LanServerInfo } from './adminMeta';

interface NetworkModuleProps {
  isPt: boolean;
  lanInfo: LanServerInfo;
  selectedHostIp: string;
  tabletUrl: string;
  qrModules: boolean[][];
  copiedKey: string | null;
  lanClients: LanPeerInfo[];
  onSetSelectedHostIp: (ip: string) => void;
  onCopyText: (key: string, text: string) => void;
  onRefreshLan: () => void;
}

export const NetworkModule: React.FC<NetworkModuleProps> = ({
  isPt,
  lanInfo,
  selectedHostIp,
  tabletUrl,
  qrModules,
  copiedKey,
  lanClients,
  onSetSelectedHostIp,
  onCopyText,
  onRefreshLan,
}) => {
  const ipOptions = useMemo(
    () =>
      lanInfo.lanIps.map((ip) => ({
        value: ip,
        label: `${ip}:${lanInfo.port}`,
      })),
    [lanInfo.lanIps, lanInfo.port]
  );

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      {/* Coluna Esquerda: QR Pairing + Receptores LAN */}
      <div className="flex flex-col gap-4 lg:col-span-5">
        <section className={`flex flex-col gap-3.5 p-4 ${ADMIN_PANEL_CLASS}`}>
          <div className="flex items-center gap-2 text-sm font-semibold tracking-[-0.01em] text-slate-50">
            <QrCode size={16} className="text-slate-300" />
            <h2>
              {isPt
                ? 'Pareamento Offline do Tablet · Wi-Fi LAN'
                : 'Offline Tablet Pairing · Wi-Fi LAN'}
            </h2>
          </div>

          <div className="mx-auto flex items-center justify-center rounded-xl border border-[#1e3a66]/55 bg-white p-3.5">
            <svg
              viewBox={`0 0 ${qrModules.length + 4} ${qrModules.length + 4}`}
              className="h-40 w-40"
              role="img"
              aria-label="Tablet Controller QR Code"
            >
              <rect
                x={0}
                y={0}
                width={qrModules.length + 4}
                height={qrModules.length + 4}
                fill="#ffffff"
              />
              {qrModules.map((row, r) =>
                row.map((dark, c) =>
                  dark ? (
                    <rect
                      key={`${r}-${c}`}
                      x={c + 2}
                      y={r + 2}
                      width={1}
                      height={1}
                      fill="#060913"
                    />
                  ) : null
                )
              )}
            </svg>
          </div>

          {lanInfo.lanIps.length > 0 && (
            <div className="flex flex-col gap-1.5 text-xs text-slate-300">
              <span>{isPt ? 'IP da Placa Wi-Fi deste PC' : 'Master PC Wi-Fi IP'}</span>
              <AdminSelect
                ariaLabel="Master PC Wi-Fi IP"
                value={selectedHostIp}
                options={ipOptions}
                onChange={onSetSelectedHostIp}
              />
            </div>
          )}

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
                {isPt
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
              {isPt
                ? 'Sincronização local BroadcastChannel ativa. Quando `npm run dev` estiver rodando, os nós da rede Wi-Fi aparecem aqui.'
                : 'Local BroadcastChannel sync active. Wi-Fi LAN nodes appear here when `npm run dev` is running.'}
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
