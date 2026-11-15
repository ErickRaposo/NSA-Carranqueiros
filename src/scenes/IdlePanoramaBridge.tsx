import React, { useEffect, useState } from 'react';
import { Mineiro3D } from '../components/Mineiro3D';

export type PanoramaWallSurface = 'leftWall' | 'rightWall';

interface IdlePanoramaBridgeProps {
  surface: PanoramaWallSurface;
}

interface CrossCometSpec {
  id: string;
  topPct: number;
  slopeYPer100X: number;
  angleDeg: number;
  periodMs: number;
  phaseMs: number;
  tailWidthPx: number;
  tint: string;
  reverse?: boolean;
}

const CROSS_WALL_COMETS: readonly CrossCometSpec[] = [
  {
    id: 'c1',
    topPct: 14,
    slopeYPer100X: 11,
    angleDeg: 8,
    periodMs: 5600,
    phaseMs: 300,
    tailWidthPx: 170,
    tint: 'rgba(186, 230, 253, 0.9)',
  },
  {
    id: 'c2',
    topPct: 38,
    slopeYPer100X: -9,
    angleDeg: -173,
    periodMs: 6800,
    phaseMs: 2400,
    tailWidthPx: 145,
    tint: 'rgba(125, 211, 252, 0.85)',
    reverse: true,
  },
  {
    id: 'c3',
    topPct: 68,
    slopeYPer100X: -12,
    angleDeg: -9,
    periodMs: 7400,
    phaseMs: 4100,
    tailWidthPx: 155,
    tint: 'rgba(224, 242, 254, 0.88)',
  },
];

const SMOKE_STEPS = [1, 2, 3, 4, 5, 6, 7, 8] as const;
const MARQUEE_SEGMENT_ITEMS = Array.from({ length: 6 }, (_, i) => i);

/**
 * Calcula posição determinística (via relógio global) do robô no palco contínuo 0%..200%:
 * - 0%..100%  = Parede Esquerda
 * - 100%..200% = Parede Direita
 * Dessa forma, quando ele sai pela borda direita da Parede Esquerda (100%),
 * entra instantaneamente pela borda esquerda da Parede Direita (0%) sem emenda.
 */
function sampleRobotMotion(nowMs: number): {
  xGlobalPct: number;
  bobPx: number;
  tiltDeg: number;
  dir: 1 | -1;
  speedNorm: number;
} {
  const sec = nowMs / 1000;
  // Ciclo completo de ida e volta entre as duas paredes em ~9.8s (rápido e energético)
  const omega = (Math.PI * 2) / 9.8;
  const angle = sec * omega;
  const xNorm = -Math.cos(angle); // -1 .. +1
  const dir: 1 | -1 = Math.sin(angle) >= 0 ? 1 : -1;
  const speedNorm = Math.abs(Math.sin(angle));

  const xGlobalPct = 100 + xNorm * 88; // vai de 12% (Parede Esq.) até 188% (Parede Dir.)
  const bobPx = Math.sin(sec * 3.8) * 14;
  const tiltDeg = dir * speedNorm * 10.5;

  return { xGlobalPct, bobPx, tiltDeg, dir, speedNorm };
}

/**
 * Camada compartilhada de projeção mapeada contínua entre Parede Esquerda e Parede Direita em `idle`:
 * - Faixas superiores/inferiores `MINEIRØ` atravessando a quina em L
 * - Cometas rápidos cruzando de uma parede para a outra
 * - Robô MINEIRØ gigante (`256px`) andando rápido pelas duas paredes com rastro de fumaça contínuo
 */
export const IdlePanoramaBridge: React.FC<IdlePanoramaBridgeProps> = ({ surface }) => {
  const [nowMs, setNowMs] = useState<number>(() =>
    typeof window !== 'undefined' ? Date.now() : 0
  );
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isReduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setReducedMotion(isReduced);
    if (isReduced) return;

    let rafId = 0;
    const tick = () => {
      setNowMs(Date.now());
      rafId = window.requestAnimationFrame(tick);
    };
    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, []);

  const surfaceOffsetPct = surface === 'leftWall' ? 0 : -100;
  const robot = reducedMotion
    ? { xGlobalPct: 150, bobPx: 0, tiltDeg: 0, dir: 1 as const, speedNorm: 0 }
    : sampleRobotMotion(nowMs);
  const robotLocalLeftPct = robot.xGlobalPct + surfaceOffsetPct;
  const showRobotOnThisSurface = robotLocalLeftPct > -24 && robotLocalLeftPct < 124;

  // Deslocamento contínuo em pista única de 400% (8 blocos iguais; cada bloco = 50% de uma parede)
  const topShiftPct = reducedMotion ? 0 : -((nowMs / 240) % 25);
  const bottomShiftPct = reducedMotion ? -12.5 : -25 + ((nowMs / 240) % 25);

  const renderMarqueeTrack = (shiftPct: number, keyPrefix: string) => (
    <div
      className="relative flex w-[400%] items-center"
      style={{
        marginLeft: surface === 'leftWall' ? '0%' : '-100%',
        transform: `translate3d(${shiftPct.toFixed(3)}%, 0, 0)`,
      }}
    >
      {[0, 1, 2, 3, 4, 5, 6, 7].map((chunk) => (
        <div
          key={`${keyPrefix}-chunk-${chunk}`}
          className="flex w-[12.5%] shrink-0 items-center justify-around"
        >
          {MARQUEE_SEGMENT_ITEMS.map((idx) => (
            <span key={`${keyPrefix}-${chunk}-${idx}`} className="inline-flex items-center gap-5">
              <span
                className="text-[16px] font-semibold tracking-[0.28em] text-sky-200/50 uppercase"
                style={{ fontFamily: "'Orbitron', 'Poppins', system-ui, sans-serif" }}
              >
                MINEIRØ
              </span>
              <span className="h-1.5 w-1.5 rounded-full bg-sky-300/45" />
            </span>
          ))}
        </div>
      ))}
    </div>
  );

  return (
    <div
      className="pointer-events-none absolute inset-0 z-25 overflow-hidden"
      aria-hidden="true"
    >
      {/* Faixas contínuas topo & rodapé cruzando as duas paredes sem quebra na quina */}
      <div className="absolute inset-x-0 top-4 overflow-hidden border-y border-sky-400/15 bg-sky-950/10 py-2">
        {renderMarqueeTrack(topShiftPct, 'top')}
      </div>
      <div className="absolute inset-x-0 bottom-4 overflow-hidden border-y border-sky-400/15 bg-sky-950/10 py-2">
        {renderMarqueeTrack(bottomShiftPct, 'bottom')}
      </div>

      {/* Cometas rápidos atravessando de uma parede para a outra pela quina */}
      {!reducedMotion &&
        CROSS_WALL_COMETS.map((comet) => {
          const p = ((nowMs + comet.phaseMs) % comet.periodMs) / comet.periodMs;
          const xGlobal = comet.reverse ? 220 - p * 240 : -20 + p * 240;
          const localX = xGlobal + surfaceOffsetPct;
          if (localX < -22 || localX > 122) return null;
          const yPct = comet.topPct + (xGlobal / 100) * comet.slopeYPer100X;
          const fadeOpacity =
            p < 0.08 ? p / 0.08 : p > 0.9 ? Math.max(0, (1 - p) / 0.1) : 1;

          return (
            <div
              key={comet.id}
              className="absolute flex items-center justify-end"
              style={{
                left: `${localX.toFixed(2)}%`,
                top: `${yPct.toFixed(2)}%`,
                width: `${comet.tailWidthPx}px`,
                height: '5px',
                opacity: fadeOpacity,
                transform: `translate(-50%, -50%) rotate(${comet.angleDeg}deg)`,
              }}
            >
              <span
                className="h-[2.5px] w-full rounded-full"
                style={{
                  background: `linear-gradient(90deg, transparent 0%, ${comet.tint} 68%, #ffffff 100%)`,
                }}
              />
              <span
                className="h-[7px] w-[7px] shrink-0 rounded-full bg-white"
                style={{
                  boxShadow: `0 0 14px 4px ${comet.tint}, 0 0 26px rgba(56, 189, 248, 0.55)`,
                }}
              />
            </div>
          );
        })}

      {/* Pista inferior única cruzando as duas paredes: Rastro de fumaça + Robô MINEIRØ gigante */}
      <div className="absolute inset-x-0 bottom-[62px] h-[270px]">
        {/* Nuvens determinísticas de fumaça atrás do robô (cruzam a quina em sincronia exata) */}
        {!reducedMotion &&
          SMOKE_STEPS.map((stepIdx) => {
            const past = sampleRobotMotion(nowMs - stepIdx * 115);
            const smokeGlobalX = past.xGlobalPct - past.dir * (3.6 + stepIdx * 0.45);
            const smokeLocalX = smokeGlobalX + surfaceOffsetPct;
            if (smokeLocalX < -15 || smokeLocalX > 115) return null;

            const life = stepIdx / SMOKE_STEPS.length; // 0.125 .. 1
            const sizePx = 22 + stepIdx * 7;
            const opacity = Math.max(0, (1 - life) * 0.62 * (0.35 + past.speedNorm * 0.65));
            const yPx = past.bobPx - stepIdx * 4.5 + Math.sin(stepIdx * 1.9) * 5;

            return (
              <div
                key={`smoke-${stepIdx}`}
                className="absolute bottom-[56px] rounded-full blur-[3px]"
                style={{
                  left: `${smokeLocalX.toFixed(2)}%`,
                  width: `${sizePx}px`,
                  height: `${sizePx}px`,
                  opacity,
                  transform: `translate(-50%, ${yPx.toFixed(1)}px) scale(${(0.8 + life * 1.25).toFixed(2)})`,
                  background:
                    'radial-gradient(circle, rgba(224, 242, 254, 0.72) 0%, rgba(56, 189, 248, 0.3) 55%, transparent 100%)',
                }}
              />
            );
          })}

        {showRobotOnThisSurface && (
          <div
            className="absolute bottom-0"
            style={{
              left: `${robotLocalLeftPct.toFixed(2)}%`,
              transform: `translate(-50%, ${robot.bobPx.toFixed(1)}px) rotate(${robot.tiltDeg.toFixed(1)}deg)`,
            }}
          >
            <div
              className="pointer-events-none absolute inset-x-10 bottom-3 h-6 rounded-full bg-sky-400/25 blur-lg"
              aria-hidden="true"
            />
            <Mineiro3D stepIndex={0} isExplaining={false} size="hero" idleShowcase={true} />
          </div>
        )}
      </div>
    </div>
  );
};
