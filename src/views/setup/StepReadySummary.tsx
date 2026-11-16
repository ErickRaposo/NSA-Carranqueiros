import React from 'react';
import {
  Pause,
  Play,
  Sliders,
  Sparkles,
} from 'lucide-react';
import { AudioOutputMode, Lang, SyncNetworkMode, ViewRole } from '../../experience/types';
import {
  ADMIN_FOCUS,
  ADMIN_PANEL_CLASS,
  ADMIN_PRIMARY_PILL_CLASS,
} from '../admin/adminMeta';
import { ScreenScenario } from './setupTypes';

interface StepReadySummaryProps {
  lang: Lang;
  roomCode: string | null;
  syncNetworkMode: SyncNetworkMode;
  scenario: ScreenScenario;
  audioMode: AudioOutputMode;
  controllerConnected: boolean;
  isPlaying: boolean;
  onQuickSoundAndVisualTest: () => void;
  onNavigate: (view: ViewRole) => void;
}

const PRESS_TRANSITION =
  'transition-[transform,background-color,border-color,color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97]';

export const StepReadySummary: React.FC<StepReadySummaryProps> = ({
  lang,
  roomCode,
  syncNetworkMode,
  scenario,
  audioMode,
  controllerConnected,
  isPlaying,
  onQuickSoundAndVisualTest,
  onNavigate,
}) => {
  const isPt = lang === 'pt';

  const screenSummary =
    scenario === 0
      ? isPt
        ? '0 projetores (Tela direta)'
        : '0 projectors (Direct screen)'
      : scenario === 1
        ? isPt
          ? '1 projetor (Canto único)'
          : '1 projector (Single corner)'
        : scenario === 2
          ? isPt
            ? '2 projetores (Canto L + Teto)'
            : '2 projectors (L + Ceiling)'
          : isPt
            ? '3 projetores (Esq + Dir + Teto)'
            : '3 projectors (Left + Right + Ceiling)';

  const audioSummary =
    audioMode === 'hrtf'
      ? isPt
        ? 'Fone de Ouvido (8D Direto)'
        : 'Headphones (Direct 8D)'
      : isPt
        ? '3 Caixas (C1, C2 e C3)'
        : '3 Speakers (C1, C2, C3)';

  const controllerSummary = controllerConnected
    ? isPt
      ? 'Celular / Tablet Online'
      : 'Phone / Tablet Online'
    : scenario === 0
      ? isPt
        ? 'Controle direto neste PC'
        : 'PC direct control'
      : isPt
        ? 'Liberação em PC único'
        : 'Single-PC override';

  const roomSummary = roomCode
    ? `${roomCode} (${
        syncNetworkMode === 'cloud-room'
          ? isPt
            ? 'Nuvem'
            : 'Cloud'
          : syncNetworkMode === 'lan-ws'
            ? 'LAN'
            : 'Local'
      })`
    : isPt
      ? 'Local'
      : 'Local';

  const checklist = [
    {
      label: isPt ? 'Ambiente & Sala' : 'Language & Room',
      value: `${isPt ? 'Português' : 'English'} · ${roomSummary}`,
      ok: true,
    },
    {
      label: isPt ? 'Projeção' : 'Displays',
      value: screenSummary,
      ok: true,
    },
    {
      label: isPt ? 'Áudio 8D' : 'Spatial Audio',
      value: audioSummary,
      ok: true,
    },
    {
      label: isPt ? 'Controle' : 'Controller',
      value: controllerSummary,
      ok: controllerConnected || scenario === 0,
    },
  ];

  return (
    <div className="flex flex-col gap-5" data-testid="setup-step-ready">
      <section className={`setup-block-enter p-6 sm:p-8 lg:p-9 ${ADMIN_PANEL_CLASS}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-[64ch]">
            <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-slate-50 sm:text-[25px]">
              {isPt ? 'Sistema pronto para iniciar a experiência' : 'System ready to launch'}
            </h2>
            <p className="mt-2 text-sm leading-[1.6] text-slate-400 sm:text-[15px]">
              {isPt
                ? 'Valide som e visuais ou entre diretamente na tela de operação.'
                : 'Run a quick A/V check or launch directly into operation mode.'}
            </p>
          </div>

          <button
            type="button"
            onClick={onQuickSoundAndVisualTest}
            className={`inline-flex min-h-[42px] items-center gap-2 rounded-full border border-[#1e3a66] bg-[#060c1a] px-4 text-xs font-semibold text-white hover:border-[#2563eb] hover:bg-[#0c1a36] ${PRESS_TRANSITION} ${ADMIN_FOCUS}`}
          >
            {isPlaying ? <Pause size={13} /> : <Play size={13} />}
            <span>
              {isPlaying
                ? isPt
                  ? 'Pausar Teste'
                  : 'Pause Check'
                : isPt
                  ? 'Testar Som e Visuais'
                  : 'Test Sound & Visuals'}
            </span>
          </button>
        </div>

        <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {checklist.map((item) => (
            <div
              key={item.label}
              className={`flex flex-col justify-between rounded-xl border p-5 ${
                item.ok
                  ? 'border-[#2563eb]/65 bg-[#0c1a36]/70'
                  : 'border-amber-400/40 bg-amber-500/5'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-slate-400">
                  {item.label}
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1 text-xs font-semibold ${
                    item.ok
                      ? 'border-[#2563eb]/55 bg-[#0c1a36] text-slate-100'
                      : 'border-amber-400/40 bg-[#040b1a] text-amber-200'
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      item.ok ? 'bg-emerald-400' : 'bg-amber-300'
                    }`}
                    aria-hidden="true"
                  />
                  <span>{item.ok ? (isPt ? 'Ativo' : 'Ready') : isPt ? 'Manual' : 'Manual'}</span>
                </span>
              </div>
              <div className="mt-3 text-base font-semibold text-slate-100 [font-variant-numeric:tabular-nums]">
                {item.value}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-7 flex flex-wrap items-center gap-3 border-t border-[#1e3a66]/45 pt-5">
          {scenario === 0 ? (
            <>
              <button
                type="button"
                onClick={() => onNavigate('demo')}
                data-testid="btn-launch-demo"
                className={`inline-flex min-h-[46px] items-center gap-2 px-6 text-[13px] ${PRESS_TRANSITION} ${ADMIN_PRIMARY_PILL_CLASS} ${ADMIN_FOCUS}`}
              >
                <Sparkles size={14} />
                <span>{isPt ? 'Iniciar Experiência Agora' : 'Launch Experience Now'}</span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('admin')}
                data-testid="btn-open-admin"
                className={`inline-flex min-h-[46px] items-center gap-2 rounded-full border border-[#1e3a66] bg-[#060c1a] px-5 text-xs font-medium text-slate-200 hover:border-[#2563eb] hover:text-white ${PRESS_TRANSITION} ${ADMIN_FOCUS}`}
              >
                <Sliders size={13} />
                <span>{isPt ? 'Abrir Painel Técnico' : 'Open Control Desk'}</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => onNavigate('admin')}
                data-testid="btn-launch-admin"
                className={`inline-flex min-h-[46px] items-center gap-2 px-6 text-[13px] ${PRESS_TRANSITION} ${ADMIN_PRIMARY_PILL_CLASS} ${ADMIN_FOCUS}`}
              >
                <Sparkles size={14} />
                <span>
                  {isPt
                    ? 'Iniciar Sala & Abrir Painel Técnico'
                    : 'Start Room & Open Control Desk'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('demo')}
                data-testid="btn-launch-demo"
                className={`inline-flex min-h-[46px] items-center gap-2 rounded-full border border-[#1e3a66] bg-[#060c1a] px-5 text-xs font-medium text-slate-200 hover:border-[#2563eb] hover:text-white ${PRESS_TRANSITION} ${ADMIN_FOCUS}`}
              >
                <span>{isPt ? 'Abrir Modo Tela Única' : 'Open Single-Screen Mode'}</span>
              </button>
            </>
          )}
        </div>
      </section>
    </div>
  );
};
