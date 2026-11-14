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
 * Rasterizes the selected country's rings into an equirectangular CanvasTexture
 * (white = inside selected country, black = rest of world).
 */
export function createCountryMaskTexture(
  rings: number[][][],
  width = 1024,
  height = 512
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
  ctx.lineWidth = 1.5;

  for (const ring of rings) {
    const subRings = splitAntimeridianRing(ring);
    for (const sub of subRings) {
      ctx.beginPath();
      for (let i = 0; i < sub.length; i++) {
        const { u, v } = lonLatToUV(sub[i][0], sub[i][1]);
        const x = u * width;
        // Canvas Y=0 is top (North Pole, v=1), Y=height is bottom (South Pole, v=0)
        const y = (1 - v) * height;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
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
