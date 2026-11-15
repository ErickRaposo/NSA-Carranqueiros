import React, { useEffect, useRef, useState } from 'react';
import { Check, Copy, ExternalLink, Grid, RotateCcw, Scan } from 'lucide-react';
import { LanPeerInfo, ProjectorOutId } from '../../experience/types';
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
import { ScreenScenario } from './setupTypes';

interface StepProjectionSetupProps {
  isPt: boolean;
  scenario: Exclude<ScreenScenario, 0>;
  projectionState: ProjectionCalibrationState;
  baseOrigin: string;
  roomCode: string | null;
  lanClients: LanPeerInfo[];
  copiedKey: string | null;
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

export const StepProjectionSetup: React.FC<StepProjectionSetupProps> = ({
  isPt,
  scenario,
  projectionState,
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
}) => {
  const activeOutputs = ([1, 2, 3] as ProjectorOutId[]).slice(0, scenario);
  const [selectedOut, setSelectedOut] = useState<ProjectorOutId>(1);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [dragState, setDragState] = useState<LocalDragState | null>(null);

  const effectiveOut: ProjectorOutId = activeOutputs.includes(selectedOut) ? selectedOut : 1;
  const activeSurfaces = projectionState.outputs[effectiveOut]?.surfaces ?? [];

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
    <div className="flex flex-col gap-5" data-testid="setup-step-projection">
      {/* Sub-etapa A: Abrir janelas dos projetores e identificar cabos */}
      <section className={`p-5 ${ADMIN_PANEL_CLASS}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <span className="text-xs font-semibold tracking-wide text-[#7dd3fc] uppercase">
              {isPt ? 'Passo 2A · Abrir as Telas' : 'Step 2A · Open Projector Windows'}
            </span>
            <h2 className="mt-1 text-lg font-semibold text-slate-50">
              {isPt
                ? 'Envie cada janela para o projetor correspondente'
                : 'Send each window to its matching projector'}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-300">
              {isPt
                ? 'Clique em "Abrir Janela", arraste a nova janela para a tela daquele projetor e aperte F11 para deixá-la em tela cheia. Se tiver dúvida de qual projetor é qual, clique em "Piscar Números nas Paredes".'
                : 'Click "Open Window", drag the new window onto that projector display, and press F11 for fullscreen. Unsure which projector is which? Click "Flash Numbers on Walls".'}
            </p>
          </div>

          <button
            type="button"
            onClick={onIdentifyOutputs}
            className={`inline-flex min-h-[44px] items-center gap-2 rounded-full border border-[#2563eb]/65 bg-[#0c1a36] px-4 text-xs font-semibold text-white transition hover:bg-[#152a55] ${ADMIN_FOCUS}`}
          >
            <Scan size={15} className="text-[#7dd3fc]" />
            <span>
              {isPt ? 'Piscar Números nas Paredes (7s)' : 'Flash Numbers on Walls (7s)'}
            </span>
          </button>
        </div>

        <div
          className={`mt-4 grid grid-cols-1 gap-3 ${
            activeOutputs.length === 1
              ? 'md:grid-cols-1'
              : activeOutputs.length === 2
                ? 'md:grid-cols-2'
                : 'md:grid-cols-3'
          }`}
        >
          {activeOutputs.map((outId) => {
            const surfaces = projectionState.outputs[outId]?.surfaces ?? [];
            const copyKey = `wiz-proj-${outId}`;
            const fullUrl = buildViewUrl(baseOrigin, 'projector', { outId, roomCode });
            const relativeHref = buildViewUrl(null, 'projector', { outId, roomCode });
            const isOnline = lanClients.some((c) => c.role === `projector-${outId}`);
            const wallNames = surfaces
              .map((s) => (isPt ? SURFACE_UI_META[s].shortPt : SURFACE_UI_META[s].shortEn))
              .join(' + ');

            return (
              <div
                key={outId}
                className="flex flex-col justify-between rounded-2xl border border-[#1e3a66]/60 bg-[#060c1a]/90 p-4"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-lg border border-[#1e3a66] bg-[#0c1a36] px-2.5 py-1 text-xs font-semibold text-white [font-variant-numeric:tabular-nums]">
                      {isPt ? `Projetor ${outId}` : `Projector ${outId}`}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs text-slate-300">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          isOnline ? 'bg-emerald-400' : 'bg-slate-500'
                        }`}
                      />
                      <span>
                        {isOnline
                          ? isPt
                            ? 'Janela aberta'
                            : 'Window active'
                          : isPt
                            ? 'Aguardando abertura'
                            : 'Not opened yet'}
                      </span>
                    </span>
                  </div>

                  <div className="mt-3 text-sm font-semibold text-slate-100">
                    {wallNames || (isPt ? 'Sem parede atribuída' : 'No wall assigned')}
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    {surfaces
                      .map((s) =>
                        isPt ? SURFACE_UI_META[s].detailPt : SURFACE_UI_META[s].detailEn
                      )
                      .join(' · ')}
                  </p>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <a
                    href={relativeHref}
                    target="_blank"
                    rel="noreferrer"
                    className={`inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 px-3.5 text-xs ${ADMIN_PRIMARY_PILL_CLASS} ${ADMIN_FOCUS}`}
                  >
                    <span>{isPt ? `Abrir Projetor ${outId}` : `Open Projector ${outId}`}</span>
                    <ExternalLink size={13} />
                  </a>

                  <button
                    type="button"
                    onClick={() => onCopyText(copyKey, fullUrl)}
                    title={fullUrl}
                    className={`inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-full border border-[#1e3a66] bg-[#040b1a] px-3.5 text-xs font-medium text-slate-200 transition hover:border-[#2563eb] hover:text-white ${ADMIN_FOCUS}`}
                  >
                    {copiedKey === copyKey ? (
                      <Check size={13} className="text-[#7dd3fc]" />
                    ) : (
                      <Copy size={13} />
                    )}
                    <span>
                      {copiedKey === copyKey
                        ? 'OK'
                        : isPt
                          ? 'Copiar p/ outro PC'
                          : 'Copy for other PC'}
                    </span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Sub-etapa B: Encaixar nos 4 cantos reais da parede */}
      <section className={`p-5 ${ADMIN_PANEL_CLASS}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <span className="text-xs font-semibold tracking-wide text-[#7dd3fc] uppercase">
              {isPt ? 'Passo 2B · Ajustar nas Quinas da Sala' : 'Step 2B · Fit to Room Corners'}
            </span>
            <h2 className="mt-1 text-lg font-semibold text-slate-50">
              {isPt
                ? 'Encaixe os cantos da imagem nas paredes reais'
                : 'Align the image corners to your physical walls'}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-300">
              {isPt
                ? 'Ligue a "Guia dos 4 Cantos" para ver uma grade luminosa na parede. Depois, arraste os círculos abaixo até encaixar exatamente nas quinas da sua sala. Os pontos onde as paredes se tocam já ficam soldados juntos.'
                : 'Turn on the "4-Corner Guide" to see an alignment grid on the wall. Then drag the circles below until they match your room corners. Shared wall seams stay welded together automatically.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onToggleGlobalShowGrid}
              className={`inline-flex min-h-[44px] items-center gap-2 rounded-full border px-4 text-xs font-semibold transition ${ADMIN_FOCUS} ${
                projectionState.showGrid
                  ? 'border-white bg-white text-[#060913]'
                  : 'border-[#2563eb] bg-[#0c1a36] text-white hover:bg-[#142850]'
              }`}
            >
              <Grid size={14} />
              <span>
                {projectionState.showGrid
                  ? isPt
                    ? 'Ocultar Guia dos 4 Cantos'
                    : 'Hide 4-Corner Guide'
                  : isPt
                    ? 'Mostrar Guia dos 4 Cantos'
                    : 'Show 4-Corner Guide'}
              </span>
            </button>

            <button
              type="button"
              onClick={onResetAllProjectionQuads}
              className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-[#1e3a66] bg-[#060c1a] px-4 text-xs font-medium text-slate-200 transition hover:border-[#2563eb] hover:text-white ${ADMIN_FOCUS}`}
            >
              <RotateCcw size={13} />
              <span>{isPt ? 'Resetar Alinhamento' : 'Reset Alignment'}</span>
            </button>
          </div>
        </div>

        {/* Seletor de qual projetor calibrar quando há 2 ou 3 projetores */}
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
                  className={`min-h-[42px] rounded-xl border px-3.5 text-xs font-semibold transition ${ADMIN_FOCUS} ${
                    selected
                      ? 'border-[#2563eb] bg-[#0c1a36] text-white'
                      : 'border-[#1e3a66]/55 bg-[#040b1a] text-slate-300 hover:text-white'
                  }`}
                >
                  {isPt ? `Ajustar Projetor ${outId}` : `Align Projector ${outId}`} · {labelWalls}
                </button>
              );
            })}
          </div>
        )}

        {/* Palco visual simplificado 16:9 com pins soldados */}
        <div
          ref={stageRef}
          className="relative mx-auto mt-4 aspect-video w-full max-w-4xl overflow-hidden rounded-2xl border border-[#1e3a66]/65 bg-black select-none touch-none"
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
                  className={`absolute z-20 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 cursor-grab items-center justify-center rounded-full border-2 bg-[#060913] text-xs font-semibold text-white active:cursor-grabbing [font-variant-numeric:tabular-nums] ${
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

        <div className={`mt-3 p-3 text-xs text-slate-300 ${ADMIN_WELL_CLASS}`}>
          {isPt
            ? 'Dica: quando terminar de encaixar os cantos, clique em "Ocultar Guia dos 4 Cantos" (ou simplesmente avance para o próximo passo, que nós ocultamos a grade ao iniciar).'
            : 'Tip: once the corners fit your walls, click "Hide 4-Corner Guide" (or simply continue — we automatically hide the alignment grid when launching).'}
        </div>
      </section>
    </div>
  );
};
