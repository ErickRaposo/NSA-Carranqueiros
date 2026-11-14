import React, { useRef, useState } from 'react';
import { Contrast, ImagePlus, Volume2 } from 'lucide-react';
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
  const [bannerSrc, setBannerSrc] = useState<string>('/banner.png');
  const [bannerMissing, setBannerMissing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleBannerPreview = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setBannerSrc(url);
    setBannerMissing(false);
  };

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

      {/* Left Half: Space Canvas + Official Square Artwork Banner (1:1) */}
      <section
        aria-label="Área visual do portal EARTHSONG"
        className="relative z-10 flex w-full items-center justify-center p-6 sm:p-8 lg:w-1/2 lg:p-12"
      >
        <div
          className={`relative flex aspect-square w-full max-w-[460px] items-center justify-center overflow-hidden rounded-3xl border shadow-2xl backdrop-blur-sm ${
            highContrast
              ? 'border-2 border-[#facc15] bg-black'
              : 'border-[#1E3566] bg-[#07142E]/70'
          }`}
        >
          {!bannerMissing ? (
            <>
              <img
                src={bannerSrc}
                alt="Ilustração do astronauta EARTHSONG observando o planeta Terra com fluxos atmosféricos da NASA"
                onError={() => setBannerMissing(true)}
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={`absolute right-3 bottom-3 inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-[#38bdf8] ${
                  highContrast
                    ? 'border-[#facc15] bg-black text-[#facc15] hover:bg-[#1a1a00]'
                    : 'border-[#2C4B88]/80 bg-[#061024]/80 text-slate-200 hover:bg-[#102857]'
                }`}
                title="Testar outra imagem quadrada para o banner"
              >
                <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Trocar imagem</span>
              </button>
            </>
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center p-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[#26427A] bg-[#0D2149] text-slate-200">
                <ImagePlus className="h-8 w-8" aria-hidden="true" />
              </div>
              <p className="font-display mt-5 text-lg font-bold tracking-wide text-slate-100">
                Banner Quadrado (1:1)
              </p>
              <p className="mt-2 max-w-xs text-xs leading-relaxed text-slate-300">
                Selecione uma imagem quadrada para exibir aqui.
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-5 cursor-pointer rounded-full border border-[#2C4B88] bg-[#102857] px-4 py-2 text-xs font-semibold text-slate-100 transition hover:bg-[#173673]"
              >
                Escolher imagem do computador
              </button>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleBannerPreview}
            className="hidden"
            aria-label="Selecionar imagem para substituir o banner quadrado"
          />
        </div>
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
