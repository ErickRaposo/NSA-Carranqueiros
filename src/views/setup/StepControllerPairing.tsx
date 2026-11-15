import React from 'react';
import { Check, CheckCircle2, Cloud, Copy, ExternalLink, QrCode, Smartphone, Wifi } from 'lucide-react';
import { LanPeerInfo, SyncNetworkMode } from '../../experience/types';
import {
  ADMIN_FOCUS,
  ADMIN_PANEL_CLASS,
  ADMIN_WELL_CLASS,
} from '../admin/adminMeta';
import { ScreenScenario } from './setupTypes';

interface StepControllerPairingProps {
  isPt: boolean;
  scenario: ScreenScenario;
  roomCode: string | null;
  tabletUrl: string;
  tabletRelativeHref: string;
  qrModules: boolean[][];
  syncNetworkMode: SyncNetworkMode;
  lanClients: LanPeerInfo[];
  copiedKey: string | null;
  manualBypassConfirmed: boolean;
  onCopyText: (key: string, text: string) => void;
  onConfirmManualBypass: () => void;
  onSkipToReady: () => void;
}

export const StepControllerPairing: React.FC<StepControllerPairingProps> = ({
  isPt,
  scenario,
  roomCode,
  tabletUrl,
  tabletRelativeHref,
  qrModules,
  syncNetworkMode,
  lanClients,
  copiedKey,
  manualBypassConfirmed,
  onCopyText,
  onConfirmManualBypass,
  onSkipToReady,
}) => {
  const requiresMobileController = scenario > 0;
  const controllerConnected = lanClients.some((c) => c.role === 'controller');

  return (
    <div className="flex flex-col gap-5" data-testid="setup-step-controller">
      <section className={`p-5 ${ADMIN_PANEL_CLASS}`}>
        <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-12">
          {/* Coluna QR Code */}
          <div className="flex flex-col items-center lg:col-span-5">
            <div className="rounded-2xl border border-[#1e3a66]/55 bg-white p-4">
              <svg
                viewBox={`0 0 ${qrModules.length + 8} ${qrModules.length + 8}`}
                shapeRendering="crispEdges"
                className="h-52 w-52 sm:h-56 sm:w-56"
                role="img"
                aria-label="Mobile Controller QR Code"
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
            <span className="mt-2.5 inline-flex items-center gap-1.5 text-xs text-slate-400">
              <QrCode size={13} />
              <span>
                {isPt
                  ? 'Aponte a câmera do celular ou tablet'
                  : 'Scan with your phone or tablet camera'}
              </span>
            </span>
          </div>

          {/* Coluna Explicação + Status ao Vivo */}
          <div className="flex flex-col gap-4 lg:col-span-7">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide text-[#7dd3fc] uppercase">
                  <Smartphone size={14} />
                  <span>
                    {requiresMobileController
                      ? isPt
                        ? 'Passo 4 · Controle Obrigatório por Celular/Tablet'
                        : 'Step 4 · Required Mobile Remote Control'
                      : isPt
                        ? 'Passo 4 · Controle Opcional pelo Celular'
                        : 'Step 4 · Optional Phone Remote Control'}
                  </span>
                </span>

                {roomCode && (
                  <span className="rounded-full border border-[#2563eb]/55 bg-[#0c1a36] px-2.5 py-0.5 text-[11px] font-semibold tracking-wider text-[#7dd3fc] [font-variant-numeric:tabular-nums]">
                    {isPt ? `Sala ${roomCode}` : `Room ${roomCode}`}
                  </span>
                )}
              </div>

              <h2 className="mt-1 text-lg font-semibold text-slate-50">
                {requiresMobileController
                  ? isPt
                    ? 'Conecte o celular ou tablet que vai guiar a sala'
                    : 'Connect the phone or tablet that will guide the room'
                  : isPt
                    ? 'Quer controlar a viagem pelo celular?'
                    : 'Want to control the journey from your phone?'}
              </h2>

              <p className="mt-1 text-sm leading-relaxed text-slate-300">
                {requiresMobileController
                  ? isPt
                    ? 'No modo com projetores, as telas do computador ficam dedicadas às paredes. Escaneie o QR Code ao lado com seu celular ou tablet para entrar automaticamente nesta sala.'
                    : 'In projector mode, your computer displays are dedicated to the walls. Scan the QR Code with your phone or tablet to join this room automatically.'
                  : isPt
                    ? 'Você pode escanear o QR Code para transformar seu celular em um controle remoto interativo, ou pular esta etapa e usar o mouse no próprio computador.'
                    : 'Scan the QR Code to turn your phone into an interactive remote, or skip this step to control directly on your computer.'}
              </p>
            </div>

            {/* Status da Sala por Domínio + Código */}
            <div className={`flex items-start gap-2.5 p-3.5 text-xs leading-relaxed text-slate-200 ${ADMIN_WELL_CLASS}`}>
              {syncNetworkMode === 'cloud-room' ? (
                <Cloud size={15} className="mt-0.5 shrink-0 text-[#7dd3fc]" />
              ) : (
                <Wifi size={15} className="mt-0.5 shrink-0 text-[#7dd3fc]" />
              )}
              <span>
                {syncNetworkMode === 'cloud-room'
                  ? isPt
                    ? `Sincronia por código de sala (${roomCode ?? '—'}): o celular pode usar qualquer Wi-Fi ou 4G/5G — basta abrir o QR Code ou o link abaixo.`
                    : `Room-code sync (${roomCode ?? '—'}): your phone can be on any Wi-Fi or 4G/5G network — just scan the QR Code or open the link below.`
                  : isPt
                    ? 'Modo local sem nuvem configurada: abra o link abaixo no navegador ou configure o Supabase no .env para conectar celulares externos via código de sala.'
                    : 'Local mode without cloud configured: open the link below or configure Supabase in .env to pair external phones via room code.'}
              </span>
            </div>

            {/* Link copiável */}
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                readOnly
                value={tabletUrl}
                aria-label="Mobile Controller URL"
                className={`h-11 min-w-[220px] flex-1 rounded-xl border border-[#1e3a66] bg-[#0c1a36] px-3.5 text-xs text-slate-100 [font-variant-numeric:tabular-nums] ${ADMIN_FOCUS}`}
              />
              <button
                type="button"
                onClick={() => onCopyText('wiz-tablet', tabletUrl)}
                className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[#1e3a66] bg-[#060c1a] px-4 text-xs font-semibold text-slate-100 transition hover:border-[#2563eb] hover:text-white ${ADMIN_FOCUS}`}
              >
                {copiedKey === 'wiz-tablet' ? (
                  <Check size={14} className="text-[#7dd3fc]" />
                ) : (
                  <Copy size={14} />
                )}
                <span>{copiedKey === 'wiz-tablet' ? 'OK' : isPt ? 'Copiar Link' : 'Copy Link'}</span>
              </button>

              <a
                href={tabletRelativeHref}
                target="_blank"
                rel="noreferrer"
                className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[#1e3a66] bg-[#060c1a] px-4 text-xs font-medium text-slate-200 transition hover:border-[#2563eb] hover:text-white ${ADMIN_FOCUS}`}
              >
                <span>{isPt ? 'Testar em outra aba' : 'Test in new tab'}</span>
                <ExternalLink size={13} />
              </a>
            </div>

            {/* Indicador ao vivo de conexão */}
            {controllerConnected ? (
              <div
                data-testid="controller-connected-banner"
                className="flex items-center gap-2.5 rounded-xl border border-emerald-400/45 bg-emerald-500/15 px-4 py-3 text-sm font-semibold text-emerald-200"
              >
                <CheckCircle2 size={18} className="shrink-0 text-emerald-300" />
                <span>
                  {isPt
                    ? 'Celular / Tablet conectado na sala! Pode avançar.'
                    : 'Phone / Tablet connected to the room! Ready to continue.'}
                </span>
              </div>
            ) : requiresMobileController ? (
              <div className="flex flex-col gap-2 rounded-xl border border-amber-400/35 bg-amber-500/10 p-3.5 text-xs text-amber-100">
                <div className="flex items-center gap-2 font-semibold">
                  <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-amber-300" />
                  <span>
                    {isPt
                      ? 'Aguardando você abrir o QR Code no celular ou tablet...'
                      : 'Waiting for your phone or tablet to open the QR Code...'}
                  </span>
                </div>
                {!manualBypassConfirmed ? (
                  <button
                    type="button"
                    onClick={onConfirmManualBypass}
                    data-testid="btn-manual-controller-bypass"
                    className="self-start text-[11px] font-medium text-slate-300 underline underline-offset-2 hover:text-white"
                  >
                    {isPt
                      ? 'Estou apenas testando neste computador sem um segundo aparelho — liberar avanço'
                      : 'I am testing on this single computer without a second device — allow continue'}
                  </button>
                ) : (
                  <span className="text-[11px] text-emerald-200">
                    {isPt
                      ? 'Avanço liberado manualmente para teste em dispositivo único.'
                      : 'Manual single-device test override enabled.'}
                  </span>
                )}
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#1e3a66]/50 bg-[#060c1a] px-4 py-3 text-xs text-slate-300">
                <span>
                  {isPt
                    ? 'Sem celular agora? Sem problema: você pode controlar tudo direto na tela.'
                    : 'No phone right now? No problem — you can control everything right on screen.'}
                </span>
                <button
                  type="button"
                  onClick={onSkipToReady}
                  data-testid="btn-skip-controller"
                  className={`rounded-full border border-[#1e3a66] bg-[#0c1a36] px-3.5 py-1.5 text-xs font-semibold text-[#7dd3fc] hover:border-[#2563eb] hover:text-white ${ADMIN_FOCUS}`}
                >
                  {isPt ? 'Pular e usar só o PC' : 'Skip & use PC only'}
                </button>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
