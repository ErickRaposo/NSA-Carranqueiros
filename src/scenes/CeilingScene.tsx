import React from 'react';
import { motion } from 'motion/react';
import { buildCountryNasaReport } from '../datasets/countryNasaReport';
import { useExperience } from '../experience/ExperienceContext';
import { SceneSurfaceProps, VISUAL_LAYER_ORDER } from '../experience/types';
import { SpaceStarfield } from './SpaceStarfield';
import { SpaceshipLaunchOverlay } from './SpaceshipLaunchOverlay';

interface CeilingFlagOption {
  id: string;
  alpha2: string;
  namePt: string;
  nameEn: string;
  orbitRing: 0 | 1 | 2;
}

interface OrbitRingSpec {
  radiusCqmin: number;
  sizePx: number;
  durationSec: number;
  direction: 'cw' | 'ccw';
}

const ORBIT_RINGS: readonly OrbitRingSpec[] = [
  { radiusCqmin: 15.5, sizePx: 118, durationSec: 54, direction: 'cw' },
  { radiusCqmin: 28.5, sizePx: 132, durationSec: 78, direction: 'ccw' },
  { radiusCqmin: 41.5, sizePx: 122, durationSec: 104, direction: 'cw' },
];

const CEILING_FLAG_OPTIONS: CeilingFlagOption[] = [
  // Anel interno (4 países)
  { id: '076', alpha2: 'BR', namePt: 'Brasil', nameEn: 'Brazil', orbitRing: 0 },
  { id: '818', alpha2: 'EG', namePt: 'Egito', nameEn: 'Egypt', orbitRing: 0 },
  { id: '392', alpha2: 'JP', namePt: 'Japão', nameEn: 'Japan', orbitRing: 0 },
  { id: '250', alpha2: 'FR', namePt: 'França', nameEn: 'France', orbitRing: 0 },
  // Anel médio (6 países)
  { id: '840', alpha2: 'US', namePt: 'Estados Unidos', nameEn: 'United States', orbitRing: 1 },
  { id: '276', alpha2: 'DE', namePt: 'Alemanha', nameEn: 'Germany', orbitRing: 1 },
  { id: '356', alpha2: 'IN', namePt: 'Índia', nameEn: 'India', orbitRing: 1 },
  { id: '036', alpha2: 'AU', namePt: 'Austrália', nameEn: 'Australia', orbitRing: 1 },
  { id: '484', alpha2: 'MX', namePt: 'México', nameEn: 'Mexico', orbitRing: 1 },
  { id: '710', alpha2: 'ZA', namePt: 'África do Sul', nameEn: 'South Africa', orbitRing: 1 },
  // Anel externo (9 países)
  { id: '620', alpha2: 'PT', namePt: 'Portugal', nameEn: 'Portugal', orbitRing: 2 },
  { id: '124', alpha2: 'CA', namePt: 'Canadá', nameEn: 'Canada', orbitRing: 2 },
  { id: '032', alpha2: 'AR', namePt: 'Argentina', nameEn: 'Argentina', orbitRing: 2 },
  { id: '826', alpha2: 'GB', namePt: 'Reino Unido', nameEn: 'United Kingdom', orbitRing: 2 },
  { id: '380', alpha2: 'IT', namePt: 'Itália', nameEn: 'Italy', orbitRing: 2 },
  { id: '724', alpha2: 'ES', namePt: 'Espanha', nameEn: 'Spain', orbitRing: 2 },
  { id: '410', alpha2: 'KR', namePt: 'Coreia do Sul', nameEn: 'South Korea', orbitRing: 2 },
  { id: '566', alpha2: 'NG', namePt: 'Nigéria', nameEn: 'Nigeria', orbitRing: 2 },
];

interface CometSpec {
  top: string;
  left: string;
  angleDeg: number;
  tailWidthPx: number;
  travelX: number;
  travelY: number;
  durationSec: number;
  delaySec: number;
  repeatDelaySec: number;
  tint: string;
}

const CEILING_COMETS: readonly CometSpec[] = [
  {
    top: '14%',
    left: '8%',
    angleDeg: 24,
    tailWidthPx: 145,
    travelX: 460,
    travelY: 205,
    durationSec: 2.8,
    delaySec: 0.4,
    repeatDelaySec: 4.5,
    tint: 'rgba(186, 230, 253, 0.85)',
  },
  {
    top: '28%',
    left: '74%',
    angleDeg: 152,
    tailWidthPx: 120,
    travelX: -410,
    travelY: 215,
    durationSec: 2.4,
    delaySec: 2.3,
    repeatDelaySec: 5.8,
    tint: 'rgba(125, 211, 252, 0.8)',
  },
  {
    top: '68%',
    left: '16%',
    angleDeg: -21,
    tailWidthPx: 165,
    travelX: 520,
    travelY: -195,
    durationSec: 3.1,
    delaySec: 4.1,
    repeatDelaySec: 6.2,
    tint: 'rgba(224, 242, 254, 0.9)',
  },
  {
    top: '76%',
    left: '84%',
    angleDeg: -158,
    tailWidthPx: 130,
    travelX: -440,
    travelY: -175,
    durationSec: 2.6,
    delaySec: 6.0,
    repeatDelaySec: 5.2,
    tint: 'rgba(165, 243, 252, 0.78)',
  },
  {
    top: '44%',
    left: '48%',
    angleDeg: 16,
    tailWidthPx: 110,
    travelX: 380,
    travelY: 110,
    durationSec: 2.2,
    delaySec: 7.8,
    repeatDelaySec: 7.0,
    tint: 'rgba(248, 250, 252, 0.82)',
  },
];

/**
 * Superfície Projetada — TETO (`ceiling` · Projetor 2):
 * - `boarding` / `countdown`: escotilha da nave + rastros de subida para o espaço.
 * - `idle` / `zero_g` / `ended` / `exploring` (sem país escolhido): céu estrelado + cometas + 19 bandeiras em órbita.
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
    studioData,
    telemetrySummary,
  } = useExperience();
  const isPt = lang === 'pt';
  const anySolo = layers.melody.solo || layers.chords.solo || layers.bass.solo;

  const showCountryLayers = missionPhase === 'exploring' && Boolean(country) && storyStep > 0;
  const showFloatingFlags = missionPhase === 'exploring' || missionPhase === 'ended';
  const showIdleCosmos = missionPhase === 'idle' || missionPhase === 'briefing';
  const showComets =
    missionPhase === 'idle' ||
    missionPhase === 'briefing' ||
    missionPhase === 'zero_g' ||
    missionPhase === 'exploring' ||
    missionPhase === 'ended';

  const nasaReport =
    showCountryLayers && country
      ? buildCountryNasaReport({
          country,
          telemetrySummary,
          studioData,
          playback,
          layers,
          lang,
        })
      : null;

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
      <SpaceStarfield seedOffset={3} count={135} />

      {!showCountryLayers ? (
        <div
          className="absolute inset-0 z-10 overflow-hidden"
          style={{ containerType: 'size' }}
        >
          {/* Astros espaciais espalhados no teto em repouso/boas-vindas (sem bandeiras ainda) */}
          {showIdleCosmos && (
            <>
              <motion.div
                className="pointer-events-none absolute top-[18%] left-[18%]"
                animate={{ y: [-8, 8, -8], x: [-6, 6, -6] }}
                transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
                aria-hidden="true"
              >
                <div className="relative flex items-center justify-center">
                  <div
                    className="pointer-events-none absolute rounded-full border border-indigo-200/45"
                    style={{ width: '92px', height: '24px', transform: 'rotate(-16deg)' }}
                  />
                  <div
                    className="h-12 w-12 rounded-full"
                    style={{
                      background:
                        'radial-gradient(circle at 32% 28%, #e0e7ff 0%, #6366f1 56%, #1e1b4b 100%)',
                      boxShadow: '0 0 26px rgba(129, 140, 248, 0.45)',
                    }}
                  />
                </div>
              </motion.div>

              <motion.div
                className="pointer-events-none absolute top-[26%] left-[78%]"
                animate={{ y: [7, -7, 7], x: [5, -5, 5] }}
                transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
                aria-hidden="true"
              >
                <div
                  className="h-10 w-10 rounded-full"
                  style={{
                    background:
                      'radial-gradient(circle at 32% 30%, #fed7aa 0%, #f97316 58%, #7c2d12 100%)',
                    boxShadow: '0 0 24px rgba(251, 146, 60, 0.45)',
                  }}
                />
              </motion.div>

              <motion.div
                className="pointer-events-none absolute top-[72%] left-[26%]"
                animate={{ y: [-6, 6, -6] }}
                transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
                aria-hidden="true"
              >
                <div
                  className="h-8 w-8 rounded-full"
                  style={{
                    background:
                      'radial-gradient(circle at 32% 28%, #bae6fd 0%, #0ea5e9 58%, #082f49 100%)',
                    boxShadow: '0 0 20px rgba(56, 189, 248, 0.42)',
                  }}
                />
              </motion.div>

              <motion.div
                className="pointer-events-none absolute top-[70%] left-[72%]"
                animate={{ y: [6, -6, 6], x: [-4, 4, -4] }}
                transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }}
                aria-hidden="true"
              >
                <div
                  className="h-9 w-9 rounded-full"
                  style={{
                    background:
                      'radial-gradient(circle at 32% 28%, #a7f3d0 0%, #10b981 58%, #064e3b 100%)',
                    boxShadow: '0 0 22px rgba(52, 211, 153, 0.42)',
                  }}
                />
              </motion.div>
            </>
          )}

          {/* Cometas cruzando o céu estrelado com cauda luminosa */}
          {showComets &&
            CEILING_COMETS.map((comet, idx) => (
              <motion.div
                key={`ceiling-comet-${idx}`}
                className="pointer-events-none absolute flex items-center justify-end"
                style={{
                  top: comet.top,
                  left: comet.left,
                  width: `${comet.tailWidthPx}px`,
                  height: '4px',
                  rotate: `${comet.angleDeg}deg`,
                }}
                initial={{ opacity: 0, x: 0, y: 0, scale: 0.7 }}
                animate={{
                  opacity: [0, 0.95, 0.95, 0],
                  x: comet.travelX,
                  y: comet.travelY,
                  scale: [0.7, 1, 0.9],
                }}
                transition={{
                  duration: comet.durationSec,
                  delay: comet.delaySec,
                  repeat: Infinity,
                  repeatDelay: comet.repeatDelaySec,
                  ease: 'easeOut',
                }}
                aria-hidden="true"
              >
                <span
                  className="h-[2px] w-full rounded-full"
                  style={{
                    background: `linear-gradient(90deg, transparent 0%, ${comet.tint} 68%, #ffffff 100%)`,
                  }}
                />
                <span
                  className="h-[6px] w-[6px] shrink-0 rounded-full bg-white"
                  style={{
                    boxShadow: `0 0 12px 3px ${comet.tint}, 0 0 22px rgba(56, 189, 248, 0.55)`,
                  }}
                />
              </motion.div>
            ))}

          {showFloatingFlags && (
            <>
              {/* Núcleo e trilhas orbitais muito sutis no céu #000000 */}
              <div
                className="pointer-events-none absolute top-1/2 left-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-200/80"
                style={{
                  boxShadow:
                    '0 0 18px 4px rgba(125, 211, 252, 0.38), 0 0 42px 10px rgba(56, 189, 248, 0.14)',
                }}
                aria-hidden="true"
              />

              {ORBIT_RINGS.map((ring, ringIdx) => (
                <div
                  key={`orbit-track-${ringIdx}`}
                  className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-sky-300/12"
                  style={{
                    width: `${ring.radiusCqmin * 2}cqmin`,
                    height: `${ring.radiusCqmin * 2}cqmin`,
                  }}
                  aria-hidden="true"
                />
              ))}

              {ORBIT_RINGS.map((ring, ringIdx) => {
                const ringItems = CEILING_FLAG_OPTIONS.filter(
                  (item) => item.orbitRing === ringIdx
                );
                return ringItems.map((item, itemIdx) => {
                  const isSelected = country?.id === item.id;
                  const phaseDelaySec = -(ring.durationSec * itemIdx) / ringItems.length;

                  return (
                    <div
                      key={item.id}
                      className={`pointer-events-none absolute top-1/2 left-1/2 h-0 w-0 ${
                        ring.direction === 'cw' ? 'ceiling-orbit-cw' : 'ceiling-orbit-ccw'
                      }`}
                      style={{
                        animationDuration: `${ring.durationSec}s`,
                        animationDelay: `${phaseDelaySec}s`,
                      }}
                    >
                      <div
                        className="pointer-events-none absolute top-0 left-0"
                        style={{ transform: `translateX(${ring.radiusCqmin}cqmin)` }}
                      >
                        <div
                          className={`pointer-events-none absolute top-0 left-0 ${
                            ring.direction === 'cw'
                              ? 'ceiling-orbit-ccw'
                              : 'ceiling-orbit-cw'
                          }`}
                          style={{
                            animationDuration: `${ring.durationSec}s`,
                            animationDelay: `${phaseDelaySec}s`,
                          }}
                        >
                          <motion.div
                            aria-hidden="true"
                            initial={
                              missionPhase === 'exploring'
                                ? { opacity: 0, scale: 0.25 }
                                : { opacity: 1, scale: 1 }
                            }
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{
                              duration: 0.75,
                              delay:
                                missionPhase === 'exploring'
                                  ? (ringIdx * 4 + itemIdx) * 0.04
                                  : 0,
                              ease: [0.22, 1, 0.36, 1],
                            }}
                            style={{
                              width: `${ring.sizePx}px`,
                              height: `${ring.sizePx}px`,
                            }}
                            className={`pointer-events-none flex items-center justify-center rounded-full border-2 bg-[#060913]/85 p-2 backdrop-blur-md transition-[border-color,transform,background-color] duration-300 ${
                              isSelected
                                ? 'border-sky-400 bg-sky-500/20 ring-4 ring-sky-400/50'
                                : 'border-slate-700/60'
                            }`}
                          >
                            <span className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-slate-950/90">
                              <span
                                className={`fi fi-${item.alpha2.toLowerCase()} fis block h-full w-full rounded-full`}
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  backgroundSize: 'cover',
                                  backgroundPosition: 'center',
                                }}
                                aria-hidden="true"
                              />
                            </span>
                          </motion.div>
                        </div>
                      </div>
                    </div>
                  );
                });
              })}
            </>
          )}
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

          {/* Card Colorido de Curiosidades & Hero Banner da Bandeira no Teto */}
          {nasaReport && (
            <motion.aside
              key={nasaReport.countryId}
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              className="pointer-events-none flex w-[490px] max-w-[84%] flex-col overflow-hidden rounded-[22px] border border-white/15 bg-[#060b19]/94 text-left shadow-[0_0_64px_rgba(0,0,0,0.92)]"
              data-testid="ceiling-country-nasa-card"
            >
              {/* Capa Hero Full-Width da Bandeira (100% limpa sem texto em cima + vinheta sutil nas bordas) */}
              {nasaReport.alpha2 && (
                <div
                  className="relative h-[152px] w-full shrink-0 overflow-hidden bg-slate-950"
                  data-testid="ceiling-card-flag"
                >
                  <span
                    className={`fi fi-${nasaReport.alpha2.toLowerCase()} block h-full w-full`}
                    style={{
                      width: '100%',
                      height: '100%',
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      backgroundRepeat: 'no-repeat',
                    }}
                    aria-hidden="true"
                  />
                  <div
                    className="pointer-events-none absolute inset-0"
                    style={{
                      boxShadow: 'inset 0 0 36px rgba(5, 10, 24, 0.52)',
                    }}
                    aria-hidden="true"
                  />
                </div>
              )}

              {/* Faixa nas cores dos 5 mapas da NASA logo abaixo da bandeira */}
              <div
                className="h-1 w-full shrink-0"
                style={{
                  background:
                    'linear-gradient(90deg, #facc15 0%, #22d3ee 25%, #4ade80 50%, #38bdf8 75%, #fb7185 100%)',
                }}
              />

              <div className="flex flex-col gap-2.5 p-4">
                {/* Bloco de Títulos separado abaixo da bandeira */}
                <div className="flex flex-col gap-1 border-b border-white/10 pb-2.5">
                  <div className="flex items-center justify-between gap-2.5">
                    <span className="inline-flex items-center rounded-full border border-sky-400/35 bg-sky-500/12 px-2.5 py-0.5 text-[10px] font-bold tracking-[0.12em] text-sky-300 uppercase">
                      {isPt ? 'Curiosidades da Órbita · NASA' : 'Orbital Curiosities · NASA'}
                    </span>

                    <span className="shrink-0 rounded-full border border-white/15 bg-white/[0.05] px-2.5 py-0.5 text-[11px] font-semibold text-slate-200 [font-variant-numeric:tabular-nums]">
                      {nasaReport.coordinatesLabel} · {playback.bpm} BPM
                    </span>
                  </div>

                  <div className="flex w-full items-baseline justify-between gap-2">
                    <h2 className="truncate text-[24px] font-extrabold tracking-tight leading-tight text-white">
                      {nasaReport.countryName}
                    </h2>
                    <span className="shrink-0 text-[12px] font-medium text-slate-300">
                      {isPt ? `Tom: ${playback.keyRootPt}` : `Key: ${playback.keyRoot}`}
                    </span>
                  </div>
                </div>

                {/* Curiosidade Divertida Baseada nos Dados Reais */}
                <div className="rounded-xl border border-amber-300/25 bg-white/[0.04] px-3.5 py-2">
                  <div className="text-[10px] font-bold tracking-[0.08em] text-amber-200 uppercase">
                    {nasaReport.curiosityTitle}
                  </div>
                  <p className="mt-0.5 text-[13.5px] font-medium leading-snug text-slate-100">
                    {nasaReport.curiosityText}
                  </p>
                </div>

                {/* 5 Cards Coloridos com as Cores dos Mapas */}
                <div className="grid grid-cols-2 gap-2">
                  {nasaReport.layers.map((row, idx) => (
                    <div
                      key={row.layerId}
                      className={`flex flex-col justify-between gap-1 rounded-xl border px-3 py-2 transition-colors ${
                        idx === 4 ? 'col-span-2' : ''
                      }`}
                      style={{
                        borderColor: row.enabled
                          ? `color-mix(in srgb, ${row.accentHex} 75%, transparent)`
                          : `color-mix(in srgb, ${row.accentHex} 38%, transparent)`,
                        background: row.enabled
                          ? `color-mix(in srgb, ${row.accentHex} 18%, rgba(8, 14, 32, 0.94))`
                          : `color-mix(in srgb, ${row.accentHex} 9%, rgba(8, 14, 32, 0.9))`,
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{
                              backgroundColor: row.accentHex,
                              boxShadow: row.enabled ? `0 0 10px ${row.accentHex}` : 'none',
                            }}
                          />
                          <span className="truncate text-[12px] font-bold text-slate-100">
                            {row.funLabel}
                          </span>
                        </div>
                        <span
                          className="shrink-0 rounded-md px-1.5 py-0.5 text-[9.5px] font-bold"
                          style={{
                            color: row.accentHex,
                            backgroundColor: `color-mix(in srgb, ${row.accentHex} 16%, rgba(4, 9, 22, 0.9))`,
                          }}
                        >
                          {row.svsId}
                        </span>
                      </div>

                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[14.5px] font-extrabold text-white [font-variant-numeric:tabular-nums]">
                          {row.metricHeadline}
                        </span>
                        <span className="truncate text-[10.5px] text-slate-300">
                          {row.funHint}
                        </span>
                      </div>

                      {row.normalized01 !== null && (
                        <div className="h-1 w-full overflow-hidden rounded-full bg-black/45">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.max(6, Math.min(100, Math.round(row.normalized01 * 100)))}%`,
                              backgroundColor: row.accentHex,
                            }}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="truncate text-center text-[10px] font-medium tracking-wide text-slate-400">
                  {isPt
                    ? 'Dados reais NASA SVS 5011 · 5147 · 5148 · 5153 · 5154'
                    : 'Official NASA SVS data 5011 · 5147 · 5148 · 5153 · 5154'}
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
