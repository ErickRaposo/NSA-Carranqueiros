export interface Point2D {
  x: number;
  y: number;
}

/**
 * Quad de 4 vértices em coordenadas normalizadas [0..1] da área alvo:
 * Ordem horária: Top-Left, Top-Right, Bottom-Right, Bottom-Left.
 */
export type QuadCorners = [Point2D, Point2D, Point2D, Point2D];

export type CalibrationSurfaceKey =
  | 'out1-leftWall'
  | 'out1-rightWall'
  | 'out2-ceiling'
  | 'out3-rightWall';

export interface ProjectionCalibrationState {
  showGrid: boolean;
  quads: Record<CalibrationSurfaceKey, QuadCorners>;
}

export const CALIBRATION_STORAGE_KEY = 'earth-jukebox-calibration-v1';
export const CALIBRATION_CHANNEL_NAME = 'earth-jukebox-calibration-sync-v1';

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

export function createDefaultCalibrationState(): ProjectionCalibrationState {
  return {
    showGrid: false,
    quads: {
      // Projetor 1 (Canto em L): metade esquerda = Parede Esq, metade direita = Parede Dir
      'out1-leftWall': createIdentityQuad(0, 0, 0.5, 1),
      'out1-rightWall': createIdentityQuad(0.5, 0, 1, 1),
      // Projetor 2 (Teto): tela cheia
      'out2-ceiling': createIdentityQuad(0, 0, 1, 1),
      // Saída Auxiliar 3: tela cheia
      'out3-rightWall': createIdentityQuad(0, 0, 1, 1),
    },
  };
}

export function loadCalibrationState(): ProjectionCalibrationState {
  const fallback = createDefaultCalibrationState();
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(CALIBRATION_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<ProjectionCalibrationState>;
    if (!parsed || typeof parsed !== 'object' || !parsed.quads) return fallback;
    return {
      showGrid: Boolean(parsed.showGrid),
      quads: {
        ...fallback.quads,
        ...parsed.quads,
      },
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

  // CSS matrix3d é column-major 4x4 inserindo o eixo Z identidade na 3ª linha/coluna:
  // [ h0, h3, 0, h6,
  //   h1, h4, 0, h7,
  //    0,  0, 1,  0,
  //   h2, h5, 0,  1 ]
  const vals = [h0, h3, 0, h6, h1, h4, 0, h7, 0, 0, 1, 0, h2, h5, 0, 1].map((v) =>
    Number(v.toFixed(12))
  );
  return `matrix3d(${vals.join(', ')})`;
}
