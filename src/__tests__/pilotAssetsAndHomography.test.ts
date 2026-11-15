import { describe, expect, it } from 'vitest';
import { PILOT_COUNTRY_IDS, VISUAL_LAYER_ORDER } from '../experience/types';
import { computeHomographyMatrix3d, Point2D } from '../projection/homography';

interface MinimalNodeFs {
  existsSync(path: URL): boolean;
  readFileSync(path: URL): Uint8Array;
}

function readUint32BE(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] << 24) >>> 0) +
    (bytes[offset + 1] << 16) +
    (bytes[offset + 2] << 8) +
    bytes[offset + 3]
  );
}

function applyCssMatrix3dTo2DPoint(matrixCss: string, x: number, y: number): Point2D {
  const inside = matrixCss.replace(/^matrix3d\(|\)$/g, '');
  const m = inside.split(',').map((s) => Number(s.trim()));
  const xp = m[0] * x + m[4] * y + m[12];
  const yp = m[1] * x + m[5] * y + m[13];
  const wp = m[3] * x + m[7] * y + m[15];
  return { x: xp / wp, y: yp / wp };
}

describe('Passo 2 — Países Piloto (1024x1024 RGBA PNGs + meta.json) & Homografia Corner-Pin', () => {
  it('verifica que Brasil (076) e Egito (818) possuem os 5 PNGs 1024x1024 RGBA e meta.json', async () => {
    const fsModuleId = 'node:fs';
    const fs = (await import(/* @vite-ignore */ fsModuleId)) as unknown as MinimalNodeFs;
    const decoder = new TextDecoder('utf-8');

    for (const id of PILOT_COUNTRY_IDS) {
      const countryDirUrl = new URL(`../../public/countries/${id}/`, import.meta.url);
      expect(fs.existsSync(countryDirUrl)).toBe(true);

      for (const layer of VISUAL_LAYER_ORDER) {
        const pngUrl = new URL(`${layer}.png`, countryDirUrl);
        expect(fs.existsSync(pngUrl)).toBe(true);

        const bytes = fs.readFileSync(pngUrl);
        expect(bytes[0]).toBe(0x89);
        expect(String.fromCharCode(bytes[1], bytes[2], bytes[3])).toBe('PNG');
        const width = readUint32BE(bytes, 16);
        const height = readUint32BE(bytes, 20);
        const bitDepth = bytes[24];
        const colorType = bytes[25]; // 6 = Truecolor with alpha (RGBA)

        expect(width).toBe(1024);
        expect(height).toBe(1024);
        expect(bitDepth).toBe(8);
        expect(colorType).toBe(6);
      }

      const metaUrl = new URL('meta.json', countryDirUrl);
      expect(fs.existsSync(metaUrl)).toBe(true);
      const meta = JSON.parse(decoder.decode(fs.readFileSync(metaUrl))) as {
        id: string;
        pngSpec: { resolution: number; marginRatio: number };
        session: { region: { bpm: number }; base: { bpm: number } };
        beatEvents: Array<{ source_x: number; source_y: number }>;
      };

      expect(meta.id).toBe(id);
      expect(meta.pngSpec.resolution).toBe(1024);
      expect(meta.pngSpec.marginRatio).toBe(0.08);
      expect(meta.session.region.bpm).toBeGreaterThanOrEqual(66);
      expect(meta.session.region.bpm).toBeLessThanOrEqual(110);
      expect(meta.session.base.bpm).toBe(90);
      expect(Array.isArray(meta.beatEvents)).toBe(true);
      expect(meta.beatEvents.length).toBeGreaterThan(0);

      for (const ev of meta.beatEvents) {
        expect(ev.source_x).toBeGreaterThanOrEqual(0);
        expect(ev.source_x).toBeLessThanOrEqual(1);
        expect(ev.source_y).toBeGreaterThanOrEqual(0);
        expect(ev.source_y).toBeLessThanOrEqual(1);
      }
    }
  });

  it('mapeia os 4 cantos do retângulo de origem exatamente para qualquer quadrilátero projetivo (Corner-Pin)', () => {
    const srcW = 1280;
    const srcH = 960;
    const dst: [Point2D, Point2D, Point2D, Point2D] = [
      { x: 84, y: 62 },
      { x: 912, y: 118 },
      { x: 874, y: 890 },
      { x: 40, y: 815 },
    ];

    const css = computeHomographyMatrix3d(srcW, srcH, dst);
    expect(css.startsWith('matrix3d(')).toBe(true);

    const p0 = applyCssMatrix3dTo2DPoint(css, 0, 0);
    const p1 = applyCssMatrix3dTo2DPoint(css, srcW, 0);
    const p2 = applyCssMatrix3dTo2DPoint(css, srcW, srcH);
    const p3 = applyCssMatrix3dTo2DPoint(css, 0, srcH);

    expect(p0.x).toBeCloseTo(dst[0].x, 3);
    expect(p0.y).toBeCloseTo(dst[0].y, 3);
    expect(p1.x).toBeCloseTo(dst[1].x, 3);
    expect(p1.y).toBeCloseTo(dst[1].y, 3);
    expect(p2.x).toBeCloseTo(dst[2].x, 3);
    expect(p2.y).toBeCloseTo(dst[2].y, 3);
    expect(p3.x).toBeCloseTo(dst[3].x, 3);
    expect(p3.y).toBeCloseTo(dst[3].y, 3);
  });
});
