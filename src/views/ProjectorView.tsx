import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useExperience } from '../experience/ExperienceContext';
import { ProjectorOutId } from '../experience/types';
import {
  CALIBRATION_CHANNEL_NAME,
  CalibrationSurfaceKey,
  computeHomographyMatrix3d,
  createDefaultCalibrationState,
  loadCalibrationState,
  Point2D,
  ProjectionCalibrationState,
  QuadCorners,
  saveCalibrationState,
} from '../projection/homography';
import { CeilingScene } from '../scenes/CeilingScene';
import { LeftWallScene } from '../scenes/LeftWallScene';
import { RightWallScene } from '../scenes/RightWallScene';

interface ProjectorViewProps {
  outId: ProjectorOutId;
}

const BASE_W = 1280;
const BASE_H = 960;

interface WarpedSurfaceSlot {
  key: CalibrationSurfaceKey;
  title: string;
  accentHex: string;
  aspectRatio: number;
  render: () => React.ReactNode;
}

/**
 * Saída fullscreen 100% limpa para os projetores (`?view=projector&out=1..3`), fundo `#000000` absoluto:
 * - `out=1` (Projetor 1 — Canto em L): projeta `LeftWallScene` + `RightWallScene` com Corner-Pin independente por parede!
 * - `out=2` (Projetor 2 — Teto): projeta `CeilingScene` em tela cheia com Corner-Pin!
 * - `out=3`: saída individual auxiliar (`RightWallScene`).
 *
 * Atalhos na janela do projetor (ou via `?view=setup`):
 * - Tecla `C`: liga/desliga Grade de Calibração + 4 pinos arrastáveis (Corner-Pin Homography).
 * - Tecla `R`: reseta os 4 vértices desta saída para o padrão retangular.
 */
export const ProjectorView: React.FC<ProjectorViewProps> = ({ outId }) => {
  const { roomDimensions } = useExperience();
  const containerRef = useRef<HTMLElement | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);

  const [viewport, setViewport] = useState<{ w: number; h: number }>(() => ({
    w: typeof window !== 'undefined' ? Math.max(1, window.innerWidth) : 1920,
    h: typeof window !== 'undefined' ? Math.max(1, window.innerHeight) : 1080,
  }));

  const [calibration, setCalibration] = useState<ProjectionCalibrationState>(loadCalibrationState);
  const [draggingPin, setDraggingPin] = useState<{
    surfaceKey: CalibrationSurfaceKey;
    cornerIdx: 0 | 1 | 2 | 3;
  } | null>(null);

  useEffect(() => {
    const onResize = () => {
      setViewport({
        w: Math.max(1, window.innerWidth),
        h: Math.max(1, window.innerHeight),
      });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const broadcastAndPersist = useCallback((next: ProjectionCalibrationState) => {
    saveCalibrationState(next);
    try {
      channelRef.current?.postMessage(next);
    } catch {
      // ignore channel errors
    }
  }, []);

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const ch = new BroadcastChannel(CALIBRATION_CHANNEL_NAME);
    channelRef.current = ch;
    ch.onmessage = (ev: MessageEvent<ProjectionCalibrationState>) => {
      if (ev.data && ev.data.quads) {
        setCalibration(ev.data);
        saveCalibrationState(ev.data);
      }
    };
    return () => {
      ch.close();
      channelRef.current = null;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'c' || e.key === 'C') {
        setCalibration((prev) => {
          const next: ProjectionCalibrationState = { ...prev, showGrid: !prev.showGrid };
          broadcastAndPersist(next);
          return next;
        });
      } else if ((e.key === 'r' || e.key === 'R') && calibration.showGrid) {
        const defaults = createDefaultCalibrationState();
        setCalibration((prev) => {
          const nextQuads = { ...prev.quads };
          if (outId === 1) {
            nextQuads['out1-leftWall'] = defaults.quads['out1-leftWall'];
            nextQuads['out1-rightWall'] = defaults.quads['out1-rightWall'];
          } else if (outId === 2) {
            nextQuads['out2-ceiling'] = defaults.quads['out2-ceiling'];
          } else {
            nextQuads['out3-rightWall'] = defaults.quads['out3-rightWall'];
          }
          const next: ProjectionCalibrationState = { ...prev, quads: nextQuads };
          broadcastAndPersist(next);
          return next;
        });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [broadcastAndPersist, calibration.showGrid, outId]);

  useEffect(() => {
    if (!draggingPin) return;

    const onPointerMove = (e: PointerEvent) => {
      const nx = Math.min(1, Math.max(0, e.clientX / Math.max(1, viewport.w)));
      const ny = Math.min(1, Math.max(0, e.clientY / Math.max(1, viewport.h)));

      setCalibration((prev) => {
        const currentQuad = [...prev.quads[draggingPin.surfaceKey]] as QuadCorners;
        currentQuad[draggingPin.cornerIdx] = {
          x: Number(nx.toFixed(4)),
          y: Number(ny.toFixed(4)),
        };
        const next: ProjectionCalibrationState = {
          ...prev,
          quads: {
            ...prev.quads,
            [draggingPin.surfaceKey]: currentQuad,
          },
        };
        broadcastAndPersist(next);
        return next;
      });
    };

    const onPointerUp = () => setDraggingPin(null);

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [broadcastAndPersist, draggingPin, viewport.h, viewport.w]);

  const leftAspect = roomDimensions.leftWall.widthCm / Math.max(1, roomDimensions.leftWall.heightCm);
  const rightAspect =
    roomDimensions.rightWall.widthCm / Math.max(1, roomDimensions.rightWall.heightCm);
  const ceilingAspect =
    roomDimensions.ceiling.widthCm / Math.max(1, roomDimensions.ceiling.heightCm);

  const slots: WarpedSurfaceSlot[] =
    outId === 1
      ? [
          {
            key: 'out1-leftWall',
            title: '1A · PAREDE ESQUERDA (GLOBO)',
            accentHex: '#38bdf8',
            aspectRatio: leftAspect,
            render: () => (
              <LeftWallScene
                surfaceId="leftWall"
                widthCm={roomDimensions.leftWall.widthCm}
                heightCm={roomDimensions.leftWall.heightCm}
                aspectRatio={leftAspect}
                renderContext="projector"
              />
            ),
          },
          {
            key: 'out1-rightWall',
            title: '1B · PAREDE DIREITA (ROBOZINHO)',
            accentHex: '#fbbf24',
            aspectRatio: rightAspect,
            render: () => (
              <RightWallScene
                surfaceId="rightWall"
                widthCm={roomDimensions.rightWall.widthCm}
                heightCm={roomDimensions.rightWall.heightCm}
                aspectRatio={rightAspect}
                renderContext="projector"
              />
            ),
          },
        ]
      : outId === 2
        ? [
            {
              key: 'out2-ceiling',
              title: '2 · TETO (5 CAMADAS PNG)',
              accentHex: '#34d399',
              aspectRatio: ceilingAspect,
              render: () => (
                <CeilingScene
                  surfaceId="ceiling"
                  widthCm={roomDimensions.ceiling.widthCm}
                  heightCm={roomDimensions.ceiling.heightCm}
                  aspectRatio={ceilingAspect}
                  renderContext="projector"
                />
              ),
            },
          ]
        : [
            {
              key: 'out3-rightWall',
              title: '3 · AUXILIAR PAREDE DIREITA',
              accentHex: '#fb923c',
              aspectRatio: rightAspect,
              render: () => (
                <RightWallScene
                  surfaceId="rightWall"
                  widthCm={roomDimensions.rightWall.widthCm}
                  heightCm={roomDimensions.rightWall.heightCm}
                  aspectRatio={rightAspect}
                  renderContext="projector"
                />
              ),
            },
          ];

  return (
    <main
      ref={containerRef}
      className="relative h-dvh w-screen overflow-hidden bg-black select-none"
      style={{ backgroundColor: '#000000' }}
      data-testid={`projector-view-${outId}`}
    >
      {slots.map((slot) => {
        const srcW = Math.round(BASE_H * Math.max(0.4, Math.min(2.5, slot.aspectRatio || BASE_W / BASE_H)));
        const srcH = BASE_H;
        const normQuad = calibration.quads[slot.key];
        const dstPixels: [Point2D, Point2D, Point2D, Point2D] = [
          { x: normQuad[0].x * viewport.w, y: normQuad[0].y * viewport.h },
          { x: normQuad[1].x * viewport.w, y: normQuad[1].y * viewport.h },
          { x: normQuad[2].x * viewport.w, y: normQuad[2].y * viewport.h },
          { x: normQuad[3].x * viewport.w, y: normQuad[3].y * viewport.h },
        ];
        const matrix3d = computeHomographyMatrix3d(srcW, srcH, dstPixels);

        return (
          <div
            key={slot.key}
            className="absolute top-0 left-0 overflow-hidden bg-black"
            style={{
              width: `${srcW}px`,
              height: `${srcH}px`,
              transformOrigin: '0 0',
              transform: matrix3d,
              backgroundColor: '#000000',
            }}
          >
            {slot.render()}

            {calibration.showGrid && (
              <div
                className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
                style={{
                  border: `3px solid ${slot.accentHex}`,
                  backgroundImage: `
                    linear-gradient(to right, rgba(255,255,255,0.16) 1px, transparent 1px),
                    linear-gradient(to bottom, rgba(255,255,255,0.16) 1px, transparent 1px)
                  `,
                  backgroundSize: `${srcW / 8}px ${srcH / 8}px`,
                }}
              >
                {/* Mira central */}
                <div
                  className="relative flex h-28 w-28 items-center justify-center rounded-full border-2"
                  style={{ borderColor: slot.accentHex }}
                >
                  <div className="absolute h-full w-0.5 bg-white/60" />
                  <div className="absolute h-0.5 w-full bg-white/60" />
                </div>
                <div
                  className="mt-4 rounded-xl bg-black/90 px-5 py-2 text-lg font-bold tracking-wider uppercase"
                  style={{ color: slot.accentHex, border: `1px solid ${slot.accentHex}` }}
                >
                  {slot.title}
                </div>
                <span className="mt-1.5 rounded bg-black/85 px-3 py-1 text-xs text-slate-300">
                  Arraste os 4 vértices · Tecla C fecha grade · Tecla R reseta
                </span>
              </div>
            )}
          </div>
        );
      })}

      {/* Handles arrastáveis de Corner-Pin (apenas visíveis quando calibration.showGrid === true) */}
      {calibration.showGrid &&
        slots.map((slot) => {
          const normQuad = calibration.quads[slot.key];
          const cornerLabels = ['TL', 'TR', 'BR', 'BL'] as const;
          return normQuad.map((pt, idx) => {
            const cornerIdx = idx as 0 | 1 | 2 | 3;
            return (
              <button
                key={`${slot.key}-${cornerLabels[idx]}`}
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  setDraggingPin({ surfaceKey: slot.key, cornerIdx });
                }}
                className="absolute z-50 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 cursor-grab items-center justify-center rounded-full border-2 bg-black/90 text-[11px] font-bold text-white shadow-lg active:cursor-grabbing"
                style={{
                  left: `${pt.x * 100}%`,
                  top: `${pt.y * 100}%`,
                  borderColor: slot.accentHex,
                  boxShadow: `0 0 16px ${slot.accentHex}`,
                }}
                title={`${slot.title} · ${cornerLabels[idx]}`}
              >
                {cornerLabels[idx]}
              </button>
            );
          });
        })}
    </main>
  );
};
