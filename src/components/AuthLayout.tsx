import React, { useRef, useState } from 'react';
import { ImagePlus } from 'lucide-react';
import { StarfieldBackground } from './StarfieldBackground';

interface AuthLayoutProps {
  children: React.ReactNode;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ children }) => {
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
    <div className="relative flex min-h-screen w-full flex-col overflow-hidden bg-gradient-to-br from-[#030816] via-[#07142E] to-[#040B1C] lg:flex-row">
      {/* Moving deep-space starfield across the background */}
      <StarfieldBackground />

      {/* Left Half: Space Canvas + Square Banner Slot (1:1) */}
      <section
        aria-label="Área visual de apresentação"
        className="relative z-10 flex w-full items-center justify-center p-8 lg:w-1/2 lg:p-12"
      >
        {/* Square Banner Container (1:1) */}
        <div className="relative flex aspect-square w-full max-w-[460px] items-center justify-center overflow-hidden rounded-3xl border border-[#1E3566] bg-[#07142E]/70 shadow-2xl backdrop-blur-sm">
          {!bannerMissing ? (
            <img
              src={bannerSrc}
              alt="Banner do sistema"
              onError={() => setBannerMissing(true)}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center p-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[#26427A] bg-[#0D2149] text-slate-200">
                <ImagePlus className="h-8 w-8" />
              </div>
              <p className="font-display mt-5 text-lg font-bold tracking-wide text-slate-100">
                Espaço do Banner Quadrado (1:1)
              </p>
              <p className="mt-2 max-w-xs text-xs leading-relaxed text-slate-300/80">
                Salve sua arte em{' '}
                <code className="rounded bg-[#0D2149] px-1.5 py-0.5 text-slate-100">
                  public/banner.png
                </code>{' '}
                ou clique abaixo para testar uma imagem agora.
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-5 cursor-pointer rounded-full border border-[#2C4B88] bg-[#102857] px-4 py-2 text-xs font-semibold text-slate-100 transition hover:bg-[#173673]"
              >
                Testar imagem do computador
              </button>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleBannerPreview}
            className="hidden"
            aria-label="Selecionar imagem para testar no banner quadrado"
          />
        </div>
      </section>

      {/* Right Half: Sober Dark Navy Form Panel (No Neon) */}
      <main className="relative z-10 flex w-full flex-1 flex-col items-center justify-center border-t border-[#15284F] bg-[#061024]/90 px-6 py-12 backdrop-blur-md lg:w-1/2 lg:border-t-0 lg:border-l">
        <div className="w-full max-w-[340px]">{children}</div>

        <span className="absolute right-4 bottom-3 text-[11px] font-medium text-slate-500">
          v1.0.0
        </span>
      </main>
    </div>
  );
};
