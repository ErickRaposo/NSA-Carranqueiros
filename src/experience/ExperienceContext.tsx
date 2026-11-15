import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AudioDeviceOption,
  AudioOutputSupportStatus,
  CalibrationTestMode,
  SpatialAudioEngine,
} from '../audio/spatialAudioEngine';
import {
  AudioCalibrationState,
  createDefaultAudioCalibration,
  loadAudioCalibration,
  saveAudioCalibration,
  SPEAKER_CALIBRATION_CHANNEL,
  speakerIndexToSlotId,
  SpeakerSlotConfig,
  SpeakerSlotId,
} from '../audio/speakerCalibration';
import { resolveAssetUrl } from '../datasets/nasaDatasets';
import { CountryEntry, loadWorldCountries } from '../geo/countries';
import {
  applyProjectionPreset,
  CALIBRATION_CHANNEL_NAME,
  CalibrationSurfaceKey,
  createDefaultCalibrationState,
  isProjectionStateValid,
  loadCalibrationState,
  ProjectionCalibrationState,
  ProjectionTopologyPreset,
  ProjectorOutputConfig,
  QuadCorners,
  resetOutputQuads,
  saveCalibrationState,
  toggleSurfaceOnOutput,
} from '../projection/homography';
import {
  advanceLoopProgress,
  buildBeatTimeline,
  computeShowCueStep,
  computeSpeakerLiveLevels,
  resolveCompareSwapTarget,
} from './cueEngine';
import {
  AudioLevelsMap,
  AudioOutputMode,
  CompareCountriesState,
  ExperienceContextValue,
  ExperienceCountry,
  ExperienceLayersState,
  ExperiencePlaybackState,
  Lang,
  LanPeerInfo,
  LiveFrameSnapshot,
  LiveNoteEvent,
  MissionPhase,
  PILOT_COUNTRY_IDS,
  ProjectorOutId,
  RoomDimensions,
  ShowCueMode,
  SoloableLayerId,
  SurfaceId,
  VISUAL_LAYER_ORDER,
  VisualLayerId,
} from './types';

export interface AudioAdminContextValue {
  speakerCalibration: AudioCalibrationState;
  calibTestMode: CalibrationTestMode;
  outputDevices: AudioDeviceOption[];
  outputSupportStatus: AudioOutputSupportStatus;
  isSetSinkIdSupported: boolean;
  isolatedSpeakerSlot: SpeakerSlotId | null;
  setIsolatedSpeakerSlot: (slot: SpeakerSlotId | null) => void;
  unlockAudioContext: () => boolean;
  unlockOutputDevices: () => Promise<AudioDeviceOption[]>;
  updateSpeakerConfig: (speakerId: SpeakerSlotId, patch: Partial<SpeakerSlotConfig>) => void;
  setReferenceSpeaker: (speakerId: SpeakerSlotId) => void;
  resetSpeakerCalibration: () => void;
  startPinkNoiseSingle: (speakerId: SpeakerSlotId) => void;
  startPinkNoiseAB: (targetSpeakerId: SpeakerSlotId) => void;
  startDelayClickTest: (targetSpeakerId: SpeakerSlotId) => void;
  stopCalibrationSignal: () => void;
  refreshOutputDevices: () => Promise<void>;
}

export interface ProjectionAdminContextValue {
  projectionState: ProjectionCalibrationState;
  updateProjectionState: (next: ProjectionCalibrationState) => void;
  selectProjectionPreset: (preset: Exclude<ProjectionTopologyPreset, 'custom'>) => void;
  toggleOutputSurface: (outId: ProjectorOutId, surfaceId: SurfaceId) => void;
  updateOutputConfig: (outId: ProjectorOutId, patch: Partial<ProjectorOutputConfig>) => void;
  updateSurfaceQuad: (key: CalibrationSurfaceKey, quad: QuadCorners) => void;
  resetSingleOutputQuads: (outId: ProjectorOutId) => void;
  resetAllProjectionQuads: () => void;
  triggerIdentifyOutputs: (durationMs?: number) => void;
  toggleGlobalBlackout: () => void;
  toggleGlobalShowGrid: () => void;
}

interface CountryMetaTuning {
  bpm: number;
  keyRoot: string;
  keyRootPt: string;
  modeNamePt: string;
  modeNameEn: string;
  chords: string[];
  windMeanSpeed: number;
}

interface CountryMetaBeatEvent {
  beat: number;
  layer: LiveNoteEvent['layer'];
  source_x: number;
  source_y: number;
  pitch: number;
  velocity: number;
  isAnchor: boolean;
}

interface CountryMetaJson {
  id: string;
  hasAudioStems?: boolean;
  audioFormat?: 'ogg' | 'm4a' | 'mp3' | 'wav';
  session: {
    region: CountryMetaTuning;
    base: CountryMetaTuning;
  };
  telemetrySummary?: {
    lightningHotspotCount?: number;
  };
  beatEvents?: CountryMetaBeatEvent[];
}

const SYNC_CHANNEL_NAME = 'earth-jukebox-sync-v1';
const countryMetaCache = new Map<string, CountryMetaJson>();
const ROOM_STORAGE_KEY = 'earth-jukebox-room-dims-v1';
const STORY_STEP_COUNT = 4;

interface PilotMusicalProfile {
  regionBpm: number;
  regionKeyRoot: string;
  regionKeyRootPt: string;
  modeNamePt: string;
  modeNameEn: string;
  chords: string[];
  windMeanSpeed: number;
}

const PILOT_PROFILES: Record<string, PilotMusicalProfile> = {
  '076': {
    // Brasil — clima quente tropical + alta incidência de raios ISS na Amazônia/Centro-Oeste
    regionBpm: 98,
    regionKeyRoot: 'D',
    regionKeyRootPt: 'Ré',
    modeNamePt: 'Mixolídio Tropical',
    modeNameEn: 'Tropical Mixolydian',
    chords: ['Dadd9', 'Am7', 'Gmaj7', 'Asus4'],
    windMeanSpeed: 7.4,
  },
  '818': {
    // Egito — calor árido intenso (BPM alto) + ventos do Saara/Mar Vermelho + raríssimos raios
    regionBpm: 106,
    regionKeyRoot: 'E',
    regionKeyRootPt: 'Mi',
    modeNamePt: 'Frígio Solar Árido',
    modeNameEn: 'Arid Solar Phrygian',
    chords: ['Esus4', 'Fmaj7', 'Dm7', 'Esus2'],
    windMeanSpeed: 11.2,
  },
  '156': {
    // China — alta densidade urbana/industrial de NO2 e CO no leste + contrastes térmicos
    regionBpm: 92,
    regionKeyRoot: 'G',
    regionKeyRootPt: 'Sol',
    modeNamePt: 'Dórico Atmosférico',
    modeNameEn: 'Atmospheric Dorian',
    chords: ['Gm9', 'Csus2', 'Eb6', 'Fadd9'],
    windMeanSpeed: 9.8,
  },
  '840': {
    // Estados Unidos
    regionBpm: 92,
    regionKeyRoot: 'G',
    regionKeyRootPt: 'Sol',
    modeNamePt: 'Dórico Continental',
    modeNameEn: 'Continental Dorian',
    chords: ['Gm9', 'Csus2', 'Eb6', 'Fadd9'],
    windMeanSpeed: 10.8,
  },
  '484': {
    // México
    regionBpm: 102,
    regionKeyRoot: 'E',
    regionKeyRootPt: 'Mi',
    modeNamePt: 'Lídio Solar',
    modeNameEn: 'Solar Lydian',
    chords: ['Emaj9', 'F#6', 'C#m7', 'Bsus4'],
    windMeanSpeed: 8.6,
  },
};

function inferFallbackProfile(country: ExperienceCountry | null): PilotMusicalProfile {
  if (!country) {
    return {
      regionBpm: 90,
      regionKeyRoot: 'A',
      regionKeyRootPt: 'Lá',
      modeNamePt: 'Eólio Neutro',
      modeNameEn: 'Neutral Aeolian',
      chords: ['Am9', 'Fmaj7', 'Cmaj7', 'Gsus4'],
      windMeanSpeed: 6.5,
    };
  }
  const pilot = PILOT_PROFILES[country.id];
  if (pilot) return pilot;

  const absLat = Math.abs(country.lat);
  const regionBpm = Math.round(Math.max(66, Math.min(110, 108 - absLat * 0.58)));
  const isCold = absLat > 46;
  return {
    regionBpm,
    regionKeyRoot: isCold ? 'F#' : 'C',
    regionKeyRootPt: isCold ? 'Fá#' : 'Dó',
    modeNamePt: isCold ? 'Eólio Boreal' : 'Lídio Equatorial',
    modeNameEn: isCold ? 'Boreal Aeolian' : 'Equatorial Lydian',
    chords: isCold ? ['F#m9', 'Dmaj7', 'Aadd9', 'Esus4'] : ['Cmaj9', 'G6', 'Am7', 'Fmaj7#11'],
    windMeanSpeed: Number((5.2 + (absLat / 90) * 9.4).toFixed(1)),
  };
}

export const DEFAULT_ROOM_DIMENSIONS: RoomDimensions = {
  leftWall: { widthCm: 360, heightCm: 270 },
  rightWall: { widthCm: 360, heightCm: 270 },
  ceiling: { widthCm: 360, heightCm: 360 },
};

function loadInitialRoomDimensions(): RoomDimensions {
  if (typeof window === 'undefined') return DEFAULT_ROOM_DIMENSIONS;
  try {
    const raw = window.localStorage.getItem(ROOM_STORAGE_KEY);
    if (!raw) return DEFAULT_ROOM_DIMENSIONS;
    const parsed = JSON.parse(raw) as Partial<RoomDimensions>;
    if (
      parsed.leftWall?.widthCm &&
      parsed.rightWall?.widthCm &&
      parsed.ceiling?.widthCm
    ) {
      return parsed as RoomDimensions;
    }
  } catch {
    // ignore storage errors
  }
  return DEFAULT_ROOM_DIMENSIONS;
}

export const DEFAULT_LAYERS_STATE: ExperienceLayersState = {
  melody: { enabled: true, gain: 0.88, solo: false, sparkleEnabled: true },
  chords: { enabled: true, gain: 0.8, solo: false },
  bass: { enabled: true, gain: 0.82, solo: false },
  wind: { enabled: true, gain: 0.55, wetMix: 0.55, solo: false },
  temperature: { enabled: true, gain: 1.0, solo: false, tuningMode: 'region' },
};

function toExperienceCountry(
  entry: CountryEntry,
  pilotSet: ReadonlySet<string>
): ExperienceCountry {
  return {
    id: entry.id,
    namePt: entry.namePt,
    nameEn: entry.nameEn,
    regionPt: entry.regionPt,
    regionEn: entry.regionEn,
    hemispherePt: entry.hemispherePt,
    hemisphereEn: entry.hemisphereEn,
    lon: entry.lon,
    lat: entry.lat,
    lonSpan: entry.lonSpan,
    latSpan: entry.latSpan,
    idealDistance: entry.idealDistance,
    bbox: entry.bbox,
    isPilot: pilotSet.has(entry.id),
  };
}

function buildCountryPngUrls(countryId: string): Record<VisualLayerId, string> {
  const urls = {} as Record<VisualLayerId, string>;
  for (const layerId of VISUAL_LAYER_ORDER) {
    urls[layerId] = resolveAssetUrl(`/countries/${countryId}/${layerId}.png`);
  }
  return urls;
}

interface SyncPayload {
  senderId: string;
  countryId: string | null;
  lang: Lang;
  storyStep: number;
  missionPhase?: MissionPhase;
  showCueMode?: ShowCueMode;
  loopSingleBar?: number | null;
  compareCountries?: CompareCountriesState;
  audioMode: AudioOutputMode;
  masterGain: number;
  layers: ExperienceLayersState;
  isPlaying: boolean;
  progress01: number;
  roomDimensions: RoomDimensions;
}

const ExperienceContext = createContext<ExperienceContextValue | null>(null);
const AudioAdminContext = createContext<AudioAdminContextValue | null>(null);
const ProjectionAdminContext = createContext<ProjectionAdminContextValue | null>(null);

type RemoteCalibSignalCommand =
  | { action: 'stop' }
  | { action: 'pink-single'; speakerId: SpeakerSlotId }
  | { action: 'pink-ab'; targetSpeakerId: SpeakerSlotId }
  | { action: 'delay-click'; targetSpeakerId: SpeakerSlotId };

function detectInitialSpeakerSlotFromUrl(): SpeakerSlotId | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const view = params.get('view')?.toLowerCase() ?? '';
  if (view !== 'audio-node') return null;
  const spk = Number(params.get('spk') ?? '1');
  const idx: 1 | 2 | 3 = spk === 2 ? 2 : spk === 3 ? 3 : 1;
  return speakerIndexToSlotId(idx);
}

function detectCurrentRole(): string {
  if (typeof window === 'undefined') return 'demo';
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('view')?.toLowerCase() ?? '';
  if (raw === 'admin' || raw === 'setup') return 'admin';
  if (raw === 'projector') {
    const out = params.get('out') ?? '1';
    return `projector-${out}`;
  }
  if (raw === 'audio-node') {
    const spk = params.get('spk') ?? '1';
    return `audio-node-C${spk}`;
  }
  if (raw === 'controller' || raw === 'simulator' || raw === 'demo') return raw;
  return 'demo';
}

function isLocalLanHost(): boolean {
  if (typeof window === 'undefined') return false;
  const { protocol, hostname } = window.location;
  if (protocol !== 'http:') return false;
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('10.') ||
    hostname.startsWith('172.') ||
    hostname.endsWith('.local')
  );
}

export const ExperienceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const senderIdRef = useRef<string>(`node-${Math.random().toString(36).slice(2, 9)}`);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const calibBroadcastRef = useRef<BroadcastChannel | null>(null);
  const projBroadcastRef = useRef<BroadcastChannel | null>(null);
  const suppressBroadcastRef = useRef(false);

  const [localAudioMuted, setLocalAudioMutedState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const raw = new URLSearchParams(window.location.search).get('view')?.toLowerCase() ?? '';
    return raw === 'projector'; // Janelas de projetor iniciam mudas por padrão para não vazar áudio ruim via HDMI
  });
  const [audioSourceKind, setAudioSourceKind] = useState<'stems' | 'meta-synth'>('meta-synth');
  const [lanConnected, setLanConnected] = useState<boolean>(false);
  const [lanClients, setLanClients] = useState<LanPeerInfo[]>([]);

  const [projectionState, setProjectionState] =
    useState<ProjectionCalibrationState>(loadCalibrationState);

  const [speakerCalibration, setSpeakerCalibration] =
    useState<AudioCalibrationState>(loadAudioCalibration);
  const [isolatedSpeakerSlot, setIsolatedSpeakerSlotState] = useState<SpeakerSlotId | null>(
    detectInitialSpeakerSlotFromUrl
  );
  const [calibTestMode, setCalibTestMode] = useState<CalibrationTestMode>({ kind: 'off' });
  const [outputDevices, setOutputDevices] = useState<AudioDeviceOption[]>([]);

  const audioEngineRef = useRef<SpatialAudioEngine | null>(null);
  if (!audioEngineRef.current && typeof window !== 'undefined') {
    const eng = new SpatialAudioEngine(speakerCalibration);
    eng.setIsolatedSpeakerSlot(isolatedSpeakerSlot);
    eng.setOnCalibrationModeChange((mode) => setCalibTestMode(mode));
    audioEngineRef.current = eng;
  }

  const world = useMemo(() => loadWorldCountries(), []);
  const pilotSet = useMemo<ReadonlySet<string>>(() => new Set(PILOT_COUNTRY_IDS), []);

  const { countryMap, availableCountryIds, allCountries } = useMemo(() => {
    const map = new Map<string, ExperienceCountry>();
    const available = new Set<string>();
    const list: ExperienceCountry[] = [];
    for (const c of world.countries) {
      const ec = toExperienceCountry(c, pilotSet);
      map.set(c.id, ec);
      if (!c.isMinorUninhabited) {
        available.add(c.id);
        list.push(ec);
      }
    }
    list.sort((a, b) => {
      if (a.isPilot !== b.isPilot) return a.isPilot ? -1 : 1;
      return a.namePt.localeCompare(b.namePt, 'pt-BR');
    });
    return {
      countryMap: map,
      availableCountryIds: available as ReadonlySet<string>,
      allCountries: list as ReadonlyArray<ExperienceCountry>,
    };
  }, [pilotSet, world.countries]);

  const [selectedCountryId, setSelectedCountryId] = useState<string | null>('076');
  const [lang, setLangState] = useState<Lang>('pt');
  const [storyStep, setStoryStepState] = useState<number>(0);
  const [missionPhase, setMissionPhaseState] = useState<MissionPhase>('idle');
  const [showCueMode, setShowCueModeState] = useState<ShowCueMode>('free-loop');
  const [loopSingleBar, setLoopSingleBarState] = useState<number | null>(null);
  const [compareCountries, setCompareCountriesState] = useState<CompareCountriesState>({
    slotA: '076',
    slotB: '818',
  });
  const [scrubPreviewActive, setScrubPreviewActive] = useState<boolean>(false);
  const scrubTimerRef = useRef<number | null>(null);
  const [seekSyncNonce, setSeekSyncNonce] = useState<number>(0);
  const [audioMode, setAudioModeState] = useState<AudioOutputMode>('hrtf');
  const [masterGain, setMasterGainState] = useState<number>(0.9);
  const [layers, setLayers] = useState<ExperienceLayersState>(DEFAULT_LAYERS_STATE);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [progress01, setProgress01] = useState<number>(0);
  const [roomDimensions, setRoomDimensionsState] = useState<RoomDimensions>(
    loadInitialRoomDimensions
  );

  const country = useMemo(
    () => (selectedCountryId ? countryMap.get(selectedCountryId) ?? null : null),
    [countryMap, selectedCountryId]
  );

  const [countryMeta, setCountryMeta] = useState<CountryMetaJson | null>(null);

  useEffect(() => {
    if (!country) {
      setCountryMeta(null);
      return;
    }
    const cached = countryMetaCache.get(country.id);
    if (cached) {
      setCountryMeta(cached);
      return;
    }
    setCountryMeta(null);
    if (
      typeof window === 'undefined' ||
      typeof window.fetch !== 'function' ||
      !window.location?.origin ||
      window.location.origin === 'null'
    ) {
      return;
    }

    let cancelled = false;
    const url = resolveAssetUrl(`/countries/${country.id}/meta.json`);
    window
      .fetch(url)
      .then((res) => (res.ok ? (res.json() as Promise<CountryMetaJson>) : null))
      .then((json) => {
        if (cancelled || !json || !json.session?.region) return;
        countryMetaCache.set(country.id, json);
        setCountryMeta(json);
      })
      .catch(() => {
        // Fallback profile remains active when country meta.json has not been generated yet
      });

    return () => {
      cancelled = true;
    };
  }, [country]);

  const fallbackProfile = useMemo(() => inferFallbackProfile(country), [country]);
  const isRegionTuning = layers.temperature.enabled && layers.temperature.tuningMode === 'region';
  const activeTuning = countryMeta
    ? isRegionTuning
      ? countryMeta.session.region
      : countryMeta.session.base
    : null;

  const bpm = activeTuning ? activeTuning.bpm : isRegionTuning ? fallbackProfile.regionBpm : 90;
  const keyRoot = activeTuning
    ? activeTuning.keyRoot
    : isRegionTuning
      ? fallbackProfile.regionKeyRoot
      : 'A';
  const keyRootPt = activeTuning
    ? activeTuning.keyRootPt
    : isRegionTuning
      ? fallbackProfile.regionKeyRootPt
      : 'Lá';
  const modeNamePt = activeTuning
    ? activeTuning.modeNamePt
    : isRegionTuning
      ? fallbackProfile.modeNamePt
      : 'Referência Neutra (90 BPM)';
  const modeNameEn = activeTuning
    ? activeTuning.modeNameEn
    : isRegionTuning
      ? fallbackProfile.modeNameEn
      : 'Neutral Reference (90 BPM)';
  const windMeanSpeed = activeTuning ? activeTuning.windMeanSpeed : fallbackProfile.windMeanSpeed;
  const chordList = activeTuning ? activeTuning.chords : fallbackProfile.chords;

  const totalBars = 8;
  const totalBeats = totalBars * 4;
  const durationSeconds = Number(((totalBeats * 60) / bpm).toFixed(2));

  const exactBeat = progress01 * totalBeats;
  const bar = Math.min(totalBars - 1, Math.floor(exactBeat / 4));
  const beat = Math.floor(exactBeat % 4);
  const activeChord = chordList[bar % Math.max(1, chordList.length)] ?? 'Am7';

  const playback: ExperiencePlaybackState = useMemo(
    () => ({
      isPlaying,
      bar,
      beat,
      totalBeats,
      totalBars,
      progress: progress01,
      durationSeconds,
      bpm,
      keyRoot,
      keyRootPt,
      modeNamePt,
      modeNameEn,
      activeChord,
      windMeanSpeed,
    }),
    [
      activeChord,
      bar,
      beat,
      bpm,
      durationSeconds,
      isPlaying,
      keyRoot,
      keyRootPt,
      modeNameEn,
      modeNamePt,
      progress01,
      totalBars,
      totalBeats,
      windMeanSpeed,
    ]
  );

  const pngUrls = useMemo(
    () => (country ? buildCountryPngUrls(country.id) : null),
    [country]
  );

  const liveProgressRef = useRef(0);
  liveProgressRef.current = progress01;

  useEffect(() => {
    if (!isPlaying) return;
    let raf = 0;
    let prevMs = performance.now();
    let lastCommittedBeat = -1;

    const tick = (nowMs: number) => {
      const dtSec = Math.min(0.1, Math.max(0, (nowMs - prevMs) / 1000));
      prevMs = nowMs;
      const nextProg = advanceLoopProgress(
        liveProgressRef.current,
        dtSec,
        durationSeconds,
        loopSingleBar,
        totalBars
      );
      liveProgressRef.current = nextProg;

      const currentQuarter = Math.floor(nextProg * totalBeats * 2);
      if (currentQuarter !== lastCommittedBeat) {
        lastCommittedBeat = currentQuarter;
        setProgress01(nextProg);
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [durationSeconds, isPlaying, loopSingleBar, totalBars, totalBeats]);

  // Automação de cenas/camadas quando um modo de roteiro/final do Cue Player está selecionado
  useEffect(() => {
    if (showCueMode === 'free-loop') return;
    const step = computeShowCueStep(showCueMode, bar, layersRef.current);
    if (!step) return;
    setStoryStepState(step.storyStep);
    setLayers(step.layers);
  }, [bar, showCueMode]);

  const layersRef = useRef(layers);
  layersRef.current = layers;
  const masterGainRef = useRef(masterGain);
  masterGainRef.current = masterGain;
  const playbackRef = useRef(playback);
  playbackRef.current = playback;

  const makeNoteEvent = (
    layer: LiveNoteEvent['layer'],
    sx: number,
    sy: number,
    pitch: number,
    velocity: number,
    isAnchor: boolean
  ): LiveNoteEvent => ({
    layer,
    source_x: sx,
    source_y: sy,
    sourceX: sx,
    sourceY: sy,
    pitch,
    velocity,
    isAnchor,
  });

  const countryMetaRef = useRef(countryMeta);
  countryMetaRef.current = countryMeta;

  const computeSyntheticNotes = useCallback(
    (prog: number): LiveNoteEvent[] => {
      const l = layersRef.current;
      const anySolo = l.melody.solo || l.chords.solo || l.bass.solo;
      const melodyAudible = l.melody.enabled && (!anySolo || l.melody.solo);
      const chordsAudible = l.chords.enabled && (!anySolo || l.chords.solo);
      const bassAudible = l.bass.enabled && (!anySolo || l.bass.solo);

      const meta = countryMetaRef.current;
      if (meta?.beatEvents && meta.beatEvents.length > 0) {
        const beatIdx = Math.min(31, Math.max(0, Math.floor(prog * 32) % 32));
        const realEvents: LiveNoteEvent[] = [];
        for (const ev of meta.beatEvents) {
          if (ev.beat !== beatIdx) continue;
          if (ev.layer === 'melody' && !melodyAudible) continue;
          if (ev.layer === 'sparkle' && (!melodyAudible || !l.melody.sparkleEnabled)) continue;
          if (ev.layer === 'chords' && !chordsAudible) continue;
          if (ev.layer === 'bass' && !bassAudible) continue;
          realEvents.push(
            makeNoteEvent(
              ev.layer,
              ev.source_x,
              ev.source_y,
              ev.pitch,
              ev.velocity,
              ev.isAnchor
            )
          );
        }
        return realEvents;
      }

      const events: LiveNoteEvent[] = [];
      const phase = prog * Math.PI * 2;
      if (melodyAudible) {
        events.push(
          makeNoteEvent(
            'melody',
            Number((0.5 + 0.34 * Math.cos(phase * 3)).toFixed(3)),
            Number((0.5 + 0.3 * Math.sin(phase * 2)).toFixed(3)),
            74,
            0.82,
            beat === 0
          )
        );
        if (l.melody.sparkleEnabled) {
          events.push(
            makeNoteEvent(
              'sparkle',
              Number((0.5 - 0.36 * Math.sin(phase * 4)).toFixed(3)),
              Number((0.56 + 0.28 * Math.cos(phase * 3)).toFixed(3)),
              86,
              0.64,
              false
            )
          );
        }
      }
      if (chordsAudible) {
        events.push(makeNoteEvent('chords', 0.5, 0.45, 62, 0.7, true));
      }
      if (bassAudible) {
        events.push(makeNoteEvent('bass', 0.5, 0.2, 38, 0.88, true));
      }
      return events;
    },
    [beat]
  );

  const computeAudioLevels = useCallback(
    (active: boolean, pulseFactor: number): AudioLevelsMap => {
      const l = layersRef.current;
      const anySolo = l.melody.solo || l.chords.solo || l.bass.solo;
      const melVu =
        active && l.melody.enabled && (!anySolo || l.melody.solo)
          ? l.melody.gain * pulseFactor
          : 0;
      const spkVu = melVu > 0 && l.melody.sparkleEnabled ? melVu * 0.78 : 0;
      const chdVu =
        active && l.chords.enabled && (!anySolo || l.chords.solo)
          ? l.chords.gain * (0.55 + 0.25 * pulseFactor)
          : 0;
      const basVu =
        active && l.bass.enabled && (!anySolo || l.bass.solo)
          ? l.bass.gain * (0.68 + 0.3 * pulseFactor)
          : 0;
      const wndVu =
        active && l.wind.enabled ? l.wind.wetMix * Math.max(melVu, chdVu, basVu) * 0.85 : 0;
      const masterVu = Math.min(
        1,
        Math.max(melVu, chdVu, basVu) * masterGainRef.current
      );
      return {
        melody: melVu,
        sparkle: spkVu,
        chords: chdVu,
        bass: basVu,
        wind: wndVu,
        master: masterVu,
      };
    },
    []
  );

  const isLiveOrScrubbing = isPlaying || scrubPreviewActive;

  const beatTimeline = useMemo(
    () => buildBeatTimeline(countryMeta?.beatEvents),
    [countryMeta]
  );

  const liveEvents = useMemo(
    () => (isLiveOrScrubbing ? computeSyntheticNotes(progress01) : []),
    [computeSyntheticNotes, countryMeta, isLiveOrScrubbing, progress01]
  );

  const audioLevels = useMemo<AudioLevelsMap>(() => {
    const beatPulse = isLiveOrScrubbing ? (beat % 2 === 0 ? 0.92 : 0.72) : 0;
    return computeAudioLevels(isLiveOrScrubbing, beatPulse);
  }, [beat, computeAudioLevels, isLiveOrScrubbing, layers, masterGain]);

  const speakerLiveLevels = useMemo(
    () =>
      computeSpeakerLiveLevels({
        events: liveEvents,
        audioLevels,
        masterGain,
        progress01,
        speakerCalibration,
      }),
    [audioLevels, liveEvents, masterGain, progress01, speakerCalibration]
  );

  const getLiveFrame = useCallback((): LiveFrameSnapshot => {
    const l = layersRef.current;
    const pb = playbackRef.current;
    const prog = liveProgressRef.current;
    const active = pb.isPlaying || scrubPreviewActive;
    const nowSec = typeof performance !== 'undefined' ? performance.now() / 1000 : 0;
    const pulse = active ? 0.62 + 0.38 * Math.abs(Math.sin(nowSec * (pb.bpm / 30) * Math.PI)) : 0;
    const vu = computeAudioLevels(active, pulse);

    return {
      currentTime: prog * pb.durationSeconds,
      progress01: prog,
      vu,
      activeNotes: active ? computeSyntheticNotes(prog) : [],
      lightningCount: vu.melody > 0 ? (l.melody.sparkleEnabled ? 12 : 5) : 0,
    };
  }, [computeAudioLevels, computeSyntheticNotes, scrubPreviewActive]);

  const applyIncomingSync = useCallback((data: SyncPayload) => {
    if (!data || data.senderId === senderIdRef.current) return;
    suppressBroadcastRef.current = true;
    setSelectedCountryId(data.countryId);
    setLangState(data.lang);
    setStoryStepState(data.storyStep ?? 0);
    if (data.missionPhase) setMissionPhaseState(data.missionPhase);
    if (data.showCueMode) setShowCueModeState(data.showCueMode);
    if (data.loopSingleBar !== undefined) setLoopSingleBarState(data.loopSingleBar);
    if (data.compareCountries) setCompareCountriesState(data.compareCountries);
    setAudioModeState(data.audioMode);
    setMasterGainState(data.masterGain);
    setLayers(data.layers);
    setIsPlaying(data.isPlaying);
    setProgress01(data.progress01);
    liveProgressRef.current = data.progress01;
    setRoomDimensionsState(data.roomDimensions);
    queueMicrotask(() => {
      suppressBroadcastRef.current = false;
    });
  }, []);

  const applyRemoteCalibSignal = useCallback((cmd: RemoteCalibSignalCommand) => {
    const eng = audioEngineRef.current;
    if (!eng) return;
    if (cmd.action === 'stop') {
      eng.stopCalibrationSignal();
    } else if (cmd.action === 'pink-single') {
      eng.startPinkNoiseSingle(cmd.speakerId);
    } else if (cmd.action === 'pink-ab') {
      eng.startPinkNoiseAB(cmd.targetSpeakerId);
    } else if (cmd.action === 'delay-click') {
      eng.startDelayClickTest(cmd.targetSpeakerId);
    }
  }, []);

  // Multi-tab 1-PC sync via BroadcastChannel
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const ch = new BroadcastChannel(SYNC_CHANNEL_NAME);
    channelRef.current = ch;
    ch.onmessage = (ev: MessageEvent<SyncPayload>) => applyIncomingSync(ev.data);

    const calibCh = new BroadcastChannel(SPEAKER_CALIBRATION_CHANNEL);
    calibBroadcastRef.current = calibCh;
    calibCh.onmessage = (
      ev: MessageEvent<AudioCalibrationState | { type: 'calib-signal'; cmd: RemoteCalibSignalCommand }>
    ) => {
      const data = ev.data;
      if (!data || typeof data !== 'object') return;
      if ('type' in data && data.type === 'calib-signal' && data.cmd) {
        applyRemoteCalibSignal(data.cmd);
      } else if ('speakers' in data && data.speakers) {
        setSpeakerCalibration(data);
        saveAudioCalibration(data);
        audioEngineRef.current?.updateSpeakerCalibration(data);
      }
    };

    const projCh = new BroadcastChannel(CALIBRATION_CHANNEL_NAME);
    projBroadcastRef.current = projCh;
    projCh.onmessage = (ev: MessageEvent<ProjectionCalibrationState>) => {
      if (isProjectionStateValid(ev.data)) {
        setProjectionState(ev.data);
        saveCalibrationState(ev.data);
      }
    };

    return () => {
      ch.close();
      calibCh.close();
      projCh.close();
      channelRef.current = null;
      calibBroadcastRef.current = null;
      projBroadcastRef.current = null;
    };
  }, [applyIncomingSync, applyRemoteCalibSignal]);

  // Multi-Device Wi-Fi LAN Sync via /ws-earth-sync (Offline-First)
  useEffect(() => {
    if (!isLocalLanHost() || typeof WebSocket === 'undefined') return;
    let disposed = false;
    let reconnectTimer: number | null = null;

    const connect = () => {
      if (disposed) return;
      const role = detectCurrentRole();
      const wsUrl = `ws://${window.location.host}/ws-earth-sync?role=${encodeURIComponent(role)}`;
      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (disposed) return;
          setLanConnected(true);
          ws.send(JSON.stringify({ type: 'hello', role }));
        };

        ws.onmessage = (ev) => {
          if (typeof ev.data !== 'string') return;
          try {
            const msg = JSON.parse(ev.data) as {
              type?: string;
              payload?: unknown;
              clients?: LanPeerInfo[];
              cmd?: RemoteCalibSignalCommand;
            };
            if (msg.type === 'sync' && msg.payload) {
              applyIncomingSync(msg.payload as SyncPayload);
            } else if (msg.type === 'projection' && isProjectionStateValid(msg.payload)) {
              setProjectionState(msg.payload);
              saveCalibrationState(msg.payload);
            } else if (
              msg.type === 'speaker-calib' &&
              msg.payload &&
              typeof msg.payload === 'object' &&
              'speakers' in (msg.payload as AudioCalibrationState)
            ) {
              const calib = msg.payload as AudioCalibrationState;
              setSpeakerCalibration(calib);
              saveAudioCalibration(calib);
              audioEngineRef.current?.updateSpeakerCalibration(calib);
            } else if (msg.type === 'calib-signal' && msg.cmd) {
              applyRemoteCalibSignal(msg.cmd);
            } else if (msg.type === 'presence' && Array.isArray(msg.clients)) {
              setLanClients(msg.clients);
            }
          } catch {
            // ignore malformed JSON
          }
        };

        ws.onclose = () => {
          setLanConnected(false);
          wsRef.current = null;
          if (!disposed) {
            reconnectTimer = window.setTimeout(connect, 2500);
          }
        };

        ws.onerror = () => {
          ws.close();
        };
      } catch {
        // ignore WebSocket creation failure in test environments
      }
    };

    connect();
    return () => {
      disposed = true;
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [applyIncomingSync, applyRemoteCalibSignal]);

  useEffect(() => {
    if (suppressBroadcastRef.current) return;
    const payload: SyncPayload = {
      senderId: senderIdRef.current,
      countryId: selectedCountryId,
      lang,
      storyStep,
      missionPhase,
      showCueMode,
      loopSingleBar,
      compareCountries,
      audioMode,
      masterGain,
      layers,
      isPlaying,
      progress01: liveProgressRef.current,
      roomDimensions,
    };
    try {
      channelRef.current?.postMessage(payload);
    } catch {
      // ignore closed channel errors
    }
    try {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'sync', payload }));
      }
    } catch {
      // ignore socket send errors
    }
  }, [
    audioMode,
    compareCountries,
    isPlaying,
    lang,
    layers,
    loopSingleBar,
    masterGain,
    missionPhase,
    roomDimensions,
    seekSyncNonce,
    selectedCountryId,
    showCueMode,
    storyStep,
  ]);

  // --- Sincronização do Motor Web Audio 8D (Stems Gapless + Síntese meta.json) ---
  useEffect(() => {
    const eng = audioEngineRef.current;
    if (!eng) return;
    eng.setMasterGain(localAudioMuted ? 0 : masterGain);
  }, [localAudioMuted, masterGain]);

  useEffect(() => {
    audioEngineRef.current?.setAudioMode(audioMode);
  }, [audioMode]);

  useEffect(() => {
    audioEngineRef.current?.updateWindParameters(windMeanSpeed, layers);
  }, [layers, windMeanSpeed]);

  useEffect(() => {
    const eng = audioEngineRef.current;
    if (!eng || !country || localAudioMuted) {
      eng?.stopStemPlayback();
      return;
    }
    const tuning = isRegionTuning ? 'region' : 'base';
    let cancelled = false;

    void eng
      .tryLoadPreRenderedStems(
        country.id,
        tuning,
        countryMeta?.hasAudioStems,
        countryMeta?.audioFormat ?? 'ogg'
      )
      .then((loaded) => {
        if (cancelled) return;
        setAudioSourceKind(loaded ? 'stems' : 'meta-synth');
        if (loaded && isPlaying) {
          eng.startStemPlayback(liveProgressRef.current, layersRef.current);
        } else if (!loaded) {
          eng.stopStemPlayback();
        }
      });

    return () => {
      cancelled = true;
    };
  }, [country, countryMeta, isPlaying, isRegionTuning, localAudioMuted]);

  const currentBeat32 = Math.min(31, Math.max(0, Math.floor(progress01 * 32) % 32));
  const prevTriggeredBeatRef = useRef<number>(-1);

  useEffect(() => {
    const eng = audioEngineRef.current;
    if (!eng) return;
    if (!isPlaying || localAudioMuted) {
      prevTriggeredBeatRef.current = -1;
      eng.stopStemPlayback();
      return;
    }
    if (eng.isUsingPreRenderedStems()) return;

    if (prevTriggeredBeatRef.current !== currentBeat32) {
      prevTriggeredBeatRef.current = currentBeat32;
      eng.triggerBeatStep({
        beatIndex: currentBeat32,
        bpm,
        activeChord,
        keyRoot,
        events: computeSyntheticNotes(currentBeat32 / 32),
        layers: layersRef.current,
      });
    }
  }, [
    activeChord,
    bpm,
    computeSyntheticNotes,
    currentBeat32,
    isPlaying,
    keyRoot,
    localAudioMuted,
  ]);

  const selectCountry = useCallback(
    (countryId: string | null) => {
      if (countryId && !availableCountryIds.has(countryId)) return;
      setSelectedCountryId(countryId);
      setProgress01(0);
      liveProgressRef.current = 0;
      prevTriggeredBeatRef.current = -1;
      setSeekSyncNonce((n) => n + 1);
    },
    [availableCountryIds]
  );

  const selectCountryPreserveBeat = useCallback(
    (countryId: string) => {
      if (!availableCountryIds.has(countryId)) return;
      prevTriggeredBeatRef.current = -1;
      setSelectedCountryId(countryId);
      setSeekSyncNonce((n) => n + 1);
    },
    [availableCountryIds]
  );

  const setCompareSlot = useCallback(
    (slot: 'A' | 'B', countryId: string) => {
      if (!availableCountryIds.has(countryId)) return;
      setCompareCountriesState((prev) =>
        slot === 'A' ? { ...prev, slotA: countryId } : { ...prev, slotB: countryId }
      );
    },
    [availableCountryIds]
  );

  const swapCompareCountries = useCallback(() => {
    const nextId = resolveCompareSwapTarget(selectedCountryId, compareCountries);
    if (!availableCountryIds.has(nextId)) return;
    prevTriggeredBeatRef.current = -1;
    setSelectedCountryId(nextId);
    setSeekSyncNonce((n) => n + 1);
  }, [availableCountryIds, compareCountries, selectedCountryId]);

  const setShowCueMode = useCallback((mode: ShowCueMode) => {
    setShowCueModeState(mode);
    if (mode === 'free-loop') {
      setLayers(DEFAULT_LAYERS_STATE);
    } else {
      const step = computeShowCueStep(mode, playbackRef.current.bar, layersRef.current);
      if (step) {
        setStoryStepState(step.storyStep);
        setLayers(step.layers);
      }
    }
  }, []);

  const toggleEye = useCallback((layerId: VisualLayerId) => {
    setLayers((prev) => {
      if (layerId === 'temperature') {
        const nextEnabled = !prev.temperature.enabled;
        return {
          ...prev,
          temperature: {
            ...prev.temperature,
            enabled: nextEnabled,
            tuningMode: nextEnabled ? 'region' : 'base',
          },
        };
      }
      return {
        ...prev,
        [layerId]: {
          ...prev[layerId],
          enabled: !prev[layerId].enabled,
        },
      };
    });
  }, []);

  const toggleSparkle = useCallback(() => {
    setLayers((prev) => ({
      ...prev,
      melody: {
        ...prev.melody,
        sparkleEnabled: !prev.melody.sparkleEnabled,
      },
    }));
  }, []);

  const setAllLayersEnabled = useCallback((enabled: boolean) => {
    setLayers((prev) => ({
      melody: { ...prev.melody, enabled, solo: false },
      chords: { ...prev.chords, enabled, solo: false },
      temperature: { ...prev.temperature, enabled },
      bass: { ...prev.bass, enabled, solo: false },
      wind: { ...prev.wind, enabled },
    }));
  }, []);

  const setLayerGain = useCallback((layerId: VisualLayerId, gainOrWet: number) => {
    const clamped = Math.min(1, Math.max(0, gainOrWet));
    setLayers((prev) => {
      if (layerId === 'temperature') {
        return prev;
      }
      if (layerId === 'wind') {
        return {
          ...prev,
          wind: { ...prev.wind, gain: clamped, wetMix: clamped },
        };
      }
      return {
        ...prev,
        [layerId]: {
          ...prev[layerId],
          gain: clamped,
        },
      };
    });
  }, []);

  const setWindWetMix = useCallback((wetMix: number) => {
    const clamped = Math.min(1, Math.max(0, wetMix));
    setLayers((prev) => ({
      ...prev,
      wind: { ...prev.wind, gain: clamped, wetMix: clamped },
    }));
  }, []);

  const toggleSolo = useCallback((layerId: SoloableLayerId) => {
    setLayers((prev) => ({
      ...prev,
      [layerId]: {
        ...prev[layerId],
        solo: !prev[layerId].solo,
        enabled: !prev[layerId].solo ? true : prev[layerId].enabled,
      },
    }));
  }, []);

  const setMasterGain = useCallback((gain: number) => {
    setMasterGainState(Math.min(1, Math.max(0, gain)));
  }, []);

  const setLocalAudioMuted = useCallback((muted: boolean) => {
    setLocalAudioMutedState(muted);
  }, []);

  const setAudioMode = useCallback((mode: AudioOutputMode) => {
    setAudioModeState(mode);
  }, []);

  const togglePlay = useCallback(() => {
    if (!localAudioMuted) {
      audioEngineRef.current?.ensureContext();
    }
    setIsPlaying((prev) => !prev);
  }, [localAudioMuted]);

  const resetExperienceToDefault = useCallback(() => {
    audioEngineRef.current?.stopCalibrationSignal();
    setSelectedCountryId('076');
    setLayers(DEFAULT_LAYERS_STATE);
    setStoryStepState(0);
    setShowCueModeState('free-loop');
    setLoopSingleBarState(null);
    setProgress01(0);
    liveProgressRef.current = 0;
    setIsPlaying(false);
    setSeekSyncNonce((n) => n + 1);
  }, []);

  const sendWsJson = useCallback((body: Record<string, unknown>) => {
    try {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(body));
      }
    } catch {
      // ignore socket send errors
    }
  }, []);

  const updateProjectionState = useCallback(
    (next: ProjectionCalibrationState) => {
      setProjectionState(next);
      saveCalibrationState(next);
      try {
        projBroadcastRef.current?.postMessage(next);
      } catch {
        // ignore
      }
      sendWsJson({ type: 'projection', payload: next });
    },
    [sendWsJson]
  );

  const selectProjectionPreset = useCallback(
    (preset: Exclude<ProjectionTopologyPreset, 'custom'>) => {
      setProjectionState((prev) => {
        const next = applyProjectionPreset(preset, prev);
        saveCalibrationState(next);
        try {
          projBroadcastRef.current?.postMessage(next);
        } catch {
          // ignore
        }
        sendWsJson({ type: 'projection', payload: next });
        return next;
      });
    },
    [sendWsJson]
  );

  const toggleOutputSurface = useCallback(
    (outId: ProjectorOutId, surfaceId: SurfaceId) => {
      setProjectionState((prev) => {
        const next = toggleSurfaceOnOutput(prev, outId, surfaceId);
        saveCalibrationState(next);
        try {
          projBroadcastRef.current?.postMessage(next);
        } catch {
          // ignore
        }
        sendWsJson({ type: 'projection', payload: next });
        return next;
      });
    },
    [sendWsJson]
  );

  const updateOutputConfig = useCallback(
    (outId: ProjectorOutId, patch: Partial<ProjectorOutputConfig>) => {
      setProjectionState((prev) => {
        const next: ProjectionCalibrationState = {
          ...prev,
          outputs: {
            ...prev.outputs,
            [outId]: {
              ...prev.outputs[outId],
              ...patch,
              outId,
            },
          },
        };
        saveCalibrationState(next);
        try {
          projBroadcastRef.current?.postMessage(next);
        } catch {
          // ignore
        }
        sendWsJson({ type: 'projection', payload: next });
        return next;
      });
    },
    [sendWsJson]
  );

  const updateSurfaceQuad = useCallback(
    (key: CalibrationSurfaceKey, quad: QuadCorners) => {
      setProjectionState((prev) => {
        const next: ProjectionCalibrationState = {
          ...prev,
          quads: {
            ...prev.quads,
            [key]: quad,
          },
        };
        saveCalibrationState(next);
        try {
          projBroadcastRef.current?.postMessage(next);
        } catch {
          // ignore
        }
        sendWsJson({ type: 'projection', payload: next });
        return next;
      });
    },
    [sendWsJson]
  );

  const resetSingleOutputQuads = useCallback(
    (outId: ProjectorOutId) => {
      setProjectionState((prev) => {
        const next = resetOutputQuads(prev, outId);
        saveCalibrationState(next);
        try {
          projBroadcastRef.current?.postMessage(next);
        } catch {
          // ignore
        }
        sendWsJson({ type: 'projection', payload: next });
        return next;
      });
    },
    [sendWsJson]
  );

  const resetAllProjectionQuads = useCallback(() => {
    setProjectionState((prev) => {
      const defaults = createDefaultCalibrationState();
      const next =
        prev.preset === 'custom'
          ? {
              ...prev,
              showGrid: false,
              globalBlackout: false,
              quads: defaults.quads,
            }
          : applyProjectionPreset(prev.preset, { ...prev, showGrid: false });
      saveCalibrationState(next);
      try {
        projBroadcastRef.current?.postMessage(next);
      } catch {
        // ignore
      }
      sendWsJson({ type: 'projection', payload: next });
      return next;
    });
  }, [sendWsJson]);

  const triggerIdentifyOutputs = useCallback(
    (durationMs = 7000) => {
      setProjectionState((prev) => {
        const next: ProjectionCalibrationState = {
          ...prev,
          identifyUntil: Date.now() + durationMs,
        };
        saveCalibrationState(next);
        try {
          projBroadcastRef.current?.postMessage(next);
        } catch {
          // ignore
        }
        sendWsJson({ type: 'projection', payload: next });
        return next;
      });
    },
    [sendWsJson]
  );

  const toggleGlobalBlackout = useCallback(() => {
    setProjectionState((prev) => {
      const next: ProjectionCalibrationState = {
        ...prev,
        globalBlackout: !prev.globalBlackout,
      };
      saveCalibrationState(next);
      try {
        projBroadcastRef.current?.postMessage(next);
      } catch {
        // ignore
      }
      sendWsJson({ type: 'projection', payload: next });
      return next;
    });
  }, [sendWsJson]);

  const toggleGlobalShowGrid = useCallback(() => {
    setProjectionState((prev) => {
      const nextVal = !prev.showGrid;
      const next: ProjectionCalibrationState = {
        ...prev,
        showGrid: nextVal,
      };
      saveCalibrationState(next);
      try {
        projBroadcastRef.current?.postMessage(next);
      } catch {
        // ignore
      }
      sendWsJson({ type: 'projection', payload: next });
      return next;
    });
  }, [sendWsJson]);

  const persistAndSyncSpeakerCalibration = useCallback(
    (next: AudioCalibrationState) => {
      setSpeakerCalibration(next);
      saveAudioCalibration(next);
      audioEngineRef.current?.updateSpeakerCalibration(next);
      try {
        calibBroadcastRef.current?.postMessage(next);
      } catch {
        // ignore
      }
      sendWsJson({ type: 'speaker-calib', payload: next });
    },
    [sendWsJson]
  );

  const updateSpeakerConfig = useCallback(
    (speakerId: SpeakerSlotId, patch: Partial<SpeakerSlotConfig>) => {
      if (patch.sinkDeviceId) {
        audioEngineRef.current?.ensureContext();
        // Ao escolher uma caixa física dedicada (Bluetooth/USB), ativa automaticamente o palco 3 Caixas VBAP!
        setAudioModeState('room3');
      }
      setSpeakerCalibration((prev) => {
        const next: AudioCalibrationState = {
          ...prev,
          speakers: {
            ...prev.speakers,
            [speakerId]: {
              ...prev.speakers[speakerId],
              ...patch,
            },
          },
        };
        saveAudioCalibration(next);
        audioEngineRef.current?.updateSpeakerCalibration(next);
        try {
          calibBroadcastRef.current?.postMessage(next);
        } catch {
          // ignore
        }
        sendWsJson({ type: 'speaker-calib', payload: next });
        return next;
      });
    },
    [sendWsJson]
  );

  const setReferenceSpeaker = useCallback(
    (speakerId: SpeakerSlotId) => {
      persistAndSyncSpeakerCalibration({
        ...speakerCalibration,
        referenceSpeakerId: speakerId,
      });
    },
    [persistAndSyncSpeakerCalibration, speakerCalibration]
  );

  const resetSpeakerCalibration = useCallback(() => {
    audioEngineRef.current?.stopCalibrationSignal();
    persistAndSyncSpeakerCalibration(createDefaultAudioCalibration());
  }, [persistAndSyncSpeakerCalibration]);

  const refreshOutputDevices = useCallback(async () => {
    const list = (await audioEngineRef.current?.listOutputDevices()) ?? [];
    setOutputDevices(list);
  }, []);

  const unlockOutputDevices = useCallback(async (): Promise<AudioDeviceOption[]> => {
    const list = (await audioEngineRef.current?.unlockAudioOutputDevices()) ?? [];
    setOutputDevices(list);
    return list;
  }, []);

  // Atualiza automaticamente a lista de caixas sempre que uma caixa Bluetooth/USB conecta ou desconecta no Mac/PC
  useEffect(() => {
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.addEventListener !== 'function'
    ) {
      return;
    }
    const handleDeviceChange = () => {
      void refreshOutputDevices();
    };
    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
    };
  }, [refreshOutputDevices]);

  const setIsolatedSpeakerSlot = useCallback((slot: SpeakerSlotId | null) => {
    setIsolatedSpeakerSlotState(slot);
    audioEngineRef.current?.setIsolatedSpeakerSlot(slot);
  }, []);

  const unlockAudioContext = useCallback((): boolean => {
    const ctx = audioEngineRef.current?.ensureContext();
    return Boolean(ctx);
  }, []);

  const broadcastCalibCommand = useCallback(
    (cmd: RemoteCalibSignalCommand) => {
      try {
        calibBroadcastRef.current?.postMessage({ type: 'calib-signal', cmd });
      } catch {
        // ignore
      }
      sendWsJson({ type: 'calib-signal', cmd });
    },
    [sendWsJson]
  );

  const startPinkNoiseSingle = useCallback(
    (speakerId: SpeakerSlotId) => {
      audioEngineRef.current?.startPinkNoiseSingle(speakerId);
      broadcastCalibCommand({ action: 'pink-single', speakerId });
    },
    [broadcastCalibCommand]
  );

  const startPinkNoiseAB = useCallback(
    (targetSpeakerId: SpeakerSlotId) => {
      audioEngineRef.current?.startPinkNoiseAB(targetSpeakerId);
      broadcastCalibCommand({ action: 'pink-ab', targetSpeakerId });
    },
    [broadcastCalibCommand]
  );

  const startDelayClickTest = useCallback(
    (targetSpeakerId: SpeakerSlotId) => {
      audioEngineRef.current?.startDelayClickTest(targetSpeakerId);
      broadcastCalibCommand({ action: 'delay-click', targetSpeakerId });
    },
    [broadcastCalibCommand]
  );

  const stopCalibrationSignal = useCallback(() => {
    audioEngineRef.current?.stopCalibrationSignal();
    broadcastCalibCommand({ action: 'stop' });
  }, [broadcastCalibCommand]);

  useEffect(() => {
    return () => {
      if (scrubTimerRef.current !== null && typeof window !== 'undefined') {
        window.clearTimeout(scrubTimerRef.current);
      }
    };
  }, []);

  const auditionBeatIfPaused = useCallback(
    (beatIdx: number) => {
      if (playbackRef.current.isPlaying) return;
      setScrubPreviewActive(true);
      if (typeof window !== 'undefined') {
        if (scrubTimerRef.current !== null) {
          window.clearTimeout(scrubTimerRef.current);
        }
        scrubTimerRef.current = window.setTimeout(() => {
          setScrubPreviewActive(false);
          scrubTimerRef.current = null;
        }, 1100);
      }

      const eng = audioEngineRef.current;
      if (!eng || localAudioMuted || eng.isUsingPreRenderedStems()) return;
      eng.ensureContext();
      const pb = playbackRef.current;
      eng.triggerBeatStep({
        beatIndex: beatIdx,
        bpm: pb.bpm,
        activeChord: pb.activeChord,
        keyRoot: pb.keyRoot,
        events: computeSyntheticNotes(beatIdx / 32),
        layers: layersRef.current,
      });
    },
    [computeSyntheticNotes, localAudioMuted]
  );

  const seekProgress = useCallback((nextProgress01: number) => {
    const clamped = Math.min(0.999, Math.max(0, nextProgress01));
    liveProgressRef.current = clamped;
    setProgress01(clamped);
    setSeekSyncNonce((n) => n + 1);
  }, []);

  const seekBeat = useCallback(
    (beatIndex: number) => {
      const clampedBeat = Math.max(0, Math.min(totalBeats - 1, beatIndex));
      seekProgress(clampedBeat / totalBeats);
      auditionBeatIfPaused(clampedBeat);
    },
    [auditionBeatIfPaused, seekProgress, totalBeats]
  );

  const stepBeat = useCallback(
    (delta: number) => {
      const curBeat = Math.floor(liveProgressRef.current * totalBeats);
      const nextBeat =
        (((curBeat + Math.round(delta)) % totalBeats) + totalBeats) % totalBeats;
      seekProgress(nextBeat / totalBeats);
      auditionBeatIfPaused(nextBeat);
    },
    [auditionBeatIfPaused, seekProgress, totalBeats]
  );

  const seekBar = useCallback(
    (barIndex: number) => {
      const clampedBar = Math.max(0, Math.min(totalBars - 1, barIndex));
      const targetBeat = clampedBar * 4;
      seekProgress(targetBeat / totalBeats);
      auditionBeatIfPaused(targetBeat);
    },
    [auditionBeatIfPaused, seekProgress, totalBars, totalBeats]
  );

  const setLoopSingleBar = useCallback(
    (barIndex: number | null) => {
      if (barIndex === null) {
        setLoopSingleBarState(null);
        return;
      }
      const clampedBar = Math.max(0, Math.min(totalBars - 1, barIndex));
      setLoopSingleBarState(clampedBar);
      if (playbackRef.current.bar !== clampedBar) {
        seekProgress((clampedBar * 4) / totalBeats);
      }
    },
    [seekProgress, totalBars, totalBeats]
  );

  const setLang = useCallback((nextLang: Lang) => {
    setLangState(nextLang);
  }, []);

  const setStoryStep = useCallback((step: number) => {
    const normalized =
      ((Math.round(step) % STORY_STEP_COUNT) + STORY_STEP_COUNT) % STORY_STEP_COUNT;
    setStoryStepState(normalized);
  }, []);

  const setMissionPhase = useCallback((phase: MissionPhase) => {
    setMissionPhaseState(phase);
  }, []);

  const nextStoryStep = useCallback(() => {
    setStoryStepState((prev) => (prev + 1) % STORY_STEP_COUNT);
  }, []);

  const prevStoryStep = useCallback(() => {
    setStoryStepState((prev) => (prev - 1 + STORY_STEP_COUNT) % STORY_STEP_COUNT);
  }, []);

  const setRoomDimensions = useCallback((next: RoomDimensions) => {
    setRoomDimensionsState(next);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(ROOM_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
    }
  }, []);

  const outputSupportStatus: AudioOutputSupportStatus = useMemo(
    () => audioEngineRef.current?.getOutputSupportStatus(outputDevices) ?? 'unsupported',
    [outputDevices]
  );

  const audioAdminValue: AudioAdminContextValue = useMemo(
    () => ({
      speakerCalibration,
      calibTestMode,
      outputDevices,
      outputSupportStatus,
      isSetSinkIdSupported: audioEngineRef.current?.isSetSinkIdSupported() ?? false,
      isolatedSpeakerSlot,
      setIsolatedSpeakerSlot,
      unlockAudioContext,
      unlockOutputDevices,
      updateSpeakerConfig,
      setReferenceSpeaker,
      resetSpeakerCalibration,
      startPinkNoiseSingle,
      startPinkNoiseAB,
      startDelayClickTest,
      stopCalibrationSignal,
      refreshOutputDevices,
    }),
    [
      calibTestMode,
      isolatedSpeakerSlot,
      outputDevices,
      outputSupportStatus,
      refreshOutputDevices,
      resetSpeakerCalibration,
      setIsolatedSpeakerSlot,
      setReferenceSpeaker,
      speakerCalibration,
      startDelayClickTest,
      startPinkNoiseAB,
      startPinkNoiseSingle,
      stopCalibrationSignal,
      unlockAudioContext,
      unlockOutputDevices,
      updateSpeakerConfig,
    ]
  );

  const projectionAdminValue: ProjectionAdminContextValue = useMemo(
    () => ({
      projectionState,
      updateProjectionState,
      selectProjectionPreset,
      toggleOutputSurface,
      updateOutputConfig,
      updateSurfaceQuad,
      resetSingleOutputQuads,
      resetAllProjectionQuads,
      triggerIdentifyOutputs,
      toggleGlobalBlackout,
      toggleGlobalShowGrid,
    }),
    [
      projectionState,
      resetAllProjectionQuads,
      resetSingleOutputQuads,
      selectProjectionPreset,
      toggleGlobalBlackout,
      toggleGlobalShowGrid,
      toggleOutputSurface,
      triggerIdentifyOutputs,
      updateOutputConfig,
      updateProjectionState,
      updateSurfaceQuad,
    ]
  );

  const value: ExperienceContextValue = useMemo(
    () => ({
      country,
      allCountries,
      availableCountryIds,
      pilotCountryIds: pilotSet,
      loadStatus: country ? 'ready' : 'idle',
      lang,
      storyStep,
      missionPhase,
      showCueMode,
      loopSingleBar,
      compareCountries,
      beatTimeline,
      speakerLiveLevels,
      audioMode,
      masterGain,
      localAudioMuted,
      audioSourceKind,
      lanConnected,
      lanClients,
      layers,
      playback,
      liveEvents,
      audioLevels,
      pngUrls,
      roomDimensions,
      getLiveFrame,
      selectCountry,
      selectCountryPreserveBeat,
      setCompareSlot,
      swapCompareCountries,
      setShowCueMode,
      setLoopSingleBar,
      stepBeat,
      toggleEye,
      setAllLayersEnabled,
      toggleSparkle,
      setLayerGain,
      setWindWetMix,
      toggleSolo,
      setMasterGain,
      setLocalAudioMuted,
      setAudioMode,
      togglePlay,
      seekBeat,
      seekBar,
      seekProgress,
      setLang,
      setStoryStep,
      setMissionPhase,
      nextStoryStep,
      prevStoryStep,
      setRoomDimensions,
      resetExperienceToDefault,
    }),
    [
      allCountries,
      audioLevels,
      audioMode,
      audioSourceKind,
      availableCountryIds,
      beatTimeline,
      compareCountries,
      country,
      getLiveFrame,
      lanClients,
      lanConnected,
      lang,
      layers,
      liveEvents,
      localAudioMuted,
      loopSingleBar,
      masterGain,
      missionPhase,
      nextStoryStep,
      pilotSet,
      playback,
      pngUrls,
      prevStoryStep,
      resetExperienceToDefault,
      roomDimensions,
      seekBar,
      seekBeat,
      seekProgress,
      selectCountry,
      selectCountryPreserveBeat,
      setAllLayersEnabled,
      setAudioMode,
      setCompareSlot,
      setLang,
      setLayerGain,
      setLocalAudioMuted,
      setLoopSingleBar,
      setMasterGain,
      setMissionPhase,
      setRoomDimensions,
      setShowCueMode,
      setStoryStep,
      setWindWetMix,
      showCueMode,
      speakerLiveLevels,
      stepBeat,
      storyStep,
      swapCompareCountries,
      toggleEye,
      togglePlay,
      toggleSolo,
      toggleSparkle,
    ]
  );

  return (
    <ExperienceContext.Provider value={value}>
      <AudioAdminContext.Provider value={audioAdminValue}>
        <ProjectionAdminContext.Provider value={projectionAdminValue}>
          {children}
        </ProjectionAdminContext.Provider>
      </AudioAdminContext.Provider>
    </ExperienceContext.Provider>
  );
};

export function useExperience(): ExperienceContextValue {
  const ctx = useContext(ExperienceContext);
  if (!ctx) {
    throw new Error('useExperience() deve ser usado dentro de <ExperienceProvider>.');
  }
  return ctx;
}

export function useAudioAdmin(): AudioAdminContextValue {
  const ctx = useContext(AudioAdminContext);
  if (!ctx) {
    throw new Error('useAudioAdmin() deve ser usado dentro de <ExperienceProvider>.');
  }
  return ctx;
}

export function useProjectionAdmin(): ProjectionAdminContextValue {
  const ctx = useContext(ProjectionAdminContext);
  if (!ctx) {
    throw new Error('useProjectionAdmin() deve ser usado dentro de <ExperienceProvider>.');
  }
  return ctx;
}
