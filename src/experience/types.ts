import { DatasetId } from '../datasets/nasaDatasets';

export type Lang = 'pt' | 'en';
export type ViewRole =
  | 'setup'
  | 'admin'
  | 'simulator'
  | 'projector'
  | 'controller'
  | 'demo'
  | 'portal'
  | 'audio-node';
export type SyncNetworkMode = 'isolated' | 'lan-ws' | 'cloud-room';
export type ProjectorOutId = 1 | 2 | 3;
export type SpeakerNodeIndex = 1 | 2 | 3;
export type MissionPhase =
  | 'idle'
  | 'briefing'
  | 'boarding'
  | 'countdown'
  | 'zero_g'
  | 'exploring'
  | 'ended';
export type SpeechPlaybackStatus = 'idle' | 'speaking' | 'paused' | 'stopped';
export type SpeechCommandType = 'pause' | 'resume' | 'stop';

export const PROJECTOR_OUT_IDS: readonly ProjectorOutId[] = [1, 2, 3] as const;
export const SURFACE_IDS: readonly SurfaceId[] = ['leftWall', 'rightWall', 'ceiling'] as const;

/**
 * As 5 camadas estilo Photoshop do Earth Jukebox (1:1 com os 5 PNGs 1024x1024 por país).
 */
export type VisualLayerId = 'melody' | 'chords' | 'temperature' | 'bass' | 'wind';

/**
 * Camadas geradoras principais com áudio próprio + botão Solo (S).
 */
export type SoloableLayerId = 'melody' | 'chords' | 'bass';

export type AudioOutputMode = 'room3' | 'hrtf' | '5.1';
export type TuningMode = 'region' | 'base';

export interface BeatTimelineSlot {
  beat: number;
  bar: number;
  beatInBar: number;
  hasMelody: boolean;
  hasSparkle: boolean;
  hasChords: boolean;
  hasBass: boolean;
  primaryX: number | null;
  primaryY: number | null;
}

export interface CompareCountriesState {
  slotA: string;
  slotB: string;
}

/**
 * Os Países Piloto para validação no Simulador 3D:
 * - '076': Brasil
 * - '818': Egito
 */
export const PILOT_COUNTRY_IDS = ['076', '818'] as const;

/**
 * Os 11 Países pré-gerados com pacote completo real (5 PNGs 1024x1024 RGBA + 5 vídeos 96f + 16 Stems OGG + Partitura MIDI Studio):
 * Sem fallback sintético — apenas países com pacote gerado ficam disponíveis.
 */
export const GENERATED_COUNTRY_IDS = [
  '076',
  '840',
  '250',
  '392',
  '276',
  '818',
  '356',
  '484',
  '036',
  '710',
  '620',
] as const;

export const VISUAL_LAYER_ORDER: VisualLayerId[] = [
  'melody',
  'chords',
  'bass',
  'wind',
  'temperature',
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
    musicalRolePt: 'Celesta / Rhodes + Pentatônica Neutra',
    musicalRoleEn: 'Celesta / Rhodes + Neutral Pentatonic',
    phenomenonPt: 'Raios ISS · SVS 5011',
    phenomenonEn: 'ISS Lightning · SVS 5011',
  },
  chords: {
    id: 'chords',
    datasetId: 'svs5153',
    accentHex: '#fb923c',
    roleKind: 'generator',
    labelPt: 'Acordes',
    labelEn: 'Chords',
    musicalRolePt: 'Pad Harmônico Unison · Lídio → Frígio',
    musicalRoleEn: 'Unison Harmonic Pad · Lydian → Phrygian',
    phenomenonPt: 'Monóxido de Carbono CO · SVS 5153',
    phenomenonEn: 'Carbon Monoxide CO · SVS 5153',
  },
  temperature: {
    id: 'temperature',
    datasetId: 'svs5147',
    accentHex: '#fb7185',
    roleKind: 'conductor',
    labelPt: 'Temperatura',
    labelEn: 'Temperature',
    musicalRolePt: 'Regente: Tom & BPM · 66–110 BPM vs Base 90',
    musicalRoleEn: 'Conductor: Key & BPM · 66–110 BPM vs Base 90',
    phenomenonPt: 'Temperatura 2m T2M · SVS 5147',
    phenomenonEn: '2m Temperature T2M · SVS 5147',
  },
  bass: {
    id: 'bass',
    datasetId: 'svs5154',
    accentHex: '#34d399',
    roleKind: 'generator',
    labelPt: 'Baixo',
    labelEn: 'Bass',
    musicalRolePt: 'Sub-Bass Contínuo · Cutoff & Drive',
    musicalRoleEn: 'Continuous Sub-Bass · Cutoff & Drive',
    phenomenonPt: 'Óxidos de Nitrogênio NO₂ · SVS 5154',
    phenomenonEn: 'Nitrogen Oxides NO₂ · SVS 5154',
  },
  wind: {
    id: 'wind',
    datasetId: 'svs5148',
    accentHex: '#38bdf8',
    roleKind: 'fxBus',
    labelPt: 'Vento',
    labelEn: 'Wind',
    musicalRolePt: 'Bus Espacial 8D · Delay + Chorus + Reverb',
    musicalRoleEn: '8D Spatial Bus · Delay + Chorus + Reverb',
    phenomenonPt: 'Ventos 10m · SVS 5148',
    phenomenonEn: '10m Winds · SVS 5148',
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
  sparkleGain: number;
  sparkleSolo: boolean;
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

/**
 * Canonic saved gains from `nasa-geo-sonification/nasa_soundscape/config.py`
 */
export const STUDIO_SAVED_GAINS = {
  melody: 0.88,
  sparkle: 1.0,
  chords: 0.72,
  bass: 1.05,
  wind: 1.0,
  master: 1.0,
} as const;

export interface StudioMidiNote {
  start_beat: number;
  duration_beats: number;
  pitch: number;
  velocity: number;
  source_x: number;
  source_y: number;
  is_anchor?: boolean;
  sub_role?: 'bloom_interval' | 'crystal_sparkle' | string;
}

export interface StudioSessionData {
  tuningMode: TuningMode;
  bpm: number;
  keyRoot: string;
  keyRootPt: string;
  durationSeconds: number;
  totalBars: number;
  modeId: string;
  modeNamePt: string;
  modeNameEn: string;
  chordProgression: string[];
  musicalParameters: {
    melody: {
      noteCount: number;
      anchorNoteCount: number;
      sparkleCount: number;
      lightningMap: string;
      lightningMode: string;
    };
    chords: {
      noteCount: number;
      voicingStyle: string;
    };
    bass: {
      noteCount: number;
      cutoffHz: number;
      drive: number;
    };
    wind: {
      reverbDecaySeconds: number;
      meanSpeed: number;
    };
  };
  tracks: {
    melody: StudioMidiNote[];
    melody_sparkle: StudioMidiNote[];
    chords_pad: StudioMidiNote[];
    bass: StudioMidiNote[];
  };
}

export interface CountryWindProfile {
  orientation: number[];
  hotspotX: number[];
  hotspotY: number[];
  speed: number[];
  turbulence: number[];
}

export interface CountryStudioPayload {
  numFrames: number;
  yellowCounts: number[];
  persistentPeaks: Array<[number, number]>;
  windProfile?: CountryWindProfile;
  sessions: {
    region: StudioSessionData;
    base: StudioSessionData;
  };
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
  subRole?: string;
}

export interface LiveFrameSnapshot {
  currentTime: number;
  progress01: number;
  vu: AudioLevelsMap;
  masterDbFs: number;
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
  globeRotationPaused?: boolean;
}

export interface LanPeerInfo {
  id: string;
  role: string;
  ip: string;
  connectedAt: number;
}

export type AudioOwnerRole = 'pc' | 'tablet' | 'both';

/**
 * Intervalo de compassos em loop `[barStart, barEnd]` inclusivo (`0..7`), ou `null` para todos os 8 compassos (`C1–C8`).
 */
export type BarLoopRange = [number, number] | null;

export interface ExperienceContextValue {
  country: ExperienceCountry | null;
  allCountries: ReadonlyArray<ExperienceCountry>;
  availableCountryIds: ReadonlySet<string>;
  pilotCountryIds: ReadonlySet<string>;
  loadStatus: 'idle' | 'loading' | 'ready' | 'error';
  lang: Lang;
  /** Passo atual da narrativa do Robozinho (Parede Direita <-> Tablet) */
  storyStep: number;
  /** Fase atual da expedição espacial (idle -> boarding -> countdown -> zero_g -> exploring -> ended) */
  missionPhase: MissionPhase;
  /** Contador para reiniciar animações locais do quadro ativo (ex: contagem 5..1 ou cabine 4s) */
  sceneReplayKey: number;
  /** Compasso congelado em loop (0..7) para inspeção de animação/áudio, ou null para fluxo normal */
  loopSingleBar: number | null;
  /** Trecho de compassos em loop estilo Jukebox Studio (`[b0, b1]` inclusivo ou `null` p/ `C1–C8`) */
  barLoop: BarLoopRange;
  /** Par de países configurado para comparação científica A ⇄ B na mesma batida */
  compareCountries: CompareCountriesState;
  /** Sequência completa de 32 batidas (8 compassos x 4 tempos) do país ativo */
  beatTimeline: ReadonlyArray<BeatTimelineSlot>;
  /** Partitura MIDI e telemetria completa do Jukebox Studio para o país atual */
  studioData: CountryStudioPayload | null;
  /** Sessão ativa (`region` ou `base`) da partitura MIDI */
  activeStudioSession: StudioSessionData | null;
  /** Energia acústica em tempo real (0..1) enviada para cada uma das 3 caixas físicas (VBAP) */
  speakerLiveLevels: Record<'speaker1' | 'speaker2' | 'speaker3', number>;
  audioMode: AudioOutputMode;
  masterGain: number;
  voiceVolume: number;
  /** Pico em dBFS medido em tempo real no barramento Master */
  masterDbFs: number;
  /** Silencia apenas este dispositivo/aba local (ex.: Projetores mudos por padrão ou Tablet remoto mudo) */
  localAudioMuted: boolean;
  /** Fonte de áudio ativa ('stems' para os 8 stems OGG pré-renderizados) */
  audioSourceKind: 'stems' | 'meta-synth';
  /** Estado da rede LAN WebSocket offline-first */
  lanConnected: boolean;
  lanClients: LanPeerInfo[];
  layers: ExperienceLayersState;
  playback: ExperiencePlaybackState;
  /** Notas/raios ativos no compasso/batida atual com `source_x` e `source_y` */
  liveEvents: LiveNoteEvent[];
  /** Níveis de áudio por camada (0..1) */
  audioLevels: AudioLevelsMap;
  /** URLs dos 5 PNGs 1024x1024 recortados na silhueta do país selecionado */
  pngUrls: Record<VisualLayerId, string> | null;
  /** Dimensões físicas reais configuradas no ?view=setup / ?view=admin */
  roomDimensions: RoomDimensions;
  /** Getter síncrono sem re-render para loops requestAnimationFrame (60fps) */
  getLiveFrame: () => LiveFrameSnapshot;
  /** Estado real do AudioContext do navegador ('running' | 'suspended' | 'closed' | 'uninitialized') */
  audioContextState: AudioContextState | 'uninitialized';
  /** Nível RMS real medido pelo AnalyserNode do Web Audio [0..1] */
  realAudioRms01: number;
  /** Código da sala ativa na URL (?room=XXXXXX) ou null quando visitante isolado */
  roomCode: string | null;
  /** Modo de barramento de rede ativo ('isolated' | 'lan-ws' | 'cloud-room') */
  syncNetworkMode: SyncNetworkMode;
  /** Gera um novo código de sala de 6 caracteres e atualiza a URL atual */
  regenerateRoomCode: () => string;
  /** Dono do áudio na instalação física (PC Mestre, Tablet ou Ambos) */
  audioOwner: AudioOwnerRole;

  // Ações compartilhadas (Contrato Pessoa 1 <-> Pessoa 2)
  selectCountry: (countryId: string | null) => void;
  selectCountryPreserveBeat: (countryId: string) => void;
  setCompareSlot: (slot: 'A' | 'B', countryId: string) => void;
  swapCompareCountries: () => void;
  activateMissionFrame: (
    phase: MissionPhase,
    nextStoryStep?: number,
    focusLayer?: VisualLayerId
  ) => void;
  replayActiveFrame: () => void;
  setLoopSingleBar: (barIndex: number | null) => void;
  setBarLoop: (range: BarLoopRange) => void;
  restartLoop: () => void;
  resetMixerGains: () => void;
  stepBeat: (delta: number) => void;
  toggleEye: (layerId: VisualLayerId) => void;
  setAllLayersEnabled: (enabled: boolean) => void;
  toggleSparkle: () => void;
  setSparkleGain: (gain: number) => void;
  toggleSparkleSolo: () => void;
  setLayerGain: (layerId: VisualLayerId, gainOrWet: number) => void;
  setWindWetMix: (wetMix: number) => void;
  toggleSolo: (layerId: SoloableLayerId) => void;
  setMasterGain: (gain: number) => void;
  setVoiceVolume: (volume: number) => void;
  setLocalAudioMuted: (muted: boolean) => void;
  setAudioOwner: (owner: AudioOwnerRole) => void;
  setAudioMode: (mode: AudioOutputMode) => void;
  togglePlay: () => void;
  playWithAudibleLayers: () => void;
  unlockAudioContext: () => Promise<AudioContextState | 'uninitialized'>;
  seekBeat: (beatIndex: number) => void;
  seekBar: (barIndex: number) => void;
  seekProgress: (progress01: number) => void;
  setLang: (lang: Lang) => void;
  setStoryStep: (step: number) => void;
  setMissionPhase: (phase: MissionPhase) => void;
  nextStoryStep: () => void;
  prevStoryStep: () => void;
  setRoomDimensions: (next: RoomDimensions) => void;
  resetExperienceToDefault: () => void;
  audioSessionUnlocked: boolean;
  voiceAutoEnabled: boolean;
  speechStatus: SpeechPlaybackStatus;
  speechCommandNonce: number;
  lastSpeechCommand: SpeechCommandType | null;
  unlockAudioSession: () => void;
  setVoiceAutoEnabled: (enabled: boolean) => void;
  stopRobotSpeech: () => void;
  togglePauseRobotSpeech: () => void;
  reportSpeechStatus: (status: SpeechPlaybackStatus) => void;
}
