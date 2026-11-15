import { describe, expect, it } from 'vitest';
import { parseRouteFromSearch } from '../App';
import { DEFAULT_LAYERS_STATE } from '../experience/ExperienceContext';
import { PILOT_COUNTRY_IDS, VISUAL_LAYER_ORDER } from '../experience/types';
import { buildGlobeLayerStack } from '../hooks/useNasaVideoPool';

describe('Earth Jukebox ?view= routing & 5-layer Photoshop mixer contract', () => {
  it('defaults root "/" without query params directly to portal', () => {
    expect(parseRouteFromSearch('')).toEqual({ view: 'portal', outId: 1 });
    expect(parseRouteFromSearch('?view=unknown')).toEqual({ view: 'portal', outId: 1 });
    expect(parseRouteFromSearch('?view=demo')).toEqual({ view: 'demo', outId: 1 });
  });

  it('parses all 5 official views and projector outputs 1..3', () => {
    expect(parseRouteFromSearch('?view=setup').view).toBe('setup');
    expect(parseRouteFromSearch('?view=simulator').view).toBe('simulator');
    expect(parseRouteFromSearch('?view=controller').view).toBe('controller');
    expect(parseRouteFromSearch('?view=projector&out=2')).toEqual({
      view: 'projector',
      outId: 2,
    });
    expect(parseRouteFromSearch('?view=projector&out=3')).toEqual({
      view: 'projector',
      outId: 3,
    });
  });

  it('locks the pilot countries (076 Brazil, 818 Egypt) and 5 layers 1:1', () => {
    expect(PILOT_COUNTRY_IDS).toEqual(['076', '818']);
    expect(VISUAL_LAYER_ORDER).toEqual(['melody', 'chords', 'bass', 'wind', 'temperature']);
  });

  it('starts with all 5 NASA layers disabled by default', () => {
    for (const id of VISUAL_LAYER_ORDER) {
      expect(DEFAULT_LAYERS_STATE[id].enabled).toBe(false);
    }
  });

  it('isolates a soloed generator layer on the Globe stack while muting non-soloed layers', () => {
    const soloedBass = {
      ...DEFAULT_LAYERS_STATE,
      melody: { ...DEFAULT_LAYERS_STATE.melody, enabled: true },
      bass: { ...DEFAULT_LAYERS_STATE.bass, enabled: true, solo: true },
    };
    const stack = buildGlobeLayerStack(soloedBass);
    const activeIds = stack.filter((l) => l.enabled).map((l) => l.id);
    expect(activeIds).toEqual(['svs5154']);
  });
});
