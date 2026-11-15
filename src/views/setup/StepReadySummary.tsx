import React from 'react';
import {
  CheckCircle2,
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
  ADMIN_WELL_CLASS,
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
        ? 'Sem projetor (Tela deste Computador / TV)'
        : 'No projector (Computer / TV screen)'
      : scenario === 1
        ? isPt
          ? '1 Projetor Grande-Angular (Canto 3D Isométrico)'
          : '1 Wide-Angle Projector (3D Isometric Corner)'
        : scenario === 2
          ? isPt
            ? '2 Projetores (Canto em L + Teto)'
            : '2 Projectors (L-Corner + Ceiling)'
          : isPt
            ? '3 Projetores (1 por Parede + Teto)'
            : '3 Projectors (1 per Wall + Ceiling)';

  const audioSummary =
    audioMode === 'hrtf'
      ? isPt
        ? 'Fone de Ouvido (8D Direto)'
        : 'Headphones (Direct 8D)'
      : isPt
        ? '3 Caixas na Sala (8D Simulado)'
        : '3 Room Speakers (Simulated 8D)';

  const controllerSummary = controllerConnected
    ? isPt
      ? 'Celular / Tablet conectado'
      : 'Phone / Tablet connected'
    : scenario === 0
      ? isPt
        ? 'Controle direto neste computador'
        : 'Controlled directly on this computer'
      : isPt
        ? 'Modo teste em computador único'
        : 'Single-computer test mode';

  const roomSummary = roomCode
    ? `${roomCode} (${
        syncNetworkMode === 'cloud-room'
          ? isPt
            ? 'Online'
            : 'Cloud'
          : syncNetworkMode === 'lan-ws'
            ? 'LAN'
            : 'Local'
      })`
    : isPt
      ? 'Navegador local'
      : 'Local browser';

  return (
    <div className="flex flex-col gap-5" data-testid="setup-step-ready">
      <section className={`p-6 ${ADMIN_PANEL_CLASS}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide text-emerald-300 uppercase">
              <CheckCircle2 size={15} />
              <span>{isPt ? 'Passo 5 · Tudo Configurado!' : 'Step 5 · All Set!'}</span>
            </span>
            <h2 className="mt-1 text-xl font-semibold text-slate-50">
              {isPt
                ? 'Sua experiência Earth Jukebox está pronta para começar'
                : 'Your Earth Jukebox experience is ready to launch'}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-300">
              {isPt
                ? 'Confira o resumo abaixo. Você pode testar o som e os visuais agora mesmo ou iniciar a experiência.'
                : 'Review your setup summary below. You can run a quick sound & visual check right now or launch the experience.'}
            </p>
          </div>

          <button
            type="button"
            onClick={onQuickSoundAndVisualTest}
            className={`inline-flex min-h-[44px] items-center gap-2 rounded-full border border-[#2563eb] bg-[#0c1a36] px-4 text-xs font-semibold text-white transition hover:bg-[#142850] ${ADMIN_FOCUS}`}
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} />}
            <span>
              {isPlaying
                ? isPt
                  ? 'Pausar Teste Rápido'
                  : 'Pause Quick Check'
                : isPt
                  ? 'Testar Som e Visuais'
                  : 'Test Sound & Visuals'}
            </span>
          </button>
        </div>

        {/* Grade de Resumo */}
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className={`p-3.5 ${ADMIN_WELL_CLASS}`}>
            <div className="text-[11px] font-medium text-slate-400 uppercase">
              {isPt ? 'Idioma & Sala' : 'Language & Room'}
            </div>
            <div className="mt-1 text-sm font-semibold text-slate-100 [font-variant-numeric:tabular-nums]">
              {isPt ? 'Português (BR)' : 'English (US)'} · {roomSummary}
            </div>
          </div>

          <div className={`p-3.5 ${ADMIN_WELL_CLASS}`}>
            <div className="text-[11px] font-medium text-slate-400 uppercase">
              {isPt ? 'Telas' : 'Displays'}
            </div>
            <div className="mt-1 text-sm font-semibold text-slate-100">{screenSummary}</div>
          </div>

          <div className={`p-3.5 ${ADMIN_WELL_CLASS}`}>
            <div className="text-[11px] font-medium text-slate-400 uppercase">
              {isPt ? 'Áudio Espacial' : 'Spatial Audio'}
            </div>
            <div className="mt-1 text-sm font-semibold text-slate-100">{audioSummary}</div>
          </div>

          <div className={`p-3.5 ${ADMIN_WELL_CLASS}`}>
            <div className="text-[11px] font-medium text-slate-400 uppercase">
              {isPt ? 'Controle' : 'Controller'}
            </div>
            <div className="mt-1 text-sm font-semibold text-slate-100">{controllerSummary}</div>
          </div>
        </div>

        {/* Botões Principais de Lançamento */}
        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-[#1e3a66]/45 pt-5">
          {scenario === 0 ? (
            <>
              <button
                type="button"
                onClick={() => onNavigate('demo')}
                data-testid="btn-launch-demo"
                className={`inline-flex min-h-[48px] items-center gap-2 px-6 text-sm ${ADMIN_PRIMARY_PILL_CLASS} ${ADMIN_FOCUS}`}
              >
                <Sparkles size={16} />
                <span>
                  {isPt ? 'Iniciar Experiência Agora' : 'Launch Experience Now'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('admin')}
                data-testid="btn-open-admin"
                className={`inline-flex min-h-[48px] items-center gap-2 rounded-full border border-[#1e3a66] bg-[#060c1a] px-5 text-sm font-medium text-slate-200 transition hover:border-[#2563eb] hover:text-white ${ADMIN_FOCUS}`}
              >
                <Sliders size={14} />
                <span>{isPt ? 'Abrir Painel Técnico' : 'Open Control Desk'}</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => onNavigate('admin')}
                data-testid="btn-launch-admin"
                className={`inline-flex min-h-[48px] items-center gap-2 px-6 text-sm ${ADMIN_PRIMARY_PILL_CLASS} ${ADMIN_FOCUS}`}
              >
                <Sparkles size={16} />
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
                className={`inline-flex min-h-[48px] items-center gap-2 rounded-full border border-[#1e3a66] bg-[#060c1a] px-5 text-sm font-medium text-slate-200 transition hover:border-[#2563eb] hover:text-white ${ADMIN_FOCUS}`}
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
