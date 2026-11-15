import { describe, expect, it } from 'vitest';
import { DATASET_ORDER, DEFAULT_LAYER_STACK, NASA_DATASETS } from '../datasets/nasaDatasets';

describe('datasets/nasaDatasets', () => {
  it('registers all 5 NASA SVS datasets with local equirectangular MP4s and scale literacy metadata', () => {
    expect(DATASET_ORDER).toEqual(['svs5011', 'svs5147', 'svs5148', 'svs5153', 'svs5154']);
    for (const id of DATASET_ORDER) {
      const ds = NASA_DATASETS[id];
      expect(ds.videoUrl.startsWith('/nasa/')).toBe(true);
      expect(ds.videoUrl.endsWith('.mp4')).toBe(true);
      expect(ds.aspect).toContain('2:1');
      expect(ds.colorbarCaption.length).toBeGreaterThan(5);
      expect(ds.scaleMinLabel.length).toBeGreaterThan(0);
      expect(ds.scaleMaxLabel.length).toBeGreaterThan(0);
      expect(ds.unitLabel.length).toBeGreaterThan(0);
      expect(ds.howToReadPt.length).toBeGreaterThan(10);
      if (id !== 'svs5011') {
        expect(ds.colorbarUrl).toBeTruthy();
      }
    }
  });

  it('starts with 1 pure NASA layer enabled at 100% normal opacity so single-layer visuals stay faithful', () => {
    const enabled = DEFAULT_LAYER_STACK.filter((l) => l.enabled);
    expect(enabled).toHaveLength(1);
    expect(enabled[0].id).toBe('svs5011');
    expect(enabled[0].opacity).toBe(1.0);
    expect(enabled[0].blendMode).toBe('normal');
  });
});
