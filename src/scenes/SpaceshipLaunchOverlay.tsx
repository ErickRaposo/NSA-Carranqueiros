import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { MissionPhase, SurfaceId } from '../experience/types';

interface SpaceshipLaunchOverlayProps {
  surface: SurfaceId;
  phase: MissionPhase;
}

const BRUSHED_METAL_STYLE: React.CSSProperties = {
  background:
    'linear-gradient(145deg, #1b2434 0%, #2b384c 28%, #0e1625 60%, #1c2638 85%, #070b14 100%)',
};

const SMOKE_CLOUDS = [
  { left: '10%', bottom: '10%', size: 'clamp(72px, 16vw, 130px)', delay: 0.1 },
  { left: '34%', bottom: '4%', size: 'clamp(90px, 20vw, 165px)', delay: 0.25 },
  { left: '56%', bottom: '8%', size: 'clamp(80px, 18vw, 145px)', delay: 0.15 },
  { left: '78%', bottom: '6%', size: 'clamp(76px, 17vw, 130px)', delay: 0.35 },
  { left: '24%', bottom: '26%', size: 'clamp(68px, 14vw, 110px)', delay: 0.45 },
  { left: '66%', bottom: '24%', size: 'clamp(70px, 15vw, 115px)', delay: 0.3 },
];

/**
 * Overlay físico e responsivo da nave espacial em 3 superfícies usando `motion/react`:
 * - `boarding` / `countdown` na Parede Direita: comportas metálicas fecham + fumaça espalhada.
 * - `boarding` / `countdown` na Parede Esquerda: chapa metálica com vigia circular responsiva para o campo de areia.
 * - `boarding` / `countdown` no Teto: duas comportas formando o topo cônico do foguete que abrem devagar em `zero_g`.
 * - `zero_g` -> `exploring`: painéis da cabine nas paredes laterais deslizam e abrem devagar para o espaço.
 */
export const SpaceshipLaunchOverlay: React.FC<SpaceshipLaunchOverlayProps> = ({
  surface,
  phase,
}) => {
  const [isReentry, setIsReentry] = useState(false);

  useEffect(() => {
    if (phase !== 'ended') {
      setIsReentry(false);
      return;
    }
    setIsReentry(true);
    const timer = window.setTimeout(() => setIsReentry(false), 3200);
    return () => window.clearTimeout(timer);
  }, [phase]);

  const isSealedCabin = phase === 'boarding' || phase === 'countdown' || isReentry;
  const isOpeningZeroG = phase === 'zero_g';
  const showShipShell = isSealedCabin || isOpeningZeroG;
  const isCountdown = phase === 'countdown';
  const isZeroGCabin =
    phase === 'zero_g' && (surface === 'leftWall' || surface === 'rightWall');

  return (
    <div
      className="pointer-events-none absolute inset-0 z-20 overflow-hidden select-none"
      aria-hidden="true"
    >
      {/* =====================================================================
          PAREDE DIREITA: Comportas metálicas fechando + fumaça espalhada
          ===================================================================== */}
      <AnimatePresence>
        {surface === 'rightWall' && showShipShell && (
          <motion.div
            key="right-blast-doors"
            className="absolute inset-0 flex"
            initial={{ opacity: 1 }}
            animate={
              isCountdown
                ? {
                    opacity: 1,
                    x: [-1.5, 1.5, -1, 1.5, 0],
                    y: [1, -1.5, 1.5, -1, 0],
                  }
                : { opacity: 1, x: 0, y: 0 }
            }
            exit={{ opacity: 0, transition: { duration: 0.6 } }}
            transition={
              isCountdown
                ? {
                    x: { repeat: Infinity, duration: 0.24 },
                    y: { repeat: Infinity, duration: 0.2 },
                  }
                : { duration: 1.4 }
            }
          >
            <motion.div
              className="relative h-full w-1/2 border-r border-slate-500/40 shadow-[inset_-14px_0_32px_rgba(0,0,0,0.75)]"
              style={BRUSHED_METAL_STYLE}
              initial={{ x: isOpeningZeroG ? '0%' : '-100%' }}
              animate={{ x: isOpeningZeroG ? '-105%' : '0%' }}
              exit={{ x: '-105%', transition: { duration: 1.4, ease: [0.22, 1, 0.36, 1] } }}
              transition={{ duration: isOpeningZeroG ? 2.6 : 1.45, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="absolute inset-4 rounded-xl border border-slate-400/15 bg-black/20" />
              <div className="absolute top-5 left-5 h-2 w-2 rounded-full bg-slate-400/50" />
              <div className="absolute bottom-5 left-5 h-2 w-2 rounded-full bg-slate-400/50" />
            </motion.div>

            <motion.div
              className="relative h-full w-1/2 border-l border-slate-500/40 shadow-[inset_14px_0_32px_rgba(0,0,0,0.75)]"
              style={BRUSHED_METAL_STYLE}
              initial={{ x: isOpeningZeroG ? '0%' : '100%' }}
              animate={{ x: isOpeningZeroG ? '105%' : '0%' }}
              exit={{ x: '105%', transition: { duration: 1.4, ease: [0.22, 1, 0.36, 1] } }}
              transition={{ duration: isOpeningZeroG ? 2.6 : 1.45, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="absolute inset-4 rounded-xl border border-slate-400/15 bg-black/20" />
              <div className="absolute top-5 right-5 h-2 w-2 rounded-full bg-slate-400/50" />
              <div className="absolute right-5 bottom-5 h-2 w-2 rounded-full bg-slate-400/50" />
            </motion.div>

            {/* Fumaça espalhada ao fechar/abrir as comportas */}
            {SMOKE_CLOUDS.map((puff, idx) => (
              <motion.div
                key={`right-smoke-${idx}`}
                className="absolute rounded-full blur-2xl"
                style={{
                  left: puff.left,
                  bottom: puff.bottom,
                  width: puff.size,
                  height: puff.size,
                  background:
                    'radial-gradient(circle, rgba(226,232,240,0.34) 0%, rgba(148,163,184,0.12) 55%, transparent 100%)',
                }}
                initial={{ opacity: isOpeningZeroG ? 0.45 : 0, scale: isOpeningZeroG ? 1 : 0.5, y: 0 }}
                animate={
                  isOpeningZeroG
                    ? { opacity: 0, scale: 1.6, y: -48 }
                    : {
                        opacity: [0, 0.52, 0.16],
                        scale: [0.6, 1.3, 1.7],
                        y: [18, -26, -62],
                      }
                }
                transition={{
                  duration: isOpeningZeroG ? 2.2 : isCountdown ? 3.2 : 2.8,
                  delay: isOpeningZeroG ? idx * 0.08 : puff.delay,
                  repeat: isCountdown ? Infinity : 0,
                  ease: 'easeOut',
                }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* =====================================================================
          PAREDE ESQUERDA: Chapa metálica + vigia circular responsiva para o campo de areia
          ===================================================================== */}
      <AnimatePresence>
        {surface === 'leftWall' && showShipShell && (
          <motion.div
            key="left-metal-launchpad"
            className="absolute inset-0 flex items-center justify-center"
            style={BRUSHED_METAL_STYLE}
            initial={{ x: isOpeningZeroG ? '0%' : '-100%', opacity: 1 }}
            animate={
              isCountdown
                ? {
                    x: [0, -1.5, 1.5, -1, 0],
                    y: [0, 1.5, -1.5, 1, 0],
                    opacity: 1,
                  }
                : isOpeningZeroG
                  ? { x: '-105%', opacity: 0 }
                  : { x: '0%', opacity: 1 }
            }
            exit={{ x: '-105%', opacity: 0, transition: { duration: 1.4, ease: [0.22, 1, 0.36, 1] } }}
            transition={
              isCountdown
                ? {
                    x: { repeat: Infinity, duration: 0.22 },
                    y: { repeat: Infinity, duration: 0.19 },
                  }
                : { duration: isOpeningZeroG ? 2.6 : 1.3, ease: [0.22, 1, 0.36, 1] }
            }
          >
            <span className="absolute top-4 left-4 h-2 w-2 rounded-full bg-slate-400/50" />
            <span className="absolute top-4 right-4 h-2 w-2 rounded-full bg-slate-400/50" />
            <span className="absolute bottom-4 left-4 h-2 w-2 rounded-full bg-slate-400/50" />
            <span className="absolute right-4 bottom-4 h-2 w-2 rounded-full bg-slate-400/50" />

            {/* Vigia circular 100% responsiva a qualquer proporção de tela */}
            <div className="relative flex aspect-square h-[min(74vw,74vh)] w-[min(74vw,74vh)] max-h-[82%] max-w-[82%] items-center justify-center rounded-full p-2 ring-2 ring-sky-400/45 shadow-[0_0_45px_rgba(56,189,248,0.22)]">
              <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-full border-[5px] border-slate-600/90 bg-[#030712] shadow-[inset_0_0_34px_rgba(0,0,0,0.9)]">
                <motion.div
                  className="absolute inset-0"
                  style={{
                    background:
                      'linear-gradient(to bottom, #02050d 0%, #072f4a 35%, #38bdf8 72%, #fed7aa 100%)',
                  }}
                  initial={isReentry || isOpeningZeroG ? { y: '78%', opacity: 0.12 } : false}
                  animate={{
                    y: isCountdown || isOpeningZeroG ? '78%' : '0%',
                    opacity: isCountdown || isOpeningZeroG ? 0.12 : 1,
                  }}
                  transition={{ duration: isReentry ? 3.0 : isOpeningZeroG ? 0.2 : 9.2, ease: 'easeInOut' }}
                />

                <motion.svg
                  viewBox="0 0 320 320"
                  preserveAspectRatio="xMidYMid slice"
                  className="relative z-10 h-full w-full"
                  initial={
                    isReentry || isOpeningZeroG
                      ? { y: '105%', scale: 0.62, opacity: 0.06 }
                      : false
                  }
                  animate={{
                    y: isCountdown || isOpeningZeroG ? '105%' : '0%',
                    scale: isCountdown || isOpeningZeroG ? 0.62 : 1,
                    opacity: isCountdown || isOpeningZeroG ? 0.06 : 1,
                  }}
                  transition={{
                    duration: isReentry ? 3.0 : isOpeningZeroG ? 0.2 : 8.8,
                    ease: isReentry ? 'easeOut' : 'easeIn',
                  }}
                >
                  <defs>
                    <linearGradient id="sandFieldGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#d97706" />
                      <stop offset="50%" stopColor="#b45309" />
                      <stop offset="100%" stopColor="#78350f" />
                    </linearGradient>
                  </defs>

                  <path
                    d="M0 198 Q80 182 160 194 T320 190 L320 320 L0 320 Z"
                    fill="url(#sandFieldGrad)"
                  />
                  <path
                    d="M0 220 Q110 205 220 218 T320 214 L320 320 L0 320 Z"
                    fill="#92400e"
                    opacity="0.7"
                  />

                  <rect x="92" y="206" width="136" height="16" rx="2" fill="#475569" />
                  <rect x="110" y="196" width="100" height="10" rx="1.5" fill="#64748b" />

                  <rect x="122" y="108" width="16" height="88" fill="none" stroke="#cbd5e1" strokeWidth="2" />
                  <path
                    d="M122 124 L138 142 M138 124 L122 142 M122 146 L138 164 M138 146 L122 164 M122 168 L138 186 M138 168 L122 186"
                    stroke="#94a3b8"
                    strokeWidth="1.3"
                  />
                  <line x1="138" y1="132" x2="160" y2="132" stroke="#e2e8f0" strokeWidth="2.4" />

                  {isCountdown && (
                    <g>
                      <ellipse cx="160" cy="204" rx="54" ry="16" fill="#fb923c" opacity="0.88" />
                      <ellipse cx="160" cy="214" rx="88" ry="24" fill="#fde68a" opacity="0.5" />
                    </g>
                  )}
                </motion.svg>
              </div>
            </div>

            {SMOKE_CLOUDS.slice(0, 4).map((puff, idx) => (
              <motion.div
                key={`left-smoke-${idx}`}
                className="absolute rounded-full blur-2xl"
                style={{
                  left: puff.left,
                  bottom: puff.bottom,
                  width: puff.size,
                  height: puff.size,
                  background:
                    'radial-gradient(circle, rgba(226,232,240,0.3) 0%, rgba(148,163,184,0.12) 55%, transparent 100%)',
                }}
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{
                  opacity: [0, 0.45, 0.14],
                  scale: [0.7, 1.3, 1.65],
                  y: [15, -22, -52],
                }}
                transition={{
                  duration: isCountdown ? 3.0 : 2.6,
                  delay: puff.delay,
                  repeat: isCountdown ? Infinity : 0,
                  ease: 'easeOut',
                }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* =====================================================================
          ÓRBITA / ZERO-G: Cabine lateral permanece e depois abre devagar para fora
          ===================================================================== */}
      <AnimatePresence>
        {isZeroGCabin && (
          <motion.div
            key={`zerog-cabin-${surface}`}
            className="absolute inset-0 flex"
            initial={{ opacity: 0.95 }}
            animate={{ opacity: 0.95 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2.0, ease: 'easeInOut' }}
          >
            {/* Moldura esquerda e direita abrindo suavemente para fora ao entrar em exploração */}
            <motion.div
              className="h-full w-6 border-r border-sky-400/25 sm:w-9"
              style={BRUSHED_METAL_STYLE}
              initial={{ x: 0 }}
              exit={{ x: '-120%' }}
              transition={{ duration: 2.0, ease: [0.22, 1, 0.36, 1] }}
            />
            <div className="relative flex-1">
              {surface === 'leftWall' && (
                <div className="absolute inset-0 m-auto aspect-square h-[min(78vw,78vh)] w-[min(78vw,78vh)] max-h-[86%] max-w-[86%] rounded-full border border-sky-400/35 shadow-[0_0_32px_rgba(56,189,248,0.15)]" />
              )}
              <span className="absolute top-3 left-3 h-5 w-5 border-t-2 border-l-2 border-sky-400/55" />
              <span className="absolute top-3 right-3 h-5 w-5 border-t-2 border-r-2 border-sky-400/55" />
              <span className="absolute bottom-3 left-3 h-5 w-5 border-b-2 border-l-2 border-sky-400/55" />
              <span className="absolute right-3 bottom-3 h-5 w-5 border-r-2 border-b-2 border-sky-400/55" />
            </div>
            <motion.div
              className="h-full w-6 border-l border-sky-400/25 sm:w-9"
              style={BRUSHED_METAL_STYLE}
              initial={{ x: 0 }}
              exit={{ x: '120%' }}
              transition={{ duration: 2.0, ease: [0.22, 1, 0.36, 1] }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* =====================================================================
          TETO: Duas comportas do topo do foguete que se abrem devagar em Zero-G
          ===================================================================== */}
      <AnimatePresence>
        {surface === 'ceiling' && showShipShell && (
          <motion.div
            key="ceiling-rocket-nosecone"
            className="absolute inset-0 flex overflow-hidden"
            initial={{ opacity: 1 }}
            animate={
              isCountdown
                ? {
                    opacity: 1,
                    x: [-1, 1, -1.5, 1, 0],
                    y: [1, -1, 1.5, -1, 0],
                  }
                : { opacity: 1, x: 0, y: 0 }
            }
            exit={{ opacity: 0, transition: { duration: 0.6 } }}
            transition={
              isCountdown
                ? {
                    x: { repeat: Infinity, duration: 0.22 },
                    y: { repeat: Infinity, duration: 0.19 },
                  }
                : { duration: 2.4 }
            }
          >
            {/* Metade esquerda do teto abrindo devagar para cima e esquerda */}
            <motion.div
              className="relative h-full w-1/2 overflow-hidden border-r border-sky-400/30"
              style={BRUSHED_METAL_STYLE}
              initial={{ x: isOpeningZeroG ? '0%' : '-100%', y: isOpeningZeroG ? '0%' : '-18%' }}
              animate={{ x: isOpeningZeroG ? '-42%' : '0%', y: isOpeningZeroG ? '-115%' : '0%' }}
              exit={{ x: '-42%', y: '-115%', transition: { duration: 1.4, ease: [0.22, 1, 0.36, 1] } }}
              transition={{ duration: isOpeningZeroG ? 2.6 : 2.3, ease: [0.22, 1, 0.36, 1] }}
            >
              <svg viewBox="0 0 200 260" className="h-full w-full opacity-80" preserveAspectRatio="none">
                <line x1="0" y1="0" x2="200" y2="130" stroke="#475569" strokeWidth="2.5" />
                <line x1="0" y1="260" x2="200" y2="130" stroke="#475569" strokeWidth="2.5" />
                <path
                  d="M 200 62 A 68 68 0 0 0 200 198"
                  fill="#0b1120"
                  stroke="#64748b"
                  strokeWidth="3"
                />
                <path
                  d="M 200 84 A 46 46 0 0 0 200 176"
                  fill="#020617"
                  stroke="#38bdf8"
                  strokeWidth="1.6"
                  strokeDasharray="6 4"
                />
              </svg>
            </motion.div>

            {/* Metade direita do teto abrindo devagar para cima e direita */}
            <motion.div
              className="relative h-full w-1/2 overflow-hidden border-l border-sky-400/30"
              style={BRUSHED_METAL_STYLE}
              initial={{ x: isOpeningZeroG ? '0%' : '100%', y: isOpeningZeroG ? '0%' : '-18%' }}
              animate={{ x: isOpeningZeroG ? '42%' : '0%', y: isOpeningZeroG ? '-115%' : '0%' }}
              exit={{ x: '42%', y: '-115%', transition: { duration: 1.4, ease: [0.22, 1, 0.36, 1] } }}
              transition={{ duration: isOpeningZeroG ? 2.6 : 2.3, ease: [0.22, 1, 0.36, 1] }}
            >
              <svg viewBox="0 0 200 260" className="h-full w-full opacity-80" preserveAspectRatio="none">
                <line x1="200" y1="0" x2="0" y2="130" stroke="#475569" strokeWidth="2.5" />
                <line x1="200" y1="260" x2="0" y2="130" stroke="#475569" strokeWidth="2.5" />
                <path
                  d="M 0 62 A 68 68 0 0 1 0 198"
                  fill="#0b1120"
                  stroke="#64748b"
                  strokeWidth="3"
                />
                <path
                  d="M 0 84 A 46 46 0 0 1 0 176"
                  fill="#020617"
                  stroke="#38bdf8"
                  strokeWidth="1.6"
                  strokeDasharray="6 4"
                />
              </svg>
            </motion.div>

            {isCountdown &&
              [16, 30, 46, 62, 78, 88].map((leftPct, idx) => (
                <span
                  key={leftPct}
                  className="absolute w-[2px] animate-ping rounded-full bg-amber-300/75"
                  style={{
                    left: `${leftPct}%`,
                    top: `${16 + (idx % 3) * 24}%`,
                    height: '44px',
                    animationDuration: `${0.6 + (idx % 3) * 0.22}s`,
                  }}
                />
              ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
