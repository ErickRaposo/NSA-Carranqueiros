import { RoomDimensions } from './types';

export const ROOM_DIMENSION_MIN_CM = 50;
export const ROOM_DIMENSION_MAX_CM = 2000;

export const DEFAULT_ROOM_DIMENSIONS: RoomDimensions = {
  leftWall: { widthCm: 360, heightCm: 270 },
  rightWall: { widthCm: 360, heightCm: 270 },
  ceiling: { widthCm: 360, heightCm: 360 },
};

export function clampRoomDimensionCm(value: unknown, fallback = 360): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return Math.round(
    Math.max(ROOM_DIMENSION_MIN_CM, Math.min(ROOM_DIMENSION_MAX_CM, numeric))
  );
}

/**
 * Normaliza as dimensões do quarto em canto (2 paredes + teto).
 * O teto é sempre derivado geometricamente pela largura das duas paredes:
 * - ceiling.widthCm  = rightWall.widthCm (borda superior da Parede Direita no eixo X)
 * - ceiling.heightCm = leftWall.widthCm  (borda superior da Parede Esquerda no eixo Z)
 */
export function normalizeRoomDimensions(
  dims?: Partial<RoomDimensions> | null
): RoomDimensions {
  const leftWidth = clampRoomDimensionCm(
    dims?.leftWall?.widthCm,
    DEFAULT_ROOM_DIMENSIONS.leftWall.widthCm
  );
  const leftHeight = clampRoomDimensionCm(
    dims?.leftWall?.heightCm,
    DEFAULT_ROOM_DIMENSIONS.leftWall.heightCm
  );
  const rightWidth = clampRoomDimensionCm(
    dims?.rightWall?.widthCm,
    DEFAULT_ROOM_DIMENSIONS.rightWall.widthCm
  );
  const rightHeight = clampRoomDimensionCm(
    dims?.rightWall?.heightCm,
    DEFAULT_ROOM_DIMENSIONS.rightWall.heightCm
  );

  return {
    leftWall: { widthCm: leftWidth, heightCm: leftHeight },
    rightWall: { widthCm: rightWidth, heightCm: rightHeight },
    ceiling: { widthCm: rightWidth, heightCm: leftWidth },
  };
}

export function updateWallDimension(
  current: RoomDimensions,
  wall: 'leftWall' | 'rightWall',
  field: 'widthCm' | 'heightCm',
  rawValue: number | string
): RoomDimensions {
  const parsed = clampRoomDimensionCm(rawValue, current[wall][field]);
  return normalizeRoomDimensions({
    ...current,
    [wall]: {
      ...current[wall],
      [field]: parsed,
    },
  });
}

export function formatMetersPair(widthCm: number, heightCm: number): string {
  return `${(widthCm / 100).toFixed(2)} × ${(heightCm / 100).toFixed(2)} m`;
}
