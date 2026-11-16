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
 * The 5 Photoshop-style layers of Earth Jukebox (1:1 with the 5 1024x1024 PNGs per country).
 */
export type VisualLayerId = 'melody' | 'chords' | 'temperature' | 'bass' | 'wind';

/**
 * Primary generator layers with dedicated audio + Solo (S) button.
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

export interface GlobeCameraPose {
  lon: number;
  lat: number;
  distance: number;
}

export interface CompareCountriesState {
  slotA: string;
  slotB: string;
}

/**
 * Pilot Countries for 3D Simulator validation:
 * - '076': Brazil
 * - '818': Egypt
 */
export const PILOT_COUNTRY_IDS = ['076', '818'] as const;

/**
 * The 100 local pre-generated countries in the repository (5 RGBA 1024x1024 PNGs + 5 96f videos + 16 OGG Stems + Studio MIDI Score).
 * The remaining 142 inhabited countries (excluding China '156') live in `remoteIds` on Supabase Storage (`nasa-countries`).
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
  '004',
  '010',
  '012',
  '024',
  '032',
  '050',
  '068',
  '072',
  '104',
  '112',
  '116',
  '120',
  '124',
  '140',
  '148',
  '152',
  '170',
  '178',
  '180',
  '218',
  '231',
  '232',
  '246',
  '266',
  '288',
  '300',
  '304',
  '324',
  '328',
  '360',
  '364',
  '368',
  '380',
  '384',
  '398',
  '404',
  '417',
  '418',
  '434',
  '450',
  '458',
  '466',
  '478',
  '496',
  '504',
  '508',
  '512',
  '516',
  '524',
  '554',
  '558',
  '562',
  '566',
  '578',
  '586',
  '598',
  '600',
  '604',
  '608',
  '616',
  '642',
  '643',
  '682',
  '686',
  '704',
  '706',
  '716',
  '724',
  '728',
  '729',
  '740',
  '752',
  '760',
  '762',
  '764',
  '788',
  '792',
  '795',
  '800',
  '804',
  '826',
  '834',
  '854',
  '858',
  '860',
  '862',
  '887',
  '894',
  'territory-somaliland',
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

export interface CountryTelemetrySummary {
  lightningHotspotCount: number;
  meanTemperature01: number;
  meanCo01: number;
  meanNox01: number;
  windMeanSpeedMs: number;
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
  /** Normalized coordinates 0..1 (snake_case compatible with Python meta.json and Person 1's request) */
  source_x: number;
  source_y: number;
  /** camelCase aliases for TypeScript convenience */
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
 * Inclusive bar loop range `[barStart, barEnd]` (`0..7`), or `null` for all 8 bars (`C1–C8`).
 */
export type BarLoopRange = [number, number] | null;

export interface ExperienceContextValue {
  country: ExperienceCountry | null;
  allCountries: ReadonlyArray<ExperienceCountry>;
  availableCountryIds: ReadonlySet<string>;
  pilotCountryIds: ReadonlySet<string>;
  loadStatus: 'idle' | 'loading' | 'ready' | 'error';
  lang: Lang;
  /** Current step of the Little Robot's narrative (Right Wall <-> Tablet) */
  storyStep: number;
  /** Current space expedition phase (idle -> boarding -> countdown -> zero_g -> exploring -> ended) */
  missionPhase: MissionPhase;
  /** True when the Tablet console is on the Globe tab selecting/switching countries */
  isPickingCountry: boolean;
  /** Counter to restart local animations of the active frame (e.g., 5..1 countdown or 4s cabin) */
  sceneReplayKey: number;
  /** Bar frozen in loop (0..7) for animation/audio inspection, or null for normal flow */
  loopSingleBar: number | null;
  /** Jukebox Studio-style bar loop range (`[b0, b1]` inclusive or `null` for `C1–C8`) */
  barLoop: BarLoopRange;
  /** Country pair configured for A ⇄ B scientific comparison on the same beat */
  compareCountries: CompareCountriesState;
  /** Complete 32-beat sequence (8 bars × 4 beats) of the active country */
  beatTimeline: ReadonlyArray<BeatTimelineSlot>;
  /** Complete Jukebox Studio MIDI score and telemetry for the current country */
  studioData: CountryStudioPayload | null;
  /** Active section (`region` or `base`) of the MIDI score */
  activeStudioSession: StudioSessionData | null;
  /** Official NASA telemetry extracted per layer from the active country's meta.json */
  telemetrySummary: CountryTelemetrySummary | null;
  /** Real-time acoustic energy (0..1) sent to each of the 3 physical speakers (VBAP) */
  speakerLiveLevels: Record<'speaker1' | 'speaker2' | 'speaker3', number>;
  audioMode: AudioOutputMode;
  masterGain: number;
  voiceVolume: number;
  /** Peak in dBFS measured in real time on the Master bus */
  masterDbFs: number;
  /** Mutes only this local device/tab (e.g., muted Projectors by default or muted remote Tablet) */
  localAudioMuted: boolean;
  /** Active audio source ('stems' for the 8 pre-rendered OGG stems) */
  audioSourceKind: 'stems' | 'meta-synth';
  /** Offline-first LAN WebSocket network status */
  lanConnected: boolean;
  lanClients: LanPeerInfo[];
  layers: ExperienceLayersState;
  playback: ExperiencePlaybackState;
  /** Active notes/lightning events in the current bar/beat with `source_x` and `source_y` */
  liveEvents: LiveNoteEvent[];
  /** Audio levels per layer (0..1) */
  audioLevels: AudioLevelsMap;
  /** URLs of the 5 1024x1024 PNGs clipped to the selected country's silhouette */
  pngUrls: Record<VisualLayerId, string> | null;
  /** Actual physical dimensions configured in ?view=setup / ?view=admin */
  roomDimensions: RoomDimensions;
  /** Synchronous non-rerendering getter for requestAnimationFrame loops (60fps) */
  getLiveFrame: () => LiveFrameSnapshot;
  /** Real browser AudioContext state ('running' | 'suspended' | 'closed' | 'uninitialized') */
  audioContextState: AudioContextState | 'uninitialized';
  /** Real RMS level measured by the Web Audio AnalyserNode [0..1] */
  realAudioRms01: number;
  /** Active room code in the URL (?room=XXXXXX) or null when isolated visitor */
  roomCode: string | null;
  /** Active network bus mode ('isolated' | 'lan-ws' | 'cloud-room') */
  syncNetworkMode: SyncNetworkMode;
  /** Generates a new 6-character room code and updates the current URL */
  regenerateRoomCode: () => string;
  /** Audio owner in the physical installation (Master PC, Tablet, or Both) */
  audioOwner: AudioOwnerRole;

  // Shared actions (Person 1 <-> Person 2 Contract)
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
  setIsPickingCountry: (picking: boolean) => void;
  sendGlobeCameraPose: (pose: GlobeCameraPose) => void;
  subscribeGlobeCameraPose: (listener: (pose: GlobeCameraPose) => void) => () => void;
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
