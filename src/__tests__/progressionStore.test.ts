import { describe, expect, it } from 'vitest';
import {
  createInitialProgressionState,
  getAchievementBadges,
  getExplorerRank,
  getMissionProgressList,
  getSonicPassportSummary,
  localProgressionAdapter,
  recordCollectiveContribution,
  recordRegionDiscovery,
} from '../game/progressionStore';
import { SoundscapeVisualTelemetry } from '../audio/soundscapeEngine';

function buildTelemetry(overrides: Partial<SoundscapeVisualTelemetry> = {}): SoundscapeVisualTelemetry {
  return {
    targetLabel: 'Brasil',
    bounds: {
      minLon: -74,
      maxLon: -34,
      minLat: -34,
      maxLat: 5,
      centerLon: -51,
      centerLat: -14,
    },
    timestampMs: 1000,
    keyName: 'F#',
    modeName: 'Lídio',
    chordName: 'F#m9',
    chordFreqsHz: [185, 220, 277.18],
    coSpots: [],
    melodyNoteName: 'A5',
    melodyFreqHz: 880,
    melodyPan: 0.1,
    lightningMarkers: [{ lon: -60, lat: -4, pan: 0, intensity: 0.8, noteName: 'A5', freqHz: 880, bornAtMs: 1000 }],
    bpm: 92,
    beatPhase01: 0.2,
    beatIndex: 4,
    tempIndex: 0.62,
    tempHotSpot: { lon: -55, lat: -12, weight: 0.8 },
    bassStyle: 'Pulsante',
    bassNoteName: 'F#2',
    bassFreqHz: 92.5,
    bassCutoffHz: 245,
    noxHotSpot: { lon: -46, lat: -23, weight: 0.7 },
    windWetPct: 48,
    windSpeedMsApprox: 15,
    windCorridors: [],
    stemActivity: {
      melody: 0.74,
      harmony: 0.58,
      rhythm: 0.65,
      bass: 0.51,
      fx: 0.6,
    },
    sourceMode: 'synthetic-fallback',
    ...overrides,
  };
}

describe('progressionStore (XP anti-spam, 5 NASA missions & badges)', () => {
  it('awards discovery XP once per unique region and blocks repeated-click XP farming', () => {
    const t = buildTelemetry();
    const s0 = createInitialProgressionState();

    const first = recordRegionDiscovery(s0, {
      regionKey: 'country:BRA',
      regionLabel: 'Brasil',
      telemetry: t,
    });
    expect(first.isNewRegion).toBe(true);
    expect(first.xpGained).toBeGreaterThan(0);

    // Repeating click on Brasil MUST yield 0 XP
    const repeat = recordRegionDiscovery(first.nextState, {
      regionKey: 'country:BRA',
      regionLabel: 'Brasil',
      telemetry: t,
    });
    expect(repeat.isNewRegion).toBe(false);
    expect(repeat.xpGained).toBe(0);
    expect(repeat.nextState.xp).toBe(first.nextState.xp);
  });

  it('completes NASA threshold missions after 3 distinct matching regions', () => {
    const t = buildTelemetry();
    let state = createInitialProgressionState();

    for (const [key, label] of [
      ['country:BRA', 'Brasil'],
      ['country:IDN', 'Indonésia'],
      ['country:COD', 'RD Congo'],
    ]) {
      const res = recordRegionDiscovery(state, { regionKey: key, regionLabel: label, telemetry: t });
      state = res.nextState;
    }

    const missions = getMissionProgressList(state);
    expect(missions.find((m) => m.id === 'cacador_de_raios')?.completed).toBe(true);
    expect(missions.find((m) => m.id === 'mestre_dos_ventos')?.completed).toBe(true);
    expect(missions.find((m) => m.id === 'pulso_termico')?.completed).toBe(true);
    expect(missions.find((m) => m.id === 'ecos_invisiveis')?.completed).toBe(true);
    expect(getExplorerRank(state.xp).title).not.toBe('Ouvinte Orbital');
  });

  it('tracks collective contributions without duplicate XP and unlocks badges', () => {
    let state = createInitialProgressionState();
    state = recordRegionDiscovery(state, {
      regionKey: 'country:BRA',
      regionLabel: 'Brasil',
      telemetry: buildTelemetry(),
    }).nextState;

    const contrib1 = recordCollectiveContribution(state, {
      regionKey: 'country:BRA',
      regionLabel: 'Brasil',
      stemId: 'melody',
      isRegionComplete5of5: true,
    });
    expect(contrib1.xpGained).toBe(90); // 40 collective + 50 symphony 5/5

    const contribRepeat = recordCollectiveContribution(contrib1.nextState, {
      regionKey: 'country:BRA',
      regionLabel: 'Brasil',
      stemId: 'melody',
      isRegionComplete5of5: true,
    });
    expect(contribRepeat.xpGained).toBe(0);

    const badges = getAchievementBadges(contrib1.nextState);
    expect(badges.find((b) => b.id === 'first_signal')?.unlocked).toBe(true);
    expect(badges.find((b) => b.id === 'collective_spark')?.unlocked).toBe(true);
    expect(badges.find((b) => b.id === 'symphony_witness')?.unlocked).toBe(true);
    expect(contrib1.nextState.contributionHistory).toHaveLength(1);
    expect(contrib1.nextState.contributionHistory[0].regionLabel).toBe('Brasil');
    expect(contribRepeat.nextState.contributionHistory).toHaveLength(1);
    expect(localProgressionAdapter.mode).toBe('local');
  });

  it('computes ExplorerRank numeric level (1..4) and normalized progress01 for PlayerHUD', () => {
    const r1 = getExplorerRank(0);
    expect(r1.level).toBe(1);
    expect(r1.progress01).toBe(0);
    expect(r1.nextXp).toBe(120);

    const r1Mid = getExplorerRank(60);
    expect(r1Mid.level).toBe(1);
    expect(r1Mid.progress01).toBeCloseTo(0.5, 2);

    const r2 = getExplorerRank(200);
    expect(r2.level).toBe(2);
    expect(r2.title).toBe('Cartógrafo Sonoro');
    expect(r2.progress01).toBeCloseTo(0.5, 2);

    const r4 = getExplorerRank(700);
    expect(r4.level).toBe(4);
    expect(r4.maxLevel).toBe(4);
    expect(r4.nextXp).toBeNull();
    expect(r4.progress01).toBe(1);
  });

  it('derives Sonic Passport regional titles, favorite frequency, and 5/5 golden trail reward', () => {
    let state = createInitialProgressionState();
    state = recordCollectiveContribution(state, {
      regionKey: 'country:076',
      regionLabel: 'Brasil',
      stemId: 'melody',
      isRegionComplete5of5: true,
    }).nextState;

    const geoMap = new Map([
      ['country:076', { namePt: 'Brasil', regionPt: 'América do Sul' }],
    ]);
    const passport = getSonicPassportSummary(state, geoMap);
    expect(passport.hasGoldenTrailReward).toBe(true);
    expect(passport.favoriteStem?.stemId).toBe('melody');
    expect(passport.regionalTitles).toContain('Orquestrador Áureo 5/5');
    expect(passport.regionalTitles).toContain('Maestro Sul-Americano');
    expect(passport.illuminatedRegions[0]).toEqual({
      regionKey: 'country:076',
      regionLabel: 'Brasil',
      isComplete5of5: true,
    });
  });
});
