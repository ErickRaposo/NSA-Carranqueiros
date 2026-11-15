import React, { useState } from 'react';
import {
  ArrowLeft,
  Columns2,
  Columns3,
  Headphones,
  SlidersHorizontal,
  Tablet,
  Volume2,
  VolumeX,
} from 'lucide-react';
import symbollLogo from '../assets/symboll.png';
import { useExperience } from '../experience/ExperienceContext';
import { CameraPresetId, SimulatorView } from './SimulatorView';
import { TabletControllerView } from './TabletControllerView';
import { ADMIN_FOCUS } from './admin/adminMeta';

export type DemoLayoutMode = 'split' | 'tablet' | 'room2d';

interface WebDemoViewProps {
  onBackToHub?: () => void;
  onOpenSetup?: () => void;
}

/**
 * Experiência Web Unificada (`?view=demo`):
 * Combina a Maquete 3D/2D do Quarto Projetado com o Controle estilo Tablet + Áudio 8D Binaural,
 * em um único header alinhado à identidade visual do Painel Técnico.
 */
export const WebDemoView: React.FC<WebDemoViewProps> = ({
  onBackToHub,
  onOpenSetup,
}) => {
  const { lang, setLang, voiceAutoEnabled, setVoiceAutoEnabled } = useExperience();
  const isPt = lang === 'pt';
  const [layoutMode, setLayoutMode] = useState<DemoLayoutMode>('split');
  const [roomPreset, setRoomPreset] = useState<CameraPresetId>('overview');

  const handleSelectLayout = (nextMode: DemoLayoutMode) => {
    setLayoutMode(nextMode);
    if (nextMode === 'room2d') {
      setRoomPreset('flat');
    } else if (nextMode === 'split' && roomPreset === 'flat') {
      setRoomPreset('overview');
    }
  };

  const handleBack = () => {
    if (onBackToHub) {
      onBackToHub();
      return;
    }
    // TODO(erick): apontar para a tela intermediária do Erick quando entrar no repositório
    if (typeof window !== 'undefined') {
      window.location.search = '?view=hub';
    }
  };

  const handleOpenSetup = () => {
    if (onOpenSetup) {
      onOpenSetup();
      return;
    }
    if (typeof window !== 'undefined') {
      window.location.search = '?view=setup';
    }
  };

  const showRoom = layoutMode !== 'tablet';
  const showTablet = layoutMode !== 'room2d';

  return (
    <main
      className="flex h-dvh w-screen flex-col overflow-hidden bg-[#060913] font-['Poppins',system-ui,sans-serif] text-slate-50"
      data-testid="web-demo-view"
    >
      {/* Header único alinhado à identidade visual do Painel Técnico (CockpitHeader) */}
      <header className="flex min-h-[56px] shrink-0 flex-wrap items-center justify-between gap-2.5 border-b border-[#1e3a66]/55 bg-[#040b1a] px-3.5 py-2 lg:px-5">
        {/* Esquerda: Seta Voltar (tela intermediária do Erick / Portal) + Marca + Áudio 8D */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleBack}
            data-testid="demo-back-btn"
            aria-label={
              isPt
                ? 'Voltar para seleção de painéis'
                : 'Back to panel hub'
            }
            title={
              isPt
                ? 'Voltar para seleção de painéis'
                : 'Back to panel hub'
            }
            className={`inline-flex min-h-[38px] min-w-[38px] cursor-pointer items-center justify-center rounded-full border border-[#1e3a66] bg-[#060c1a] text-slate-200 transition hover:border-[#2563eb] hover:text-white ${ADMIN_FOCUS}`}
          >
            <ArrowLeft size={16} aria-hidden="true" />
          </button>

          <img src={symbollLogo} alt="" className="h-7 w-7 object-contain" aria-hidden="true" />

          <h1 className="text-sm font-bold tracking-[0.04em] text-slate-50">
            {isPt ? 'Earth Jukebox · Demo' : 'Earth Jukebox · Demo'}
          </h1>

          <span className="hidden items-center gap-1.5 rounded-full border border-[#1e3a66] bg-[#060c1a] px-2.5 py-1 text-[11px] font-medium text-slate-300 lg:inline-flex">
            <Headphones size={12} className="text-[#7dd3fc]" aria-hidden="true" />
            <span>{isPt ? 'Fones · Áudio 8D' : 'Headphones · 8D'}</span>
          </span>
        </div>

        {/* Centro: Modos de Visualização (Dividido / Estender Tablet / Estender Simulação 2D) */}
        <div
          role="group"
          aria-label={isPt ? 'Modo de exibição da Demo' : 'Demo layout mode'}
          className="inline-flex items-center gap-1 rounded-full border border-[#1e3a66] bg-[#060c1a] p-1"
        >
          {(
            [
              {
                id: 'split',
                label: isPt ? 'Dividido' : 'Split',
                Icon: Columns2,
                testId: 'demo-mode-split',
              },
              {
                id: 'tablet',
                label: isPt ? 'Estender Tablet' : 'Full Tablet',
                Icon: Tablet,
                testId: 'demo-mode-tablet',
              },
              {
                id: 'room2d',
                label: isPt ? 'Simulação 2D' : '2D Simulation',
                Icon: Columns3,
                testId: 'demo-mode-room2d',
              },
            ] as const
          ).map(({ id, label, Icon, testId }) => {
            const active = layoutMode === id;
            return (
              <button
                key={id}
                type="button"
                data-testid={testId}
                aria-pressed={active}
                onClick={() => handleSelectLayout(id)}
                className={`inline-flex min-h-[34px] cursor-pointer items-center gap-1.5 rounded-full border px-3 text-xs transition ${ADMIN_FOCUS} ${
                  active
                    ? 'border-[#2563eb]/65 bg-[#0c1a36] font-semibold text-white'
                    : 'border-transparent text-slate-400 hover:text-slate-100'
                }`}
              >
                <Icon size={13} className={active ? 'text-[#7dd3fc]' : ''} aria-hidden="true" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>

        {/* Direita: Voz + Idioma + Painel Técnico */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setVoiceAutoEnabled(!voiceAutoEnabled)}
            data-testid="demo-voice-toggle"
            aria-pressed={voiceAutoEnabled}
            aria-label={
              voiceAutoEnabled
                ? isPt
                  ? 'Silenciar narração automática'
                  : 'Mute auto narration'
                : isPt
                  ? 'Ativar narração automática'
                  : 'Enable auto narration'
            }
            className={`inline-flex min-h-[38px] cursor-pointer items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition ${ADMIN_FOCUS} ${
              voiceAutoEnabled
                ? 'border-[#1e3a66] bg-[#060c1a] text-sky-200 hover:border-[#2563eb]'
                : 'border-rose-400/40 bg-rose-500/15 text-rose-200 hover:border-rose-400/70'
            }`}
          >
            {voiceAutoEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
            <span className="hidden sm:inline">
              {voiceAutoEnabled
                ? isPt
                  ? 'Voz: ON'
                  : 'Voice: ON'
                : isPt
                  ? 'Voz: OFF'
                  : 'Voice: OFF'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setLang(isPt ? 'en' : 'pt')}
            data-testid="demo-lang-toggle"
            aria-label={isPt ? 'Mudar idioma para Inglês' : 'Switch language to Portuguese'}
            className={`inline-flex min-h-[38px] min-w-[64px] cursor-pointer items-center justify-center rounded-full border border-[#1e3a66] bg-[#060c1a] px-3 text-xs font-semibold text-slate-200 transition hover:border-[#2563eb] hover:text-white ${ADMIN_FOCUS}`}
          >
            {isPt ? 'PT · BR' : 'EN · US'}
          </button>

          <button
            type="button"
            onClick={handleOpenSetup}
            data-testid="demo-setup-btn"
            aria-label={isPt ? 'Abrir Painel Técnico' : 'Open Control Desk'}
            title={isPt ? 'Abrir Painel Técnico' : 'Open Control Desk'}
            className={`inline-flex min-h-[38px] cursor-pointer items-center gap-1.5 rounded-full border border-[#1e3a66] bg-[#060c1a] px-3.5 text-xs font-semibold text-slate-200 transition hover:border-[#2563eb] hover:text-white ${ADMIN_FOCUS}`}
          >
            <SlidersHorizontal size={13} className="text-[#7dd3fc]" aria-hidden="true" />
            <span>{isPt ? 'Painel Técnico' : 'Control Desk'}</span>
          </button>
        </div>
      </header>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:flex-row">
        {showRoom && (
          <div
            className={
              layoutMode === 'room2d'
                ? 'h-full min-h-0 w-full min-w-0 flex-1'
                : 'h-1/2 min-h-0 w-full min-w-0 shrink-0 border-b border-[#1e3a66]/55 lg:h-full lg:w-1/2 lg:border-r lg:border-b-0'
            }
          >
            <SimulatorView
              embedded={true}
              preset={roomPreset}
              onPresetChange={setRoomPreset}
              hideBrandTitle={true}
            />
          </div>
        )}

        {showTablet && (
          <div
            className={
              layoutMode === 'tablet'
                ? 'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden'
                : 'flex h-1/2 min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden lg:h-full lg:w-1/2'
            }
          >
            <TabletControllerView embeddedInDemo={true} />
          </div>
        )}
      </div>
    </main>
  );
};
