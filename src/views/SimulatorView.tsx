import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowUp,
  Box,
  Columns3,
  Compass,
  Eye,
  EyeOff,
  Maximize2,
  Minus,
  Pause,
  Play,
  Plus,
  SlidersHorizontal,
} from 'lucide-react';
import { useExperience } from '../experience/ExperienceContext';
import {
  LAYER_METAS,
  PILOT_COUNTRY_IDS,
  SoloableLayerId,
  VISUAL_LAYER_ORDER,
} from '../experience/types';
import { CeilingScene } from '../scenes/CeilingScene';
import { LeftWallScene } from '../scenes/LeftWallScene';
import { RightWallScene } from '../scenes/RightWallScene';

export type CameraPresetId = 'overview' | 'visitor' | 'ceiling' | 'flat';

interface SimulatorViewProps {
  embedded?: boolean;
  preset?: CameraPresetId;
  onPresetChange?: (preset: CameraPresetId) => void;
  hideBrandTitle?: boolean;
}

const LOGICAL_SCENE_HEIGHT = 960;

/**
 * Renders any scene at the same logical resolution as the Projector (960px height)
 * and applies uniform scaling so the 3D Simulator, Demo, and Projector are 1:1 faithful.
 */
const LogicalSceneViewport: React.FC<{
  aspectRatio: number;
  targetWidth?: number;
  children: React.ReactNode;
}> = ({ aspectRatio, targetWidth, children }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [measuredWidth, setMeasuredWidth] = useState<number>(targetWidth ?? 300);
  const logicalWidth = Math.max(1, Math.round(LOGICAL_SCENE_HEIGHT * aspectRatio));

  useEffect(() => {
    if (typeof targetWidth === 'number') {
      setMeasuredWidth(targetWidth);
      return;
    }
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      if (el.clientWidth > 0) setMeasuredWidth(el.clientWidth);
    };
    update();

    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [targetWidth]);

  const effectiveWidth = typeof targetWidth === 'number' ? targetWidth : measuredWidth;
  const scale = effectiveWidth / logicalWidth;

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-black">
      <div
        style={{
          width: `${logicalWidth}px`,
          height: `${LOGICAL_SCENE_HEIGHT}px`,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          position: 'relative',
        }}
      >
        {children}
      </div>
    </div>
  );
};

const PILOT_LABELS: Record<string, { flag: string; pt: string; en: string }> = {
  '076': { flag: '🇧🇷', pt: 'Brasil', en: 'Brazil' },
  '818': { flag: '🇪🇬', pt: 'Egito', en: 'Egypt' },
};

export const SimulatorView: React.FC<SimulatorViewProps> = ({
  embedded = false,
  preset: controlledPreset,
  onPresetChange,
  hideBrandTitle = embedded,
}) => {
  const {
    country,
    roomDimensions,
    lang,
    setLang,
    layers,
    playback,
    storyStep,
    missionPhase,
    selectCountry,
    toggleEye,
    toggleSolo,
    toggleSparkle,
    togglePlay,
    seekBar,
    setStoryStep,
    setMissionPhase,
  } = useExperience();

  const isPt = lang === 'pt';
  const [internalPreset, setInternalPreset] = useState<CameraPresetId>('overview');
  const preset = controlledPreset ?? internalPreset;
  const [yawDeg, setYawDeg] = useState<number>(-45);
  const [pitchDeg, setPitchDeg] = useState<number>(-16);
  const [zoomScale, setZoomScale] = useState<number>(1.32);
  const [showSeamGuides, setShowSeamGuides] = useState<boolean>(true);
  const [showControlDock, setShowControlDock] = useState<boolean>(!embedded);
  const [globeRotationPaused, setGlobeRotationPaused] = useState<boolean>(false);

  const dragStateRef = useRef<{
    startX: number;
    startY: number;
    startYaw: number;
    startPitch: number;
  } | null>(null);

  const applyCameraForPreset = (id: CameraPresetId) => {
    if (id === 'overview') {
      setYawDeg(-45);
      setPitchDeg(-16);
      setZoomScale(1.32);
    } else if (id === 'visitor') {
      setYawDeg(-45);
      setPitchDeg(8);
      setZoomScale(1.58);
    } else if (id === 'ceiling') {
      setYawDeg(-45);
      setPitchDeg(48);
      setZoomScale(1.38);
    }
  };

  useEffect(() => {
    if (controlledPreset) {
      applyCameraForPreset(controlledPreset);
    }
  }, [controlledPreset]);

  const applyPreset = (id: CameraPresetId) => {
    if (controlledPreset === undefined) {
      setInternalPreset(id);
    }
    onPresetChange?.(id);
    applyCameraForPreset(id);
  };

  const leftAspect = roomDimensions.leftWall.widthCm / Math.max(1, roomDimensions.leftWall.heightCm);
  const rightAspect =
    roomDimensions.rightWall.widthCm / Math.max(1, roomDimensions.rightWall.heightCm);
  const ceilingAspect =
    roomDimensions.ceiling.widthCm / Math.max(1, roomDimensions.ceiling.heightCm);

  // Exact geometric scale in pixels (1 cm -> ~0.82 px base) preserving real room proportions
  const maxCm = Math.max(
    roomDimensions.leftWall.widthCm,
    roomDimensions.rightWall.widthCm,
    roomDimensions.leftWall.heightCm,
    roomDimensions.ceiling.widthCm,
    100
  );
  const pxPerCm = (embedded ? 300 : 335) / maxCm;

  const leftW = Math.round(roomDimensions.leftWall.widthCm * pxPerCm);
  const leftH = Math.round(roomDimensions.leftWall.heightCm * pxPerCm);
  const rightW = Math.round(roomDimensions.rightWall.widthCm * pxPerCm);
  const rightH = Math.round(roomDimensions.rightWall.heightCm * pxPerCm);
  const ceilW = Math.round(roomDimensions.ceiling.widthCm * pxPerCm);
  const ceilD = Math.round(roomDimensions.ceiling.heightCm * pxPerCm);

  const seamBorderClass = showSeamGuides ? 'border border-sky-300/35' : 'border-0';

  return (
    <div
      className={`relative flex w-full flex-col overflow-hidden bg-[#050811] text-slate-100 ${
        embedded ? 'h-full' : 'h-dvh'
      }`}
      data-testid="simulator-view"
    >
      {/* Camera Presets Bar (aligned in height, spacing, and circumference with the Tablet bar) */}
      <div
        className={`z-20 flex min-h-[46px] shrink-0 items-center gap-2 overflow-x-auto border-b border-[#1e3a66]/45 bg-[#040b1a]/95 px-3.5 py-1.5 ${
          hideBrandTitle ? 'justify-between' : 'justify-between'
        }`}
      >
        {!hideBrandTitle ? (
          <div className="flex shrink-0 items-center gap-2.5">
            <Compass size={15} className="text-sky-400" />
            <span className="text-xs font-semibold text-slate-100">
              {isPt ? 'Simulador 3D do Quarto' : '3D Corner Room Simulator'}
            </span>
          </div>
        ) : (
          <span className="hidden shrink-0 text-[11px] font-medium text-slate-400 2xl:inline">
            {preset === 'flat'
              ? isPt
                ? 'Projeção 2D'
                : '2D Projection'
              : isPt
                ? 'Maquete 3D'
                : '3D Room'}
          </span>
        )}

        <div className="flex shrink-0 flex-nowrap items-center gap-1.5">
          {(
            [
              ['overview', isPt ? 'Canto 3D' : '3D Corner', isPt ? 'Visualizar Quarto 3D Projetado — Canto 3D' : 'Show 3D Projected Room — 3D Corner', Box],
              ['visitor', isPt ? 'Visão Visitante' : 'Visitor POV', isPt ? 'Visualizar Quarto 3D Projetado — Visão do Visitante' : 'Show 3D Projected Room — Visitor POV', Maximize2],
              ['ceiling', isPt ? 'Olhar p/ Teto' : 'Look at Ceiling', isPt ? 'Visualizar Quarto 3D Projetado — Olhar para o Teto' : 'Show 3D Projected Room — Look at Ceiling', ArrowUp],
              ['flat', isPt ? '2D · 3 Telas' : '2D · 3 Screens', isPt ? 'Visualizar Quarto Projetado em 2D — 3 Telas' : 'Show Projected Room in 2D — 3 Screens', Columns3],
            ] as const
          ).map(([id, label, ariaLabel, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => applyPreset(id)}
              aria-pressed={preset === id}
              aria-label={ariaLabel}
              className={`inline-flex min-h-[30px] shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-semibold tracking-tight transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7dd3fc] ${
                preset === id
                  ? 'border-[#2563eb]/75 bg-[#0c1a36] text-white'
                  : 'border-[#1e3a66]/65 bg-[#060c1a] text-slate-300 hover:border-[#2563eb]/60 hover:text-white'
              }`}
            >
              <Icon size={12} aria-hidden="true" />
              <span>{label}</span>
            </button>
          ))}

          <button
            type="button"
            onClick={() => setGlobeRotationPaused((v) => !v)}
            data-testid="simulator-globe-rotation-toggle"
            aria-pressed={globeRotationPaused}
            aria-label={
              globeRotationPaused
                ? isPt
                  ? 'Retomar rotação do globo 3D'
                  : 'Resume 3D globe rotation'
                : isPt
                  ? 'Pausar rotação do globo 3D'
                  : 'Pause 3D globe rotation'
            }
            title={
              globeRotationPaused
                ? isPt
                  ? 'Retomar rotação do globo 3D'
                  : 'Resume 3D globe rotation'
                : isPt
                  ? 'Pausar rotação do globo 3D'
                  : 'Pause 3D globe rotation'
            }
            className={`inline-flex min-h-[30px] shrink-0 cursor-pointer items-center gap-1 rounded-full border px-2.5 text-[11px] font-semibold tracking-tight transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7dd3fc] ${
              globeRotationPaused
                ? 'border-amber-400/50 bg-amber-400/15 text-amber-200'
                : 'border-[#1e3a66]/65 bg-[#060c1a] text-slate-300 hover:border-[#2563eb]/60 hover:text-white'
            }`}
          >
            {globeRotationPaused ? <Play size={11} aria-hidden="true" /> : <Pause size={11} aria-hidden="true" />}
            <span>{isPt ? (globeRotationPaused ? 'Globo Pausado' : 'Pausar Globo') : globeRotationPaused ? 'Globe Paused' : 'Pause Globe'}</span>
          </button>

          {preset !== 'flat' && (
            <button
              type="button"
              onClick={() => setShowSeamGuides((v) => !v)}
              aria-pressed={showSeamGuides}
              className={`min-h-[30px] shrink-0 cursor-pointer rounded-full border px-2.5 text-[11px] font-semibold tracking-tight transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7dd3fc] ${
                showSeamGuides
                  ? 'border-[#1e3a66]/65 bg-[#060c1a] text-slate-200 hover:border-[#2563eb]/60'
                  : 'border-[#1e3a66]/45 bg-transparent text-slate-400 hover:text-slate-200'
              }`}
              title={
                isPt
                  ? 'Oculte as guias para ver o breu #000000 real sem bordas!'
                  : 'Hide seam guides to preview seamless #000000 projection!'
              }
            >
              {isPt ? (showSeamGuides ? 'Guias: ON' : 'Breu #000') : showSeamGuides ? 'Guides: ON' : 'Pure #000'}
            </button>
          )}

          {!embedded && (
            <button
              type="button"
              onClick={() => setShowControlDock((v) => !v)}
              className={`inline-flex min-h-[30px] shrink-0 items-center gap-1 rounded-full border px-2.5 text-[11px] font-semibold transition ${
                showControlDock
                  ? 'border-amber-400/50 bg-amber-400/15 text-amber-200'
                  : 'border-slate-400/20 bg-white/[0.04] text-slate-300'
              }`}
            >
              <SlidersHorizontal size={13} />
              <span>{isPt ? 'Painel Piloto' : 'Pilot Dock'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Viewport: Flat 3-Screen Inspection OR Interactive 3D Joined Corner */}
      {preset === 'flat' ? (
        <div className="@container flex-1 overflow-auto">
          <div className="grid min-h-full grid-cols-1 content-center gap-3 p-3 @[880px]:grid-cols-3 @[880px]:gap-4 @[880px]:p-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium text-sky-300 [font-variant-numeric:tabular-nums]">
              1 · {isPt ? 'Parede Esquerda — Globo' : 'Left Wall — Globe'} ·{' '}
              {roomDimensions.leftWall.widthCm}×{roomDimensions.leftWall.heightCm} cm
            </span>
            <div
              className="pointer-events-none w-full overflow-hidden rounded-lg border border-slate-400/25 bg-black select-none"
              style={{ aspectRatio: String(leftAspect) }}
            >
              <LogicalSceneViewport aspectRatio={leftAspect}>
                <LeftWallScene
                  surfaceId="leftWall"
                  widthCm={roomDimensions.leftWall.widthCm}
                  heightCm={roomDimensions.leftWall.heightCm}
                  aspectRatio={leftAspect}
                  renderContext={embedded ? 'demo' : 'simulator'}
                  globeRotationPaused={globeRotationPaused}
                />
              </LogicalSceneViewport>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium text-amber-300 [font-variant-numeric:tabular-nums]">
              2 · {isPt ? 'Parede Direita — Jukebox Studio & MIDI' : 'Right Wall — Jukebox Studio & MIDI'} ·{' '}
              {roomDimensions.rightWall.widthCm}×{roomDimensions.rightWall.heightCm} cm
            </span>
            <div
              className="pointer-events-none w-full overflow-hidden rounded-lg border border-slate-400/25 bg-black select-none"
              style={{ aspectRatio: String(rightAspect) }}
            >
              <LogicalSceneViewport aspectRatio={rightAspect}>
                <RightWallScene
                  surfaceId="rightWall"
                  widthCm={roomDimensions.rightWall.widthCm}
                  heightCm={roomDimensions.rightWall.heightCm}
                  aspectRatio={rightAspect}
                  renderContext={embedded ? 'demo' : 'simulator'}
                />
              </LogicalSceneViewport>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium text-emerald-300 [font-variant-numeric:tabular-nums]">
              3 · {isPt ? 'Teto — 5 PNGs Empilhados' : 'Ceiling — 5 Stacked PNGs'} ·{' '}
              {roomDimensions.ceiling.widthCm}×{roomDimensions.ceiling.heightCm} cm
            </span>
            <div
              className="pointer-events-none w-full overflow-hidden rounded-lg border border-slate-400/25 bg-black select-none"
              style={{ aspectRatio: String(ceilingAspect) }}
            >
              <LogicalSceneViewport aspectRatio={ceilingAspect}>
                <CeilingScene
                  surfaceId="ceiling"
                  widthCm={roomDimensions.ceiling.widthCm}
                  heightCm={roomDimensions.ceiling.heightCm}
                  aspectRatio={ceilingAspect}
                  renderContext={embedded ? 'demo' : 'simulator'}
                />
              </LogicalSceneViewport>
            </div>
          </div>
          </div>
        </div>
      ) : (
        <div
          className="relative flex flex-1 cursor-grab items-center justify-center overflow-hidden bg-[#02040a] active:cursor-grabbing select-none"
          style={{ perspective: '980px' }}
          onPointerDown={(e) => {
            if ((e.target as HTMLElement).closest('button, input, select')) return;
            dragStateRef.current = {
              startX: e.clientX,
              startY: e.clientY,
              startYaw: yawDeg,
              startPitch: pitchDeg,
            };
          }}
          onPointerMove={(e) => {
            const st = dragStateRef.current;
            if (!st) return;
            const dx = e.clientX - st.startX;
            const dy = e.clientY - st.startY;
            setYawDeg(Math.max(-85, Math.min(-5, st.startYaw + dx * 0.28)));
            setPitchDeg(Math.max(-42, Math.min(68, st.startPitch - dy * 0.28)));
          }}
          onPointerUp={() => {
            dragStateRef.current = null;
          }}
          onPointerLeave={() => {
            dragStateRef.current = null;
          }}
          onWheel={(e) => {
            const next = Math.max(0.62, Math.min(2.4, zoomScale - e.deltaY * 0.0008));
            setZoomScale(Number(next.toFixed(3)));
          }}
        >
          {/* True 90° Orthogonal 3D Room: Vertex (0,0,0) = top junction of Left Wall + Right Wall + Ceiling */}
          <div
            style={{
              position: 'relative',
              width: 0,
              height: 0,
              transformStyle: 'preserve-3d',
              transform: `scale(${zoomScale}) rotateX(${pitchDeg}deg) rotateY(${yawDeg}deg) translate3d(${-Math.round(
                rightW * 0.42
              )}px, ${-Math.round(Math.max(leftH, rightH) * 0.44)}px, ${-Math.round(leftW * 0.42)}px)`,
              transition: dragStateRef.current ? 'none' : 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          >
            {/* 1. Left Wall (x = 0, z ∈ [0, leftW], facing +X into the room) */}
            <div
              className={`pointer-events-none absolute overflow-hidden bg-black shadow-2xl select-none ${seamBorderClass}`}
              style={{
                left: `${-leftW}px`,
                top: '0px',
                width: `${leftW}px`,
                height: `${leftH}px`,
                transformOrigin: '100% 0%',
                transform: 'rotateY(90deg)',
                backfaceVisibility: 'hidden',
                backgroundColor: '#000000',
              }}
            >
              <LogicalSceneViewport aspectRatio={leftAspect} targetWidth={leftW}>
                <LeftWallScene
                  surfaceId="leftWall"
                  widthCm={roomDimensions.leftWall.widthCm}
                  heightCm={roomDimensions.leftWall.heightCm}
                  aspectRatio={leftAspect}
                  renderContext={embedded ? 'demo' : 'simulator'}
                  globeRotationPaused={globeRotationPaused}
                />
              </LogicalSceneViewport>
            </div>

            {/* 2. Right Wall (z = 0, x ∈ [0, rightW], facing +Z into the room) */}
            <div
              className={`pointer-events-none absolute overflow-hidden bg-black shadow-2xl select-none ${seamBorderClass}`}
              style={{
                left: '0px',
                top: '0px',
                width: `${rightW}px`,
                height: `${rightH}px`,
                transformOrigin: '0% 0%',
                backgroundColor: '#000000',
              }}
            >
              <LogicalSceneViewport aspectRatio={rightAspect} targetWidth={rightW}>
                <RightWallScene
                  surfaceId="rightWall"
                  widthCm={roomDimensions.rightWall.widthCm}
                  heightCm={roomDimensions.rightWall.heightCm}
                  aspectRatio={rightAspect}
                  renderContext={embedded ? 'demo' : 'simulator'}
                />
              </LogicalSceneViewport>
            </div>

            {/* 3. Ceiling (y = 0, x ∈ [0, ceilW], z ∈ [0, ceilD], facing down +Y for someone looking up) */}
            <div
              className={`pointer-events-none absolute overflow-hidden bg-black shadow-2xl select-none ${seamBorderClass}`}
              style={{
                left: '0px',
                top: `${-ceilD}px`,
                width: `${ceilW}px`,
                height: `${ceilD}px`,
                transformOrigin: '0% 100%',
                transform: 'rotateX(-90deg)',
                backgroundColor: '#000000',
              }}
            >
              <LogicalSceneViewport aspectRatio={ceilingAspect} targetWidth={ceilW}>
                <CeilingScene
                  surfaceId="ceiling"
                  widthCm={roomDimensions.ceiling.widthCm}
                  heightCm={roomDimensions.ceiling.heightCm}
                  aspectRatio={ceilingAspect}
                  renderContext={embedded ? 'demo' : 'simulator'}
                />
              </LogicalSceneViewport>
            </div>
          </div>

          <div
            className="absolute right-3.5 top-1/2 z-20 flex -translate-y-1/2 flex-col items-center gap-1 rounded-xl border border-slate-400/20 bg-[#080d19]/90 p-1 backdrop-blur-sm"
            data-testid="simulator-zoom-controls"
          >
            <button
              type="button"
              onClick={() =>
                setZoomScale((prev) => Number(Math.min(2.4, prev + 0.15).toFixed(3)))
              }
              disabled={zoomScale >= 2.4}
              aria-label={isPt ? 'Aproximar simulação 3D' : 'Zoom in 3D simulation'}
              title={isPt ? 'Aproximar' : 'Zoom in'}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-200 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:cursor-not-allowed disabled:opacity-35"
            >
              <Plus size={15} />
            </button>
            <div className="h-[1px] w-5 bg-slate-400/20" aria-hidden="true" />
            <button
              type="button"
              onClick={() =>
                setZoomScale((prev) => Number(Math.max(0.62, prev - 0.15).toFixed(3)))
              }
              disabled={zoomScale <= 0.62}
              aria-label={isPt ? 'Afastar simulação 3D' : 'Zoom out 3D simulation'}
              title={isPt ? 'Afastar' : 'Zoom out'}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-200 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:cursor-not-allowed disabled:opacity-35"
            >
              <Minus size={15} />
            </button>
          </div>

          <div className="pointer-events-none absolute bottom-3 left-3.5 rounded-full border border-slate-400/15 bg-[#080d19]/80 px-3 py-1 text-[11px] text-slate-400 [font-variant-numeric:tabular-nums]">
            {isPt
              ? 'Arraste para girar o quarto · Scroll para zoom'
              : 'Drag to orbit corner · Scroll to zoom'}{' '}
            · Yaw {Math.round(yawDeg)}° · Pitch {Math.round(pitchDeg)}° · {Math.round(zoomScale * 100)}%
          </div>
        </div>
      )}

      {/* Quick Validation Workbench for Shay (Person 1): 3 Pilot Countries + 5 Photoshop Eyes + Play/Story */}
      {!embedded && showControlDock && (
        <aside
          className="z-20 border-t border-slate-400/15 bg-[#080d19]/95 px-4 py-3 backdrop-blur-md"
          data-testid="simulator-pilot-dock"
        >
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
            {/* 1. Instant selection of Pilot Countries (Brazil, Egypt) */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
                {isPt ? 'Pilotos:' : 'Pilots:'}
              </span>
              {PILOT_COUNTRY_IDS.map((pid) => {
                const info = PILOT_LABELS[pid];
                const active = country?.id === pid;
                return (
                  <button
                    key={pid}
                    type="button"
                    onClick={() => {
                      selectCountry(pid);
                      if (missionPhase === 'idle') {
                        setMissionPhase('exploring');
                      }
                      if (storyStep === 0) {
                        setStoryStep(1);
                      }
                    }}
                    className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition ${
                      active
                        ? 'border-amber-400/70 bg-amber-400/15 text-amber-100 shadow-sm'
                        : 'border-slate-400/20 bg-white/[0.04] text-slate-200 hover:bg-white/[0.09]'
                    }`}
                  >
                    <span>{info.flag}</span>
                    <span>{isPt ? info.pt : info.en}</span>
                  </button>
                );
              })}
            </div>

            {/* 2. The 5 Photoshop-style Eyes + Solo (S) + Storm */}
            <div className="flex flex-wrap items-center gap-1.5">
              {VISUAL_LAYER_ORDER.map((layerId) => {
                const meta = LAYER_METAS[layerId];
                const enabled = layers[layerId].enabled;
                const isSoloable =
                  layerId === 'melody' || layerId === 'chords' || layerId === 'bass';
                const isSolo = isSoloable && layers[layerId].solo;

                return (
                  <div
                    key={layerId}
                    className="inline-flex min-h-[38px] items-center rounded-xl border border-slate-400/20 bg-white/[0.03] p-0.5"
                  >
                    <button
                      type="button"
                      onClick={() => toggleEye(layerId)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition"
                      style={{
                        color: enabled ? meta.accentHex : '#64748b',
                        backgroundColor: enabled ? `${meta.accentHex}18` : 'transparent',
                      }}
                      title={isPt ? meta.phenomenonPt : meta.phenomenonEn}
                    >
                      {enabled ? <Eye size={13} /> : <EyeOff size={13} />}
                      <span>{isPt ? meta.labelPt : meta.labelEn}</span>
                    </button>

                    {isSoloable && (
                      <button
                        type="button"
                        onClick={() => toggleSolo(layerId as SoloableLayerId)}
                        className={`mr-0.5 h-7 w-7 rounded-lg text-[11px] font-bold transition ${
                          isSolo
                            ? 'bg-amber-400 text-slate-950'
                            : 'text-slate-400 hover:bg-white/10 hover:text-slate-100'
                        }`}
                        title="Solo"
                      >
                        S
                      </button>
                    )}

                    {layerId === 'melody' && (
                      <button
                        type="button"
                        onClick={toggleSparkle}
                        className={`mr-0.5 rounded-lg px-1.5 py-1 text-[10px] font-semibold transition ${
                          layers.melody.sparkleEnabled
                            ? 'bg-amber-400/20 text-amber-200'
                            : 'text-slate-500 hover:text-slate-300'
                        }`}
                        title={isPt ? 'Sub-camada Tempestade' : 'Storm Sparkle sub-layer'}
                      >
                        ⚡
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 3. Transport (Play/Pause + Bar/Measure) + Robot Step + PT/EN */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (missionPhase === 'idle') {
                    setMissionPhase('exploring');
                    if (storyStep === 0) setStoryStep(1);
                  }
                  togglePlay();
                }}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-amber-400 px-3.5 text-xs font-bold text-slate-950 transition hover:bg-amber-300"
              >
                {playback.isPlaying ? <Pause size={14} /> : <Play size={14} />}
                <span>{playback.isPlaying ? (isPt ? 'Pausar' : 'Pause') : isPt ? 'Tocar' : 'Play'}</span>
              </button>

              <div className="inline-flex items-center gap-1 rounded-xl border border-slate-400/20 bg-white/[0.03] p-1">
                {[0, 1, 2, 3].map((stepIdx) => (
                  <button
                    key={stepIdx}
                    type="button"
                    onClick={() => setStoryStep(stepIdx)}
                    className={`h-7 rounded-lg px-2 text-[11px] font-semibold [font-variant-numeric:tabular-nums] ${
                      storyStep === stepIdx
                        ? 'bg-sky-400/25 text-sky-200'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title={isPt ? `Fala ${stepIdx + 1} do Robozinho` : `Robot Story Step ${stepIdx + 1}`}
                  >
                    🤖 {stepIdx + 1}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => seekBar((playback.bar + 1) % playback.totalBars)}
                className="min-h-[38px] rounded-xl border border-slate-400/20 bg-white/[0.03] px-2.5 text-[11px] font-medium text-slate-200 [font-variant-numeric:tabular-nums]"
                title={isPt ? 'Avançar compasso' : 'Next bar'}
              >
                {isPt ? 'Comp.' : 'Bar'} {playback.bar + 1}/{playback.totalBars}
              </button>

              <button
                type="button"
                onClick={() => setLang(isPt ? 'en' : 'pt')}
                className="min-h-[38px] rounded-xl border border-slate-400/20 bg-white/[0.04] px-3 text-xs font-semibold text-slate-100"
              >
                {isPt ? 'PT' : 'EN'}
              </button>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
};
