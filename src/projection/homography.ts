import {
  PROJECTOR_OUT_IDS,
  ProjectorOutId,
  SURFACE_IDS,
  SurfaceId,
} from '../experience/types';
import { clampScreenDelayMs } from './screenDelay';

export interface Point2D {
  x: number;
  y: number;
}

/**
 * Quad de 4 vértices em coordenadas normalizadas [0..1] da área alvo:
 * Ordem horária: Top-Left, Top-Right, Bottom-Right, Bottom-Left.
 */
export type QuadCorners = [Point2D, Point2D, Point2D, Point2D];

export type CalibrationSurfaceKey = `out${ProjectorOutId}-${SurfaceId}`;

export type ProjectionTopologyPreset =
  | '3-projectors'
  | '2-projectors'
  | '1-projector'
  | 'custom';

export interface ProjectorOutputConfig {
  outId: ProjectorOutId;
  surfaces: SurfaceId[];
  showGrid: boolean;
  blackout: boolean;
  /** Compensação de atraso entre telas (-400 a +400 ms). */
  delayMs?: number;
}

export type EdgeFeatherSide = 'left' | 'right' | 'top' | 'bottom';

export interface EdgeFeatherMask {
  leftPct: number;
  rightPct: number;
  topPct: number;
  bottomPct: number;
}

export interface ProjectionCalibrationState {
  preset: ProjectionTopologyPreset;
  showGrid: boolean;
  globalBlackout: boolean;
  identifyUntil: number;
  identifyNonce?: number;
  identifyDurationMs?: number;
  outputs: Record<ProjectorOutId, ProjectorOutputConfig>;
  quads: Record<CalibrationSurfaceKey, QuadCorners>;
  edgeMasks: Record<CalibrationSurfaceKey, EdgeFeatherMask>;
}

export const CALIBRATION_STORAGE_KEY = 'earth-jukebox-calibration-v3';
export const CALIBRATION_CHANNEL_NAME = 'earth-jukebox-calibration-sync-v1';

export function makeSurfaceQuadKey(
  outId: ProjectorOutId,
  surfaceId: SurfaceId
): CalibrationSurfaceKey {
  return `out${outId}-${surfaceId}`;
}

export function parseSurfaceQuadKey(key: CalibrationSurfaceKey): {
  outId: ProjectorOutId;
  surfaceId: SurfaceId;
} {
  const match = /^out([1-3])-(leftWall|rightWall|ceiling)$/.exec(key);
  if (!match) {
    return { outId: 1, surfaceId: 'leftWall' };
  }
  return {
    outId: Number(match[1]) as ProjectorOutId,
    surfaceId: match[2] as SurfaceId,
  };
}

export interface CornerVertexRef {
  surfaceId: SurfaceId;
  cornerIdx: 0 | 1 | 2 | 3;
}

export interface DeduplicatedPinHandle {
  id: string;
  quadKey: CalibrationSurfaceKey;
  surfaceId: SurfaceId;
  cornerIdx: 0 | 1 | 2 | 3;
  point: Point2D;
  label: 'TL' | 'TR' | 'BR' | 'BL';
  isShared: boolean;
  memberCount: number;
  members: ReadonlyArray<CornerVertexRef>;
}

export function createIdentityQuad(
  x0 = 0,
  y0 = 0,
  x1 = 1,
  y1 = 1
): QuadCorners {
  return [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];
}

export function createDefaultEdgeMask(): EdgeFeatherMask {
  return { leftPct: 0, rightPct: 0, topPct: 0, bottomPct: 0 };
}

function createAllZeroEdgeMasks(): Record<CalibrationSurfaceKey, EdgeFeatherMask> {
  const masks = {} as Record<CalibrationSurfaceKey, EdgeFeatherMask>;
  for (const outId of PROJECTOR_OUT_IDS) {
    for (const sId of SURFACE_IDS) {
      masks[makeSurfaceQuadKey(outId, sId)] = createDefaultEdgeMask();
    }
  }
  return masks;
}

function createAllIdentityQuads(): Record<CalibrationSurfaceKey, QuadCorners> {
  const quads = {} as Record<CalibrationSurfaceKey, QuadCorners>;
  for (const outId of PROJECTOR_OUT_IDS) {
    for (const sId of SURFACE_IDS) {
      quads[makeSurfaceQuadKey(outId, sId)] = createIdentityQuad(0, 0, 1, 1);
    }
  }
  return quads;
}

/**
 * Distribui automaticamente os quadriláteros das superfícies atribuídas a uma saída HDMI
 * aproveitando 100% da resolução quando há 1 superfície, 50/50 soldado no meio quando há 2,
 * ou Canto 3D Isométrico (Teto em losango + Parede Esq + Parede Dir com pins soldados) quando há 3.
 */
export function buildAutoQuadsForSurfaces(
  outId: ProjectorOutId,
  surfaces: SurfaceId[],
  baseQuads: Record<CalibrationSurfaceKey, QuadCorners>
): Record<CalibrationSurfaceKey, QuadCorners> {
  const next = { ...baseQuads };
  if (surfaces.length === 1) {
    next[makeSurfaceQuadKey(outId, surfaces[0])] = createIdentityQuad(0, 0, 1, 1);
  } else if (surfaces.length === 2) {
    next[makeSurfaceQuadKey(outId, surfaces[0])] = createIdentityQuad(0, 0, 0.5, 1);
    next[makeSurfaceQuadKey(outId, surfaces[1])] = createIdentityQuad(0.5, 0, 1, 1);
  } else if (surfaces.length >= 3) {
    const hasAllThreeRoomSurfaces =
      surfaces.includes('ceiling') &&
      surfaces.includes('leftWall') &&
      surfaces.includes('rightWall');

    if (hasAllThreeRoomSurfaces) {
      // Canto 3D Isométrico para 1 Projetor Grande-Angular (pins compartilhados 100% soldados)
      const pCeilingPeak: Point2D = { x: 0.5, y: 0.06 };
      const pLeftTop: Point2D = { x: 0.21, y: 0.35 };
      const pRightTop: Point2D = { x: 0.79, y: 0.35 };
      const pCenterTop: Point2D = { x: 0.5, y: 0.45 };
      const pLeftBottom: Point2D = { x: 0.21, y: 0.83 };
      const pRightBottom: Point2D = { x: 0.79, y: 0.83 };
      const pCenterBottom: Point2D = { x: 0.5, y: 0.94 };

      next[makeSurfaceQuadKey(outId, 'ceiling')] = [
        { ...pLeftTop },
        { ...pCeilingPeak },
        { ...pRightTop },
        { ...pCenterTop },
      ];
      next[makeSurfaceQuadKey(outId, 'leftWall')] = [
        { ...pLeftTop },
        { ...pCenterTop },
        { ...pCenterBottom },
        { ...pLeftBottom },
      ];
      next[makeSurfaceQuadKey(outId, 'rightWall')] = [
        { ...pCenterTop },
        { ...pRightTop },
        { ...pRightBottom },
        { ...pCenterBottom },
      ];
    } else {
      surfaces.forEach((sId, idx) => {
        const w = 1 / surfaces.length;
        next[makeSurfaceQuadKey(outId, sId)] = createIdentityQuad(
          Number((idx * w).toFixed(4)),
          0,
          Number(((idx + 1) * w).toFixed(4)),
          1
        );
      });
    }
  }
  return next;
}

/**
 * Retorna os grupos de vértices soldados entre paredes que dividem a mesma saída física (`outId`).
 */
export function getSharedCornerGroupsForSurfaces(
  surfaces: readonly SurfaceId[]
): ReadonlyArray<ReadonlyArray<CornerVertexRef>> {
  const hasAllThree =
    surfaces.includes('leftWall') &&
    surfaces.includes('rightWall') &&
    surfaces.includes('ceiling');

  if (hasAllThree) {
    return [
      // Junta Tripla Central: Parede Esq TR [1] === Parede Dir TL [0] === Teto BL [3]
      [
        { surfaceId: 'leftWall', cornerIdx: 1 },
        { surfaceId: 'rightWall', cornerIdx: 0 },
        { surfaceId: 'ceiling', cornerIdx: 3 },
      ],
      // Base Central: Parede Esq BR [2] === Parede Dir BL [3]
      [
        { surfaceId: 'leftWall', cornerIdx: 2 },
        { surfaceId: 'rightWall', cornerIdx: 3 },
      ],
      // Quina Superior Esquerda: Teto TL [0] === Parede Esq TL [0]
      [
        { surfaceId: 'ceiling', cornerIdx: 0 },
        { surfaceId: 'leftWall', cornerIdx: 0 },
      ],
      // Quina Superior Direita: Teto BR [2] === Parede Dir TR [1]
      [
        { surfaceId: 'ceiling', cornerIdx: 2 },
        { surfaceId: 'rightWall', cornerIdx: 1 },
      ],
    ];
  }

  if (surfaces.length === 2) {
    const [first, second] = surfaces;
    return [
      [
        { surfaceId: first, cornerIdx: 1 },
        { surfaceId: second, cornerIdx: 0 },
      ],
      [
        { surfaceId: first, cornerIdx: 2 },
        { surfaceId: second, cornerIdx: 3 },
      ],
    ];
  }

  return [];
}

function cloneQuadCorners(q: QuadCorners): QuadCorners {
  return [{ ...q[0] }, { ...q[1] }, { ...q[2] }, { ...q[3] }];
}

/**
 * Atualiza um quadrilátero propagando automaticamente qualquer movimento nos pins soldados
 * entre paredes compartilhadas na mesma saída (`2-projectors` e `1-projector`).
 */
export function updateQuadWithSharedSeams(
  state: ProjectionCalibrationState,
  key: CalibrationSurfaceKey,
  nextQuad: QuadCorners
): Record<CalibrationSurfaceKey, QuadCorners> {
  const { outId, surfaceId } = parseSurfaceQuadKey(key);
  const surfaces = state.outputs[outId]?.surfaces ?? [];
  const prevQuad = state.quads[key];

  const nextQuads: Record<CalibrationSurfaceKey, QuadCorners> = {
    ...state.quads,
    [key]: cloneQuadCorners(nextQuad),
  };

  if (surfaces.length < 2) {
    return nextQuads;
  }

  const groups = getSharedCornerGroupsForSurfaces(surfaces);
  for (const idx of [0, 1, 2, 3] as const) {
    const changed =
      !prevQuad ||
      Math.abs(nextQuad[idx].x - prevQuad[idx].x) > 1e-7 ||
      Math.abs(nextQuad[idx].y - prevQuad[idx].y) > 1e-7;
    if (!changed) continue;

    const group = groups.find((g) =>
      g.some((m) => m.surfaceId === surfaceId && m.cornerIdx === idx)
    );
    if (!group) continue;

    for (const member of group) {
      if (member.surfaceId === surfaceId && member.cornerIdx === idx) continue;
      const peerKey = makeSurfaceQuadKey(outId, member.surfaceId);
      const peerQuad = cloneQuadCorners(nextQuads[peerKey]);
      peerQuad[member.cornerIdx] = {
        x: nextQuad[idx].x,
        y: nextQuad[idx].y,
      };
      nextQuads[peerKey] = peerQuad;
    }
  }

  return nextQuads;
}

/**
 * Translada solidariamente todas as superfícies conectadas em uma mesma saída (`outId`),
 * preservando a união das quinas ao arrastar o interior da malha.
 */
export function translateOutputSurfacesTogether(
  outId: ProjectorOutId,
  surfaces: readonly SurfaceId[],
  startQuads: Record<CalibrationSurfaceKey, QuadCorners>,
  rawDx: number,
  rawDy: number
): Record<CalibrationSurfaceKey, QuadCorners> {
  const nextQuads = { ...startQuads };
  if (surfaces.length === 0) return nextQuads;

  let minDx = -Infinity;
  let maxDx = Infinity;
  let minDy = -Infinity;
  let maxDy = Infinity;

  for (const sId of surfaces) {
    const q = startQuads[makeSurfaceQuadKey(outId, sId)];
    if (!q) continue;
    for (const pt of q) {
      minDx = Math.max(minDx, -pt.x);
      maxDx = Math.min(maxDx, 1 - pt.x);
      minDy = Math.max(minDy, -pt.y);
      maxDy = Math.min(maxDy, 1 - pt.y);
    }
  }

  const dx = Math.min(maxDx, Math.max(minDx, rawDx));
  const dy = Math.min(maxDy, Math.max(minDy, rawDy));

  for (const sId of surfaces) {
    const k = makeSurfaceQuadKey(outId, sId);
    const base = startQuads[k];
    if (!base) continue;
    nextQuads[k] = [
      { x: Number((base[0].x + dx).toFixed(4)), y: Number((base[0].y + dy).toFixed(4)) },
      { x: Number((base[1].x + dx).toFixed(4)), y: Number((base[1].y + dy).toFixed(4)) },
      { x: Number((base[2].x + dx).toFixed(4)), y: Number((base[2].y + dy).toFixed(4)) },
      { x: Number((base[3].x + dx).toFixed(4)), y: Number((base[3].y + dy).toFixed(4)) },
    ];
  }

  return nextQuads;
}

/**
 * Deduplica visualmente as alças de Corner-Pin para que vértices soldados exibam 1 único pino limpo
 * em vez de 2 ou 3 botões empilhados na mesma coordenada.
 */
export function getUniquePinHandlesForOutput(
  outId: ProjectorOutId,
  surfaces: readonly SurfaceId[],
  quads: Record<CalibrationSurfaceKey, QuadCorners>
): DeduplicatedPinHandle[] {
  const cornerLabels = ['TL', 'TR', 'BR', 'BL'] as const;
  const groups = getSharedCornerGroupsForSurfaces(surfaces);
  const visited = new Set<string>();
  const handles: DeduplicatedPinHandle[] = [];

  for (const surfaceId of surfaces) {
    const quadKey = makeSurfaceQuadKey(outId, surfaceId);
    const q = quads[quadKey];
    if (!q) continue;

    for (const idx of [0, 1, 2, 3] as const) {
      const token = `${surfaceId}:${idx}`;
      if (visited.has(token)) continue;

      const group = groups.find((g) =>
        g.some((m) => m.surfaceId === surfaceId && m.cornerIdx === idx)
      );
      if (group) {
        for (const m of group) {
          visited.add(`${m.surfaceId}:${m.cornerIdx}`);
        }
        const primary = group[0];
        const primaryKey = makeSurfaceQuadKey(outId, primary.surfaceId);
        const pt = quads[primaryKey]?.[primary.cornerIdx] ?? q[idx];
        handles.push({
          id: `${outId}-shared-${primary.surfaceId}-${cornerLabels[primary.cornerIdx]}`,
          quadKey: primaryKey,
          surfaceId: primary.surfaceId,
          cornerIdx: primary.cornerIdx,
          point: pt,
          label: cornerLabels[primary.cornerIdx],
          isShared: true,
          memberCount: group.length,
          members: group,
        });
      } else {
        visited.add(token);
        handles.push({
          id: `${quadKey}-${cornerLabels[idx]}`,
          quadKey,
          surfaceId,
          cornerIdx: idx,
          point: q[idx],
          label: cornerLabels[idx],
          isShared: false,
          memberCount: 1,
          members: [{ surfaceId, cornerIdx: idx }],
        });
      }
    }
  }

  return handles;
}

export function applyProjectionPreset(
  preset: Exclude<ProjectionTopologyPreset, 'custom'>,
  prev?: ProjectionCalibrationState
): ProjectionCalibrationState {
  let quads = createAllIdentityQuads();
  let outputs: Record<ProjectorOutId, ProjectorOutputConfig>;

  if (preset === '3-projectors') {
    // 1 Projetor dedicado por superfície (100% da resolução nativa em cada parede e teto)
    outputs = {
      1: { outId: 1, surfaces: ['leftWall'], showGrid: false, blackout: false },
      2: { outId: 2, surfaces: ['rightWall'], showGrid: false, blackout: false },
      3: { outId: 3, surfaces: ['ceiling'], showGrid: false, blackout: false },
    };
  } else if (preset === '1-projector') {
    // 1 Projetor único grande-angular cobrindo Canto em L + Teto
    outputs = {
      1: {
        outId: 1,
        surfaces: ['leftWall', 'rightWall', 'ceiling'],
        showGrid: false,
        blackout: false,
      },
      2: { outId: 2, surfaces: [], showGrid: false, blackout: false },
      3: { outId: 3, surfaces: [], showGrid: false, blackout: false },
    };
  } else {
    // Default '2-projectors': Out 1 = Canto em L (Esq + Dir), Out 2 = Teto
    outputs = {
      1: { outId: 1, surfaces: ['leftWall', 'rightWall'], showGrid: false, blackout: false },
      2: { outId: 2, surfaces: ['ceiling'], showGrid: false, blackout: false },
      3: { outId: 3, surfaces: [], showGrid: false, blackout: false },
    };
  }

  for (const outId of PROJECTOR_OUT_IDS) {
    outputs[outId] = {
      ...outputs[outId],
      delayMs: clampScreenDelayMs(prev?.outputs?.[outId]?.delayMs ?? 0),
    };
    quads = buildAutoQuadsForSurfaces(outId, outputs[outId].surfaces, quads);
  }

  return {
    preset,
    showGrid: prev?.showGrid ?? false,
    globalBlackout: false,
    identifyUntil: 0,
    identifyNonce: prev?.identifyNonce ?? 0,
    identifyDurationMs: 7000,
    outputs,
    quads,
    edgeMasks: prev?.edgeMasks ?? createAllZeroEdgeMasks(),
  };
}

export function createDefaultCalibrationState(): ProjectionCalibrationState {
  return applyProjectionPreset('2-projectors');
}

const SURFACE_SORT_ORDER: Record<SurfaceId, number> = {
  leftWall: 0,
  rightWall: 1,
  ceiling: 2,
};

/**
 * Liga/desliga uma superfície em uma saída física `Out 1..4` na matriz Patchbay,
 * redistribuindo automaticamente os quads daquela saída para ocupar 100% da área útil.
 */
export function toggleSurfaceOnOutput(
  state: ProjectionCalibrationState,
  outId: ProjectorOutId,
  surfaceId: SurfaceId
): ProjectionCalibrationState {
  const current = state.outputs[outId]?.surfaces ?? [];
  const exists = current.includes(surfaceId);
  const nextSurfaces = exists
    ? current.filter((s) => s !== surfaceId)
    : [...current, surfaceId].sort((a, b) => SURFACE_SORT_ORDER[a] - SURFACE_SORT_ORDER[b]);

  const nextOutputs: Record<ProjectorOutId, ProjectorOutputConfig> = {
    ...state.outputs,
    [outId]: {
      ...state.outputs[outId],
      surfaces: nextSurfaces,
    },
  };

  const nextQuads = buildAutoQuadsForSurfaces(outId, nextSurfaces, state.quads);

  return {
    ...state,
    preset: 'custom',
    outputs: nextOutputs,
    quads: nextQuads,
  };
}

export function resetOutputQuads(
  state: ProjectionCalibrationState,
  outId: ProjectorOutId
): ProjectionCalibrationState {
  const surfaces = state.outputs[outId]?.surfaces ?? [];
  const nextMasks = { ...state.edgeMasks };
  for (const sId of SURFACE_IDS) {
    nextMasks[makeSurfaceQuadKey(outId, sId)] = createDefaultEdgeMask();
  }
  return {
    ...state,
    quads: buildAutoQuadsForSurfaces(outId, surfaces, state.quads),
    edgeMasks: nextMasks,
  };
}

export function isProjectionStateValid(
  candidate: unknown
): candidate is ProjectionCalibrationState {
  if (!candidate || typeof candidate !== 'object') return false;
  const obj = candidate as Partial<ProjectionCalibrationState>;
  return Boolean(obj.outputs && obj.quads);
}

export function loadCalibrationState(): ProjectionCalibrationState {
  const fallback = createDefaultCalibrationState();
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(CALIBRATION_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<ProjectionCalibrationState>;
    if (!parsed || typeof parsed !== 'object' || !parsed.quads || !parsed.outputs) {
      return fallback;
    }

    const mergedOutputs = { ...fallback.outputs };
    for (const outId of PROJECTOR_OUT_IDS) {
      if (parsed.outputs[outId]) {
        mergedOutputs[outId] = {
          ...fallback.outputs[outId],
          ...parsed.outputs[outId],
          outId,
          delayMs: clampScreenDelayMs(parsed.outputs[outId].delayMs ?? 0),
          surfaces: Array.isArray(parsed.outputs[outId].surfaces)
            ? parsed.outputs[outId].surfaces
            : fallback.outputs[outId].surfaces,
        };
      }
    }

    const mergedMasks = { ...fallback.edgeMasks };
    if (parsed.edgeMasks && typeof parsed.edgeMasks === 'object') {
      for (const key of Object.keys(mergedMasks) as CalibrationSurfaceKey[]) {
        const candidate = parsed.edgeMasks[key];
        if (candidate && typeof candidate === 'object') {
          mergedMasks[key] = {
            leftPct: Math.max(0, Math.min(40, Number(candidate.leftPct) || 0)),
            rightPct: Math.max(0, Math.min(40, Number(candidate.rightPct) || 0)),
            topPct: Math.max(0, Math.min(40, Number(candidate.topPct) || 0)),
            bottomPct: Math.max(0, Math.min(40, Number(candidate.bottomPct) || 0)),
          };
        }
      }
    }

    return {
      preset: parsed.preset ?? '2-projectors',
      showGrid: Boolean(parsed.showGrid),
      globalBlackout: Boolean(parsed.globalBlackout),
      identifyUntil: Number(parsed.identifyUntil ?? 0),
      identifyNonce: Number(parsed.identifyNonce ?? 0),
      identifyDurationMs: Number(parsed.identifyDurationMs ?? 7000),
      outputs: mergedOutputs,
      quads: {
        ...fallback.quads,
        ...parsed.quads,
      },
      edgeMasks: mergedMasks,
    };
  } catch {
    return fallback;
  }
}

export function saveCalibrationState(state: ProjectionCalibrationState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CALIBRATION_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage quota errors
  }
}

/**
 * Resolve sistema linear Ax = b (eliminação gaussiana com pivoteamento parcial).
 */
function solveLinearSystem(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    let maxRow = col;
    let maxVal = Math.abs(M[col][col]);
    for (let row = col + 1; row < n; row++) {
      const absVal = Math.abs(M[row][col]);
      if (absVal > maxVal) {
        maxVal = absVal;
        maxRow = row;
      }
    }
    if (maxVal < 1e-11) return null;

    if (maxRow !== col) {
      const tmp = M[col];
      M[col] = M[maxRow];
      M[maxRow] = tmp;
    }

    const pivot = M[col][col];
    for (let j = col; j <= n; j++) {
      M[col][j] /= pivot;
    }

    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = M[row][col];
      if (Math.abs(factor) < 1e-14) continue;
      for (let j = col; j <= n; j++) {
        M[row][j] -= factor * M[col][j];
      }
    }
  }

  return M.map((row) => row[n]);
}

/**
 * Calcula a string CSS `matrix3d(...)` exata que mapeia um retângulo de origem `(width × height)`
 * (com `transform-origin: 0 0`) para os 4 pontos arbitrários `dstPixels` em pixels na tela.
 */
export function computeHomographyMatrix3d(
  srcWidth: number,
  srcHeight: number,
  dstPixels: [Point2D, Point2D, Point2D, Point2D]
): string {
  const w = Math.max(1, srcWidth);
  const h = Math.max(1, srcHeight);

  const src: [Point2D, Point2D, Point2D, Point2D] = [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: h },
    { x: 0, y: h },
  ];

  // Sistema 8x8 para homografia 2D H = [[h0, h1, h2], [h3, h4, h5], [h6, h7, 1]]
  const A: number[][] = [];
  const b: number[] = [];

  for (let i = 0; i < 4; i++) {
    const sx = src[i].x;
    const sy = src[i].y;
    const dx = dstPixels[i].x;
    const dy = dstPixels[i].y;

    A.push([sx, sy, 1, 0, 0, 0, -dx * sx, -dx * sy]);
    b.push(dx);

    A.push([0, 0, 0, sx, sy, 1, -dy * sx, -dy * sy]);
    b.push(dy);
  }

  const sol = solveLinearSystem(A, b);
  if (!sol) {
    return 'matrix3d(1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1)';
  }

  const [h0, h1, h2, h3, h4, h5, h6, h7] = sol;

  const vals = [h0, h3, 0, h6, h1, h4, 0, h7, 0, 0, 1, 0, h2, h5, 0, 1].map((v) =>
    Number(v.toFixed(12))
  );
  return `matrix3d(${vals.join(', ')})`;
}

/**
 * Preserva a proporção 1:1 (`srcWidth / srcHeight`) dentro de um slot retangular padrão
 * (evitando esmagar/esticar o Globo e o Robô em telas 16:9 ou slots 50%), mas libera
 * a homografia livre assim que o operador arrasta qualquer pino de Corner-Pin.
 */
export function fitQuadAspectContain(
  srcWidth: number,
  srcHeight: number,
  dstPixels: [Point2D, Point2D, Point2D, Point2D]
): [Point2D, Point2D, Point2D, Point2D] {
  const [tl, tr, br, bl] = dstPixels;
  const isAxisAlignedRect =
    Math.abs(tl.y - tr.y) < 1.5 &&
    Math.abs(bl.y - br.y) < 1.5 &&
    Math.abs(tl.x - bl.x) < 1.5 &&
    Math.abs(tr.x - br.x) < 1.5;

  if (!isAxisAlignedRect) {
    return dstPixels;
  }

  const boxW = Math.max(1, tr.x - tl.x);
  const boxH = Math.max(1, bl.y - tl.y);
  const srcAspect = Math.max(0.1, srcWidth / Math.max(1, srcHeight));
  const boxAspect = boxW / boxH;

  let fitW = boxW;
  let fitH = boxH;
  if (boxAspect > srcAspect) {
    fitW = boxH * srcAspect;
  } else {
    fitH = boxW / srcAspect;
  }

  const offsetX = tl.x + (boxW - fitW) / 2;
  const offsetY = tl.y + (boxH - fitH) / 2;

  return [
    { x: offsetX, y: offsetY },
    { x: offsetX + fitW, y: offsetY },
    { x: offsetX + fitW, y: offsetY + fitH },
    { x: offsetX, y: offsetY + fitH },
  ];
}
