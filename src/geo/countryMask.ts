import * as THREE from 'three';
import { lonLatToUV } from './projection';

/**
 * Splits a ring into contiguous sub-paths whenever consecutive vertices jump across the antimeridian.
 */
export function splitAntimeridianRing(ring: number[][]): number[][][] {
  if (ring.length === 0) return [];
  const parts: number[][][] = [];
  let current: number[][] = [ring[0]];

  for (let i = 1; i < ring.length; i++) {
    const prev = ring[i - 1];
    const curr = ring[i];
    if (Math.abs(curr[0] - prev[0]) > 180) {
      if (current.length >= 3) parts.push(current);
      current = [curr];
    } else {
      current.push(curr);
    }
  }
  if (current.length >= 3) parts.push(current);
  return parts;
}

/**
 * Rasterizes the selected country's polygons (respecting enclave holes via evenodd fill rule!)
 * into an equirectangular CanvasTexture (white = inside selected country, black = rest of world).
 */
export function createCountryMaskTexture(
  rings: number[][][],
  width = 1024,
  height = 512,
  polygons?: number[][][][]
): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.2;

  const polyList: number[][][][] =
    polygons && polygons.length > 0 ? polygons : rings.map((r) => [r]);

  for (const poly of polyList) {
    ctx.beginPath();
    for (const ring of poly) {
      const subRings = splitAntimeridianRing(ring);
      for (const sub of subRings) {
        for (let i = 0; i < sub.length; i++) {
          const { u, v } = lonLatToUV(sub[i][0], sub[i][1]);
          const x = u * width;
          const y = (1 - v) * height;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
      }
    }
    ctx.fill('evenodd');
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}
