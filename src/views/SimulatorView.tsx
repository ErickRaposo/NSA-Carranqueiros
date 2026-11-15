import React, { useRef, useState } from 'react';
import {
  Box,
  Columns3,
  Compass,
  Eye,
  EyeOff,
  Maximize2,
  Pause,
  Play,
  SlidersHorizontal,
  Sparkles,
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

interface SimulatorViewProps {
  embedded?: boolean;
}

type CameraPresetId = 'overview' | 'visitor' | 'ceiling' | 'flat';

const PILOT_LABELS: Record<string, { flag: string; pt: string; en: string }> = {
  '076': { flag: '🇧🇷', pt: 'Brasil', en: 'Brazil' },
  '818': { flag: '🇪🇬', pt: 'Egito', en: 'Egypt' },
};

export const SimulatorView: React.FC<SimulatorViewProps> = ({ embedded = false }) => {
  const {
    country,
    roomDimensions,
    lang,
    setLang,
    layers,
    playback,
    storyStep,
    selectCountry,
    toggleEye,
    toggleSolo,
    toggleSparkle,
    togglePlay,
    seekBar,
    setStoryStep,
  } = useExperience();

  const isPt = lang === 'pt';
  const [preset, setPreset] = useState<CameraPresetId>('overview');
  const [yawDeg, setYawDeg] = useState<number>(-45);
  const [pitchDeg, setPitchDeg] = useState<number>(-16);
  const [zoomScale, setZoomScale] = useState<number>(1.0);
  const [showSeamGuides, setShowSeamGuides] = useState<boolean>(true);
  const [showControlDock, setShowControlDock] = useState<boolean>(!embedded);

  const dragStateRef = useRef<{
    startX: number;
    startY: number;
    startYaw: number;
    startPitch: number;
  } | null>(null);

  const applyPreset = (id: CameraPresetId) => {
    setPreset(id);
    if (id === 'overview') {
      setYawDeg(-45);
      setPitchDeg(-16);
      setZoomScale(1.0);
    } else if (id === 'visitor') {
      setYawDeg(-45);
      setPitchDeg(8);
      setZoomScale(1.42);
    } else if (id === 'ceiling') {
      setYawDeg(-45);
      setPitchDeg(48);
      setZoomScale(1.22);
    }
  };

  const leftAspect = roomDimensions.leftWall.widthCm / Math.max(1, roomDimensions.leftWall.heightCm);
  const rightAspect =
    roomDimensions.rightWall.widthCm / Math.max(1, roomDimensions.rightWall.heightCm);
  const ceilingAspect =
    roomDimensions.ceiling.widthCm / Math.max(1, roomDimensions.ceiling.heightCm);

  // Escala geométrica exata em pixels (1 cm -> ~0.82 px base) mantendo proporções reais da sala
  const maxCm = Math.max(
    roomDimensions.leftWall.widthCm,
    roomDimensions.rightWall.widthCm,
    roomDimensions.leftWall.heightCm,
    roomDimensions.ceiling.widthCm,
    100
  );
  const pxPerCm = (embedded ? 250 : 310) / maxCm;

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
      {/* Top Header & Camera Presets */}
      <div className="z-20 flex flex-wrap items-center justify-between gap-2 border-b border-slate-400/15 bg-[#080d19]/95 px-3.5 py-2">
        <div className="flex items-center gap-2.5">
          <Compass size={15} className="text-sky-400" />
          <span className="text-xs font-semibold text-slate-100">
            {isPt
              ? 'Simulador 3D do Quarto (2 Paredes 90° + Teto)'
              : '3D Corner Room Simulator (2 Walls 90° + Ceiling)'}
          </span>
          {country && (
            <span className="hidden rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-0.5 text-[11px] font-medium text-amber-200 sm:inline-block [font-variant-numeric:tabular-nums]">
              {isPt ? country.namePt : country.nameEn} · {playback.bpm} BPM · {playback.activeChord}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              ['overview', isPt ? 'Canto 3D' : '3D Corner', Box],
              ['visitor', isPt ? 'Visão Visitante' : 'Visitor POV', Maximize2],
              ['ceiling', isPt ? 'Olhar p/ Teto' : 'Look at Ceiling', Sparkles],
              ['flat', isPt ? 'Planificar 3 Telas' : 'Unfold 3 Screens', Columns3],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => applyPreset(id)}
              className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-semibold transition ${
                preset === id
                  ? 'border-sky-400/60 bg-sky-400/15 text-sky-200'
                  : 'border-slate-400/20 bg-white/[0.04] text-slate-300 hover:bg-white/[0.09]'
              }`}
            >
              <Icon size={13} />
              <span>{label}</span>
            </button>
          ))}

          {preset !== 'flat' && (
            <button
              type="button"
              onClick={() => setShowSeamGuides((v) => !v)}
              className={`min-h-[34px] rounded-full border px-2.5 text-[11px] font-medium transition ${
                showSeamGuides
                  ? 'border-slate-400/30 bg-white/[0.07] text-slate-200'
                  : 'border-slate-400/15 bg-transparent text-slate-400'
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
              className={`inline-flex min-h-[34px] items-center gap-1 rounded-full border px-2.5 text-[11px] font-semibold transition ${
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
        <div className="grid flex-1 grid-cols-1 gap-3 overflow-auto p-4 lg:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium text-sky-300 [font-variant-numeric:tabular-nums]">
              1 · {isPt ? 'Parede Esquerda — Globo' : 'Left Wall — Globe'} (
              {roomDimensions.leftWall.widthCm}×{roomDimensions.leftWall.heightCm} cm)
            </span>
            <div
              className="w-full overflow-hidden rounded-lg border border-slate-400/25 bg-black"
              style={{ aspectRatio: String(leftAspect) }}
            >
              <LeftWallScene
                surfaceId="leftWall"
                widthCm={roomDimensions.leftWall.widthCm}
                heightCm={roomDimensions.leftWall.heightCm}
                aspectRatio={leftAspect}
                renderContext={embedded ? 'demo' : 'simulator'}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium text-amber-300 [font-variant-numeric:tabular-nums]">
              2 · {isPt ? 'Parede Direita — Robozinho' : 'Right Wall — Robot'} (
              {roomDimensions.rightWall.widthCm}×{roomDimensions.rightWall.heightCm} cm)
            </span>
            <div
              className="w-full overflow-hidden rounded-lg border border-slate-400/25 bg-black"
              style={{ aspectRatio: String(rightAspect) }}
            >
              <RightWallScene
                surfaceId="rightWall"
                widthCm={roomDimensions.rightWall.widthCm}
                heightCm={roomDimensions.rightWall.heightCm}
                aspectRatio={rightAspect}
                renderContext={embedded ? 'demo' : 'simulator'}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium text-emerald-300 [font-variant-numeric:tabular-nums]">
              3 · {isPt ? 'Teto — 5 PNGs Empilhados' : 'Ceiling — 5 Stacked PNGs'} (
              {roomDimensions.ceiling.widthCm}×{roomDimensions.ceiling.heightCm} cm)
            </span>
            <div
              className="w-full overflow-hidden rounded-lg border border-slate-400/25 bg-black"
              style={{ aspectRatio: String(ceilingAspect) }}
            >
              <CeilingScene
                surfaceId="ceiling"
                widthCm={roomDimensions.ceiling.widthCm}
                heightCm={roomDimensions.ceiling.heightCm}
                aspectRatio={ceilingAspect}
                renderContext={embedded ? 'demo' : 'simulator'}
              />
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
            const next = Math.max(0.62, Math.min(1.85, zoomScale - e.deltaY * 0.0008));
            setZoomScale(Number(next.toFixed(3)));
          }}
        >
          {/* Verdadeira Sala 3D Ortogonal 90°: Vértice (0,0,0) = encontro superior Parede Esq + Parede Dir + Teto */}
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
            {/* 1. Parede Esquerda (x = 0, z ∈ [0, leftW], voltada para +X dentro da sala) */}
            <div
              className={`absolute overflow-hidden bg-black shadow-2xl ${seamBorderClass}`}
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
              <LeftWallScene
                surfaceId="leftWall"
                widthCm={roomDimensions.leftWall.widthCm}
                heightCm={roomDimensions.leftWall.heightCm}
                aspectRatio={leftAspect}
                renderContext={embedded ? 'demo' : 'simulator'}
              />
            </div>

            {/* 2. Parede Direita (z = 0, x ∈ [0, rightW], voltada para +Z dentro da sala) */}
            <div
              className={`absolute overflow-hidden bg-black shadow-2xl ${seamBorderClass}`}
              style={{
                left: '0px',
                top: '0px',
                width: `${rightW}px`,
                height: `${rightH}px`,
                transformOrigin: '0% 0%',
                backgroundColor: '#000000',
              }}
            >
              <RightWallScene
                surfaceId="rightWall"
                widthCm={roomDimensions.rightWall.widthCm}
                heightCm={roomDimensions.rightWall.heightCm}
                aspectRatio={rightAspect}
                renderContext={embedded ? 'demo' : 'simulator'}
              />
            </div>

            {/* 3. Teto (y = 0, x ∈ [0, ceilW], z ∈ [0, ceilD], voltado para baixo +Y para quem olha p/ cima) */}
            <div
              className={`absolute overflow-hidden bg-black shadow-2xl ${seamBorderClass}`}
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
              <CeilingScene
                surfaceId="ceiling"
                widthCm={roomDimensions.ceiling.widthCm}
                heightCm={roomDimensions.ceiling.heightCm}
                aspectRatio={ceilingAspect}
                renderContext={embedded ? 'demo' : 'simulator'}
              />
            </div>
          </div>

          <div className="pointer-events-none absolute bottom-3 left-3.5 rounded-full border border-slate-400/15 bg-[#080d19]/80 px-3 py-1 text-[11px] text-slate-400 [font-variant-numeric:tabular-nums]">
            {isPt
              ? 'Arraste para girar o quarto · Scroll para zoom'
              : 'Drag to orbit corner · Scroll to zoom'}{' '}
            · Yaw {Math.round(yawDeg)}° · Pitch {Math.round(pitchDeg)}° · {Math.round(zoomScale * 100)}%
          </div>
        </div>
      )}

      {/* Bancada Rápida de Validação para Shay (Pessoa 1): 3 Países Piloto + 5 Olhinhos Photoshop + Play/Story */}
      {!embedded && showControlDock && (
        <aside
          className="z-20 border-t border-slate-400/15 bg-[#080d19]/95 px-4 py-3 backdrop-blur-md"
          data-testid="simulator-pilot-dock"
        >
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
            {/* 1. Seleção instantânea dos Países Piloto (Brasil, Egito) */}
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
                    onClick={() => selectCountry(pid)}
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

            {/* 2. Os 5 Olhinhos estilo Photoshop + Solo (S) + Tempestade */}
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
                        title="Solo (S)"
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

            {/* 3. Transporte (Play/Pause + Compasso) + Passo do Robozinho + PT/EN */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={togglePlay}
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
