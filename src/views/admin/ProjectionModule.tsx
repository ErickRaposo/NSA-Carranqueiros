import React, { useMemo, useState } from 'react';
import { Check, Copy, ExternalLink, Grid, RotateCcw, Scan } from 'lucide-react';
import {
  PROJECTOR_OUT_IDS,
  ProjectorOutId,
  RoomDimensions,
  SURFACE_IDS,
  SurfaceId,
} from '../../experience/types';
import { buildViewUrl } from '../../lan/roomCode';
import {
  CalibrationSurfaceKey,
  createDefaultEdgeMask,
  EdgeFeatherMask,
  getUniquePinHandlesForOutput,
  makeSurfaceQuadKey,
  ProjectionCalibrationState,
  ProjectionTopologyPreset,
  ProjectorOutputConfig,
  QuadCorners,
} from '../../projection/homography';
import { AdminSelect } from './AdminSelect';
import { DimensionCmField } from './DimensionCmField';
import {
  ADMIN_FOCUS,
  ADMIN_PANEL_CLASS,
  ADMIN_WELL_CLASS,
  SURFACE_UI_META,
} from './adminMeta';

export type RemoteWarpDragTarget =
  | {
      kind: 'corner';
      quadKey: CalibrationSurfaceKey;
      cornerIdx: 0 | 1 | 2 | 3;
    }
  | {
      kind: 'edge';
      quadKey: CalibrationSurfaceKey;
      edgeIdx: 0 | 1 | 2 | 3;
      startMouse: { x: number; y: number };
      startQuad: QuadCorners;
    }
  | {
      kind: 'mesh';
      outId: ProjectorOutId;
      quadKey: CalibrationSurfaceKey;
      startMouse: { x: number; y: number };
      startQuad: QuadCorners;
      startQuads: Record<CalibrationSurfaceKey, QuadCorners>;
    };

const EDGE_CORNER_PAIRS: ReadonlyArray<readonly [0 | 1 | 2 | 3, 0 | 1 | 2 | 3]> = [
  [0, 1], // Barra Superior: TL + TR
  [1, 2], // Barra Direita: TR + BR
  [2, 3], // Barra Inferior: BR + BL
  [3, 0], // Barra Esquerda: BL + TL
];

interface ProjectionModuleProps {
  isPt: boolean;
  projectionState: ProjectionCalibrationState;
  selectedWarpOut: ProjectorOutId;
  roomDimensions: RoomDimensions;
  remoteWarpRef: React.RefObject<HTMLDivElement>;
  baseOrigin: string;
  roomCode?: string | null;
  copiedKey: string | null;
  onSelectPreset: (preset: Exclude<ProjectionTopologyPreset, 'custom'>) => void;
  onIdentifyOutputs: () => void;
  onToggleOutputSurface: (outId: ProjectorOutId, surface: SurfaceId) => void;
  onSelectWarpOut: (outId: ProjectorOutId) => void;
  onUpdateOutputConfig: (outId: ProjectorOutId, patch: Partial<ProjectorOutputConfig>) => void;
  onToggleGlobalShowGrid: () => void;
  onResetSingleOutputQuads: (outId: ProjectorOutId) => void;
  onResetAllProjectionQuads: () => void;
  onDragWarpStart: (target: RemoteWarpDragTarget) => void;
  onUpdateEdgeMask: (key: CalibrationSurfaceKey, patch: Partial<EdgeFeatherMask>) => void;
  onCopyText: (key: string, text: string) => void;
  onUpdateDimension: (surface: SurfaceId, field: 'widthCm' | 'heightCm', raw: string) => void;
}

function lerpSvgPt(
  a: { x: number; y: number },
  b: { x: number; y: number },
  t: number
): { x: number; y: number } {
  return {
    x: (a.x + (b.x - a.x) * t) * 1600,
    y: (a.y + (b.y - a.y) * t) * 900,
  };
}

export const ProjectionModule: React.FC<ProjectionModuleProps> = ({
  isPt,
  projectionState,
  selectedWarpOut,
  roomDimensions,
  remoteWarpRef,
  baseOrigin,
  roomCode,
  copiedKey,
  onSelectPreset,
  onIdentifyOutputs,
  onToggleOutputSurface,
  onSelectWarpOut,
  onUpdateOutputConfig,
  onToggleGlobalShowGrid,
  onResetSingleOutputQuads,
  onResetAllProjectionQuads,
  onDragWarpStart,
  onUpdateEdgeMask,
  onCopyText,
  onUpdateDimension,
}) => {
  const activeWarpSurfaces = projectionState.outputs[selectedWarpOut].surfaces;
  const [maskSurfaceChoice, setMaskSurfaceChoice] = useState<SurfaceId>('leftWall');
  const [linkAllEdges, setLinkAllEdges] = useState<boolean>(false);

  const effectiveMaskSurface: SurfaceId | null =
    activeWarpSurfaces.length === 0
      ? null
      : activeWarpSurfaces.includes(maskSurfaceChoice)
        ? maskSurfaceChoice
        : activeWarpSurfaces[0];

  const activeMaskKey =
    effectiveMaskSurface !== null
      ? makeSurfaceQuadKey(selectedWarpOut, effectiveMaskSurface)
      : null;
  const activeEdgeMask =
    activeMaskKey !== null
      ? (projectionState.edgeMasks?.[activeMaskKey] ?? createDefaultEdgeMask())
      : createDefaultEdgeMask();

  const applyEdgeChange = (field: keyof EdgeFeatherMask, pct: number) => {
    if (!activeMaskKey) return;
    if (linkAllEdges) {
      onUpdateEdgeMask(activeMaskKey, {
        leftPct: pct,
        rightPct: pct,
        topPct: pct,
        bottomPct: pct,
      });
    } else {
      onUpdateEdgeMask(activeMaskKey, { [field]: pct });
    }
  };

  const topologyPresetOptions = useMemo(
    () => [
      { value: '3-projectors', label: isPt ? '3 Projetores' : '3 Projectors' },
      {
        value: '2-projectors',
        label: isPt ? '2 Projetores · Canto + Teto' : '2 Projectors · L + Ceil',
      },
      { value: '1-projector', label: isPt ? '1 Projetor' : '1 Projector' },
    ],
    [isPt]
  );

  const getPointerNorm = (e: React.PointerEvent): { x: number; y: number } => {
    const el = remoteWarpRef.current;
    if (!el) return { x: 0.5, y: 0.5 };
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return { x: 0.5, y: 0.5 };
    return {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    };
  };

  return (
    <>
      {/* 1. Matriz Patchbay: clique na barra inteira para selecionar Corner-Pin */}
      <section className={`p-4 ${ADMIN_PANEL_CLASS}`}>
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
          <div>
            <h2 className="text-sm font-semibold tracking-[-0.01em] text-slate-50">
              {isPt ? 'Matriz Patchbay de Projeção' : 'Projection Patchbay Matrix'}
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              {isPt
                ? 'Escolha 2 ou 3 projetores dedicados, clique na barra para calibrar ou copie o link para outro PC.'
                : 'Switch presets, click anywhere on a bar to warp, or copy the output link for another PC.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={onIdentifyOutputs}
              className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-[#1e3a66] bg-[#060c1a] px-3.5 text-xs font-medium text-slate-200 transition hover:border-[#2563eb] hover:text-white ${ADMIN_FOCUS}`}
              title={
                isPt
                  ? 'Exibe OUT 1..4 gigante nos projetores por 7s para identificar cabos HDMI'
                  : 'Flashes giant OUT 1..4 across projectors for 7s'
              }
            >
              <Scan size={13} />
              <span>{isPt ? 'Identificar Telas' : 'Identify Outs'}</span>
            </button>

            <div className="min-w-[232px]">
              <AdminSelect
                ariaLabel={isPt ? 'Topologia de Projetores' : 'Projector Topology'}
                value={projectionState.preset}
                options={topologyPresetOptions}
                placeholder={isPt ? 'Matriz Customizada' : 'Custom Matrix'}
                onChange={(val) =>
                  onSelectPreset(val as Exclude<ProjectionTopologyPreset, 'custom'>)
                }
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[680px] space-y-2">
            <div className="grid grid-cols-12 items-center gap-2 px-3 text-xs font-medium text-slate-400">
              <div className="col-span-2">{isPt ? 'Saída HDMI' : 'HDMI Out'}</div>
              {SURFACE_IDS.map((sId) => (
                <div key={sId} className="col-span-2 text-center">
                  <div className="font-semibold text-slate-200">
                    {isPt ? SURFACE_UI_META[sId].shortPt : SURFACE_UI_META[sId].shortEn}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {isPt ? SURFACE_UI_META[sId].detailPt : SURFACE_UI_META[sId].detailEn}
                  </div>
                </div>
              ))}
              <div className="col-span-4 text-right">
                {isPt ? 'Controles da Saída' : 'Output Controls'}
              </div>
            </div>

            {PROJECTOR_OUT_IDS.map((outId) => {
              const cfg = projectionState.outputs[outId];
              const isSelectedForWarp = selectedWarpOut === outId;
              const copyKey = `proj-out-${outId}`;
              const outUrl = buildViewUrl(baseOrigin, 'projector', { outId, roomCode });
              const outRelativeHref = buildViewUrl(null, 'projector', { outId, roomCode });
              const isCopied = copiedKey === copyKey;
              return (
                <div
                  key={outId}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelectedForWarp}
                  onClick={() => onSelectWarpOut(outId)}
                  onKeyDown={(e) => {
                    if (e.target !== e.currentTarget) return;
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectWarpOut(outId);
                    }
                  }}
                  title={
                    isPt
                      ? `Clique na barra para calibrar OUT ${outId}`
                      : `Click bar to calibrate OUT ${outId}`
                  }
                  className={`grid cursor-pointer grid-cols-12 items-center gap-2 rounded-xl border px-3 py-2.5 transition ${ADMIN_FOCUS} ${
                    isSelectedForWarp
                      ? 'border-[#2563eb]/65 bg-[#0c1a36]/60'
                      : 'border-[#1e3a66]/45 bg-white/[0.02] hover:border-[#1e3a66] hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="col-span-2 flex flex-wrap items-center gap-1.5 [font-variant-numeric:tabular-nums]">
                    <span className="text-xs font-semibold text-slate-100">OUT {outId}</span>
                    {cfg.surfaces.length === 1 && (
                      <span className="rounded-md bg-[#0c1a36] px-1.5 py-0.5 text-[11px] font-medium text-slate-200">
                        100%
                      </span>
                    )}
                    {isSelectedForWarp && (
                      <span className="rounded-md bg-[#1d4ed8]/35 px-1.5 py-0.5 text-[11px] font-semibold text-[#7dd3fc]">
                        {isPt ? 'Editando' : 'Editing'}
                      </span>
                    )}
                  </div>

                  {SURFACE_IDS.map((sId) => {
                    const assigned = cfg.surfaces.includes(sId);
                    const accent = SURFACE_UI_META[sId].accentHex;
                    return (
                      <div key={sId} className="col-span-2 flex justify-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleOutputSurface(outId, sId);
                          }}
                          aria-pressed={assigned}
                          className={`flex min-h-[40px] w-full max-w-[136px] items-center justify-center gap-2 rounded-xl border px-3 text-xs font-medium transition ${ADMIN_FOCUS} ${
                            assigned
                              ? 'border-[#2563eb]/55 bg-[#0c1a36] font-semibold text-slate-50'
                              : 'border-[#1e3a66]/45 bg-[#040b1a] text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <span
                            className={`h-2 w-2 rounded-full ${assigned ? '' : 'opacity-25'}`}
                            style={{ backgroundColor: accent }}
                            aria-hidden="true"
                          />
                          <span>
                            {assigned
                              ? isPt
                                ? 'Ativa'
                                : 'On'
                              : isPt
                                ? 'Desligada'
                                : 'Off'}
                          </span>
                        </button>
                      </div>
                    );
                  })}

                  <div className="col-span-4 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateOutputConfig(outId, { showGrid: !cfg.showGrid });
                      }}
                      className={`min-h-[40px] rounded-xl border px-2.5 text-xs font-medium transition ${ADMIN_FOCUS} ${
                        cfg.showGrid
                          ? 'border-white bg-white font-semibold text-[#060913]'
                          : 'border-[#1e3a66]/55 bg-[#060c1a] text-slate-300 hover:text-white'
                      }`}
                    >
                      {isPt ? 'Grade' : 'Grid'}
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateOutputConfig(outId, { blackout: !cfg.blackout });
                      }}
                      className={`min-h-[40px] rounded-xl border px-2.5 text-xs font-medium transition ${ADMIN_FOCUS} ${
                        cfg.blackout
                          ? 'border-rose-400/60 bg-rose-500/20 text-rose-100'
                          : 'border-[#1e3a66]/55 bg-[#060c1a] text-slate-300 hover:text-white'
                      }`}
                    >
                      Blackout
                    </button>

                    <div className="flex items-center gap-1 pl-0.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onCopyText(copyKey, outUrl);
                        }}
                        title={outUrl}
                        className={`inline-flex min-h-[40px] items-center gap-1 rounded-xl border px-2.5 text-xs font-medium transition ${ADMIN_FOCUS} ${
                          isCopied
                            ? 'border-[#2563eb]/65 bg-[#0c1a36] font-semibold text-[#7dd3fc]'
                            : 'border-[#1e3a66]/55 bg-[#060c1a] text-slate-300 hover:border-[#2563eb] hover:text-white'
                        }`}
                      >
                        {isCopied ? <Check size={12} /> : <Copy size={12} />}
                        <span>{isCopied ? 'OK' : isPt ? 'Copiar' : 'Copy'}</span>
                      </button>

                      <a
                        href={outRelativeHref}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className={`inline-flex min-h-[40px] items-center gap-1 rounded-xl border border-[#1e3a66]/65 bg-[#060c1a] px-2.5 text-xs font-medium text-slate-200 transition hover:border-[#2563eb] hover:text-white ${ADMIN_FOCUS}`}
                      >
                        <span>{isPt ? 'Abrir' : 'Open'}</span>
                        <ExternalLink size={12} />
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 2. Corner-Pin Remoto 16:9 + Arraste de Barra e Malha Completa + Dimensões Físicas */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <section className={`p-4 lg:col-span-8 ${ADMIN_PANEL_CLASS}`}>
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
            <div>
              <h3 className="text-sm font-semibold tracking-[-0.01em] text-slate-50 [font-variant-numeric:tabular-nums]">
                {isPt
                  ? `Calibração Remota Corner-Pin · OUT ${selectedWarpOut}`
                  : `Remote Corner-Pin Warp Stage · OUT ${selectedWarpOut}`}
              </h3>
              <p className="mt-0.5 text-xs text-slate-400">
                {isPt
                  ? 'Arraste cantos TL/TR/BR/BL, qualquer barra da borda para nivelar ou o interior da malha para mover tudo.'
                  : 'Drag TL/TR/BR/BL corners, any whole edge bar to level, or the mesh interior to move all.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={onToggleGlobalShowGrid}
                className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-full border px-3.5 text-xs font-medium transition ${ADMIN_FOCUS} ${
                  projectionState.showGrid
                    ? 'border-white bg-white font-semibold text-[#060913]'
                    : 'border-[#1e3a66] bg-[#060c1a] text-slate-300 hover:border-[#2563eb] hover:text-white'
                }`}
              >
                <Grid size={13} />
                <span>{isPt ? 'Grade Global' : 'Global Grid'}</span>
              </button>
              <button
                type="button"
                onClick={() => onResetSingleOutputQuads(selectedWarpOut)}
                className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-[#1e3a66] bg-[#060c1a] px-3.5 text-xs font-medium text-slate-300 transition hover:border-[#2563eb] hover:text-white ${ADMIN_FOCUS}`}
              >
                <RotateCcw size={12} />
                <span>{isPt ? `Resetar OUT ${selectedWarpOut}` : `Reset OUT ${selectedWarpOut}`}</span>
              </button>
              <button
                type="button"
                onClick={onResetAllProjectionQuads}
                className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-[#1e3a66] bg-[#060c1a] px-3.5 text-xs font-medium text-slate-300 transition hover:border-rose-400/45 hover:text-rose-200 ${ADMIN_FOCUS}`}
              >
                <RotateCcw size={12} />
                <span>{isPt ? 'Resetar Todos' : 'Reset All'}</span>
              </button>
            </div>
          </div>

          <div
            ref={remoteWarpRef}
            className="relative mt-2 aspect-video w-full overflow-hidden rounded-xl border border-[#1e3a66]/65 bg-black select-none touch-none"
          >
            <svg viewBox="0 0 1600 900" className="absolute inset-0 h-full w-full">
              <line
                x1="800"
                y1="0"
                x2="800"
                y2="900"
                stroke="rgba(148,163,184,0.12)"
                className="pointer-events-none"
              />
              <line
                x1="0"
                y1="450"
                x2="1600"
                y2="450"
                stroke="rgba(148,163,184,0.12)"
                className="pointer-events-none"
              />

              {activeWarpSurfaces.map((sId) => {
                const qKey = makeSurfaceQuadKey(selectedWarpOut, sId);
                const q = projectionState.quads[qKey];
                const edgeMask = projectionState.edgeMasks?.[qKey] ?? createDefaultEdgeMask();
                const accent = SURFACE_UI_META[sId].accentHex;
                const pts = q.map((p) => `${p.x * 1600},${p.y * 900}`).join(' ');
                const cx = ((q[0].x + q[1].x + q[2].x + q[3].x) / 4) * 1600;
                const cy = ((q[0].y + q[1].y + q[2].y + q[3].y) / 4) * 900;

                const featherRegions: Array<{
                  id: string;
                  poly: string;
                  lineA: { x: number; y: number };
                  lineB: { x: number; y: number };
                }> = [];

                if (edgeMask.leftPct > 0) {
                  const t = edgeMask.leftPct / 100;
                  const topInner = lerpSvgPt(q[0], q[1], t);
                  const botInner = lerpSvgPt(q[3], q[2], t);
                  featherRegions.push({
                    id: 'left',
                    poly: `${q[0].x * 1600},${q[0].y * 900} ${topInner.x},${topInner.y} ${botInner.x},${botInner.y} ${q[3].x * 1600},${q[3].y * 900}`,
                    lineA: topInner,
                    lineB: botInner,
                  });
                }
                if (edgeMask.rightPct > 0) {
                  const t = edgeMask.rightPct / 100;
                  const topInner = lerpSvgPt(q[1], q[0], t);
                  const botInner = lerpSvgPt(q[2], q[3], t);
                  featherRegions.push({
                    id: 'right',
                    poly: `${topInner.x},${topInner.y} ${q[1].x * 1600},${q[1].y * 900} ${q[2].x * 1600},${q[2].y * 900} ${botInner.x},${botInner.y}`,
                    lineA: topInner,
                    lineB: botInner,
                  });
                }
                if (edgeMask.topPct > 0) {
                  const t = edgeMask.topPct / 100;
                  const leftInner = lerpSvgPt(q[0], q[3], t);
                  const rightInner = lerpSvgPt(q[1], q[2], t);
                  featherRegions.push({
                    id: 'top',
                    poly: `${q[0].x * 1600},${q[0].y * 900} ${q[1].x * 1600},${q[1].y * 900} ${rightInner.x},${rightInner.y} ${leftInner.x},${leftInner.y}`,
                    lineA: leftInner,
                    lineB: rightInner,
                  });
                }
                if (edgeMask.bottomPct > 0) {
                  const t = edgeMask.bottomPct / 100;
                  const leftInner = lerpSvgPt(q[3], q[0], t);
                  const rightInner = lerpSvgPt(q[2], q[1], t);
                  featherRegions.push({
                    id: 'bottom',
                    poly: `${leftInner.x},${leftInner.y} ${rightInner.x},${rightInner.y} ${q[2].x * 1600},${q[2].y * 900} ${q[3].x * 1600},${q[3].y * 900}`,
                    lineA: leftInner,
                    lineB: rightInner,
                  });
                }

                return (
                  <g key={qKey}>
                    {/* Interior da malha arrastável para mover todos os 4 pontos juntos */}
                    <polygon
                      points={pts}
                      fill={`${accent}1c`}
                      stroke={accent}
                      strokeWidth="4"
                      className="cursor-move"
                      onPointerDown={(e) => {
                        e.preventDefault();
                        onDragWarpStart({
                          kind: 'mesh',
                          outId: selectedWarpOut,
                          quadKey: qKey,
                          startMouse: getPointerNorm(e),
                          startQuad: q,
                          startQuads: projectionState.quads,
                        });
                      }}
                    />

                    {/* Prévia visual da máscara de difusão suave nas bordas */}
                    {featherRegions.map((reg) => (
                      <g key={`${qKey}-feather-${reg.id}`} className="pointer-events-none">
                        <polygon points={reg.poly} fill="rgba(2, 6, 23, 0.58)" />
                        <line
                          x1={reg.lineA.x}
                          y1={reg.lineA.y}
                          x2={reg.lineB.x}
                          y2={reg.lineB.y}
                          stroke={accent}
                          strokeWidth="2.5"
                          strokeDasharray="10 8"
                          strokeOpacity="0.85"
                        />
                      </g>
                    ))}

                    {/* Diagonais visuais */}
                    <line
                      x1={q[0].x * 1600}
                      y1={q[0].y * 900}
                      x2={q[2].x * 1600}
                      y2={q[2].y * 900}
                      stroke={`${accent}55`}
                      strokeWidth="1.5"
                      strokeDasharray="6 6"
                      className="pointer-events-none"
                    />
                    <line
                      x1={q[1].x * 1600}
                      y1={q[1].y * 900}
                      x2={q[3].x * 1600}
                      y2={q[3].y * 900}
                      stroke={`${accent}55`}
                      strokeWidth="1.5"
                      strokeDasharray="6 6"
                      className="pointer-events-none"
                    />

                    {/* Rótulo central */}
                    <text
                      x={cx}
                      y={cy - 10}
                      fill={accent}
                      fontSize="26"
                      fontWeight="600"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="pointer-events-none"
                    >
                      {isPt ? SURFACE_UI_META[sId].shortPt : SURFACE_UI_META[sId].shortEn}
                    </text>
                    <text
                      x={cx}
                      y={cy + 22}
                      fill="#94a3b8"
                      fontSize="16"
                      fontWeight="500"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="pointer-events-none"
                    >
                      {isPt ? 'Arraste para mover malha' : 'Drag mesh to move'}
                    </text>

                    {/* 4 Barras / Arestas inteiras clicáveis e puxáveis para nivelamento */}
                    {EDGE_CORNER_PAIRS.map(([iA, iB], eIdx) => {
                      const pA = q[iA];
                      const pB = q[iB];
                      const x1 = pA.x * 1600;
                      const y1 = pA.y * 900;
                      const x2 = pB.x * 1600;
                      const y2 = pB.y * 900;
                      const mx = (x1 + x2) / 2;
                      const my = (y1 + y2) / 2;
                      const angleDeg = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
                      const isHorizontal = eIdx === 0 || eIdx === 2;
                      return (
                        <g
                          key={`${qKey}-edge-${eIdx}`}
                          className={isHorizontal ? 'cursor-ns-resize' : 'cursor-ew-resize'}
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            onDragWarpStart({
                              kind: 'edge',
                              quadKey: qKey,
                              edgeIdx: eIdx as 0 | 1 | 2 | 3,
                              startMouse: getPointerNorm(e),
                              startQuad: q,
                            });
                          }}
                        >
                          <line
                            x1={x1}
                            y1={y1}
                            x2={x2}
                            y2={y2}
                            stroke="transparent"
                            strokeWidth="30"
                          />
                          <rect
                            x={mx - 22}
                            y={my - 7}
                            width="44"
                            height="14"
                            rx="7"
                            fill="#060913"
                            stroke={accent}
                            strokeWidth="2.5"
                            transform={`rotate(${angleDeg} ${mx} ${my})`}
                          />
                        </g>
                      );
                    })}
                  </g>
                );
              })}
            </svg>

            {activeWarpSurfaces.length === 0 && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-slate-400">
                {isPt
                  ? `Nenhuma superfície ligada em OUT ${selectedWarpOut}.`
                  : `No surface assigned to OUT ${selectedWarpOut}.`}
              </div>
            )}

            {/* Alças de Canto deduplicadas (pins compartilhados soldados entre paredes formam 1 única alça limpa) */}
            {getUniquePinHandlesForOutput(
              selectedWarpOut,
              activeWarpSurfaces,
              projectionState.quads
            ).map((handle) => {
              const accent = SURFACE_UI_META[handle.surfaceId].accentHex;
              const sharedSummary = handle.members
                .map(
                  (m) =>
                    `${isPt ? SURFACE_UI_META[m.surfaceId].shortPt : SURFACE_UI_META[m.surfaceId].shortEn} ${['TL', 'TR', 'BR', 'BL'][m.cornerIdx]}`
                )
                .join(' + ');
              return (
                <button
                  key={handle.id}
                  type="button"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onDragWarpStart({
                      kind: 'corner',
                      quadKey: handle.quadKey,
                      cornerIdx: handle.cornerIdx,
                    });
                  }}
                  className={`absolute z-20 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 cursor-grab items-center justify-center rounded-full border-2 bg-[#060913] text-[11px] font-semibold text-white active:cursor-grabbing [font-variant-numeric:tabular-nums] ${
                    handle.isShared ? 'ring-2 ring-[#38bdf8]/60' : ''
                  } ${ADMIN_FOCUS}`}
                  style={{
                    left: `${handle.point.x * 100}%`,
                    top: `${handle.point.y * 100}%`,
                    borderColor: handle.isShared ? '#f8fafc' : accent,
                  }}
                  title={
                    handle.isShared
                      ? `${isPt ? 'Pin Soldado' : 'Welded Pin'} (${sharedSummary}) · ${Math.round(handle.point.x * 100)}%, ${Math.round(handle.point.y * 100)}%`
                      : `${SURFACE_UI_META[handle.surfaceId].shortPt} · ${handle.label} · ${Math.round(handle.point.x * 100)}%, ${Math.round(handle.point.y * 100)}%`
                  }
                >
                  {handle.isShared ? `${handle.memberCount}×` : handle.label}
                </button>
              );
            })}
          </div>

          {/* Máscara de Difusão Suave nas 4 Bordas · Separado ou Conjunto */}
          {activeMaskKey !== null && (
            <div className={`mt-3 p-3 ${ADMIN_WELL_CLASS}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-slate-100">
                    {isPt ? 'Máscara de Difusão nas Bordas' : 'Edge Feather Diffusion Mask'}
                  </span>
                  {activeWarpSurfaces.length > 1 && (
                    <div className="flex items-center gap-1 rounded-lg border border-[#1e3a66]/55 bg-[#040b1a] p-0.5">
                      {activeWarpSurfaces.map((sId) => {
                        const selected = sId === effectiveMaskSurface;
                        return (
                          <button
                            key={sId}
                            type="button"
                            onClick={() => setMaskSurfaceChoice(sId)}
                            className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${ADMIN_FOCUS} ${
                              selected
                                ? 'bg-[#0c1a36] font-semibold text-white'
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            {isPt ? SURFACE_UI_META[sId].shortPt : SURFACE_UI_META[sId].shortEn}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <div className="grid grid-cols-2 gap-0.5 rounded-full border border-[#1e3a66]/55 bg-[#040b1a] p-0.5">
                    <button
                      type="button"
                      onClick={() => setLinkAllEdges(false)}
                      className={`min-h-[30px] rounded-full px-3 text-xs font-medium transition ${ADMIN_FOCUS} ${
                        !linkAllEdges
                          ? 'bg-[#0c1a36] font-semibold text-white'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {isPt ? 'Separado' : 'Separate'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setLinkAllEdges(true)}
                      className={`min-h-[30px] rounded-full px-3 text-xs font-medium transition ${ADMIN_FOCUS} ${
                        linkAllEdges
                          ? 'bg-[#0c1a36] font-semibold text-[#7dd3fc]'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {isPt ? 'Conjunto' : 'Linked'}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => onUpdateEdgeMask(activeMaskKey, createDefaultEdgeMask())}
                    className={`inline-flex min-h-[32px] items-center gap-1 rounded-full border border-[#1e3a66]/60 bg-[#060c1a] px-3 text-xs font-medium text-slate-300 transition hover:border-[#2563eb] hover:text-white ${ADMIN_FOCUS}`}
                  >
                    <RotateCcw size={11} />
                    <span>{isPt ? 'Zerar' : 'Clear'}</span>
                  </button>
                </div>
              </div>

              <div className="mt-2.5 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
                {(
                  [
                    ['leftPct', isPt ? 'Esquerda' : 'Left', activeEdgeMask.leftPct],
                    ['rightPct', isPt ? 'Direita' : 'Right', activeEdgeMask.rightPct],
                    ['topPct', isPt ? 'Topo' : 'Top', activeEdgeMask.topPct],
                    ['bottomPct', isPt ? 'Base' : 'Bottom', activeEdgeMask.bottomPct],
                  ] as const
                ).map(([field, label, pct]) => (
                  <label
                    key={field}
                    className={`flex flex-col gap-1.5 rounded-xl border px-3 py-2 transition ${
                      pct > 0
                        ? 'border-[#2563eb]/55 bg-[#060e20]'
                        : 'border-[#1e3a66]/45 bg-[#040b1a]'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-200">{label}</span>
                      <span
                        className={`font-semibold [font-variant-numeric:tabular-nums] ${
                          pct > 0 ? 'text-[#7dd3fc]' : 'text-slate-400'
                        }`}
                      >
                        {pct}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={40}
                      step={1}
                      aria-label={label}
                      value={pct}
                      onChange={(e) => applyEdgeChange(field, Number(e.target.value))}
                      className="h-2 w-full cursor-pointer appearance-none rounded-full bg-[#0c1a36] accent-[#2563eb]"
                    />
                  </label>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className={`p-4 lg:col-span-4 ${ADMIN_PANEL_CLASS}`}>
          <h3 className="text-sm font-semibold tracking-[-0.01em] text-slate-50">
            {isPt ? 'Dimensões Reais da Sala · cm' : 'Physical Room Dimensions · cm'}
          </h3>
          <p className="mt-0.5 text-xs text-slate-400">
            {isPt
              ? 'Proporção real aplicada ao Simulador 3D e Projetores.'
              : 'Real aspect ratios applied to the 3D Simulator and Projectors.'}
          </p>

          <div className="mt-3.5 flex flex-col gap-2.5">
            {(['leftWall', 'rightWall'] as const).map((sId) => {
              const dim = roomDimensions[sId];
              const ratio = (dim.widthCm / Math.max(1, dim.heightCm)).toFixed(2);
              return (
                <div key={sId} className={`p-3 ${ADMIN_WELL_CLASS}`}>
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-100">
                      {isPt ? SURFACE_UI_META[sId].shortPt : SURFACE_UI_META[sId].shortEn}
                    </span>
                    <span className="text-[11px] text-slate-400 [font-variant-numeric:tabular-nums]">
                      {ratio}:1
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <DimensionCmField
                      label={isPt ? 'Largura · cm' : 'Width · cm'}
                      value={dim.widthCm}
                      onCommit={(raw) => onUpdateDimension(sId, 'widthCm', raw)}
                    />
                    <DimensionCmField
                      label={isPt ? 'Altura · cm' : 'Height · cm'}
                      value={dim.heightCm}
                      onCommit={(raw) => onUpdateDimension(sId, 'heightCm', raw)}
                    />
                  </div>
                </div>
              );
            })}

            <div className={`p-3 ${ADMIN_WELL_CLASS}`}>
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-100">
                  {isPt ? `${SURFACE_UI_META.ceiling.shortPt} (Automático)` : `${SURFACE_UI_META.ceiling.shortEn} (Auto)`}
                </span>
                <span className="text-[11px] text-slate-400 [font-variant-numeric:tabular-nums]">
                  {(
                    roomDimensions.ceiling.widthCm /
                    Math.max(1, roomDimensions.ceiling.heightCm)
                  ).toFixed(2)}
                  :1
                </span>
              </div>
              <div className="mt-1.5 text-sm font-semibold text-[#7dd3fc] [font-variant-numeric:tabular-nums]">
                {roomDimensions.ceiling.widthCm} × {roomDimensions.ceiling.heightCm} cm
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                {isPt
                  ? 'Calculado pela largura da Parede Direita × Parede Esquerda.'
                  : 'Derived from Right Wall width × Left Wall width.'}
              </p>
            </div>
          </div>
        </section>
      </div>
    </>
  );
};
