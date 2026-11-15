import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ProjectorDelayBoundary,
  useAudioAdmin,
  useExperience,
  useProjectionAdmin,
} from '../experience/ExperienceContext';
import { ProjectorOutId, SurfaceId } from '../experience/types';
import { buildCalibrationGridCircles } from '../projection/calibrationCircles';
import {
  CalibrationSurfaceKey,
  computeHomographyMatrix3d,
  fitQuadAspectContain,
  getUniquePinHandlesForOutput,
  makeSurfaceQuadKey,
  Point2D,
  QuadCorners,
} from '../projection/homography';
import { computeEffectiveScreenDelays } from '../projection/screenDelay';
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
  const { calibTestMode, calibBeatSeq, screenSyncPulseActive, speakerCalibration } =
    useAudioAdmin();
  const {
    projectionState,
    updateOutputConfig,
    updateSurfaceQuad,
    resetSingleOutputQuads,
  } = useProjectionAdmin();

  const isPt = lang === 'pt';
  const containerRef = useRef<HTMLElement | null>(null);
  const [beatFlashOn, setBeatFlashOn] = useState<boolean>(false);

  const effectiveScreenDelays = useMemo(
    () => computeEffectiveScreenDelays(projectionState.outputs),
    [projectionState.outputs]
  );
  const outputDelayMs = effectiveScreenDelays[outId] ?? 0;

  useEffect(() => {
    if (calibBeatSeq <= 0) {
      setBeatFlashOn(false);
      return;
    }
    let offTimer: number | undefined;
    const triggerFlash = () => {
      setBeatFlashOn(true);
      offTimer = window.setTimeout(() => setBeatFlashOn(false), 115);
    };
    if (outputDelayMs <= 0) {
      triggerFlash();
      return () => {
        if (offTimer !== undefined) window.clearTimeout(offTimer);
      };
    }
    const startTimer = window.setTimeout(triggerFlash, outputDelayMs);
    return () => {
      window.clearTimeout(startTimer);
      if (offTimer !== undefined) window.clearTimeout(offTimer);
    };
  }, [calibBeatSeq, outputDelayMs]);

  const isClickSyncActive =
    calibTestMode.kind === 'delay-click-multi' ||
    calibTestMode.kind === 'delay-click-all' ||
    calibTestMode.kind === 'delay-click' ||
    screenSyncPulseActive;

  const [viewport, setViewport] = useState<{ w: number; h: number }>(() => ({
    w: typeof window !== 'undefined' ? Math.max(1, window.innerWidth) : 1920,
    h: typeof window !== 'undefined' ? Math.max(1, window.innerHeight) : 1080,
  }));

  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [localIdentifyUntil, setLocalIdentifyUntil] = useState<number>(() => projectionState.identifyUntil);
  const lastIdentifyNonceRef = useRef<number>(projectionState.identifyNonce ?? 0);

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
  const isIdentifying = localIdentifyUntil > nowMs;

  useEffect(() => {
    const incomingNonce = projectionState.identifyNonce ?? 0;
    let targetUntil = projectionState.identifyUntil;
    if (incomingNonce > 0 && incomingNonce !== lastIdentifyNonceRef.current) {
      lastIdentifyNonceRef.current = incomingNonce;
      targetUntil = Date.now() + (projectionState.identifyDurationMs ?? 7000);
    }
    setLocalIdentifyUntil(targetUntil);
    if (targetUntil <= Date.now()) return;
    setNowMs(Date.now());
    const timer = window.setInterval(() => {
      const curr = Date.now();
      setNowMs(curr);
      if (curr >= targetUntil) {
        window.clearInterval(timer);
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [
    projectionState.identifyDurationMs,
    projectionState.identifyNonce,
    projectionState.identifyUntil,
  ]);

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
        updateOutputConfig(outId, { showGrid: !isGridVisible });
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
      <ProjectorDelayBoundary delayMs={outputDelayMs}>
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

              {isGridVisible && (() => {
                const circles = buildCalibrationGridCircles(srcW, srcH);
                const surfaceDim = roomDimensions[surfaceId];
                return (
                  <div
                    data-testid={`projector-grid-${surfaceId}`}
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
                    <svg
                      viewBox={`0 0 ${srcW} ${srcH}`}
                      data-testid={`projector-grid-circles-${surfaceId}`}
                      className="absolute inset-0 h-full w-full"
                    >
                      <line
                        x1={0}
                        y1={0}
                        x2={srcW}
                        y2={srcH}
                        stroke="rgba(255,255,255,0.16)"
                        strokeWidth={1.5}
                        strokeDasharray="10 10"
                      />
                      <line
                        x1={srcW}
                        y1={0}
                        x2={0}
                        y2={srcH}
                        stroke="rgba(255,255,255,0.16)"
                        strokeWidth={1.5}
                        strokeDasharray="10 10"
                      />
                      {circles.map((c) => {
                        const crossArm = Math.min(18, c.r * 0.45);
                        const isCenter = c.kind === 'center';
                        return (
                          <g key={c.id}>
                            <circle
                              cx={c.cx}
                              cy={c.cy}
                              r={c.r}
                              fill="none"
                              stroke={isCenter ? meta.accentHex : 'rgba(255,255,255,0.78)'}
                              strokeOpacity={isCenter ? 0.9 : c.kind === 'corner' ? 0.85 : 0.65}
                              strokeWidth={isCenter ? 2.5 : c.kind === 'corner' ? 2 : 1.5}
                            />
                            <circle
                              cx={c.cx}
                              cy={c.cy}
                              r={2.5}
                              fill={isCenter ? meta.accentHex : '#ffffff'}
                            />
                            <line
                              x1={c.cx - crossArm}
                              y1={c.cy}
                              x2={c.cx + crossArm}
                              y2={c.cy}
                              stroke={isCenter ? meta.accentHex : 'rgba(255,255,255,0.55)'}
                              strokeWidth={1.25}
                            />
                            <line
                              x1={c.cx}
                              y1={c.cy - crossArm}
                              x2={c.cx}
                              y2={c.cy + crossArm}
                              stroke={isCenter ? meta.accentHex : 'rgba(255,255,255,0.55)'}
                              strokeWidth={1.25}
                            />
                          </g>
                        );
                      })}
                    </svg>

                    <div
                      className="relative z-10 rounded-xl bg-black/90 px-5 py-2 text-lg font-bold tracking-wider uppercase"
                      style={{ color: meta.accentHex, border: `1px solid ${meta.accentHex}` }}
                    >
                      OUT {outId} · {isPt ? meta.titlePt : meta.titleEn} · {surfaceDim.widthCm}×{surfaceDim.heightCm} cm
                    </div>
                    <span className="relative z-10 mt-1.5 rounded bg-black/85 px-3 py-1 text-xs text-slate-300 [font-variant-numeric:tabular-nums]">
                      {isPt
                        ? 'Observe os círculos na parede: se ficarem redondos, a proporção está correta · C fecha grade · R reseta · B blackout'
                        : 'Check scattered circles on the wall: round circles confirm true proportions · C hides grid · R resets · B blackout'}
                    </span>
                  </div>
                );
              })()}
            </div>
            );
          })}
      </ProjectorDelayBoundary>

      {/* Handles arrastáveis de Corner-Pin (com pins compartilhados soldados em 1 única alça limpa) */}
      {!isBlackout &&
        isGridVisible &&
        getUniquePinHandlesForOutput(outId, outputCfg.surfaces, projectionState.quads).map(
          (handle) => {
            const meta = SURFACE_META[handle.surfaceId];
            return (
              <button
                key={handle.id}
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  setDraggingPin({ surfaceKey: handle.quadKey, cornerIdx: handle.cornerIdx });
                }}
                className={`absolute z-50 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 cursor-grab items-center justify-center rounded-full border-2 bg-black/90 text-[11px] font-bold text-white active:cursor-grabbing ${
                  handle.isShared ? 'ring-2 ring-sky-300/60' : ''
                }`}
                style={{
                  left: `${handle.point.x * 100}%`,
                  top: `${handle.point.y * 100}%`,
                  borderColor: handle.isShared ? '#f8fafc' : meta.accentHex,
                }}
                title={
                  handle.isShared
                    ? `OUT ${outId} · ${isPt ? 'Junta Soldada' : 'Welded Joint'} (${handle.memberCount}×)`
                    : `OUT ${outId} · ${isPt ? meta.titlePt : meta.titleEn} · ${handle.label}`
                }
              >
                {handle.isShared ? `${handle.memberCount}×` : handle.label}
              </button>
            );
          }
        )}

      {/* Flash Visual de Sincronia Vídeo × Som (ativo apenas durante Pulso Rítmico de Calibração) */}
      {isClickSyncActive && !isBlackout && (
        <div
          data-testid="projector-sync-beat-flash"
          className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center"
        >
          <div
            style={{
              transition: beatFlashOn ? 'none' : 'all 130ms ease-out',
            }}
            className={`flex flex-col items-center justify-center rounded-3xl border-4 px-10 py-8 text-center [font-variant-numeric:tabular-nums] ${
              beatFlashOn
                ? 'scale-105 border-white bg-white text-black shadow-[0_0_90px_rgba(255,255,255,0.95)]'
                : 'scale-100 border-sky-400/50 bg-black/88 text-slate-200'
            }`}
          >
            <div
              style={{ transition: beatFlashOn ? 'none' : 'all 130ms ease-out' }}
              className={`h-12 w-12 rounded-full ${
                beatFlashOn ? 'bg-black' : 'border-2 border-sky-400/70 bg-transparent'
              }`}
            />
            <div className="mt-3 text-xl font-bold tracking-wider uppercase">
              {screenSyncPulseActive
                ? isPt
                  ? 'SINCRONIA ENTRE TELAS'
                  : 'SCREEN TO SCREEN SYNC'
                : isPt
                  ? 'SINCRONIA VÍDEO × SOM'
                  : 'VIDEO × AUDIO SYNC'}
            </div>
            <div
              className={`mt-1 text-sm font-semibold ${
                beatFlashOn ? 'text-slate-900' : 'text-sky-300'
              }`}
            >
              OUT {outId} ·{' '}
              {isPt ? 'Delay tela' : 'Screen delay'}: +{outputDelayMs} ms
              {!screenSyncPulseActive && (
                <>
                  {' · A/V '}
                  {(speakerCalibration.avOffsetMs ?? 0) > 0
                    ? `+${speakerCalibration.avOffsetMs} ms`
                    : `${speakerCalibration.avOffsetMs ?? 0} ms`}
                </>
              )}
            </div>
          </div>
        </div>
      )}

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
