import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { CountryFlagIcon } from '../components/CountryFlag';
import { useExperience } from '../experience/ExperienceContext';
import { SceneSurfaceProps, VISUAL_LAYER_ORDER } from '../experience/types';
import {
  CountryCultureCardData,
  resolveCountryCultureCard,
} from '../geo/countryCultureCard';
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
    playback,
    storyStep,
    selectCountry,
    setMissionPhase,
    nextStoryStep,
  } = useExperience();
  const isPt = lang === 'pt';
  const anySolo = layers.melody.solo || layers.chords.solo || layers.bass.solo;
  const [failedFlags, setFailedFlags] = useState<Record<string, boolean>>({});
  const [cultureCard, setCultureCard] = useState<CountryCultureCardData | null>(null);
  const [cultureImgFailed, setCultureImgFailed] = useState(false);

  const showCountryLayers = missionPhase === 'exploring' && Boolean(country) && storyStep > 0;
  const showMeteorsOnly = missionPhase === 'zero_g';
  const showFloatingFlags =
    missionPhase === 'idle' || missionPhase === 'exploring' || missionPhase === 'ended';

  useEffect(() => {
    if (!showCountryLayers || !country) {
      setCultureCard(null);
      return;
    }
    let cancelled = false;
    setCultureImgFailed(false);
    void resolveCountryCultureCard(country, lang).then((card) => {
      if (!cancelled) setCultureCard(card);
    });
    return () => {
      cancelled = true;
    };
  }, [country, lang, showCountryLayers]);

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
                  className={`ceiling-flag-float-${item.floatVariant} group absolute flex h-[96px] w-[96px] cursor-pointer items-center justify-center rounded-full border-2 bg-[#060913]/80 p-2 backdrop-blur-md transition-[border-color,transform,background-color] duration-300 hover:scale-110 hover:border-sky-300/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7dd3fc] ${
                    isSelected
                      ? 'border-sky-400 bg-sky-500/20 ring-4 ring-sky-400/50'
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
                      <span className="scale-[3.2]">
                        <CountryFlagIcon code={item.alpha2} />
                      </span>
                    )}
                  </span>
                </motion.button>
              );
            })}
        </div>
      ) : (
        <div className="relative z-10 flex h-full w-full items-center justify-center p-4">
          {/* Ações sutis das camadas da NASA no céu aberto do teto */}
          {isLayerVisible('temperature') && (
            <motion.div
              className="pointer-events-none absolute inset-12 rounded-full blur-3xl"
              style={{
                background:
                  'radial-gradient(circle, rgba(251,113,133,0.14) 0%, transparent 70%)',
              }}
              animate={{ opacity: [0.35, 0.7, 0.35] }}
              transition={{
                duration: Math.max(1.2, 120 / Math.max(60, playback.bpm)),
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          )}

          {isLayerVisible('wind') &&
            [18, 44, 74].map((topPct, idx) => (
              <motion.div
                key={`wind-streak-${topPct}`}
                className="pointer-events-none absolute left-0 h-[3px] w-44 rounded-full bg-gradient-to-r from-transparent via-sky-400/70 to-cyan-200/80"
                style={{ top: `${topPct}%` }}
                animate={{
                  x: ['-15%', '520%'],
                  opacity: [0, 0.35 + layers.wind.wetMix * 0.45, 0],
                }}
                transition={{
                  duration: Math.max(1.4, 3.8 - playback.windMeanSpeed * 0.14),
                  delay: idx * 0.6,
                  repeat: Infinity,
                  ease: 'linear',
                }}
              />
            ))}

          {isLayerVisible('chords') &&
            [0, 1].map((ringIdx) => (
              <motion.div
                key={`chord-ring-${ringIdx}`}
                className="pointer-events-none absolute rounded-full border-2 border-cyan-300/35"
                style={{
                  width: ringIdx === 0 ? '540px' : '740px',
                  height: ringIdx === 0 ? '540px' : '740px',
                }}
                animate={{
                  scale: [0.92, 1.06, 0.92],
                  opacity: [0.18, 0.5, 0.18],
                }}
                transition={{
                  duration: Math.max(1.2, (60 / Math.max(60, playback.bpm)) * (ringIdx === 0 ? 2 : 4)),
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />
            ))}

          {isLayerVisible('bass') &&
            [14, 30, 48, 66, 82].map((leftPct, idx) => (
              <motion.div
                key={`bass-rain-${leftPct}`}
                className="pointer-events-none absolute top-0 h-28 w-[3px] rounded-full bg-gradient-to-b from-transparent via-emerald-400/70 to-sky-300/80"
                style={{ left: `${leftPct}%` }}
                animate={{
                  y: ['-12%', '880%'],
                  opacity: [0, 0.72, 0],
                }}
                transition={{
                  duration: Math.max(1.1, 2.2 - idx * 0.15),
                  delay: idx * 0.35,
                  repeat: Infinity,
                  ease: 'linear',
                }}
              />
            ))}

          {isLayerVisible('melody') &&
            liveEvents
              .filter((ev) => ev.layer === 'melody' || ev.layer === 'sparkle')
              .map((ev, idx) => (
                <motion.span
                  key={`sky-flash-${idx}`}
                  initial={{ scale: 0.4, opacity: 0.9 }}
                  animate={{ scale: [0.8, 1.5, 0.9], opacity: [0.9, 0.25] }}
                  transition={{ duration: 0.35 }}
                  className="pointer-events-none absolute h-6 w-6 rounded-full bg-amber-300 shadow-[0_0_28px_rgba(251,191,36,0.9)]"
                  style={{
                    left: `${ev.source_x * 100}%`,
                    top: `${(1 - ev.source_y) * 100}%`,
                  }}
                />
              ))}

          {/* Somente o Card Cultural / Curiosidade com Foto Livre de Direitos Autorais e Referência Discreta */}
          {cultureCard && (
            <motion.aside
              key={cultureCard.countryId}
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              className="pointer-events-none flex w-[460px] max-w-[80%] flex-col overflow-hidden rounded-3xl border border-slate-400/25 bg-[#060c1a]/88 text-left shadow-[0_0_54px_rgba(0,0,0,0.85)]"
              data-testid="ceiling-country-culture-card"
            >
              {!cultureImgFailed && (
                <div className="relative h-[210px] w-full overflow-hidden bg-slate-950">
                  <img
                    src={cultureCard.imageUrl}
                    alt={isPt ? cultureCard.titlePt : cultureCard.titleEn}
                    className="h-full w-full object-cover"
                    onError={() => setCultureImgFailed(true)}
                  />
                  <span className="absolute top-3.5 left-3.5 rounded-full border border-sky-400/40 bg-[#050811]/85 px-3.5 py-1 text-[15px] font-semibold text-sky-200">
                    {isPt ? cultureCard.categoryPt : cultureCard.categoryEn}
                  </span>
                </div>
              )}

              <div className="flex flex-col gap-2.5 p-5">
                <div className="text-[22px] font-bold leading-tight text-slate-50">
                  {isPt ? cultureCard.titlePt : cultureCard.titleEn}
                </div>
                <p className="line-clamp-4 text-[17px] leading-snug text-slate-300">
                  {isPt ? cultureCard.curiosityPt : cultureCard.curiosityEn}
                </p>
                <div className="mt-1 truncate border-t border-slate-400/15 pt-2 text-[12px] leading-tight text-slate-500">
                  Ref: {cultureCard.sourceName} · {cultureCard.license} · {cultureCard.author}
                </div>
              </div>
            </motion.aside>
          )}
        </div>
      )}

      <SpaceshipLaunchOverlay surface="ceiling" phase={missionPhase} />
    </section>
  );
};
