export function formatVideoTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00.0';
  const totalTenths = Math.floor(seconds * 10 + 1e-6);
  const tenths = totalTenths % 10;
  const totalSeconds = Math.floor(totalTenths / 10);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${tenths}`;
}

export function clampVideoTime(target: number, duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  return Math.max(0, Math.min(target, duration));
}

export function stepVideoTime(
  currentTime: number,
  duration: number,
  direction: 1 | -1,
  fps = 30
): number {
  const delta = (1 / fps) * direction;
  return clampVideoTime(currentTime + delta, duration);
}

/**
 * Estimates a friendly camera distance (in globe-radius units, where surface = 1.0)
 * given a country's angular bounding box span in degrees.
 */
export function computeIdealZoomDistance(lonSpanDeg: number, latSpanDeg: number): number {
  const span = Math.max(lonSpanDeg, latSpanDeg, 2);
  // Small countries (~2-6 deg) -> zoom close (~1.16..1.25); continental countries (~40+ deg) -> ~1.7..2.1
  const normalized = Math.min(1, Math.max(0, span / 80));
  return Number((1.15 + Math.pow(normalized, 0.65) * 1.15).toFixed(3));
}
