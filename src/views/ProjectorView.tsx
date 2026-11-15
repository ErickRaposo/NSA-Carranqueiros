import React, { useEffect, useRef, useState } from 'react';
import { useExperience, useProjectionAdmin } from '../experience/ExperienceContext';
import { ProjectorOutId, SurfaceId } from '../experience/types';
import {
  CalibrationSurfaceKey,
  computeHomographyMatrix3d,
  fitQuadAspectContain,
  makeSurfaceQuadKey,
  Point2D,
  QuadCorners,
} from '../projection/homography';
import { CeilingScene } from '../scenes/CeilingScene';
import { LeftWallScene } from '../scenes/LeftWallScene';
import { RightWallScene } from '../scenes/RightWallScene';

interface ProjectorViewProps {
  outId: ProjectorOutId;
}

const BASE_W = 1280;
const BASE_H = 960;

const SURFACE_META: Record<
  SurfaceId,
  { titlePt: string; titleEn: string; accentHex: string }
> = {
  leftWall: {
    titlePt: 'PAREDE ESQUERDA · GLOBO',
    titleEn: 'LEFT WALL · GLOBE',
    accentHex: '#38bdf8',
  },
  rightWall: {
    titlePt: 'PAREDE DIREITA · GUIA',
    titleEn: 'RIGHT WALL · GUIDE',
    accentHex: '#fbbf24',
  },
  ceiling: {
    titlePt: 'TETO · 5 CAMADAS PNG',
    titleEn: 'CEILING · 5 PNG LAYERS',
    accentHex: '#34d399',
  },
};

/**
 * Saída fullscreen 100% limpa para os projetores (`?view=projector&out=1..4`), fundo `#000000` absoluto.
 * Renderiza dinamicamente apenas as superfícies atribuídas na Matriz Patchbay (`useProjectionAdmin`),
 * sincronizada em tempo real via `BroadcastChannel` e WebSocket LAN (`/ws-earth-sync`).
 *
 * Atalhos locais na janela do projetor:
 * - Tecla `C`: liga/desliga Grade de Calibração Corner-Pin desta saída.
 * - Tecla `R`: reseta os 4 vértices desta saída para ocupação automática.
 * - Tecla `B`: liga/desliga Blackout #000 desta saída.
 */
export const ProjectorView: React.FC<ProjectorViewProps> = ({ outId }) => {
  const { roomDimensions, lang, sceneReplayKey } = useExperience();
  const {
    projectionState,
    updateOutputConfig,
    updateSurfaceQuad,
    resetSingleOutputQuads,
  } = useProjectionAdmin();

  const isPt = lang === 'pt';
  const containerRef = useRef<HTMLElement | null>(null);

  const [viewport, setViewport] = useState<{ w: number; h: number }>(() => ({
    w: typeof window !== 'undefined' ? Math.max(1, window.innerWidth) : 1920,
    h: typeof window !== 'undefined' ? Math.max(1, window.innerHeight) : 1080,
  }));

  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  const [draggingPin, setDraggingPin] = useState<{
    surfaceKey: CalibrationSurfaceKey;
    cornerIdx: 0 | 1 | 2 | 3;
  } | null>(null);

  const outputCfg = projectionState.outputs[outId] ?? {
    outId,
    surfaces: [],
    showGrid: false,
    blackout: false,
  };

  const isGridVisible = projectionState.showGrid || outputCfg.showGrid;
  const isBlackout = projectionState.globalBlackout || outputCfg.blackout;
  const isIdentifying = projectionState.identifyUntil > nowMs;

  useEffect(() => {
    if (projectionState.identifyUntil <= Date.now()) return;
    setNowMs(Date.now());
    const timer = window.setInterval(() => {
      const curr = Date.now();
      setNowMs(curr);
      if (curr >= projectionState.identifyUntil) {
        window.clearInterval(timer);
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [projectionState.identifyUntil]);

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

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'c' || e.key === 'C') {
        updateOutputConfig(outId, { showGrid: !outputCfg.showGrid });
      } else if ((e.key === 'r' || e.key === 'R') && isGridVisible) {
        resetSingleOutputQuads(outId);
      } else if (e.key === 'b' || e.key === 'B') {
        updateOutputConfig(outId, { blackout: !outputCfg.blackout });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isGridVisible, outId, outputCfg.blackout, outputCfg.showGrid, resetSingleOutputQuads, updateOutputConfig]);

  useEffect(() => {
    if (!draggingPin) return;

    const onPointerMove = (e: PointerEvent) => {
      const nx = Math.min(1, Math.max(0, e.clientX / Math.max(1, viewport.w)));
      const ny = Math.min(1, Math.max(0, e.clientY / Math.max(1, viewport.h)));

      const currentQuad = [...projectionState.quads[draggingPin.surfaceKey]] as QuadCorners;
      currentQuad[draggingPin.cornerIdx] = {
        x: Number(nx.toFixed(4)),
        y: Number(ny.toFixed(4)),
      };
      updateSurfaceQuad(draggingPin.surfaceKey, currentQuad);
    };

    const onPointerUp = () => setDraggingPin(null);

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [draggingPin, projectionState.quads, updateSurfaceQuad, viewport.h, viewport.w]);

  const getAspectForSurface = (sId: SurfaceId): number => {
    const dim = roomDimensions[sId];
    return dim.widthCm / Math.max(1, dim.heightCm);
  };

  const renderSurfaceScene = (sId: SurfaceId, aspect: number): React.ReactNode => {
    const dim = roomDimensions[sId];
    if (sId === 'leftWall') {
      return (
        <LeftWallScene
          surfaceId="leftWall"
          widthCm={dim.widthCm}
          heightCm={dim.heightCm}
          aspectRatio={aspect}
          renderContext="projector"
        />
      );
    }
    if (sId === 'rightWall') {
      return (
        <RightWallScene
          surfaceId="rightWall"
          widthCm={dim.widthCm}
          heightCm={dim.heightCm}
          aspectRatio={aspect}
          renderContext="projector"
        />
      );
    }
    return (
      <CeilingScene
        surfaceId="ceiling"
        widthCm={dim.widthCm}
        heightCm={dim.heightCm}
        aspectRatio={aspect}
        renderContext="projector"
      />
    );
  };

  return (
    <main
      ref={containerRef}
      className="relative h-dvh w-screen overflow-hidden bg-black select-none"
      style={{ backgroundColor: '#000000' }}
      data-testid={`projector-view-${outId}`}
    >
      {!isBlackout &&
        outputCfg.surfaces.map((surfaceId) => {
          const quadKey = makeSurfaceQuadKey(outId, surfaceId);
          const meta = SURFACE_META[surfaceId];
          const aspect = getAspectForSurface(surfaceId);
          const srcW = Math.round(BASE_H * Math.max(0.4, Math.min(2.5, aspect || BASE_W / BASE_H)));
          const srcH = BASE_H;
          const normQuad = projectionState.quads[quadKey];
          const dstPixels: [Point2D, Point2D, Point2D, Point2D] = [
            { x: normQuad[0].x * viewport.w, y: normQuad[0].y * viewport.h },
            { x: normQuad[1].x * viewport.w, y: normQuad[1].y * viewport.h },
            { x: normQuad[2].x * viewport.w, y: normQuad[2].y * viewport.h },
            { x: normQuad[3].x * viewport.w, y: normQuad[3].y * viewport.h },
          ];
          const fittedPixels = fitQuadAspectContain(srcW, srcH, dstPixels);
          const matrix3d = computeHomographyMatrix3d(srcW, srcH, fittedPixels);

          return (
            <div
              key={`${quadKey}-${sceneReplayKey}`}
              className="absolute top-0 left-0 overflow-hidden bg-black"
              style={{
                width: `${srcW}px`,
                height: `${srcH}px`,
                transformOrigin: '0 0',
                transform: matrix3d,
                backgroundColor: '#000000',
              }}
            >
              {renderSurfaceScene(surfaceId, aspect)}

              {(() => {
                const edgeMask = projectionState.edgeMasks?.[quadKey];
                if (!edgeMask) return null;
                return (
                  <>
                    {edgeMask.leftPct > 0 && (
                      <div
                        className="pointer-events-none absolute inset-y-0 left-0"
                        style={{
                          width: `${edgeMask.leftPct}%`,
                          background:
                            'linear-gradient(to right, #000000 0%, rgba(0,0,0,0.68) 42%, rgba(0,0,0,0) 100%)',
                        }}
                      />
                    )}
                    {edgeMask.rightPct > 0 && (
                      <div
                        className="pointer-events-none absolute inset-y-0 right-0"
                        style={{
                          width: `${edgeMask.rightPct}%`,
                          background:
                            'linear-gradient(to left, #000000 0%, rgba(0,0,0,0.68) 42%, rgba(0,0,0,0) 100%)',
                        }}
                      />
                    )}
                    {edgeMask.topPct > 0 && (
                      <div
                        className="pointer-events-none absolute inset-x-0 top-0"
                        style={{
                          height: `${edgeMask.topPct}%`,
                          background:
                            'linear-gradient(to bottom, #000000 0%, rgba(0,0,0,0.68) 42%, rgba(0,0,0,0) 100%)',
                        }}
                      />
                    )}
                    {edgeMask.bottomPct > 0 && (
                      <div
                        className="pointer-events-none absolute inset-x-0 bottom-0"
                        style={{
                          height: `${edgeMask.bottomPct}%`,
                          background:
                            'linear-gradient(to top, #000000 0%, rgba(0,0,0,0.68) 42%, rgba(0,0,0,0) 100%)',
                        }}
                      />
                    )}
                  </>
                );
              })()}

              {isGridVisible && (
                <div
                  className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
                  style={{
                    border: `3px solid ${meta.accentHex}`,
                    backgroundImage: `
                      linear-gradient(to right, rgba(255,255,255,0.16) 1px, transparent 1px),
                      linear-gradient(to bottom, rgba(255,255,255,0.16) 1px, transparent 1px)
                    `,
                    backgroundSize: `${srcW / 8}px ${srcH / 8}px`,
                  }}
                >
                  <div
                    className="relative flex h-28 w-28 items-center justify-center rounded-full border-2"
                    style={{ borderColor: meta.accentHex }}
                  >
                    <div className="absolute h-full w-0.5 bg-white/60" />
                    <div className="absolute h-0.5 w-full bg-white/60" />
                  </div>
                  <div
                    className="mt-4 rounded-xl bg-black/90 px-5 py-2 text-lg font-bold tracking-wider uppercase"
                    style={{ color: meta.accentHex, border: `1px solid ${meta.accentHex}` }}
                  >
                    OUT {outId} · {isPt ? meta.titlePt : meta.titleEn}
                  </div>
                  <span className="mt-1.5 rounded bg-black/85 px-3 py-1 text-xs text-slate-300 [font-variant-numeric:tabular-nums]">
                    {isPt
                      ? 'Arraste os 4 vértices · Tecla C fecha grade · Tecla R reseta · Tecla B blackout'
                      : 'Drag 4 pins · Key C hides grid · Key R resets · Key B blackout'}
                  </span>
                </div>
              )}
            </div>
          );
        })}

      {/* Handles arrastáveis de Corner-Pin (visíveis apenas com grade ativa e sem blackout) */}
      {!isBlackout &&
        isGridVisible &&
        outputCfg.surfaces.map((surfaceId) => {
          const quadKey = makeSurfaceQuadKey(outId, surfaceId);
          const meta = SURFACE_META[surfaceId];
          const normQuad = projectionState.quads[quadKey];
          const cornerLabels = ['TL', 'TR', 'BR', 'BL'] as const;
          return normQuad.map((pt, idx) => {
            const cornerIdx = idx as 0 | 1 | 2 | 3;
            return (
              <button
                key={`${quadKey}-${cornerLabels[idx]}`}
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  setDraggingPin({ surfaceKey: quadKey, cornerIdx });
                }}
                className="absolute z-50 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 cursor-grab items-center justify-center rounded-full border-2 bg-black/90 text-[11px] font-bold text-white active:cursor-grabbing"
                style={{
                  left: `${pt.x * 100}%`,
                  top: `${pt.y * 100}%`,
                  borderColor: meta.accentHex,
                }}
                title={`OUT ${outId} · ${isPt ? meta.titlePt : meta.titleEn} · ${cornerLabels[idx]}`}
              >
                {cornerLabels[idx]}
              </button>
            );
          });
        })}

      {/* Overlay Técnico Temporário "Identificar Projetores" acionado pelo Admin */}
      {isIdentifying && !isBlackout && (
        <div className="pointer-events-none absolute inset-0 z-40 flex flex-col items-center justify-center border-4 border-sky-400/80 bg-black/80 p-8 text-center">
          <div className="rounded-2xl border border-sky-400/40 bg-[#050811]/95 px-10 py-8">
            <div className="text-sm font-semibold tracking-widest text-sky-300 uppercase">
              EARTH JUKEBOX · STAGE IDENTIFY
            </div>
            <div className="mt-2 text-7xl font-bold tracking-tight text-white [font-variant-numeric:tabular-nums]">
              OUT {outId}
            </div>
            <div className="mt-3 text-base font-medium text-slate-200">
              {outputCfg.surfaces.length === 0
                ? isPt
                  ? 'Sem superfície atribuída · Standby #000000'
                  : 'No assigned surface · Standby #000000'
                : outputCfg.surfaces
                    .map((s) => (isPt ? SURFACE_META[s].titlePt : SURFACE_META[s].titleEn))
                    .join('  +  ')}
            </div>
            <div className="mt-2 text-xs text-slate-400 [font-variant-numeric:tabular-nums]">
              {viewport.w} × {viewport.h} px
            </div>
          </div>
        </div>
      )}
    </main>
  );
};
