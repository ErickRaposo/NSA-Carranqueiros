import React from 'react';
import { Contrast, Volume2 } from 'lucide-react';
import symbollLogo from '../assets/symboll.png';
import { StarfieldBackground } from './StarfieldBackground';

interface AuthLayoutProps {
  children: React.ReactNode;
  highContrast: boolean;
  onToggleHighContrast: () => void;
  fontScale: number;
  onCycleFontScale: () => void;
  onSpeakScreen: () => void;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({
  children,
  highContrast,
  onToggleHighContrast,
  fontScale,
  onCycleFontScale,
  onSpeakScreen,
}) => {
  return (
    <div
      style={{ fontSize: `${Math.round(fontScale * 100)}%` }}
      className={`relative flex h-screen w-full flex-col overflow-hidden lg:flex-row ${
        highContrast
          ? 'bg-black text-white'
          : 'bg-gradient-to-br from-[#030816] via-[#07142E] to-[#040B1C] text-slate-100'
      }`}
    >
      <a href="#auth-main-panel" className="skip-link">
        Pular para o formulário de acesso
      </a>

      {/* Moving deep-space starfield across the background */}
      {!highContrast && <StarfieldBackground />}

      {/* Left Half: Space Canvas + Logo Symboll directly over background */}
      <section
        aria-label="Identidade visual"
        className="relative z-10 hidden w-full items-center justify-center p-6 sm:p-8 lg:flex lg:w-1/2 lg:p-12"
      >
        <img
          src={symbollLogo}
          alt="Símbolo do sistema"
          className="h-auto w-full max-w-[380px] object-contain"
        />
      </section>

      {/* Right Half: Sober Dark Navy Form Panel + Accessibility Toolbar */}
      <main
        id="auth-main-panel"
        className={`relative z-10 flex w-full flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-8 shadow-[-12px_0_32px_rgba(0,0,0,0.55)] lg:w-1/2 ${
          highContrast ? 'bg-black' : 'bg-[#071126]/95'
        }`}
      >
        {/* Accessibility quick toolbar on auth screen */}
        <div
          className="mb-5 flex flex-wrap items-center justify-center gap-2"
          role="group"
          aria-label="Recursos de acessibilidade da tela de entrada"
        >
          <button
            type="button"
            onClick={onSpeakScreen}
            className={`inline-flex min-h-[36px] cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium shadow-sm transition ${
              highContrast
                ? 'bg-zinc-900 text-white hover:bg-zinc-800'
                : 'bg-[#0f2042] text-slate-200 hover:bg-[#172d59] hover:text-white'
            }`}
            title="Ouvir instruções de acesso em português"
          >
            <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Ouvir tela</span>
          </button>

          <button
            type="button"
            onClick={onToggleHighContrast}
            aria-pressed={highContrast}
            className={`inline-flex min-h-[36px] cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium shadow-sm transition ${
              highContrast
                ? 'bg-white text-black'
                : 'bg-[#0f2042] text-slate-200 hover:bg-[#172d59] hover:text-white'
            }`}
            title="Ativar modo Alto Contraste"
            data-testid="auth-contrast-btn"
          >
            <Contrast className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Contraste</span>
          </button>

          <button
            type="button"
            onClick={onCycleFontScale}
            className={`inline-flex min-h-[36px] cursor-pointer items-center rounded-lg px-3 py-1.5 text-xs font-medium shadow-sm transition ${
              highContrast
                ? 'bg-zinc-900 text-white hover:bg-zinc-800'
                : 'bg-[#0f2042] text-slate-200 hover:bg-[#172d59] hover:text-white'
            }`}
            aria-label={`Tamanho de texto atual ${Math.round(fontScale * 100)} por cento`}
          >
            A+{Math.round(fontScale * 100)}%
          </button>
        </div>

        <div className="w-full max-w-[360px]">{children}</div>

        <span className="mt-6 text-xs font-medium text-slate-400">
          NASA Space Apps
        </span>
      </main>
    </div>
  );
};
