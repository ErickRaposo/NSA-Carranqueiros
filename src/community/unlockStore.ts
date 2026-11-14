import { DatasetId } from '../datasets/nasaDatasets';
import { CountryEntry } from '../geo/countries';

export type StemId = 'melody' | 'harmony' | 'rhythm' | 'bass' | 'fx';

export interface StemMeta {
  id: StemId;
  datasetId: DatasetId;
  keyShortcut: string;
  labelPt: string;
  instrumentPt: string;
  layerNamePt: string;
  visualRulePt: string;
  accentHex: string;
  category: 'lightning' | 'co' | 'temperature' | 'nox' | 'wind';
}

export const STEM_ORDER: StemId[] = ['melody', 'harmony', 'rhythm', 'bass', 'fx'];

export const STEM_METAS: Record<StemId, StemMeta> = {
  melody: {
    id: 'melody',
    datasetId: 'svs5011',
    keyShortcut: '1',
    labelPt: 'Melodia',
    instrumentPt: 'Sinos & Piano Pentatônico',
    layerNamePt: 'Raios ISS (SVS 5011)',
    visualRulePt: 'Miras douradas no clarão: Y define altura da nota e X controla o pan L/R.',
    accentHex: '#fbbf24',
    category: 'lightning',
  },
  harmony: {
    id: 'harmony',
    datasetId: 'svs5153',
    keyShortcut: '2',
    labelPt: 'Harmonia',
    instrumentPt: 'Pad Atmosférico (7ª/9ª)',
    layerNamePt: 'Monóxido CO (SVS 5153)',
    visualRulePt: 'Isolinhas âmbar na pluma de CO definem modo e acordes sustentados.',
    accentHex: '#fb923c',
    category: 'co',
  },
  rhythm: {
    id: 'rhythm',
    datasetId: 'svs5147',
    keyShortcut: '3',
    labelPt: 'Ritmo',
    instrumentPt: 'Percussão Orgânica (BPM)',
    layerNamePt: 'Temperatura (SVS 5147)',
    visualRulePt: 'Anéis térmicos solares expandem no núcleo quente a cada batida.',
    accentHex: '#fb7185',
    category: 'temperature',
  },
  bass: {
    id: 'bass',
    datasetId: 'svs5154',
    keyShortcut: '4',
    labelPt: 'Baixo',
    instrumentPt: 'Sub-Bass & Filtro (Hz)',
    layerNamePt: 'Óxidos NO₂ (SVS 5154)',
    visualRulePt: 'Contorno esmeralda no polo denso de NO₂ pulsa o grave e abre o filtro.',
    accentHex: '#34d399',
    category: 'nox',
  },
  fx: {
    id: 'fx',
    datasetId: 'svs5148',
    keyShortcut: '5',
    labelPt: 'Efeitos',
    instrumentPt: 'Chorus, Delay & Sopro',
    layerNamePt: 'Vento 10m (SVS 5148)',
    visualRulePt: 'Isolinhas azul-celeste nos corredores rápidos modulam o retorno espacial Wet.',
    accentHex: '#38bdf8',
    category: 'wind',
  },
};

export interface StemContribution {
  stemId: StemId;
  contributorId: string;
  contributorName: string;
  unlockedAt: string;
}

export interface RegionUnlockRecord {
  regionKey: string;
  regionLabel: string;
  contributions: Partial<Record<StemId, StemContribution>>;
}

export interface CommunityUnlockState {
  regions: Record<string, RegionUnlockRecord>;
  /** Simulated or demo community toggle allowing jury to test locked vs full experience immediately */
  juryUnlockAll: boolean;
}

export interface UnlockSyncAdapter {
  load(countries: CountryEntry[]): CommunityUnlockState;
  save(state: CommunityUnlockState): void;
}

const STORAGE_KEY = 'mineiro_collective_unlocks_v1';

export function buildCountryRegionKey(country: CountryEntry): string {
  return `country:${country.id}`;
}

export function buildRadiusRegionKey(lon: number, lat: number): string {
  return `radius:${Math.round(lon)}_${Math.round(lat)}`;
}

export function createSeededUnlockState(countries: CountryEntry[]): CommunityUnlockState {
  const regions: Record<string, RegionUnlockRecord> = {};

  const byNameEn = (nameEn: string): CountryEntry | undefined =>
    countries.find((c) => c.nameEn.toLowerCase() === nameEn.toLowerCase());

  const brazil = byNameEn('Brazil');
  if (brazil) {
    // Starts at 1/5 unlocked so users & jury immediately see & hear partial collective progress
    regions[buildCountryRegionKey(brazil)] = {
      regionKey: buildCountryRegionKey(brazil),
      regionLabel: brazil.namePt,
      contributions: {
        melody: {
          stemId: 'melody',
          contributorId: 'seed-ana',
          contributorName: 'Ana (Pesquisadora)',
          unlockedAt: '2026-10-03T12:00:00.000Z',
        },
      },
    };
  }

  const usa = byNameEn('United States of America');
  if (usa) {
    regions[buildCountryRegionKey(usa)] = {
      regionKey: buildCountryRegionKey(usa),
      regionLabel: usa.namePt,
      contributions: {
        melody: {
          stemId: 'melody',
          contributorId: 'seed-leo',
          contributorName: 'Leo (Space Apps)',
          unlockedAt: '2026-10-03T12:05:00.000Z',
        },
        rhythm: {
          stemId: 'rhythm',
          contributorId: 'seed-maya',
          contributorName: 'Maya (Clima)',
          unlockedAt: '2026-10-03T12:10:00.000Z',
        },
      },
    };
  }

  const japan = byNameEn('Japan');
  if (japan) {
    regions[buildCountryRegionKey(japan)] = {
      regionKey: buildCountryRegionKey(japan),
      regionLabel: japan.namePt,
      contributions: {
        bass: {
          stemId: 'bass',
          contributorId: 'seed-kenji',
          contributorName: 'Kenji (Áudio)',
          unlockedAt: '2026-10-03T12:15:00.000Z',
        },
        fx: {
          stemId: 'fx',
          contributorId: 'seed-lara',
          contributorName: 'Lara (Dados)',
          unlockedAt: '2026-10-03T12:20:00.000Z',
        },
      },
    };
  }

  const france = byNameEn('France');
  if (france) {
    // Full 5/5 illuminated reference region unlocked by the community
    regions[buildCountryRegionKey(france)] = {
      regionKey: buildCountryRegionKey(france),
      regionLabel: france.namePt,
      contributions: {
        melody: {
          stemId: 'melody',
          contributorId: 'seed-1',
          contributorName: 'Camille',
          unlockedAt: '2026-10-03T11:00:00.000Z',
        },
        harmony: {
          stemId: 'harmony',
          contributorId: 'seed-2',
          contributorName: 'Lucas',
          unlockedAt: '2026-10-03T11:10:00.000Z',
        },
        rhythm: {
          stemId: 'rhythm',
          contributorId: 'seed-3',
          contributorName: 'Clara',
          unlockedAt: '2026-10-03T11:20:00.000Z',
        },
        bass: {
          stemId: 'bass',
          contributorId: 'seed-4',
          contributorName: 'Rafael',
          unlockedAt: '2026-10-03T11:30:00.000Z',
        },
        fx: {
          stemId: 'fx',
          contributorId: 'seed-5',
          contributorName: 'Sofia',
          unlockedAt: '2026-10-03T11:40:00.000Z',
        },
      },
    };
  }

  return { regions, juryUnlockAll: false };
}

export const localUnlockAdapter: UnlockSyncAdapter = {
  load(countries) {
    if (typeof window === 'undefined' || !window.localStorage) {
      return createSeededUnlockState(countries);
    }
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return createSeededUnlockState(countries);
      const parsed = JSON.parse(raw) as CommunityUnlockState;
      if (!parsed || typeof parsed.regions !== 'object') {
        return createSeededUnlockState(countries);
      }
      return {
        regions: parsed.regions,
        juryUnlockAll: Boolean(parsed.juryUnlockAll),
      };
    } catch {
      return createSeededUnlockState(countries);
    }
  },
  save(state) {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage quota errors
    }
  },
};

export interface RegionUnlockSummary {
  unlockedCount: number;
  totalCount: number;
  progress01: number;
  unlockedStems: Record<StemId, boolean>;
  userAlreadyContributedStem: StemId | null;
  record: RegionUnlockRecord | null;
}

export function getRegionUnlockSummary(
  state: CommunityUnlockState,
  regionKey: string,
  currentUserId: string
): RegionUnlockSummary {
  const record = state.regions[regionKey] ?? null;
  const contributions = record?.contributions ?? {};

  const unlockedStems: Record<StemId, boolean> = {
    melody: state.juryUnlockAll || Boolean(contributions.melody),
    harmony: state.juryUnlockAll || Boolean(contributions.harmony),
    rhythm: state.juryUnlockAll || Boolean(contributions.rhythm),
    bass: state.juryUnlockAll || Boolean(contributions.bass),
    fx: state.juryUnlockAll || Boolean(contributions.fx),
  };

  let rawUnlockedCount = 0;
  let userContributed: StemId | null = null;
  for (const stem of STEM_ORDER) {
    const c = contributions[stem];
    if (c) {
      rawUnlockedCount += 1;
      if (c.contributorId === currentUserId) {
        userContributed = stem;
      }
    }
  }

  const effectiveCount = state.juryUnlockAll ? 5 : rawUnlockedCount;
  return {
    unlockedCount: effectiveCount,
    totalCount: 5,
    progress01: effectiveCount / 5,
    unlockedStems,
    userAlreadyContributedStem: userContributed,
    record,
  };
}

export interface UnlockAttemptResult {
  nextState: CommunityUnlockState;
  ok: boolean;
  reasonPt: string;
  unlockedStem?: StemId;
}

/**
 * Enforces collective unlock rule: 1 unique stem per contributor account per region,
 * requiring 5 collective contributions to illuminate the full 5-stem symphony.
 */
export function contributeRegionStem(
  state: CommunityUnlockState,
  params: {
    regionKey: string;
    regionLabel: string;
    stemId: StemId;
    contributorId: string;
    contributorName: string;
    bypassSingleLimit?: boolean;
  }
): UnlockAttemptResult {
  const existingRecord: RegionUnlockRecord = state.regions[params.regionKey] ?? {
    regionKey: params.regionKey,
    regionLabel: params.regionLabel,
    contributions: {},
  };

  if (existingRecord.contributions[params.stemId]) {
    return {
      nextState: state,
      ok: false,
      reasonPt: `A camada ${STEM_METAS[params.stemId].labelPt} já foi liberada nesta região.`,
    };
  }

  if (!params.bypassSingleLimit) {
    const existingByUser = STEM_ORDER.find(
      (s) => existingRecord.contributions[s]?.contributorId === params.contributorId
    );
    if (existingByUser) {
      return {
        nextState: state,
        ok: false,
        reasonPt: `Você já contribuiu com "${STEM_METAS[existingByUser].labelPt}" em ${params.regionLabel}. Para liberar toda a música, outras pessoas da comunidade (ou outro participante) precisam desbloquear as camadas restantes.`,
      };
    }
  }

  const nextRecord: RegionUnlockRecord = {
    ...existingRecord,
    regionLabel: params.regionLabel,
    contributions: {
      ...existingRecord.contributions,
      [params.stemId]: {
        stemId: params.stemId,
        contributorId: params.contributorId,
        contributorName: params.contributorName,
        unlockedAt: new Date().toISOString(),
      },
    },
  };

  const nextState: CommunityUnlockState = {
    ...state,
    regions: {
      ...state.regions,
      [params.regionKey]: nextRecord,
    },
  };

  const count = Object.keys(nextRecord.contributions).length;
  return {
    nextState,
    ok: true,
    unlockedStem: params.stemId,
    reasonPt:
      count >= 5
        ? `Comunidade completou 5/5 camadas em ${params.regionLabel}! O mapa se iluminou por completo.`
        : `${params.contributorName} liberou "${STEM_METAS[params.stemId].labelPt}" em ${params.regionLabel} (${count}/5 coletivo).`,
  };
}
