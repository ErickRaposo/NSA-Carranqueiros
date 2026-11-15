import React from 'react';
import { useExperience } from '../experience/ExperienceContext';
import { LAYER_METAS, SceneSurfaceProps, VISUAL_LAYER_ORDER } from '../experience/types';

/**
 * Superfície Projetada — TETO (`ceiling` · Projetor 2):
 * As 5 camadas PNG (1024×1024, margem 8%) do país selecionado empilhadas estilo Photoshop
 * em tamanho gigante sobre `#000000` absoluto, reagindo aos Olhinhos, relâmpagos (`source_x`, `source_y`) e vento.
 * Propriedade criativa 100% livre da Shay (Pessoa 1).
 */
export const CeilingScene: React.FC<SceneSurfaceProps> = ({ renderContext }) => {
  const { country, lang, layers, liveEvents, playback, pngUrls } = useExperience();
  const isPt = lang === 'pt';
  const anySolo = layers.melody.solo || layers.chords.solo || layers.bass.solo;

  const isLayerVisible = (layerId: (typeof VISUAL_LAYER_ORDER)[number]): boolean => {
    if (!layers[layerId].enabled) return false;
    if (!anySolo) return true;
    if (layerId === 'melody' || layerId === 'chords' || layerId === 'bass') {
      return layers[layerId].solo;
    }
    return false;
  };

  return (
    <section
      className="relative flex h-full w-full items-center justify-center overflow-hidden bg-black p-4 text-slate-50 select-none"
      style={{ backgroundColor: '#000000' }}
      data-surface="ceiling"
      data-render-context={renderContext}
    >
      {/* Container quadrado 1:1 centralizado para os 5 PNGs 1024x1024 recortados do país */}
      <div className="relative aspect-square h-[86%] max-h-full max-w-full">
        {pngUrls &&
          VISUAL_LAYER_ORDER.map((layerId) => {
            if (!isLayerVisible(layerId)) return null;
            return (
              <img
                key={layerId}
                src={pngUrls[layerId]}
                alt=""
                className="pointer-events-none absolute inset-0 h-full w-full object-contain transition-opacity duration-200"
                style={{
                  mixBlendMode: 'screen',
                  opacity:
                    layerId === 'wind'
                      ? 0.45 + layers.wind.wetMix * 0.55
                      : layers[layerId].gain,
                }}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
            );
          })}

        {/* Pulsos ao vivo dos relâmpagos/notas georreferenciadas (source_x, source_y) */}
        {liveEvents.map((ev, idx) => (
          <span
            key={`${ev.layer}-${idx}`}
            className="pointer-events-none absolute rounded-full transition-all duration-150"
            style={{
              left: `${ev.source_x * 100}%`,
              top: `${(1 - ev.source_y) * 100}%`,
              width: ev.layer === 'sparkle' ? '14px' : '22px',
              height: ev.layer === 'sparkle' ? '14px' : '22px',
              transform: 'translate(-50%, -50%)',
              backgroundColor:
                ev.layer === 'melody' || ev.layer === 'sparkle'
                  ? '#fbbf24'
                  : ev.layer === 'chords'
                    ? '#fb923c'
                    : '#34d399',
              boxShadow:
                ev.layer === 'melody' || ev.layer === 'sparkle'
                  ? '0 0 20px rgba(251, 191, 36, 0.85)'
                  : 'none',
              opacity: 0.85,
            }}
          />
        ))}

        {/* Placeholder sutil visível enquanto os PNGs do país ainda não foram gerados no disco */}
        <div className="pointer-events-none absolute inset-x-0 bottom-2 flex flex-wrap items-center justify-center gap-2">
          {VISUAL_LAYER_ORDER.map((layerId) => {
            const meta = LAYER_METAS[layerId];
            const visible = isLayerVisible(layerId);
            return (
              <span
                key={layerId}
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-opacity"
                style={{
                  color: visible ? meta.accentHex : '#475569',
                  opacity: visible ? 0.9 : 0.25,
                }}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: meta.accentHex }}
                />
                {isPt ? meta.labelPt : meta.labelEn}
              </span>
            );
          })}
        </div>
      </div>

      {country && (
        <div className="pointer-events-none absolute top-4 left-5 text-xs font-medium text-slate-500 [font-variant-numeric:tabular-nums]">
          {isPt ? country.namePt : country.nameEn} · {playback.bpm} BPM
        </div>
      )}
    </section>
  );
};
