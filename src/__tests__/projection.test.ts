import { describe, expect, it } from 'vitest';
import {
  FLAT_HEIGHT,
  FLAT_WIDTH,
  GLOBE_RADIUS,
  buildMorphEarthGeometry,
  buildMorphLinesFromRings,
  flatPointToLonLat,
  formatLatLon,
  lonLatToFlat,
  lonLatToSphere,
  lonLatToUV,
  spherePointToLonLat,
} from '../geo/projection';

describe('geo/projection', () => {
  it('maps prime meridian equator (0, 0) to +Z on sphere and center of flat map', () => {
    const s = lonLatToSphere(0, 0, GLOBE_RADIUS);
    expect(s.x).toBeCloseTo(0, 6);
    expect(s.y).toBeCloseTo(0, 6);
    expect(s.z).toBeCloseTo(GLOBE_RADIUS, 6);

    const f = lonLatToFlat(0, 0);
    expect(f.x).toBeCloseTo(0, 6);
    expect(f.y).toBeCloseTo(0, 6);

    const uv = lonLatToUV(0, 0);
    expect(uv.u).toBeCloseTo(0.5, 6);
    expect(uv.v).toBeCloseTo(0.5, 6);
  });

  it('round-trips sphere and flat points back to lon/lat accurately', () => {
    const samples = [
      { lon: -51.9, lat: -14.2 }, // Brazil
      { lon: 139.7, lat: 35.6 }, // Japan
      { lon: -98.5, lat: 39.5 }, // USA
      { lon: 0, lat: 51.5 }, // UK
    ];
    for (const sample of samples) {
      const s = lonLatToSphere(sample.lon, sample.lat, GLOBE_RADIUS);
      const backS = spherePointToLonLat(s);
      expect(backS.lon).toBeCloseTo(sample.lon, 4);
      expect(backS.lat).toBeCloseTo(sample.lat, 4);

      const f = lonLatToFlat(sample.lon, sample.lat, FLAT_WIDTH, FLAT_HEIGHT);
      const backF = flatPointToLonLat(f, FLAT_WIDTH, FLAT_HEIGHT);
      expect(backF.lon).toBeCloseTo(sample.lon, 4);
      expect(backF.lat).toBeCloseTo(sample.lat, 4);
    }
  });

  it('builds valid morph earth geometry with matching attributes', () => {
    const geo = buildMorphEarthGeometry(36, 18);
    const pos = geo.getAttribute('position');
    const flatPos = geo.getAttribute('aFlatPosition');
    const uv = geo.getAttribute('uv');
    expect(pos.count).toBe(37 * 19);
    expect(flatPos.count).toBe(pos.count);
    expect(uv.count).toBe(pos.count);
    expect(geo.index?.count).toBe(36 * 18 * 6);
  });

  it('skips antimeridian jumps when building border line segments', () => {
    const ring = [
      [179, 10],
      [-179, 10], // 358 deg jump -> should be skipped!
      [-170, 12], // 9 deg jump -> should produce 1 segment (2 vertices)
    ];
    const geo = buildMorphLinesFromRings([ring]);
    expect(geo.getAttribute('position').count).toBe(2);
  });

  it('formats lat/lon cleanly with hemisphere letters', () => {
    expect(formatLatLon(-14.234, -51.921)).toBe('14.23° S, 51.92° W');
    expect(formatLatLon(35.68, 139.76)).toBe('35.68° N, 139.76° E');
  });
});
