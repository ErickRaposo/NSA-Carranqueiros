import React from 'react';
import {
  Check,
  CheckCircle2,
  Cloud,
  Copy,
  ExternalLink,
  QrCode,
  Wifi,
} from 'lucide-react';
import { LanPeerInfo, SyncNetworkMode } from '../../experience/types';
import {
  ADMIN_CARD_CLASS,
  ADMIN_FOCUS,
  ADMIN_PANEL_CLASS,
  ADMIN_WELL_CLASS,
} from '../admin/adminMeta';
import { NextBlockTeaser } from './NextBlockTeaser';
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

const PRESS_TRANSITION =
  'transition-[transform,background-color,border-color,color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97]';

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
    <div className="flex flex-col gap-3.5" data-testid="setup-step-controller">
      <section className={`setup-block-enter p-5 sm:p-6 ${ADMIN_PANEL_CLASS}`}>
        <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-12">
          {/* Coluna QR Code */}
          <div className="flex flex-col items-center lg:col-span-5">
            <div className="rounded-xl border border-[#1e3a66]/55 bg-white p-3.5">
              <svg
                viewBox={`0 0 ${qrModules.length + 8} ${qrModules.length + 8}`}
                shapeRendering="crispEdges"
                className="h-48 w-48 sm:h-52 sm:w-52"
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
                  ? 'Leia com a câmera do celular ou tablet'
                  : 'Scan with phone or tablet camera'}
              </span>
            </span>
          </div>

          {/* Coluna Pareamento + Status */}
          <div className="flex flex-col gap-3.5 lg:col-span-7">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-semibold tracking-[-0.015em] text-slate-50 sm:text-lg">
                  {requiresMobileController
                    ? isPt
                      ? 'Pareie o Controle Obrigatório da sala'
                      : 'Pair the Required Room Controller'
                    : isPt
                      ? 'Pareie um celular como controle ou pule esta etapa'
                      : 'Pair a phone as remote control or skip'}
                </h2>

                {roomCode && (
                  <span className="rounded-md bg-[#1d4ed8]/35 px-2.5 py-0.5 font-mono text-xs font-semibold tracking-wider text-[#7dd3fc] [font-variant-numeric:tabular-nums]">
                    {roomCode}
                  </span>
                )}
              </div>

              <p className="mt-1 max-w-[60ch] text-xs leading-[1.55] text-slate-400 sm:text-[13px]">
                {requiresMobileController
                  ? isPt
                    ? 'As janelas do computador ficam nas paredes; use o celular ou tablet para guiar a viagem.'
                    : 'Computer displays stay on the walls; use your phone or tablet to guide the room.'
                  : isPt
                    ? 'Opcional no modo tela única: controle pelo celular ou direto pelo mouse.'
                    : 'Optional in single-screen mode: control via phone or desktop mouse.'}
              </p>
            </div>

            <div className={`flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-slate-300 ${ADMIN_WELL_CLASS}`}>
              {syncNetworkMode === 'cloud-room' ? (
                <Cloud size={14} className="shrink-0 text-[#7dd3fc]" />
              ) : (
                <Wifi size={14} className="shrink-0 text-[#7dd3fc]" />
              )}
              <span>
                {syncNetworkMode === 'cloud-room'
                  ? isPt
                    ? `Sala ${roomCode ?? '—'} via nuvem: funciona em qualquer Wi-Fi ou 4G/5G.`
                    : `Cloud room ${roomCode ?? '—'}: works across any Wi-Fi or 4G/5G network.`
                  : isPt
                    ? 'Rede local: mantenha celular e computador no mesmo Wi-Fi.'
                    : 'Local network: keep phone and computer on the same Wi-Fi.'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                readOnly
                value={tabletUrl}
                aria-label="Mobile Controller URL"
                className={`h-11 min-w-[200px] flex-1 rounded-xl border border-[#1e3a66] bg-[#0c1a36] px-3 font-mono text-xs text-slate-100 [font-variant-numeric:tabular-nums] ${ADMIN_FOCUS}`}
              />
              <button
                type="button"
                onClick={() => onCopyText('wiz-tablet', tabletUrl)}
                className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[#1e3a66] bg-[#060c1a] px-3.5 text-xs font-semibold text-slate-100 hover:border-[#2563eb] hover:text-white ${PRESS_TRANSITION} ${ADMIN_FOCUS}`}
              >
                {copiedKey === 'wiz-tablet' ? (
                  <Check size={13} className="text-[#7dd3fc]" />
                ) : (
                  <Copy size={13} />
                )}
                <span>{copiedKey === 'wiz-tablet' ? 'OK' : isPt ? 'Copiar' : 'Copy'}</span>
              </button>

              <a
                href={tabletRelativeHref}
                target="_blank"
                rel="noreferrer"
                className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[#1e3a66] bg-[#060c1a] px-3.5 text-xs font-medium text-slate-200 hover:border-[#2563eb] hover:text-white ${PRESS_TRANSITION} ${ADMIN_FOCUS}`}
              >
                <span>{isPt ? 'Abrir aba' : 'Open tab'}</span>
                <ExternalLink size={12} />
              </a>
            </div>

            {controllerConnected ? (
              <div
                data-testid="controller-connected-banner"
                className="flex items-center gap-2.5 rounded-xl border border-emerald-400/45 bg-emerald-500/15 px-4 py-3 text-xs font-semibold text-emerald-200"
              >
                <CheckCircle2 size={16} className="shrink-0 text-emerald-300" />
                <span>
                  {isPt
                    ? 'Controle conectado na sala. Pode continuar.'
                    : 'Remote controller connected to room. Ready to continue.'}
                </span>
              </div>
            ) : requiresMobileController ? (
              <div className="flex flex-col gap-2 rounded-xl border border-amber-400/35 bg-amber-500/10 px-4 py-3 text-xs text-amber-100">
                <div className="flex items-center gap-2 font-semibold">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-amber-300" />
                  <span>
                    {isPt
                      ? 'Aguardando leitura do QR Code no celular ou tablet...'
                      : 'Waiting for phone or tablet to scan QR Code...'}
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
                      ? 'Testando em PC único sem segundo aparelho — liberar avanço'
                      : 'Testing on single computer without phone — allow continue'}
                  </button>
                ) : (
                  <span className="text-[11px] text-emerald-200">
                    {isPt
                      ? 'Liberação manual ativa para teste em computador único.'
                      : 'Single-device manual override active.'}
                  </span>
                )}
              </div>
            ) : (
              <div className={`flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-xs text-slate-300 ${ADMIN_CARD_CLASS}`}>
                <span>
                  {isPt
                    ? 'Sem celular no momento? Controle tudo direto nesta tela.'
                    : 'No phone right now? Control everything on this screen.'}
                </span>
                <button
                  type="button"
                  onClick={onSkipToReady}
                  data-testid="btn-skip-controller"
                  className={`rounded-full border border-[#1e3a66] bg-[#0c1a36] px-3.5 py-2 text-xs font-semibold text-[#7dd3fc] hover:border-[#2563eb] hover:text-white ${PRESS_TRANSITION} ${ADMIN_FOCUS}`}
                >
                  {isPt ? 'Pular e usar só o PC' : 'Skip & use PC only'}
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      <NextBlockTeaser
        title={isPt ? 'Revisão final e início da operação' : 'Final review & launch'}
        subtitle={
          isPt
            ? 'Confira o resumo completo da instalação, teste som/visuais e abra a sala.'
            : 'Review your full setup summary, test A/V, and start the experience.'
        }
        slotCount={3}
      />
    </div>
  );
};
