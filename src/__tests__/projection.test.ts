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
import { fitQuadAspectContain } from '../projection/homography';

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

  it('skips antimeridian jumps and subdivides valid straight arcs on the 3D sphere', () => {
    const ring = [
      [179, 10],
      [-179, 10], // 358 deg jump -> skipped!
      [-170, 12], // ~9.22 deg arc -> subdivided into <= 1.0 deg steps (10 segments = 20 or 9 segments = 18 vertices)
    ];
    const geoCoarse = buildMorphLinesFromRings([ring], GLOBE_RADIUS * 1.003, FLAT_WIDTH, FLAT_HEIGHT, 0.004, 20);
    expect(geoCoarse.getAttribute('position').count).toBe(2);

    const geoSubdivided = buildMorphLinesFromRings([ring]);
    expect(geoSubdivided.getAttribute('position').count).toBeGreaterThanOrEqual(18);
  });

  it('formats lat/lon cleanly with hemisphere letters', () => {
    expect(formatLatLon(-14.234, -51.921)).toBe('14.23° S, 51.92° W');
    expect(formatLatLon(35.68, 139.76)).toBe('35.68° N, 139.76° E');
  });

  it('fits axis-aligned projector slots without aspect distortion and preserves manual corner-pin', () => {
    // 1200x960 wall (1.25 aspect) inside half-screen 16:9 slot (960x1080)
    const fitted = fitQuadAspectContain(1200, 960, [
      { x: 0, y: 0 },
      { x: 960, y: 0 },
      { x: 960, y: 1080 },
      { x: 0, y: 1080 },
    ]);
    expect(fitted[0]).toEqual({ x: 0, y: 156 });
    expect(fitted[1]).toEqual({ x: 960, y: 156 });
    expect(fitted[2]).toEqual({ x: 960, y: 924 });
    expect(fitted[3]).toEqual({ x: 0, y: 924 });

    // Manually dragged corner-pin quad (tr.y !== tl.y) must pass through untouched
    const dragged: [
      { x: number; y: number },
      { x: number; y: number },
      { x: number; y: number },
      { x: number; y: number },
    ] = [
      { x: 10, y: 0 },
      { x: 950, y: 40 },
      { x: 960, y: 1080 },
      { x: 0, y: 1060 },
    ];
    expect(fitQuadAspectContain(1200, 960, dragged)).toEqual(dragged);
  });
});
