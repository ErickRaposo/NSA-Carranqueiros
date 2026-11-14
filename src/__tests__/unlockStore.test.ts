import { describe, expect, it } from 'vitest';
import {
  buildCountryRegionKey,
  contributeRegionStem,
  createSeededUnlockState,
  getRegionUnlockSummary,
} from '../community/unlockStore';
import { loadWorldCountries } from '../geo/countries';

describe('Collective Unlock Store & Illumination Progress', () => {
  const { countries } = loadWorldCountries();
  const brazil = countries.find((c) => c.nameEn === 'Brazil')!;
  const france = countries.find((c) => c.nameEn === 'France')!;

  it('seeds Brazil with 1/5 partial community unlock and France with 5/5 full illumination', () => {
    const state = createSeededUnlockState(countries);
    const brSummary = getRegionUnlockSummary(state, buildCountryRegionKey(brazil), 'visitante');
    const frSummary = getRegionUnlockSummary(state, buildCountryRegionKey(france), 'visitante');

    expect(brSummary.unlockedCount).toBe(1);
    expect(brSummary.unlockedStems.melody).toBe(true);
    expect(brSummary.unlockedStems.harmony).toBe(false);
    expect(brSummary.progress01).toBeCloseTo(0.2, 4);

    expect(frSummary.unlockedCount).toBe(5);
    expect(frSummary.progress01).toBe(1);
  });

  it('allows a user to unlock 1 stem in a region and enforces collective rule for additional stems', () => {
    const state = createSeededUnlockState(countries);
    const key = buildCountryRegionKey(brazil);

    const first = contributeRegionStem(state, {
      regionKey: key,
      regionLabel: brazil.namePt,
      stemId: 'harmony',
      contributorId: 'ana-user',
      contributorName: 'Ana',
    });
    expect(first.ok).toBe(true);

    const secondSameUser = contributeRegionStem(first.nextState, {
      regionKey: key,
      regionLabel: brazil.namePt,
      stemId: 'bass',
      contributorId: 'ana-user',
      contributorName: 'Ana',
    });
    expect(secondSameUser.ok).toBe(false);

    const anotherUser = contributeRegionStem(first.nextState, {
      regionKey: key,
      regionLabel: brazil.namePt,
      stemId: 'bass',
      contributorId: 'carlos-user',
      contributorName: 'Carlos',
    });
    expect(anotherUser.ok).toBe(true);

    const summary = getRegionUnlockSummary(anotherUser.nextState, key, 'carlos-user');
    expect(summary.unlockedCount).toBe(3);
    expect(summary.userAlreadyContributedStem).toBe('bass');
  });

  it('exposes all 5 stems immediately when juryUnlockAll is enabled', () => {
    const state = {
      ...createSeededUnlockState(countries),
      juryUnlockAll: true,
    };
    const brSummary = getRegionUnlockSummary(state, buildCountryRegionKey(brazil), 'juri');
    expect(brSummary.unlockedCount).toBe(5);
    expect(Object.values(brSummary.unlockedStems).every(Boolean)).toBe(true);
  });
});
