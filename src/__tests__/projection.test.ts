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
import {
  applyProjectionPreset,
  fitQuadAspectContain,
  getUniquePinHandlesForOutput,
  makeSurfaceQuadKey,
  QuadCorners,
  translateOutputSurfacesTogether,
  updateQuadWithSharedSeams,
} from '../projection/homography';

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

  it('abre 1-projector em Canto 3D Isométrico com Teto em losango e todas as quinas compartilhadas soldadas', () => {
    const oneProj = applyProjectionPreset('1-projector');
    const qCeil = oneProj.quads[makeSurfaceQuadKey(1, 'ceiling')];
    const qLeft = oneProj.quads[makeSurfaceQuadKey(1, 'leftWall')];
    const qRight = oneProj.quads[makeSurfaceQuadKey(1, 'rightWall')];

    // Central Triple Joint: leftWall.TR [1] === rightWall.TL [0] === ceiling.BL [3]
    expect(qLeft[1]).toEqual(qRight[0]);
    expect(qLeft[1]).toEqual(qCeil[3]);
    // Central Base: leftWall.BR [2] === rightWall.BL [3]
    expect(qLeft[2]).toEqual(qRight[3]);
    // Top-Left Corner: ceiling.TL [0] === leftWall.TL [0]
    expect(qCeil[0]).toEqual(qLeft[0]);
    // Top-Right Corner: ceiling.BR [2] === rightWall.TR [1]
    expect(qCeil[2]).toEqual(qRight[1]);
    // Top of the ceiling diamond above center
    expect(qCeil[1].y).toBeLessThan(qCeil[0].y);

    // 12 raw vertices deduplicated into 7 unique handles (1 3-way joint + 3 2-way joints + 3 outer corners)
    const handles3 = getUniquePinHandlesForOutput(
      1,
      oneProj.outputs[1].surfaces,
      oneProj.quads
    );
    expect(handles3).toHaveLength(7);
    expect(handles3.filter((h) => h.memberCount === 3)).toHaveLength(1);
    expect(handles3.filter((h) => h.memberCount === 2)).toHaveLength(3);

    // Dragging the central joint propagates to all 3 walls together
    const movedLeft: QuadCorners = [
      qLeft[0],
      { x: 0.46, y: 0.42 },
      qLeft[2],
      qLeft[3],
    ];
    const welded3 = updateQuadWithSharedSeams(
      oneProj,
      makeSurfaceQuadKey(1, 'leftWall'),
      movedLeft
    );
    expect(welded3[makeSurfaceQuadKey(1, 'rightWall')][0]).toEqual({ x: 0.46, y: 0.42 });
    expect(welded3[makeSurfaceQuadKey(1, 'ceiling')][3]).toEqual({ x: 0.46, y: 0.42 });
  });

  it('solda os pins centrais em 2-projectors e translada a malha em bloco sem abrir fresta', () => {
    const twoProj = applyProjectionPreset('2-projectors');
    const handles2 = getUniquePinHandlesForOutput(
      1,
      twoProj.outputs[1].surfaces,
      twoProj.quads
    );
    expect(handles2).toHaveLength(6);

    const qLeft = twoProj.quads[makeSurfaceQuadKey(1, 'leftWall')];
    const nextLeft: QuadCorners = [
      qLeft[0],
      { x: 0.54, y: 0.08 },
      { x: 0.52, y: 0.96 },
      qLeft[3],
    ];
    const welded2 = updateQuadWithSharedSeams(
      twoProj,
      makeSurfaceQuadKey(1, 'leftWall'),
      nextLeft
    );
    expect(welded2[makeSurfaceQuadKey(1, 'rightWall')][0]).toEqual({ x: 0.54, y: 0.08 });
    expect(welded2[makeSurfaceQuadKey(1, 'rightWall')][3]).toEqual({ x: 0.52, y: 0.96 });

    const translated = translateOutputSurfacesTogether(
      1,
      twoProj.outputs[1].surfaces,
      welded2,
      0.2,
      -0.05
    );
    expect(translated[makeSurfaceQuadKey(1, 'leftWall')][1]).toEqual(
      translated[makeSurfaceQuadKey(1, 'rightWall')][0]
    );
  });
});
