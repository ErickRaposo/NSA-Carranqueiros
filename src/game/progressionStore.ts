import { SoundscapeVisualTelemetry } from '../audio/soundscapeEngine';
import { STEM_METAS, StemId } from '../community/unlockStore';

export type MissionId =
  | 'cacador_de_raios'
  | 'mestre_dos_ventos'
  | 'pulso_termico'
  | 'ecos_invisiveis'
  | 'guardiao_planetario';

export interface MissionDefinition {
  id: MissionId;
  titlePt: string;
  descriptionPt: string;
  stemId: StemId;
  accentHex: string;
  targetCount: number;
  xpReward: number;
}

export interface MissionProgress extends MissionDefinition {
  currentCount: number;
  completed: boolean;
  matchedRegions: string[];
}

export interface AchievementBadge {
  id: string;
  titlePt: string;
  descriptionPt: string;
  unlocked: boolean;
}

export interface DiscoveryEvent {
  regionKey: string;
  label: string;
  phenomenonPt: string;
  stemId: StemId;
  xpGained: number;
  completedMissions: MissionId[];
}

export interface ContributionHistoryItem {
  regionKey: string;
  regionLabel: string;
  stemId: StemId;
  isRegionComplete5of5: boolean;
  timestampIso: string;
}

export interface ProgressionState {
  xp: number;
  exploredRegionKeys: string[];
  contributedRegionKeys: string[];
  unlockedSymphonyKeys: string[];
  contributionHistory: ContributionHistoryItem[];
  discoveredPhenomena: Record<StemId, number>;
  missionMatches: Record<MissionId, string[]>;
  lastDiscovery: DiscoveryEvent | null;
}

export interface ProgressionSyncAdapter {
  readonly mode: 'local' | 'remote';
  readonly noticePt: string;
  load(userId: string): ProgressionState;
  save(userId: string, state: ProgressionState): void;
}

export interface ExplorerRank {
  level: number;
  maxLevel: number;
  title: string;
  minXp: number;
  nextXp: number | null;
  progress01: number;
}

export const EXPLORER_RANKS: { title: string; minXp: number }[] = [
  { title: 'Ouvinte Orbital', minXp: 0 },
  { title: 'Cartógrafo Sonoro', minXp: 120 },
  { title: 'Maestro Atmosférico', minXp: 280 },
  { title: 'Guardião da Sinfonia', minXp: 520 },
];

export const NASA_MISSIONS: MissionDefinition[] = [
  {
    id: 'cacador_de_raios',
    titlePt: 'Caçador de Raios',
    descriptionPt: 'Descubra tempestades com clarões ativos em 3 regiões distintas.',
    stemId: 'melody',
    accentHex: '#FBBF24',
    targetCount: 3,
    xpReward: 75,
  },
  {
    id: 'mestre_dos_ventos',
    titlePt: 'Mestre dos Ventos',
    descriptionPt: 'Explore corredores de vento fortes (≥ 10 m/s) em 3 regiões.',
    stemId: 'fx',
    accentHex: '#38BDF8',
    targetCount: 3,
    xpReward: 75,
  },
  {
    id: 'pulso_termico',
    titlePt: 'Pulso Térmico',
    descriptionPt: 'Sinta zonas aquecidas (≥ 84 BPM) em 3 regiões do globo.',
    stemId: 'rhythm',
    accentHex: '#FB7185',
    targetCount: 3,
    xpReward: 75,
  },
  {
    id: 'ecos_invisiveis',
    titlePt: 'Ecos Invisíveis',
    descriptionPt: 'Mapeie plumas intensas de CO e NO₂ em 3 regiões.',
    stemId: 'harmony',
    accentHex: '#FB923C',
    targetCount: 3,
    xpReward: 75,
  },
  {
    id: 'guardiao_planetario',
    titlePt: 'Guardião Planetário',
    descriptionPt: 'Contribua para 3 regiões coletivas e ouça uma sinfonia 5/5.',
    stemId: 'bass',
    accentHex: '#34D399',
    targetCount: 3,
    xpReward: 110,
  },
];

export function createInitialProgressionState(): ProgressionState {
  return {
    xp: 0,
    exploredRegionKeys: [],
    contributedRegionKeys: [],
    unlockedSymphonyKeys: [],
    contributionHistory: [],
    discoveredPhenomena: {
      melody: 0,
      harmony: 0,
      rhythm: 0,
      bass: 0,
      fx: 0,
    },
    missionMatches: {
      cacador_de_raios: [],
      mestre_dos_ventos: [],
      pulso_termico: [],
      ecos_invisiveis: [],
      guardiao_planetario: [],
    },
    lastDiscovery: null,
  };
}

export function getExplorerRank(xp: number): ExplorerRank {
  const safeXp = Math.max(0, xp);
  let levelIdx = 0;
  let current = EXPLORER_RANKS[0];
  let nextXp: number | null = EXPLORER_RANKS[1].minXp;
  for (let i = 0; i < EXPLORER_RANKS.length; i++) {
    if (safeXp >= EXPLORER_RANKS[i].minXp) {
      levelIdx = i;
      current = EXPLORER_RANKS[i];
      nextXp = EXPLORER_RANKS[i + 1]?.minXp ?? null;
    }
  }
  const progress01 =
    nextXp === null
      ? 1
      : Math.min(1, Math.max(0, (safeXp - current.minXp) / Math.max(1, nextXp - current.minXp)));

  return {
    level: levelIdx + 1,
    maxLevel: EXPLORER_RANKS.length,
    title: current.title,
    minXp: current.minXp,
    nextXp,
    progress01,
  };
}

function getDominantPhenomenon(telemetry: SoundscapeVisualTelemetry): {
  stemId: StemId;
  phenomenonPt: string;
} {
  const ranked: { stemId: StemId; score: number; label: string }[] = [
    {
      stemId: 'melody',
      score: telemetry.stemActivity.melody,
      label: `Raios pentatônicos (${telemetry.melodyNoteName})`,
    },
    {
      stemId: 'harmony',
      score: telemetry.stemActivity.harmony,
      label: `Pluma de CO (${telemetry.chordName} ${telemetry.modeName})`,
    },
    {
      stemId: 'rhythm',
      score: telemetry.stemActivity.rhythm,
      label: `Pulso térmico (${telemetry.bpm} BPM)`,
    },
    {
      stemId: 'bass',
      score: telemetry.stemActivity.bass,
      label: `Grave NO₂ (${telemetry.bassNoteName})`,
    },
    {
      stemId: 'fx',
      score: telemetry.stemActivity.fx,
      label: `Corredor de ventos (${telemetry.windSpeedMsApprox.toFixed(0)} m/s)`,
    },
  ];
  ranked.sort((a, b) => b.score - a.score);
  return {
    stemId: ranked[0].stemId,
    phenomenonPt: ranked[0].label,
  };
}

function addUniqueRegion(list: string[], key: string): string[] {
  return list.includes(key) ? list : [...list, key];
}

export function recordRegionDiscovery(
  state: ProgressionState,
  input: {
    regionKey: string;
    regionLabel: string;
    telemetry: SoundscapeVisualTelemetry;
  }
): {
  nextState: ProgressionState;
  xpGained: number;
  isNewRegion: boolean;
  completedMissions: MissionId[];
} {
  // Strict anti-spam: never award XP twice for the same region key
  if (state.exploredRegionKeys.includes(input.regionKey)) {
    return {
      nextState: state,
      xpGained: 0,
      isNewRegion: false,
      completedMissions: [],
    };
  }

  let xpGained = 25; // Base XP for discovering a new region
  const dominant = getDominantPhenomenon(input.telemetry);
  const nextMatches: Record<MissionId, string[]> = {
    cacador_de_raios: [...state.missionMatches.cacador_de_raios],
    mestre_dos_ventos: [...state.missionMatches.mestre_dos_ventos],
    pulso_termico: [...state.missionMatches.pulso_termico],
    ecos_invisiveis: [...state.missionMatches.ecos_invisiveis],
    guardiao_planetario: [...state.missionMatches.guardiao_planetario],
  };

  const telemetry = input.telemetry;
  if (telemetry.stemActivity.melody >= 0.34 || telemetry.lightningMarkers.length > 0) {
    nextMatches.cacador_de_raios = addUniqueRegion(nextMatches.cacador_de_raios, input.regionKey);
    xpGained += 15;
  }
  if (telemetry.windSpeedMsApprox >= 10 || telemetry.windWetPct >= 38) {
    nextMatches.mestre_dos_ventos = addUniqueRegion(nextMatches.mestre_dos_ventos, input.regionKey);
    xpGained += 15;
  }
  if (telemetry.bpm >= 84 || telemetry.tempIndex >= 0.42) {
    nextMatches.pulso_termico = addUniqueRegion(nextMatches.pulso_termico, input.regionKey);
    xpGained += 15;
  }
  if (telemetry.stemActivity.harmony >= 0.32 || telemetry.bassCutoffHz >= 200) {
    nextMatches.ecos_invisiveis = addUniqueRegion(nextMatches.ecos_invisiveis, input.regionKey);
    xpGained += 15;
  }

  const completedMissions: MissionId[] = [];
  for (const mission of NASA_MISSIONS) {
    if (mission.id === 'guardiao_planetario') continue;
    const prevCount = state.missionMatches[mission.id].length;
    const nextCount = nextMatches[mission.id].length;
    if (prevCount < mission.targetCount && nextCount >= mission.targetCount) {
      xpGained += mission.xpReward;
      completedMissions.push(mission.id);
    }
  }

  const discovery: DiscoveryEvent = {
    regionKey: input.regionKey,
    label: input.regionLabel,
    phenomenonPt: dominant.phenomenonPt,
    stemId: dominant.stemId,
    xpGained,
    completedMissions,
  };

  return {
    nextState: {
      ...state,
      xp: state.xp + xpGained,
      exploredRegionKeys: [...state.exploredRegionKeys, input.regionKey],
      discoveredPhenomena: {
        ...state.discoveredPhenomena,
        [dominant.stemId]: state.discoveredPhenomena[dominant.stemId] + 1,
      },
      missionMatches: nextMatches,
      lastDiscovery: discovery,
    },
    xpGained,
    isNewRegion: true,
    completedMissions,
  };
}

export function recordCollectiveContribution(
  state: ProgressionState,
  input: {
    regionKey: string;
    regionLabel: string;
    stemId: StemId;
    isRegionComplete5of5: boolean;
  }
): {
  nextState: ProgressionState;
  xpGained: number;
  completedMissions: MissionId[];
} {
  let xpGained = 0;
  const alreadyContributed = state.contributedRegionKeys.includes(input.regionKey);
  const nextContributed = alreadyContributed
    ? state.contributedRegionKeys
    : [...state.contributedRegionKeys, input.regionKey];

  if (!alreadyContributed) {
    xpGained += 40;
  }

  const alreadyWitnessedSymphony = state.unlockedSymphonyKeys.includes(input.regionKey);
  const nextSymphonies =
    input.isRegionComplete5of5 && !alreadyWitnessedSymphony
      ? [...state.unlockedSymphonyKeys, input.regionKey]
      : state.unlockedSymphonyKeys;

  if (input.isRegionComplete5of5 && !alreadyWitnessedSymphony) {
    xpGained += 50;
  }

  const nextGuardiao = addUniqueRegion(state.missionMatches.guardiao_planetario, input.regionKey);
  const completedMissions: MissionId[] = [];
  const guardiaoMeta = NASA_MISSIONS.find((m) => m.id === 'guardiao_planetario')!;
  if (
    state.missionMatches.guardiao_planetario.length < guardiaoMeta.targetCount &&
    nextGuardiao.length >= guardiaoMeta.targetCount
  ) {
    xpGained += guardiaoMeta.xpReward;
    completedMissions.push('guardiao_planetario');
  }

  if (xpGained === 0 && nextGuardiao.length === state.missionMatches.guardiao_planetario.length) {
    return { nextState: state, xpGained: 0, completedMissions: [] };
  }

  const nextHistory: ContributionHistoryItem[] = alreadyContributed
    ? state.contributionHistory
    : [
        {
          regionKey: input.regionKey,
          regionLabel: input.regionLabel,
          stemId: input.stemId,
          isRegionComplete5of5: input.isRegionComplete5of5,
          timestampIso: new Date().toISOString(),
        },
        ...state.contributionHistory,
      ].slice(0, 40);

  return {
    nextState: {
      ...state,
      xp: state.xp + xpGained,
      contributedRegionKeys: nextContributed,
      unlockedSymphonyKeys: nextSymphonies,
      contributionHistory: nextHistory,
      missionMatches: {
        ...state.missionMatches,
        guardiao_planetario: nextGuardiao,
      },
      lastDiscovery:
        xpGained > 0
          ? {
              regionKey: input.regionKey,
              label: input.regionLabel,
              phenomenonPt: input.isRegionComplete5of5
                ? 'Sinfonia 5/5 acesa no globo!'
                : 'Camada iluminada no coletivo',
              stemId: input.stemId,
              xpGained,
              completedMissions,
            }
          : state.lastDiscovery,
    },
    xpGained,
    completedMissions,
  };
}

export function getMissionProgressList(state: ProgressionState): MissionProgress[] {
  return NASA_MISSIONS.map((mission) => {
    const matchedRegions = state.missionMatches[mission.id] ?? [];
    return {
      ...mission,
      currentCount: Math.min(mission.targetCount, matchedRegions.length),
      completed: matchedRegions.length >= mission.targetCount,
      matchedRegions,
    };
  });
}

export function getAchievementBadges(state: ProgressionState): AchievementBadge[] {
  const activeStems = (Object.values(state.discoveredPhenomena) as number[]).filter(
    (c) => c > 0
  ).length;
  const missionsDone = getMissionProgressList(state).filter((m) => m.completed).length;

  return [
    {
      id: 'first_signal',
      titlePt: 'Primeiro Sinal da Terra',
      descriptionPt: 'Explore sua primeira região do planeta.',
      unlocked: state.exploredRegionKeys.length >= 1,
    },
    {
      id: 'collective_spark',
      titlePt: 'Centelha Coletiva',
      descriptionPt: 'Ilumine uma camada sonora com a comunidade.',
      unlocked: state.contributedRegionKeys.length >= 1,
    },
    {
      id: 'five_senses',
      titlePt: 'Cinco Elementos',
      descriptionPt: 'Descubra fenômenos dominantes das 5 camadas da NASA.',
      unlocked: activeStems >= 5,
    },
    {
      id: 'symphony_witness',
      titlePt: 'Sinfonia Completa',
      descriptionPt: 'Presencie uma região atingir 5/5 camadas acesas.',
      unlocked: state.unlockedSymphonyKeys.length >= 1,
    },
    {
      id: 'mission_master',
      titlePt: 'Orquestrador Global',
      descriptionPt: 'Conclua pelo menos 3 missões planetárias.',
      unlocked: missionsDone >= 3,
    },
  ];
}

const STORAGE_PREFIX = 'mineiro_progression_v1:';

export const PROGRESSION_SYNC_NOTICE_PT =
  'Progresso pessoal salvo localmente neste navegador; sincronização entre dispositivos requer backend dedicado.';

/**
 * Local storage persistence adapter for user progression.
 * Kept strictly separate from collective unlockStore truth; cross-device sync
 * can replace this adapter with a remote REST/WebSocket implementation later.
 */
export const localProgressionAdapter: ProgressionSyncAdapter = {
  mode: 'local',
  noticePt: PROGRESSION_SYNC_NOTICE_PT,
  load(userId: string): ProgressionState {
    if (typeof window === 'undefined' || !window.localStorage) {
      return createInitialProgressionState();
    }
    try {
      const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${userId}`);
      if (!raw) return createInitialProgressionState();
      const parsed = JSON.parse(raw) as Partial<ProgressionState>;
      const base = createInitialProgressionState();
      return {
        ...base,
        ...parsed,
        exploredRegionKeys: Array.isArray(parsed.exploredRegionKeys)
          ? parsed.exploredRegionKeys
          : [],
        contributedRegionKeys: Array.isArray(parsed.contributedRegionKeys)
          ? parsed.contributedRegionKeys
          : [],
        unlockedSymphonyKeys: Array.isArray(parsed.unlockedSymphonyKeys)
          ? parsed.unlockedSymphonyKeys
          : [],
        contributionHistory: Array.isArray(parsed.contributionHistory)
          ? parsed.contributionHistory
          : [],
        discoveredPhenomena: { ...base.discoveredPhenomena, ...parsed.discoveredPhenomena },
        missionMatches: { ...base.missionMatches, ...parsed.missionMatches },
        lastDiscovery: parsed.lastDiscovery ?? null,
      };
    } catch {
      return createInitialProgressionState();
    }
  },
  save(userId: string, state: ProgressionState): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      window.localStorage.setItem(`${STORAGE_PREFIX}${userId}`, JSON.stringify(state));
    } catch {
      // Ignore storage quota errors in private mode
    }
  },
};

export function loadProgressionState(userId: string): ProgressionState {
  return localProgressionAdapter.load(userId);
}

export function saveProgressionState(userId: string, state: ProgressionState): void {
  localProgressionAdapter.save(userId, state);
}

export interface SonicPassportSummary {
  illuminatedRegions: { regionKey: string; regionLabel: string; isComplete5of5: boolean }[];
  favoriteStem: {
    stemId: StemId;
    labelPt: string;
    accentHex: string;
    usageCount: number;
  } | null;
  regionalTitles: string[];
  hasGoldenTrailReward: boolean;
}

const REGION_TITLE_MAP: Record<string, string> = {
  'América do Sul': 'Maestro Sul-Americano',
  'América do Norte e Central': 'Guardião das Américas',
  Europa: 'Maestro da Eurásia',
  Ásia: 'Maestro da Eurásia',
  África: 'Voz do Berço Solar',
  Oceania: 'Sinfonia do Pacífico',
};

/**
 * Derives the Sonic Passport / Logbook ("Diário de Bordo & Passaporte Sônico")
 * strictly from real user discoveries, contributions, and symphonies.
 */
export function getSonicPassportSummary(
  state: ProgressionState,
  countriesByRegionKey?: ReadonlyMap<string, { namePt: string; regionPt: string }>
): SonicPassportSummary {
  const regionMap = new Map<string, { regionKey: string; regionLabel: string; isComplete5of5: boolean }>();
  for (const item of state.contributionHistory) {
    const prev = regionMap.get(item.regionKey);
    regionMap.set(item.regionKey, {
      regionKey: item.regionKey,
      regionLabel: item.regionLabel,
      isComplete5of5: Boolean(prev?.isComplete5of5 || item.isRegionComplete5of5 || state.unlockedSymphonyKeys.includes(item.regionKey)),
    });
  }
  for (const key of state.contributedRegionKeys) {
    if (!regionMap.has(key)) {
      const meta = countriesByRegionKey?.get(key);
      regionMap.set(key, {
        regionKey: key,
        regionLabel: meta?.namePt ?? key.replace(/^country:/, ''),
        isComplete5of5: state.unlockedSymphonyKeys.includes(key),
      });
    }
  }

  // Favorite / most-attuned frequency combining contributions (weight 2) + discoveries (weight 1)
  let bestStem: StemId | null = null;
  let bestScore = 0;
  const stemOrder: StemId[] = ['melody', 'harmony', 'rhythm', 'bass', 'fx'];
  for (const stemId of stemOrder) {
    const contribCount = state.contributionHistory.filter((h) => h.stemId === stemId).length;
    const discCount = state.discoveredPhenomena[stemId] ?? 0;
    const score = contribCount * 2 + discCount;
    if (score > bestScore) {
      bestScore = score;
      bestStem = stemId;
    }
  }

  const titlesSet = new Set<string>();
  if (state.unlockedSymphonyKeys.length >= 1) {
    titlesSet.add('Orquestrador Áureo 5/5');
  }
  if (bestStem === 'melody' && bestScore >= 2) {
    titlesSet.add('Explorador Pentatônico');
  }
  if (countriesByRegionKey) {
    const activeKeys = new Set([...state.contributedRegionKeys, ...state.unlockedSymphonyKeys]);
    for (const key of activeKeys) {
      const geo = countriesByRegionKey.get(key);
      if (geo && REGION_TITLE_MAP[geo.regionPt]) {
        titlesSet.add(REGION_TITLE_MAP[geo.regionPt]);
      }
    }
  }

  return {
    illuminatedRegions: Array.from(regionMap.values()),
    favoriteStem: bestStem
      ? {
          stemId: bestStem,
          labelPt: STEM_METAS[bestStem].labelPt,
          accentHex: STEM_METAS[bestStem].accentHex,
          usageCount: bestScore,
        }
      : null,
    regionalTitles: Array.from(titlesSet),
    hasGoldenTrailReward: state.unlockedSymphonyKeys.length >= 1,
  };
}
