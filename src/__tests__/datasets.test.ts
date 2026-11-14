import { describe, expect, it } from 'vitest';
import { DATASET_ORDER, NASA_DATASETS } from '../datasets/nasaDatasets';

describe('datasets/nasaDatasets', () => {
  it('registers all 5 NASA SVS datasets with local equirectangular MP4s', () => {
    expect(DATASET_ORDER).toEqual(['svs5011', 'svs5147', 'svs5148', 'svs5153', 'svs5154']);
    for (const id of DATASET_ORDER) {
      const ds = NASA_DATASETS[id];
      expect(ds.videoUrl.startsWith('/nasa/')).toBe(true);
      expect(ds.videoUrl.endsWith('.mp4')).toBe(true);
      expect(ds.aspect).toContain('2:1');
      if (id !== 'svs5011') {
        expect(ds.colorbarUrl).toBeTruthy();
      }
    }
  });
});
