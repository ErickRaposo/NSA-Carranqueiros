export interface CalibrationCircleSpec {
  id: string;
  cx: number;
  cy: number;
  r: number;
  kind: 'center' | 'corner' | 'edge' | 'mid';
}

/**
 * Generates mathematically circular circles (1:1 in wall units) spread across
 * corners, edges, intermediate diagonals, and center of the calibration grid.
 * If the physical aspect ratio (widthCm × heightCm) or keystone is wrong,
 * the circles appear squashed/oval on the projected wall.
 */
export function buildCalibrationGridCircles(
  width: number,
  height: number
): CalibrationCircleSpec[] {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const minDim = Math.min(w, h);

  return [
    // Center (outer and inner reference rings)
    { id: 'center-outer', cx: w * 0.5, cy: h * 0.5, r: minDim * 0.22, kind: 'center' },
    { id: 'center-inner', cx: w * 0.5, cy: h * 0.5, r: minDim * 0.11, kind: 'center' },

    // 4 corners (close to the corners without clipping outside the edge at any aspect ratio)
    { id: 'corner-tl', cx: w * 0.17, cy: h * 0.2, r: minDim * 0.085, kind: 'corner' },
    { id: 'corner-tr', cx: w * 0.83, cy: h * 0.2, r: minDim * 0.085, kind: 'corner' },
    { id: 'corner-br', cx: w * 0.83, cy: h * 0.8, r: minDim * 0.085, kind: 'corner' },
    { id: 'corner-bl', cx: w * 0.17, cy: h * 0.8, r: minDim * 0.085, kind: 'corner' },

    // 4 edge midpoints
    { id: 'edge-top', cx: w * 0.5, cy: h * 0.14, r: minDim * 0.065, kind: 'edge' },
    { id: 'edge-bottom', cx: w * 0.5, cy: h * 0.86, r: minDim * 0.065, kind: 'edge' },
    { id: 'edge-left', cx: w * 0.14, cy: h * 0.5, r: minDim * 0.065, kind: 'edge' },
    { id: 'edge-right', cx: w * 0.86, cy: h * 0.5, r: minDim * 0.065, kind: 'edge' },

    // 4 intermediate diagonal points
    { id: 'mid-tl', cx: w * 0.31, cy: h * 0.34, r: minDim * 0.052, kind: 'mid' },
    { id: 'mid-tr', cx: w * 0.69, cy: h * 0.34, r: minDim * 0.052, kind: 'mid' },
    { id: 'mid-br', cx: w * 0.69, cy: h * 0.66, r: minDim * 0.052, kind: 'mid' },
    { id: 'mid-bl', cx: w * 0.31, cy: h * 0.66, r: minDim * 0.052, kind: 'mid' },
  ];
}
