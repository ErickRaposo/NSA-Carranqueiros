import React from 'react';
import { Eye, EyeOff, Pause, Play, RotateCcw, Sparkles, Square } from 'lucide-react';
import symbollLogo from '../../assets/symboll.png';
import { Lang } from '../../experience/types';
import { ADMIN_FOCUS, ADMIN_PRIMARY_PILL_CLASS } from './adminMeta';

interface CockpitHeaderProps {
  lang: Lang;
  isPlaying: boolean;
  globalBlackout: boolean;
  hasActiveTestsOrGrids: boolean;
  confirmResetArmed: boolean;
  onTogglePlayOrStart: () => void;
  onToggleBlackout: () => void;
  onStagePanic: () => void;
  onResetClick: () => void;
  onToggleLang: () => void;
  onOpenSetupWizard?: () => void;
}

export const CockpitHeader: React.FC<CockpitHeaderProps> = ({
  lang,
  isPlaying,
  globalBlackout,
  hasActiveTestsOrGrids,
  confirmResetArmed,
  onTogglePlayOrStart,
  onToggleBlackout,
  onStagePanic,
  onResetClick,
  onToggleLang,
  onOpenSetupWizard,
}) => {
  const isPt = lang === 'pt';

  return (
    <header className="flex min-h-[56px] shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#1e3a66]/55 bg-[#040b1a] px-4 py-2 lg:px-5">
      {/* Left: Technical Panel Brand */}
      <div className="flex items-center gap-2.5">
        <img src={symbollLogo} alt="" className="h-7 w-7 object-contain" aria-hidden="true" />
        <h1 className="font-['Orbitron','Poppins',sans-serif] text-sm font-bold tracking-[0.04em] text-slate-50">
          {isPt ? 'Painel Técnico' : 'Control Desk'}
        </h1>
      </div>

      {/* Right: Single Global Transport + Room Safety + Language */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onTogglePlayOrStart}
          className={`inline-flex min-h-[38px] items-center gap-1.5 px-4 text-xs ${ADMIN_PRIMARY_PILL_CLASS} ${ADMIN_FOCUS}`}
          title={isPt ? 'Atalho: Barra de Espaço' : 'Shortcut: Spacebar'}
        >
          {isPlaying ? <Pause size={13} /> : <Play size={13} />}
          <span>
            {isPlaying
              ? isPt
                ? 'Pausar'
                : 'Pause'
              : isPt
                ? 'Tocar 8D'
                : 'Play 8D'}
          </span>
        </button>

        {hasActiveTestsOrGrids && (
          <button
            type="button"
            onClick={onStagePanic}
            className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-full bg-rose-500 px-3.5 text-xs font-semibold text-white transition hover:bg-rose-400 ${ADMIN_FOCUS}`}
            title={
              isPt
                ? 'Atalho Esc · Para ruído e grades'
                : 'Shortcut Esc · Stops tests and grids'
            }
          >
            <Square size={12} />
            <span>{isPt ? 'Cortar Testes' : 'Stop Tests'}</span>
          </button>
        )}

        <button
          type="button"
          onClick={onToggleBlackout}
          className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-full border px-3.5 text-xs font-medium transition ${ADMIN_FOCUS} ${
            globalBlackout
              ? 'border-rose-400/60 bg-rose-500/20 text-rose-100'
              : 'border-[#1e3a66] bg-[#060c1a] text-slate-200 hover:border-[#2563eb] hover:text-white'
          }`}
          title={isPt ? 'Atalho B · Preto #000000' : 'Shortcut B · #000000'}
        >
          {globalBlackout ? <EyeOff size={13} /> : <Eye size={13} />}
          <span>Blackout</span>
        </button>

        <button
          type="button"
          onClick={onResetClick}
          className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-full border px-3.5 text-xs font-medium transition ${ADMIN_FOCUS} ${
            confirmResetArmed
              ? 'border-rose-400/60 bg-rose-500/20 text-rose-100'
              : 'border-[#1e3a66] bg-[#060c1a] text-slate-300 hover:border-[#2563eb] hover:text-white'
          }`}
          title={
            confirmResetArmed
              ? isPt
                ? 'Clique novamente para confirmar Reset completo'
                : 'Click again to confirm full reset'
              : isPt
                ? 'Reseta experiência para o próximo visitante · 2 cliques'
                : 'Reset for next visitor · click twice'
          }
        >
          <RotateCcw size={13} />
          <span>{confirmResetArmed ? (isPt ? 'Confirmar?' : 'Confirm?') : 'Reset'}</span>
        </button>

        {onOpenSetupWizard && (
          <button
            type="button"
            onClick={onOpenSetupWizard}
            className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-full border border-[#1e3a66] bg-[#060c1a] px-3.5 text-xs font-medium text-[#7dd3fc] transition hover:border-[#2563eb] hover:text-white ${ADMIN_FOCUS}`}
            title={
              isPt
                ? 'Voltar ao assistente guiado de configuração (?view=setup)'
                : 'Return to guided setup wizard (?view=setup)'
            }
          >
            <Sparkles size={13} />
            <span>{isPt ? 'Refazer Setup' : 'Re-run Setup'}</span>
          </button>
        )}

        <button
          type="button"
          onClick={onToggleLang}
          className={`inline-flex min-h-[38px] min-w-[64px] items-center justify-center rounded-full border border-[#1e3a66] bg-[#060c1a] px-3 text-xs font-semibold text-slate-200 transition hover:border-[#2563eb] hover:text-white ${ADMIN_FOCUS}`}
        >
          {isPt ? 'PT · BR' : 'EN · US'}
        </button>
      </div>
    </header>
  );
};
