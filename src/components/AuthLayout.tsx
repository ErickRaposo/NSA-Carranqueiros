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
      className={`relative flex min-h-screen w-full flex-col overflow-y-auto lg:flex-row ${
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
        aria-label="Área visual do portal EARTHSONG"
        className="relative z-10 flex w-full items-center justify-center p-6 sm:p-8 lg:w-1/2 lg:p-12"
      >
        <img
          src={symbollLogo}
          alt="Logo EARTHSONG"
          className={`h-auto w-full max-w-[380px] object-contain ${
            highContrast ? 'rounded-2xl border-2 border-[#facc15] p-2' : ''
          }`}
        />
      </section>

      {/* Right Half: Sober Dark Navy Form Panel + Accessibility Toolbar */}
      <main
        id="auth-main-panel"
        className={`relative z-10 flex w-full flex-1 flex-col items-center justify-center px-6 py-10 backdrop-blur-md lg:w-1/2 ${
          highContrast
            ? 'border-t-2 border-[#facc15] bg-black lg:border-t-0 lg:border-l-2'
            : 'border-t border-[#15284F] bg-[#061024]/90 lg:border-t-0 lg:border-l'
        }`}
      >
        {/* Accessibility quick toolbar on auth screen */}
        <div
          className="mb-6 flex flex-wrap items-center justify-center gap-2"
          role="group"
          aria-label="Recursos de acessibilidade da tela de entrada"
        >
          <button
            type="button"
            onClick={onSpeakScreen}
            className={`inline-flex min-h-[38px] cursor-pointer items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
              highContrast
                ? 'border-[#facc15] bg-black text-[#facc15] hover:bg-[#1a1a00]'
                : 'border-[#1C325E] bg-[#0B1936] text-slate-200 hover:border-[#38bdf8] hover:text-white'
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
            className={`inline-flex min-h-[38px] cursor-pointer items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
              highContrast
                ? 'border-[#facc15] bg-[#facc15] text-black'
                : 'border-[#1C325E] bg-[#0B1936] text-slate-200 hover:border-[#38bdf8] hover:text-white'
            }`}
            title="Ativar modo Alto Contraste (WCAG AAA)"
            data-testid="auth-contrast-btn"
          >
            <Contrast className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Contraste</span>
          </button>

          <button
            type="button"
            onClick={onCycleFontScale}
            className={`inline-flex min-h-[38px] cursor-pointer items-center rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
              highContrast
                ? 'border-[#facc15] bg-black text-[#facc15]'
                : 'border-[#1C325E] bg-[#0B1936] text-slate-200 hover:border-[#38bdf8] hover:text-white'
            }`}
            aria-label={`Tamanho de texto atual ${Math.round(fontScale * 100)} por cento`}
          >
            A+{Math.round(fontScale * 100)}%
          </button>
        </div>

        <div className="w-full max-w-[360px]">{children}</div>

        <span className="mt-8 text-xs font-medium text-slate-400">
          EARTHSONG · NASA Space Apps · v2.0.0
        </span>
      </main>
    </div>
  );
};
