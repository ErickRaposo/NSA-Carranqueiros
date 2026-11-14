import { describe, expect, it } from 'vitest';
import {
  clampVideoTime,
  computeIdealZoomDistance,
  formatVideoTime,
  stepVideoTime,
} from '../utils/playerMath';

describe('utils/playerMath', () => {
  it('formats seconds as MM:SS.d', () => {
    expect(formatVideoTime(0)).toBe('00:00.0');
    expect(formatVideoTime(31.4)).toBe('00:31.4');
    expect(formatVideoTime(100.03)).toBe('01:40.0');
    expect(formatVideoTime(-5)).toBe('00:00.0');
  });

  it('clamps video time within [0, duration]', () => {
    expect(clampVideoTime(-2, 31)).toBe(0);
    expect(clampVideoTime(45, 31)).toBe(31);
    expect(clampVideoTime(12.5, 31)).toBe(12.5);
  });

  it('steps forward and backward by 1/fps', () => {
    const next = stepVideoTime(10, 31, 1, 30);
    expect(next).toBeCloseTo(10 + 1 / 30, 5);
    const prev = stepVideoTime(0.01, 31, -1, 30);
    expect(prev).toBe(0);
  });

  it('computes tighter zoom for smaller countries than continental ones', () => {
    const portugal = computeIdealZoomDistance(3.3, 5.2);
    const brazil = computeIdealZoomDistance(39, 38);
    expect(portugal).toBeLessThan(brazil);
    expect(portugal).toBeGreaterThan(1.1);
    expect(brazil).toBeLessThan(2.2);
  });
});
