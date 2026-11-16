import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, Copy, ExternalLink, Grid, RotateCcw, Scan } from 'lucide-react';
import {
  DEFAULT_ROOM_DIMENSIONS,
  formatMetersPair,
} from '../../experience/roomDimensions';
import {
  LanPeerInfo,
  PROJECTOR_OUT_IDS,
  ProjectorOutId,
  RoomDimensions,
} from '../../experience/types';
import { buildViewUrl } from '../../lan/roomCode';
import {
  CalibrationSurfaceKey,
  getUniquePinHandlesForOutput,
  makeSurfaceQuadKey,
  ProjectionCalibrationState,
  QuadCorners,
} from '../../projection/homography';
import {
  ADMIN_FOCUS,
  ADMIN_PANEL_CLASS,
  ADMIN_PRIMARY_PILL_CLASS,
  ADMIN_WELL_CLASS,
  SURFACE_UI_META,
} from '../admin/adminMeta';
import { ConfirmedRackBar } from './ConfirmedRackBar';
import { DimensionCmField } from '../admin/DimensionCmField';
import { NextBlockTeaser } from './NextBlockTeaser';
import { ScreenDelayControlPanel } from '../admin/ScreenDelayControlPanel';
import { ScreenScenario } from './setupTypes';

interface StepProjectionSetupProps {
  isPt: boolean;
  scenario: Exclude<ScreenScenario, 0>;
  projectionState: ProjectionCalibrationState;
  roomDimensions?: RoomDimensions;
  baseOrigin: string;
  roomCode: string | null;
  lanClients: LanPeerInfo[];
  copiedKey: string | null;
  screenSyncPulseActive?: boolean;
  calibBeatSeq?: number;
  onCopyText: (key: string, text: string) => void;
  onIdentifyOutputs: () => void;
  onToggleGlobalShowGrid: () => void;
  onResetAllProjectionQuads: () => void;
  onUpdateSurfaceQuad: (key: CalibrationSurfaceKey, quad: QuadCorners) => void;
  onTranslateOutputMesh: (
    outId: ProjectorOutId,
    startQuads: Record<CalibrationSurfaceKey, QuadCorners>,
    rawDx: number,
    rawDy: number
  ) => void;
  onUpdateWallDimension?: (
    wall: 'leftWall' | 'rightWall',
    field: 'widthCm' | 'heightCm',
    rawValue: string
  ) => void;
  onResetRoomDimensions?: () => void;
  onUpdateOutputDelay?: (outId: ProjectorOutId, delayMs: number) => void;
  onResetScreenDelays?: () => void;
  onToggleScreenSyncPulse?: () => void;
}

type LocalDragState =
  | {
      kind: 'corner';
      quadKey: CalibrationSurfaceKey;
      cornerIdx: 0 | 1 | 2 | 3;
    }
  | {
      kind: 'mesh';
      outId: ProjectorOutId;
      startMouse: { x: number; y: number };
      startQuads: Record<CalibrationSurfaceKey, QuadCorners>;
    };

const PRESS_TRANSITION =
  'transition-[transform,background-color,border-color,color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97]';

export const StepProjectionSetup: React.FC<StepProjectionSetupProps> = ({
  isPt,
  scenario,
  projectionState,
  roomDimensions = DEFAULT_ROOM_DIMENSIONS,
  baseOrigin,
  roomCode,
  lanClients,
  copiedKey,
  onCopyText,
  onIdentifyOutputs,
  onToggleGlobalShowGrid,
  onResetAllProjectionQuads,
  onUpdateSurfaceQuad,
  onTranslateOutputMesh,
  onUpdateWallDimension,
  onResetRoomDimensions,
  screenSyncPulseActive = false,
  calibBeatSeq = 0,
  onUpdateOutputDelay,
  onResetScreenDelays,
  onToggleScreenSyncPulse,
}) => {
  const activeOutputs = ([1, 2, 3] as ProjectorOutId[]).slice(0, scenario);
  const [selectedOut, setSelectedOut] = useState<ProjectorOutId>(1);
  const [outputsConfirmed, setOutputsConfirmed] = useState<boolean>(false);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [dragState, setDragState] = useState<LocalDragState | null>(null);

  const effectiveOut: ProjectorOutId = activeOutputs.includes(selectedOut) ? selectedOut : 1;
  const activeSurfaces = projectionState.outputs[effectiveOut]?.surfaces ?? [];
  const onlineCount = activeOutputs.filter((outId) =>
    lanClients.some((c) => c.role === `projector-${outId}`)
  ).length;

  useEffect(() => {
    if (!dragState) return;
    const onPointerMove = (e: PointerEvent) => {
      const el = stageRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const nx = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      const ny = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));

      if (dragState.kind === 'corner') {
        const nextQuad = [...projectionState.quads[dragState.quadKey]] as QuadCorners;
        nextQuad[dragState.cornerIdx] = {
          x: Number(nx.toFixed(4)),
          y: Number(ny.toFixed(4)),
        };
        onUpdateSurfaceQuad(dragState.quadKey, nextQuad);
        return;
      }

      onTranslateOutputMesh(
        dragState.outId,
        dragState.startQuads,
        nx - dragState.startMouse.x,
        ny - dragState.startMouse.y
      );
    };

    const onPointerUp = () => setDragState(null);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [dragState, onTranslateOutputMesh, onUpdateSurfaceQuad, projectionState.quads]);

  const getPointerNorm = (e: React.PointerEvent): { x: number; y: number } => {
    const el = stageRef.current;
    if (!el) return { x: 0.5, y: 0.5 };
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return { x: 0.5, y: 0.5 };
    return {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    };
  };

  return (
    <div className="flex flex-col gap-4 sm:gap-5" data-testid="setup-step-projection">
      {/* Sub-block 2A: Open projector windows and identify cables */}
      {!outputsConfirmed ? (
        <section
          className={`setup-block-enter p-5 sm:p-6 ${ADMIN_PANEL_CLASS}`}
          data-testid="substep-projection-outputs"
        >
          <div className="flex flex-wrap items-start justify-between gap-4 pb-4">
            <div className="max-w-[64ch]">
              <h2 className="text-base font-semibold tracking-[-0.015em] text-slate-50 sm:text-lg">
                {isPt
                  ? 'Abra uma janela por projetor e ative tela cheia (F11)'
                  : 'Open one window per projector and enter fullscreen (F11)'}
              </h2>
              <p className="mt-1 text-xs leading-[1.55] text-slate-400 sm:text-[13px]">
                {isPt
                  ? 'Arraste cada janela para a tela correspondente ou pisque os números nas paredes.'
                  : 'Drag each window onto its physical display or flash IDs on the walls.'}
              </p>
            </div>

            <button
              type="button"
              onClick={onIdentifyOutputs}
              className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-[#1e3a66] bg-[#060c1a] px-3.5 text-xs font-medium text-slate-200 hover:border-[#2563eb] hover:text-white ${PRESS_TRANSITION} ${ADMIN_FOCUS}`}
            >
              <Scan size={13} className="text-[#7dd3fc]" />
              <span>{isPt ? 'Piscar Números (7s)' : 'Flash IDs (7s)'}</span>
            </button>
          </div>

          <div className="space-y-2">
            {activeOutputs.map((outId) => {
              const surfaces = projectionState.outputs[outId]?.surfaces ?? [];
              const copyKey = `wiz-proj-${outId}`;
              const fullUrl = buildViewUrl(baseOrigin, 'projector', { outId, roomCode });
              const relativeHref = buildViewUrl(null, 'projector', { outId, roomCode });
              const isOnline = lanClients.some((c) => c.role === `projector-${outId}`);

              return (
                <div
                  key={outId}
                  className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 transition ${
                    isOnline
                      ? 'border-[#2563eb]/65 bg-[#0c1a36]/60'
                      : 'border-[#1e3a66]/45 bg-white/[0.02] hover:border-[#1e3a66] hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2.5 [font-variant-numeric:tabular-nums]">
                    <span className="text-xs font-semibold text-slate-100">OUT {outId}</span>
                    {surfaces.length === 1 && (
                      <span className="rounded-md bg-[#0c1a36] px-1.5 py-0.5 text-[11px] font-medium text-slate-200">
                        100%
                      </span>
                    )}
                    <span
                      className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${
                        isOnline
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-[#1d4ed8]/35 text-[#7dd3fc]'
                      }`}
                    >
                      {isOnline ? (isPt ? 'Ativa' : 'Online') : isPt ? 'Aguardando' : 'Standby'}
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {surfaces.map((sId) => (
                        <span
                          key={sId}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-[#2563eb]/50 bg-[#0c1a36] px-2.5 py-1 text-xs font-semibold text-slate-100"
                        >
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: SURFACE_UI_META[sId].accentHex }}
                            aria-hidden="true"
                          />
                          <span>
                            {isPt ? SURFACE_UI_META[sId].shortPt : SURFACE_UI_META[sId].shortEn}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onCopyText(copyKey, fullUrl)}
                      title={fullUrl}
                      className={`inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-lg border border-[#1e3a66]/55 bg-[#040b1a] px-3 text-xs font-medium text-slate-200 hover:border-[#2563eb] hover:text-white ${PRESS_TRANSITION} ${ADMIN_FOCUS}`}
                    >
                      {copiedKey === copyKey ? (
                        <Check size={12} className="text-[#7dd3fc]" />
                      ) : (
                        <Copy size={12} />
                      )}
                      <span>{copiedKey === copyKey ? 'OK' : isPt ? 'Copiar' : 'Copy'}</span>
                    </button>

                    <a
                      href={relativeHref}
                      target="_blank"
                      rel="noreferrer"
                      className={`inline-flex min-h-[36px] items-center justify-center gap-1.5 px-3.5 text-xs ${PRESS_TRANSITION} ${ADMIN_PRIMARY_PILL_CLASS} ${ADMIN_FOCUS}`}
                    >
                      <span>{isPt ? `Abrir OUT ${outId}` : `Open OUT ${outId}`}</span>
                      <ExternalLink size={12} />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-5 flex justify-end border-t border-[#1e3a66]/40 pt-4">
            <button
              type="button"
              onClick={() => setOutputsConfirmed(true)}
              data-testid="btn-confirm-projection-outputs"
              className={`inline-flex min-h-[42px] items-center gap-2 px-5 text-xs font-semibold ${PRESS_TRANSITION} ${ADMIN_PRIMARY_PILL_CLASS} ${ADMIN_FOCUS}`}
            >
              <span>
                {isPt ? 'Confirmar Saídas & Alinhar Cantos' : 'Confirm Outputs & Fit Corners'}
              </span>
              <ArrowRight size={14} />
            </button>
          </div>
        </section>
      ) : (
        <ConfirmedRackBar
          label={isPt ? 'Saídas' : 'Outputs'}
          summary={`${activeOutputs.map((id) => `Saída ${id}`).join(', ')} (${onlineCount}/${activeOutputs.length} ${isPt ? 'online' : 'online'})`}
          editLabel={isPt ? 'Alterar' : 'Edit'}
          testId="rack-bar-projection-outputs"
          onEdit={() => setOutputsConfirmed(false)}
        />
      )}

      {/* Sub-block 2B: Real wall dimensions (Ceiling automatically derived from widths) */}
      <section className={`p-5 sm:p-6 ${ADMIN_PANEL_CLASS}`} data-testid="setup-wall-dimensions-panel">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <h2 className="text-base font-semibold tracking-[-0.015em] text-slate-50 sm:text-lg">
              {isPt
                ? 'Ajuste a largura e altura das duas paredes (cm)'
                : 'Set width and height of both walls (cm)'}
            </h2>
            <p className="mt-1 text-xs leading-[1.55] text-slate-400 sm:text-[13px]">
              {isPt
                ? 'As dimensões do Teto são calculadas automaticamente pela largura da Parede Direita × largura da Parede Esquerda e aplicadas ao vivo nos Projetores e no Simulador 3D.'
                : 'Ceiling dimensions derive automatically from Right Wall width × Left Wall width and update Projectors and the 3D Simulator live.'}
            </p>
          </div>

          {onResetRoomDimensions && (
            <button
              type="button"
              onClick={onResetRoomDimensions}
              className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-full border border-[#1e3a66] bg-[#060c1a] px-3.5 text-xs font-medium text-slate-200 transition hover:border-[#2563eb] hover:text-white ${ADMIN_FOCUS}`}
            >
              <RotateCcw size={13} />
              <span>{isPt ? 'Padrão (360×270 cm)' : 'Default (360×270 cm)'}</span>
            </button>
          )}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          {(['leftWall', 'rightWall'] as const).map((wallId) => {
            const dim = roomDimensions[wallId];
            const ratio = (dim.widthCm / Math.max(1, dim.heightCm)).toFixed(2);
            const meta = SURFACE_UI_META[wallId];
            return (
              <div
                key={wallId}
                className="rounded-xl border border-[#1e3a66]/55 bg-white/[0.02] p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: meta.accentHex }}
                    />
                    <span className="text-sm font-semibold text-slate-100">
                      {isPt ? meta.shortPt : meta.shortEn}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 [font-variant-numeric:tabular-nums]">
                    {formatMetersPair(dim.widthCm, dim.heightCm)} · {ratio}:1
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2.5">
                  <DimensionCmField
                    label={isPt ? 'Largura · cm' : 'Width · cm'}
                    value={dim.widthCm}
                    testId={`dim-${wallId}-width`}
                    onCommit={(raw) => onUpdateWallDimension?.(wallId, 'widthCm', raw)}
                  />
                  <DimensionCmField
                    label={isPt ? 'Altura · cm' : 'Height · cm'}
                    value={dim.heightCm}
                    testId={`dim-${wallId}-height`}
                    onCommit={(raw) => onUpdateWallDimension?.(wallId, 'heightCm', raw)}
                  />
                </div>
              </div>
            );
          })}

          <div className="flex flex-col justify-between rounded-xl border border-[#2563eb]/55 bg-[#0c1a36]/55 p-4">
            <div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: SURFACE_UI_META.ceiling.accentHex }}
                  />
                  <span className="text-sm font-semibold text-slate-100">
                    {isPt ? 'Teto · Automático' : 'Ceiling · Auto'}
                  </span>
                </div>
                <span className="rounded-xl border border-[#1e3a66] bg-[#040b1a] px-2.5 py-0.5 text-[10px] font-semibold text-[#7dd3fc]">
                  {isPt ? 'Calculado' : 'Derived'}
                </span>
              </div>

              <div
                data-testid="dim-ceiling-auto"
                className="mt-3 text-lg font-semibold text-white [font-variant-numeric:tabular-nums]"
              >
                {roomDimensions.ceiling.widthCm} × {roomDimensions.ceiling.heightCm} cm
              </div>
              <div className="mt-0.5 text-xs text-[#7dd3fc] [font-variant-numeric:tabular-nums]">
                {formatMetersPair(roomDimensions.ceiling.widthCm, roomDimensions.ceiling.heightCm)} ·{' '}
                {(
                  roomDimensions.ceiling.widthCm /
                  Math.max(1, roomDimensions.ceiling.heightCm)
                ).toFixed(2)}
                :1
              </div>
            </div>

            <p className="mt-3 text-xs leading-relaxed text-slate-400">
              {isPt
                ? `Parede Direita (${roomDimensions.rightWall.widthCm} cm) × Parede Esquerda (${roomDimensions.leftWall.widthCm} cm)`
                : `Right Wall (${roomDimensions.rightWall.widthCm} cm) × Left Wall (${roomDimensions.leftWall.widthCm} cm)`}
            </p>
          </div>
        </div>
      </section>

      {/* Sub-block 2C: Corner-Pin on Real Room Corners */}
      <section
        className={`setup-block-enter p-5 sm:p-6 ${ADMIN_PANEL_CLASS}`}
        data-testid="substep-projection-warp"
      >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-[64ch]">
              <h2 className="text-base font-semibold tracking-[-0.015em] text-slate-50 sm:text-lg">
                {isPt
                  ? 'Calibração Remota Corner-Pin · Encaixe as quinas reais'
                  : 'Remote Corner-Pin · Fit physical wall seams'}
              </h2>
              <p className="mt-1 text-xs leading-[1.55] text-slate-400 sm:text-[13px]">
                {isPt
                  ? 'Ative a grade para ver os cantos na parede; divisas compartilhadas movem juntas.'
                  : 'Enable the grid to view corners on walls; shared wall seams stay welded.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {(() => {
                const isAnyGridVisible =
                  projectionState.showGrid ||
                  PROJECTOR_OUT_IDS.some((id) => Boolean(projectionState.outputs[id]?.showGrid));
                return (
                  <button
                    type="button"
                    onClick={onToggleGlobalShowGrid}
                    className={`inline-flex min-h-[42px] items-center gap-2 rounded-full border px-4 text-xs font-semibold ${PRESS_TRANSITION} ${ADMIN_FOCUS} ${
                      isAnyGridVisible
                        ? 'border-white bg-white text-[#060913]'
                        : 'border-[#2563eb] bg-[#0c1a36] text-white hover:bg-[#142850]'
                    }`}
                  >
                    <Grid size={13} />
                    <span>
                      {isAnyGridVisible
                        ? isPt
                          ? 'Ocultar Guia dos 4 Cantos'
                          : 'Hide 4-Corner Guide'
                        : isPt
                          ? 'Mostrar Guia dos 4 Cantos'
                          : 'Show 4-Corner Guide'}
                    </span>
                  </button>
                );
              })()}

              <button
                type="button"
                onClick={onResetAllProjectionQuads}
                className={`inline-flex min-h-[42px] items-center gap-1.5 rounded-full border border-[#1e3a66] bg-[#060c1a] px-3.5 text-xs font-medium text-slate-200 hover:border-[#2563eb] hover:text-white ${PRESS_TRANSITION} ${ADMIN_FOCUS}`}
              >
                <RotateCcw size={12} />
                <span>{isPt ? 'Resetar Malha' : 'Reset Mesh'}</span>
              </button>
            </div>
          </div>

          {activeOutputs.length > 1 && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {activeOutputs.map((outId) => {
                const selected = effectiveOut === outId;
                const labelWalls = (projectionState.outputs[outId]?.surfaces ?? [])
                  .map((s) => (isPt ? SURFACE_UI_META[s].shortPt : SURFACE_UI_META[s].shortEn))
                  .join(' + ');
                return (
                  <button
                    key={outId}
                    type="button"
                    onClick={() => setSelectedOut(outId)}
                    className={`min-h-[38px] rounded-xl border px-3 text-xs font-semibold [font-variant-numeric:tabular-nums] ${PRESS_TRANSITION} ${ADMIN_FOCUS} ${
                      selected
                        ? 'border-[#2563eb] bg-[#0c1a36] text-white'
                        : 'border-[#1e3a66]/55 bg-[#040b1a] text-slate-300 hover:text-white'
                    }`}
                  >
                    {isPt ? `Saída ${outId}` : `Output ${outId}`} — {labelWalls}
                  </button>
                );
              })}
            </div>
          )}

          {/* 16:9 visual stage */}
          <div
            ref={stageRef}
            className="relative mx-auto mt-4 aspect-video w-full max-w-2xl overflow-hidden rounded-xl border border-[#1e3a66]/65 bg-black select-none touch-none"
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

              {activeSurfaces.map((sId) => {
                const qKey = makeSurfaceQuadKey(effectiveOut, sId);
                const q = projectionState.quads[qKey];
                const accent = SURFACE_UI_META[sId].accentHex;
                const pts = q.map((p) => `${p.x * 1600},${p.y * 900}`).join(' ');
                const cx = ((q[0].x + q[1].x + q[2].x + q[3].x) / 4) * 1600;
                const cy = ((q[0].y + q[1].y + q[2].y + q[3].y) / 4) * 900;

                return (
                  <g key={qKey}>
                    <polygon
                      points={pts}
                      fill={`${accent}1c`}
                      stroke={accent}
                      strokeWidth="4"
                      className="cursor-move"
                      onPointerDown={(e) => {
                        e.preventDefault();
                        setDragState({
                          kind: 'mesh',
                          outId: effectiveOut,
                          startMouse: getPointerNorm(e),
                          startQuads: projectionState.quads,
                        });
                      }}
                    />
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
                    <text
                      x={cx}
                      y={cy - 8}
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
                      {isPt ? 'Arraste para mover' : 'Drag to move'}
                    </text>
                  </g>
                );
              })}
            </svg>

            {getUniquePinHandlesForOutput(effectiveOut, activeSurfaces, projectionState.quads).map(
              (handle) => {
                const accent = SURFACE_UI_META[handle.surfaceId].accentHex;
                return (
                  <button
                    key={handle.id}
                    type="button"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setDragState({
                        kind: 'corner',
                        quadKey: handle.quadKey,
                        cornerIdx: handle.cornerIdx,
                      });
                    }}
                    className={`absolute z-20 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 cursor-grab items-center justify-center rounded-full border-2 bg-[#060913] text-xs font-semibold text-white active:cursor-grabbing [font-variant-numeric:tabular-nums] ${
                      handle.isShared ? 'ring-2 ring-[#38bdf8]/60' : ''
                    } ${ADMIN_FOCUS}`}
                    style={{
                      left: `${handle.point.x * 100}%`,
                      top: `${handle.point.y * 100}%`,
                      borderColor: handle.isShared ? '#f8fafc' : accent,
                    }}
                  >
                    {handle.isShared ? `${handle.memberCount}×` : handle.label}
                  </button>
                );
              }
            )}
          </div>

          <div className={`mt-3 px-3.5 py-2 text-xs text-slate-400 ${ADMIN_WELL_CLASS}`}>
            {isPt
              ? 'A grade é ocultada automaticamente ao iniciar o espetáculo.'
              : 'The grid turns off automatically when launching the show.'}
          </div>
        </section>

      {/* Sub-block 2D: Inter-Screen Delay Controller */}
      <ScreenDelayControlPanel
        isPt={isPt}
        projectionState={projectionState}
        screenSyncPulseActive={screenSyncPulseActive}
        calibBeatSeq={calibBeatSeq}
        stepLabelPt="Sincronia entre Telas"
        stepLabelEn="Screen-to-Screen Delay"
        onUpdateOutputDelay={(outId, delayMs) => onUpdateOutputDelay?.(outId, delayMs)}
        onResetScreenDelays={() => onResetScreenDelays?.()}
        onToggleScreenSyncPulse={() => onToggleScreenSyncPulse?.()}
      />

      <NextBlockTeaser
        title={isPt ? 'Escolher saída de áudio espacial 8D' : 'Choose 8D spatial audio output'}
        subtitle={
          isPt
            ? 'Configure fone de ouvido ou 3 caixas e iguale o atraso entre imagem e som.'
            : 'Select headphones or 3 speakers and balance A/V timing.'
        }
        slotCount={2}
      />
    </div>
  );
};
