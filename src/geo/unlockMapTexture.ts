import * as THREE from 'three';
import { CountryEntry } from './countries';
import { splitAntimeridianRing } from './countryMask';
import { lonLatToUV } from './projection';
import {
  CommunityUnlockState,
  STEM_ORDER,
  buildCountryRegionKey,
} from '../community/unlockStore';

/**
 * Generates an equirectangular RGBA illumination texture representing community unlock progress
 * across every country on Earth (dormant/locked regions stay dim while 1/5 -> 5/5 regions light up).
 */
export function createUnlockIlluminationTexture(
  countries: CountryEntry[],
  unlockState: CommunityUnlockState,
  width = 2048,
  height = 1024
): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.clearRect(0, 0, width, height);

  for (const country of countries) {
    const key = buildCountryRegionKey(country);
    const record = unlockState.regions[key];
    let unlockedCount = 0;
    if (unlockState.juryUnlockAll) {
      unlockedCount = 5;
    } else if (record) {
      for (const s of STEM_ORDER) {
        if (record.contributions[s]) unlockedCount += 1;
      }
    }

    if (unlockedCount === 0) continue;

    const progress = unlockedCount / 5;
    // Progressive illumination palette: cyan-blue energy -> warm gold at full 5/5 community completion
    const fillStyle =
      unlockedCount >= 5
        ? 'rgba(250, 204, 21, 0.30)'
        : `rgba(56, 189, 248, ${(0.12 + progress * 0.24).toFixed(2)})`;
    const strokeStyle =
      unlockedCount >= 5
        ? 'rgba(253, 224, 71, 0.96)'
        : `rgba(56, 189, 248, ${(0.45 + progress * 0.45).toFixed(2)})`;

    ctx.fillStyle = fillStyle;
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = unlockedCount >= 5 ? 2.4 : 1.4;

    for (const ring of country.rings) {
      const subRings = splitAntimeridianRing(ring);
      for (const sub of subRings) {
        ctx.beginPath();
        for (let i = 0; i < sub.length; i++) {
          const { u, v } = lonLatToUV(sub[i][0], sub[i][1]);
          const x = u * width;
          const y = (1 - v) * height;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
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
