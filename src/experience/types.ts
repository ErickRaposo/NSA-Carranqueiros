import { DatasetId } from '../datasets/nasaDatasets';

export type Lang = 'pt' | 'en';
export type ViewRole = 'setup' | 'simulator' | 'projector' | 'controller' | 'demo' | 'portal';
export type ProjectorOutId = 1 | 2 | 3;
export type MissionPhase =
  | 'idle'
  | 'briefing'
  | 'boarding'
  | 'countdown'
  | 'zero_g'
  | 'exploring'
  | 'ended';

/**
 * As 5 camadas estilo Photoshop do Earth Jukebox (1:1 com os 5 PNGs 1024x1024 por país).
 */
export type VisualLayerId = 'melody' | 'chords' | 'temperature' | 'bass' | 'wind';

/**
 * Camadas geradoras com áudio próprio + botão Solo (S).
 */
export type SoloableLayerId = 'melody' | 'chords' | 'bass';

export type AudioOutputMode = 'room3' | 'hrtf' | '5.1';
export type TuningMode = 'region' | 'base';

/**
 * Os 3 Países Piloto solicitados pela Shay (Pessoa 1) para validação no Simulador 3D:
 * - '076': Brasil
 * - '818': Egito
 * - '156': China
 */
export const PILOT_COUNTRY_IDS = ['076', '818', '156'] as const;

export const VISUAL_LAYER_ORDER: VisualLayerId[] = [
  'melody',
  'chords',
  'temperature',
  'bass',
  'wind',
];

export interface LayerVisualMeta {
  id: VisualLayerId;
  datasetId: DatasetId;
  accentHex: string;
  roleKind: 'generator' | 'conductor' | 'fxBus';
  labelPt: string;
  labelEn: string;
  musicalRolePt: string;
  musicalRoleEn: string;
  phenomenonPt: string;
  phenomenonEn: string;
}

export const LAYER_METAS: Record<VisualLayerId, LayerVisualMeta> = {
  melody: {
    id: 'melody',
    datasetId: 'svs5011',
    accentHex: '#fbbf24',
    roleKind: 'generator',
    labelPt: 'Melodia',
    labelEn: 'Melody',
    musicalRolePt: 'Celesta / Rhodes + Tempestade (5ª/8ª)',
    musicalRoleEn: 'Celesta / Rhodes + Storm Sparkle (5th/8th)',
    phenomenonPt: 'Raios ISS (SVS 5011)',
    phenomenonEn: 'ISS Lightning (SVS 5011)',
  },
  chords: {
    id: 'chords',
    datasetId: 'svs5153',
    accentHex: '#fb923c',
    roleKind: 'generator',
    labelPt: 'Acordes',
    labelEn: 'Chords',
    musicalRolePt: 'Pad Harmônico (Lídio → Frígio)',
    musicalRoleEn: 'Harmonic Pad (Lydian → Phrygian)',
    phenomenonPt: 'Monóxido de Carbono CO (SVS 5153)',
    phenomenonEn: 'Carbon Monoxide CO (SVS 5153)',
  },
  temperature: {
    id: 'temperature',
    datasetId: 'svs5147',
    accentHex: '#fb7185',
    roleKind: 'conductor',
    labelPt: 'Temperatura',
    labelEn: 'Temperature',
    musicalRolePt: 'Regente: Tom & BPM (66–110 BPM vs Base 90)',
    musicalRoleEn: 'Conductor: Key & BPM (66–110 BPM vs Base 90)',
    phenomenonPt: 'Temperatura 2m T2M (SVS 5147)',
    phenomenonEn: '2m Temperature T2M (SVS 5147)',
  },
  bass: {
    id: 'bass',
    datasetId: 'svs5154',
    accentHex: '#34d399',
    roleKind: 'generator',
    labelPt: 'Baixo',
    labelEn: 'Bass',
    musicalRolePt: 'Sub-Bass Urbano (Cutoff & Drive)',
    musicalRoleEn: 'Urban Sub-Bass (Cutoff & Drive)',
    phenomenonPt: 'Óxidos de Nitrogênio NO₂ (SVS 5154)',
    phenomenonEn: 'Nitrogen Oxides NO₂ (SVS 5154)',
  },
  wind: {
    id: 'wind',
    datasetId: 'svs5148',
    accentHex: '#38bdf8',
    roleKind: 'fxBus',
    labelPt: 'Vento',
    labelEn: 'Wind',
    musicalRolePt: 'Bus Espacial 8D (Delay + Shimmer Reverb)',
    musicalRoleEn: '8D Spatial Bus (Delay + Shimmer Reverb)',
    phenomenonPt: 'Ventos 10m (SVS 5148)',
    phenomenonEn: '10m Winds (SVS 5148)',
  },
};

export const DATASET_TO_LAYER: Record<DatasetId, VisualLayerId> = {
  svs5011: 'melody',
  svs5153: 'chords',
  svs5147: 'temperature',
  svs5154: 'bass',
  svs5148: 'wind',
};

export interface ExperienceCountry {
  id: string;
  namePt: string;
  nameEn: string;
  regionPt: string;
  regionEn: string;
  hemispherePt: string;
  hemisphereEn: string;
  lon: number;
  lat: number;
  lonSpan: number;
  latSpan: number;
  idealDistance: number;
  bbox: [number, number, number, number];
  isPilot: boolean;
}

export interface BaseLayerState {
  enabled: boolean;
  gain: number;
  solo: boolean;
}

export interface MelodyLayerState extends BaseLayerState {
  sparkleEnabled: boolean;
}

export interface WindLayerState extends BaseLayerState {
  wetMix: number;
}

export interface TemperatureLayerState extends BaseLayerState {
  tuningMode: TuningMode;
}

export interface ExperienceLayersState {
  melody: MelodyLayerState;
  chords: BaseLayerState;
  bass: BaseLayerState;
  wind: WindLayerState;
  temperature: TemperatureLayerState;
}

export interface ExperiencePlaybackState {
  isPlaying: boolean;
  bar: number;
  beat: number;
  totalBeats: number;
  totalBars: number;
  progress: number;
  durationSeconds: number;
  bpm: number;
  keyRoot: string;
  keyRootPt: string;
  modeNamePt: string;
  modeNameEn: string;
  activeChord: string;
  windMeanSpeed: number;
}

export type AudioLevelsMap = Record<
  'melody' | 'sparkle' | 'chords' | 'bass' | 'wind' | 'master',
  number
>;

export interface LiveNoteEvent {
  layer: 'melody' | 'sparkle' | 'chords' | 'bass';
  /** Coordenadas normalizadas 0..1 (snake_case compatível com meta.json Python e pedido da Pessoa 1) */
  source_x: number;
  source_y: number;
  /** Aliases camelCase por conveniência no TypeScript */
  sourceX: number;
  sourceY: number;
  pitch: number;
  velocity: number;
  isAnchor: boolean;
}

export interface LiveFrameSnapshot {
  currentTime: number;
  progress01: number;
  vu: AudioLevelsMap;
  activeNotes: LiveNoteEvent[];
  lightningCount: number;
}

export interface SurfaceDimensionsCm {
  widthCm: number;
  heightCm: number;
}

export interface RoomDimensions {
  leftWall: SurfaceDimensionsCm;
  rightWall: SurfaceDimensionsCm;
  ceiling: SurfaceDimensionsCm;
}

export type SurfaceId = 'leftWall' | 'rightWall' | 'ceiling';

export interface SceneSurfaceProps {
  surfaceId: SurfaceId;
  widthCm: number;
  heightCm: number;
  aspectRatio: number;
  renderContext: 'projector' | 'simulator' | 'demo';
}

export interface ExperienceContextValue {
  country: ExperienceCountry | null;
  availableCountryIds: ReadonlySet<string>;
  pilotCountryIds: ReadonlySet<string>;
  loadStatus: 'idle' | 'loading' | 'ready' | 'error';
  lang: Lang;
  /** Passo atual da narrativa do Robozinho (Parede Direita <-> Tablet) */
  storyStep: number;
  /** Fase atual da expedição espacial (idle -> boarding -> countdown -> zero_g -> exploring -> ended) */
  missionPhase: MissionPhase;
  audioMode: AudioOutputMode;
  masterGain: number;
  layers: ExperienceLayersState;
  playback: ExperiencePlaybackState;
  /** Notas/raios ativos no compasso/batida atual com `source_x` e `source_y` */
  liveEvents: LiveNoteEvent[];
  /** Níveis de áudio por camada (0..1) */
  audioLevels: AudioLevelsMap;
  /** URLs dos 5 PNGs 1024x1024 recortados na silhueta do país selecionado */
  pngUrls: Record<VisualLayerId, string> | null;
  /** Dimensões físicas reais configuradas no ?view=setup */
  roomDimensions: RoomDimensions;
  /** Getter síncrono sem re-render para loops requestAnimationFrame (60fps) */
  getLiveFrame: () => LiveFrameSnapshot;

  // Ações compartilhadas (Contrato Pessoa 1 <-> Pessoa 2)
  selectCountry: (countryId: string | null) => void;
  toggleEye: (layerId: VisualLayerId) => void;
  setAllLayersEnabled: (enabled: boolean) => void;
  toggleSparkle: () => void;
  setLayerGain: (layerId: VisualLayerId, gainOrWet: number) => void;
  setWindWetMix: (wetMix: number) => void;
  toggleSolo: (layerId: SoloableLayerId) => void;
  setMasterGain: (gain: number) => void;
  setAudioMode: (mode: AudioOutputMode) => void;
  togglePlay: () => void;
  seekBeat: (beatIndex: number) => void;
  seekBar: (barIndex: number) => void;
  seekProgress: (progress01: number) => void;
  setLang: (lang: Lang) => void;
  setStoryStep: (step: number) => void;
  setMissionPhase: (phase: MissionPhase) => void;
  nextStoryStep: () => void;
  prevStoryStep: () => void;
  setRoomDimensions: (next: RoomDimensions) => void;
}
