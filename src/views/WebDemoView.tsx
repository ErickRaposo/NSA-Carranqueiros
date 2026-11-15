import React, { useState } from 'react';
import { Eye, Headphones, SlidersHorizontal } from 'lucide-react';
import { useExperience } from '../experience/ExperienceContext';
import { SimulatorView } from './SimulatorView';
import { TabletControllerView } from './TabletControllerView';

/**
 * Experiência Web Pública Unificada (`?view=demo` e rota padrão `/` na Vercel):
 * Combina a Maquete 3D do Quarto Projetado com o Controle estilo Tablet + Áudio 8D Binaural.
 */
export const WebDemoView: React.FC = () => {
  const { lang } = useExperience();
  const isPt = lang === 'pt';
  const [showRoomPreview, setShowRoomPreview] = useState(true);

  return (
    <main
      className="flex h-dvh w-screen flex-col overflow-hidden bg-[#060913] text-slate-50"
      data-testid="web-demo-view"
    >
      {/* Faixa superior compacta para visitantes/jurados da Vercel */}
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-400/15 bg-[#080d19] px-4 py-2">
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-bold tracking-wider text-slate-100 uppercase">
            Earth Jukebox
          </span>
          <span className="hidden items-center gap-1 rounded-full border border-sky-400/25 bg-sky-400/10 px-2.5 py-0.5 text-[11px] font-medium text-sky-300 sm:inline-flex">
            <Headphones size={12} />
            <span>
              {isPt
                ? 'Use fones para ouvir o Áudio 8D Espacial'
                : 'Use headphones for 8D Spatial Audio'}
            </span>
          </span>
        </div>

        <button
          type="button"
          onClick={() => setShowRoomPreview((v) => !v)}
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-slate-400/20 bg-white/[0.06] px-3 text-xs font-semibold text-slate-100 hover:bg-white/10"
        >
          {showRoomPreview ? <SlidersHorizontal size={13} /> : <Eye size={13} />}
          <span>
            {showRoomPreview
              ? isPt
                ? 'Expandir Controle Tablet'
                : 'Expand Tablet Controller'
              : isPt
                ? 'Mostrar Quarto 3D Projetado'
                : 'Show 3D Projected Room'}
          </span>
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col xl:flex-row">
        {showRoomPreview && (
          <div className="h-[36vh] shrink-0 border-b border-slate-400/15 xl:h-full xl:w-[44%] xl:border-r xl:border-b-0">
            <SimulatorView embedded={true} />
          </div>
        )}

        <div className="min-h-0 flex-1">
          <TabletControllerView embeddedInDemo={true} />
        </div>
      </div>
    </main>
  );
};
