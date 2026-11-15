import React, { useState } from 'react';
import { motion } from 'motion/react';
import { CountryFlagIcon } from '../components/CountryFlag';
import { useExperience } from '../experience/ExperienceContext';
import { SceneSurfaceProps, VISUAL_LAYER_ORDER } from '../experience/types';
import { SpaceStarfield } from './SpaceStarfield';
import { SpaceshipLaunchOverlay } from './SpaceshipLaunchOverlay';

interface CeilingFlagOption {
  id: string;
  alpha2: string;
  namePt: string;
  nameEn: string;
  xPct: number;
  yPct: number;
  floatVariant: 'a' | 'b' | 'c';
  durationSec: number;
  delaySec: number;
}

const CEILING_FLAG_OPTIONS: CeilingFlagOption[] = [
  { id: '076', alpha2: 'BR', namePt: 'Brasil', nameEn: 'Brazil', xPct: 18, yPct: 16, floatVariant: 'a', durationSec: 17, delaySec: -2 },
  { id: '840', alpha2: 'US', namePt: 'Estados Unidos', nameEn: 'United States', xPct: 39, yPct: 12, floatVariant: 'b', durationSec: 20, delaySec: -5 },
  { id: '250', alpha2: 'FR', namePt: 'França', nameEn: 'France', xPct: 61, yPct: 15, floatVariant: 'c', durationSec: 18, delaySec: -8 },
  { id: '392', alpha2: 'JP', namePt: 'Japão', nameEn: 'Japan', xPct: 81, yPct: 21, floatVariant: 'a', durationSec: 21, delaySec: -3 },
  { id: '276', alpha2: 'DE', namePt: 'Alemanha', nameEn: 'Germany', xPct: 14, yPct: 43, floatVariant: 'b', durationSec: 18, delaySec: -11 },
  { id: '818', alpha2: 'EG', namePt: 'Egito', nameEn: 'Egypt', xPct: 33, yPct: 37, floatVariant: 'c', durationSec: 19, delaySec: -6 },
  { id: '356', alpha2: 'IN', namePt: 'Índia', nameEn: 'India', xPct: 75, yPct: 44, floatVariant: 'b', durationSec: 22, delaySec: -4 },
  { id: '484', alpha2: 'MX', namePt: 'México', nameEn: 'Mexico', xPct: 26, yPct: 65, floatVariant: 'a', durationSec: 20, delaySec: -7 },
  { id: '036', alpha2: 'AU', namePt: 'Austrália', nameEn: 'Australia', xPct: 49, yPct: 62, floatVariant: 'c', durationSec: 17, delaySec: -1 },
  { id: '710', alpha2: 'ZA', namePt: 'África do Sul', nameEn: 'South Africa', xPct: 71, yPct: 66, floatVariant: 'b', durationSec: 21, delaySec: -10 },
  { id: '620', alpha2: 'PT', namePt: 'Portugal', nameEn: 'Portugal', xPct: 39, yPct: 81, floatVariant: 'c', durationSec: 19, delaySec: -12 },
];

/**
 * Superfície Projetada — TETO (`ceiling` · Projetor 2):
 * - `boarding` / `countdown`: escotilha da nave + rastros de subida para o espaço.
 * - `idle` / `zero_g` / `ended` / `exploring` (sem país escolhido): arco do globo + bandeiras flutuantes.
 * - `exploring` (com país escolhido e `storyStep > 0`): os 5 PNGs empilhados estilo Photoshop + `liveEvents`.
 */
export const CeilingScene: React.FC<SceneSurfaceProps> = ({ renderContext }) => {
  const {
    country,
    lang,
    layers,
    liveEvents,
    missionPhase,
    pngUrls,
    storyStep,
    selectCountry,
    setMissionPhase,
    nextStoryStep,
  } = useExperience();
  const isPt = lang === 'pt';
  const anySolo = layers.melody.solo || layers.chords.solo || layers.bass.solo;
  const [failedFlags, setFailedFlags] = useState<Record<string, boolean>>({});

  const showCountryLayers = missionPhase === 'exploring' && Boolean(country) && storyStep > 0;
  const showMeteorsOnly = missionPhase === 'zero_g';
  const showFloatingFlags =
    missionPhase === 'idle' || missionPhase === 'exploring' || missionPhase === 'ended';

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
      className="relative flex h-full w-full items-center justify-center overflow-hidden bg-black p-4 select-none"
      style={{ backgroundColor: '#000000' }}
      data-surface="ceiling"
      data-render-context={renderContext}
    >
      <SpaceStarfield seedOffset={3} count={76} />

      {/* Continuação do Globo na borda esquerda do Teto */}
      <div
        className="pointer-events-none absolute top-1/2 -left-[38%] h-[135%] w-[62%] -translate-y-1/2 rounded-full border-r border-sky-400/35"
        style={{
          background:
            'radial-gradient(circle at 38% 50%, rgba(4, 13, 33, 0.92) 0%, rgba(7, 26, 62, 0.72) 52%, rgba(56, 189, 248, 0.22) 84%, transparent 100%)',
          boxShadow:
            'inset -18px 0 36px rgba(56, 189, 248, 0.22), 12px 0 48px rgba(56, 189, 248, 0.16)',
        }}
        aria-hidden="true"
      />

      {!showCountryLayers ? (
        <div className="relative z-10 h-full w-full">
          {/* Meteoros passando pelo espaço aberto quando a escotilha ejeta em Zero-G (sem bandeiras ainda) */}
          {showMeteorsOnly &&
            [
              { top: '16%', left: '12%', delay: 0.2, duration: 2.1 },
              { top: '42%', left: '28%', delay: 1.4, duration: 1.8 },
              { top: '26%', left: '54%', delay: 2.6, duration: 2.3 },
              { top: '64%', left: '20%', delay: 3.4, duration: 1.9 },
              { top: '52%', left: '66%', delay: 4.5, duration: 2.0 },
            ].map((m, idx) => (
              <motion.div
                key={`meteor-${idx}`}
                className="pointer-events-none absolute h-[2px] w-20 rounded-full"
                style={{
                  top: m.top,
                  left: m.left,
                  background:
                    'linear-gradient(90deg, transparent 0%, rgba(125,211,252,0.75) 60%, #ffffff 100%)',
                  boxShadow: '0 0 12px rgba(125, 211, 252, 0.85)',
                  rotate: '22deg',
                }}
                initial={{ opacity: 0, x: -90, y: -35 }}
                animate={{ opacity: [0, 1, 0], x: 260, y: 105 }}
                transition={{
                  duration: m.duration,
                  delay: m.delay,
                  repeat: Infinity,
                  repeatDelay: 2.4,
                  ease: 'easeOut',
                }}
              />
            ))}

          {showFloatingFlags &&
            CEILING_FLAG_OPTIONS.map((item, idx) => {
              const isSelected = country?.id === item.id;
              const countryName = isPt ? item.namePt : item.nameEn;
              const useFallback = Boolean(failedFlags[item.alpha2]);

              return (
                <motion.button
                  key={item.id}
                  type="button"
                  aria-label={countryName}
                  title={countryName}
                  initial={
                    missionPhase === 'exploring'
                      ? { opacity: 0, scale: 0.25, y: -36 }
                      : { opacity: 1, scale: 1, y: 0 }
                  }
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{
                    duration: 0.75,
                    delay: missionPhase === 'exploring' ? idx * 0.06 : 0,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  onClick={() => {
                    selectCountry(item.id);
                    if (missionPhase !== 'exploring') {
                      setMissionPhase('exploring');
                    }
                    if (storyStep === 0) nextStoryStep();
                  }}
                  style={{
                    left: `${item.xPct}%`,
                    top: `${item.yPct}%`,
                    animationDuration: `${item.durationSec}s`,
                    animationDelay: `${item.delaySec}s`,
                  }}
                  className={`ceiling-flag-float-${item.floatVariant} group absolute flex h-11 w-11 min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-full border bg-[#060913]/80 p-1 backdrop-blur-md transition-[border-color,transform,background-color] duration-300 hover:scale-110 hover:border-sky-300/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7dd3fc] sm:h-12 sm:w-12 ${
                    isSelected
                      ? 'border-sky-400 bg-sky-500/20 ring-2 ring-sky-400/50'
                      : 'border-slate-700/60'
                  }`}
                >
                  <span className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-slate-950/90">
                    {!useFallback ? (
                      <img
                        src={`https://flagcdn.com/w160/${item.alpha2.toLowerCase()}.png`}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover"
                        onError={() =>
                          setFailedFlags((prev) => ({ ...prev, [item.alpha2]: true }))
                        }
                      />
                    ) : (
                      <span className="scale-[1.6]">
                        <CountryFlagIcon code={item.alpha2} />
                      </span>
                    )}
                  </span>
                </motion.button>
              );
            })}
        </div>
      ) : (
        <div className="relative z-10 aspect-square h-[88%] max-h-full max-w-full">
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
        </div>
      )}

      <SpaceshipLaunchOverlay surface="ceiling" phase={missionPhase} />
    </section>
  );
};
