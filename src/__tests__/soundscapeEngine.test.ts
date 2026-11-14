import { describe, expect, it } from 'vitest';
import {
  buildExplainMusicPt,
  computeAudioBandsFromBins,
  deriveMusicalParameters,
  getTargetBounds,
  sampleSoundscapeStats,
} from '../audio/soundscapeEngine';
import { loadWorldCountries } from '../geo/countries';
import { buildCountryRegionKey, createSeededUnlockState, getRegionUnlockSummary } from '../community/unlockStore';

describe('NASA Soundscape 1:1 Engine', () => {
  const { countries } = loadWorldCountries();
  const brazil = countries.find((c) => c.nameEn === 'Brazil')!;

  it('computes accurate bounding boxes for both country and custom radius targets', () => {
    const countryBounds = getTargetBounds({ type: 'country', country: brazil, label: brazil.namePt });
    expect(countryBounds.centerLon).toBeCloseTo(brazil.lon, 2);
    expect(countryBounds.maxLat).toBeGreaterThan(countryBounds.minLat);

    const radBounds = getTargetBounds({
      type: 'radius',
      centerLon: -46.6,
      centerLat: -23.5,
      radiusKm: 600,
      label: 'Raio 600 km',
    });
    expect(radBounds.maxLat - radBounds.minLat).toBeGreaterThan(8);
    expect(radBounds.centerLon).toBeCloseTo(-46.6, 2);
  });

  it('derives deterministic explainable musical telemetry within 68-108 BPM and valid Bass Hz/Wind Wet%', () => {
    const target = { type: 'country' as const, country: brazil, label: brazil.namePt };
    const bounds = getTargetBounds(target);
    const stats = sampleSoundscapeStats({}, bounds, 4);
    const tel1 = deriveMusicalParameters(target, bounds, stats, 4, 2);
    const tel2 = deriveMusicalParameters(target, bounds, stats, 4, 2);

    expect(tel1.bpm).toBeGreaterThanOrEqual(68);
    expect(tel1.bpm).toBeLessThanOrEqual(108);
    expect(tel1.bassCutoffHz).toBeGreaterThanOrEqual(95);
    expect(tel1.bassCutoffHz).toBeLessThanOrEqual(340);
    expect(tel1.windWetPct).toBeGreaterThanOrEqual(18);
    expect(tel1.windWetPct).toBeLessThanOrEqual(82);
    expect(tel1.chordName).toBe(tel2.chordName);
    expect(tel1.melodyNoteName).toBe(tel2.melodyNoteName);
  });

  it('builds a clear PT-BR audio explanation mentioning unlocked count and 1:1 map drivers', () => {
    const target = { type: 'country' as const, country: brazil, label: brazil.namePt };
    const bounds = getTargetBounds(target);
    const stats = sampleSoundscapeStats({}, bounds, 0);
    const tel = deriveMusicalParameters(target, bounds, stats, 0, 0);
    const state = createSeededUnlockState(countries);
    const summary = getRegionUnlockSummary(state, buildCountryRegionKey(brazil), 'juri');

    const explanation = buildExplainMusicPt(tel, summary, summary.unlockedStems);
    expect(explanation).toContain('Brasil');
    expect(explanation).toContain('1 de 5');
    expect(explanation).toContain('Melodia');
    expect(explanation).toContain('Harmonia');
    expect(explanation).toContain('Ritmo');
    expect(explanation).toContain('Baixo');
    expect(explanation).toContain('Efeitos');
  });

  it('computes normalized audio-reactive RMS and frequency bands from FFT bins', () => {
    const silent = computeAudioBandsFromBins(new Uint8Array(64));
    expect(silent.rms).toBe(0);
    expect(silent.bars).toEqual([0, 0, 0, 0, 0]);

    const energetic = new Uint8Array(64);
    energetic.fill(200, 0, 4); // sub-bass
    energetic.fill(140, 4, 14); // low-mid
    energetic.fill(90, 14, 36); // high

    const bands = computeAudioBandsFromBins(energetic);
    expect(bands.subBass).toBeCloseTo(200 / 255, 2);
    expect(bands.lowMid).toBeCloseTo(140 / 255, 2);
    expect(bands.highFreq).toBeCloseTo(90 / 255, 2);
    expect(bands.rms).toBeGreaterThan(0.5);
    expect(bands.bars).toHaveLength(5);
  });
});
