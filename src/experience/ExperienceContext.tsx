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
  computeSpeakerLiveLevels,
  resolveCompareSwapTarget,
} from './cueEngine';
import {
  AudioLevelsMap,
  AudioOutputMode,
  BarLoopRange,
  CompareCountriesState,
  CountryStudioPayload,
  ExperienceContextValue,
  ExperienceCountry,
  ExperienceLayersState,
  ExperiencePlaybackState,
  GENERATED_COUNTRY_IDS,
  Lang,
  LanPeerInfo,
  LiveFrameSnapshot,
  LiveNoteEvent,
  MissionPhase,
  PILOT_COUNTRY_IDS,
  ProjectorOutId,
  RoomDimensions,
  SoloableLayerId,
  STUDIO_SAVED_GAINS,
  StudioSessionData,
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
  studio?: CountryStudioPayload;
  telemetrySummary?: {
    lightningHotspotCount?: number;
  };
  beatEvents?: CountryMetaBeatEvent[];
}

const SYNC_CHANNEL_NAME = 'earth-jukebox-sync-v1';
const countryMetaCache = new Map<string, CountryMetaJson>();
const ROOM_STORAGE_KEY = 'earth-jukebox-room-dims-v1';
const STORY_STEP_COUNT = 6;

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
  melody: {
    enabled: false,
    gain: STUDIO_SAVED_GAINS.melody,
    solo: false,
    sparkleEnabled: true,
    sparkleGain: STUDIO_SAVED_GAINS.sparkle,
    sparkleSolo: false,
  },
  chords: { enabled: false, gain: STUDIO_SAVED_GAINS.chords, solo: false },
  bass: { enabled: false, gain: STUDIO_SAVED_GAINS.bass, solo: false },
  wind: {
    enabled: false,
    gain: STUDIO_SAVED_GAINS.wind,
    wetMix: STUDIO_SAVED_GAINS.wind,
    solo: false,
  },
  temperature: { enabled: false, gain: 1.0, solo: false, tuningMode: 'region' },
};

function normalizeIncomingLayers(raw: ExperienceLayersState): ExperienceLayersState {
  return {
    ...raw,
    melody: {
      ...raw.melody,
      sparkleGain:
        typeof raw.melody.sparkleGain === 'number'
          ? raw.melody.sparkleGain
          : STUDIO_SAVED_GAINS.sparkle,
      sparkleSolo: Boolean(raw.melody.sparkleSolo),
    },
  };
}

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
  sceneReplayKey?: number;
  loopSingleBar?: number | null;
  barLoop?: BarLoopRange;
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

const ZERO_VU: AudioLevelsMap = {
  melody: 0,
  sparkle: 0,
  chords: 0,
  bass: 0,
  wind: 0,
  master: 0,
};

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
    return raw === 'projector';
  });
  const [audioSourceKind, setAudioSourceKind] = useState<'stems' | 'meta-synth'>('stems');
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

  // Lista estrita de países com pacote pré-gerado real (sem fallback sintético!)
  const [generatedIdsList, setGeneratedIdsList] = useState<readonly string[]>(
    GENERATED_COUNTRY_IDS
  );

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      typeof window.fetch !== 'function' ||
      !window.location?.origin ||
      window.location.origin === 'null'
    ) {
      return;
    }
    let cancelled = false;
    window
      .fetch(resolveAssetUrl('/countries/index.json'))
      .then((res) => (res.ok ? (res.json() as Promise<{ generatedIds?: string[] }>) : null))
      .then((json) => {
        if (cancelled || !json || !Array.isArray(json.generatedIds) || json.generatedIds.length === 0) {
          return;
        }
        setGeneratedIdsList(json.generatedIds);
      })
      .catch(() => {
        // Mantém GENERATED_COUNTRY_IDS estático quando offline/sem index.json extra
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const { countryMap, availableCountryIds, allCountries } = useMemo(() => {
    const map = new Map<string, ExperienceCountry>();
    const generatedSet = new Set<string>(generatedIdsList);
    const available = new Set<string>();
    const list: ExperienceCountry[] = [];

    for (const c of world.countries) {
      const ec = toExperienceCountry(c, pilotSet);
      map.set(c.id, ec);
      if (!c.isMinorUninhabited && generatedSet.has(c.id)) {
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
  }, [generatedIdsList, pilotSet, world.countries]);

  const [selectedCountryId, setSelectedCountryId] = useState<string | null>('076');
  const [lang, setLangState] = useState<Lang>('pt');
  const [storyStep, setStoryStepState] = useState<number>(0);
  const [missionPhase, setMissionPhaseState] = useState<MissionPhase>('idle');
  const [sceneReplayKey, setSceneReplayKey] = useState<number>(0);
  const [barLoop, setBarLoopState] = useState<BarLoopRange>(null);
  const [compareCountries, setCompareCountriesState] = useState<CompareCountriesState>({
    slotA: '076',
    slotB: '818',
  });
  const [scrubPreviewActive, setScrubPreviewActive] = useState<boolean>(false);
  const scrubTimerRef = useRef<number | null>(null);
  const [seekSyncNonce, setSeekSyncNonce] = useState<number>(0);
  const [audioMode, setAudioModeState] = useState<AudioOutputMode>('hrtf');
  const [masterGain, setMasterGainState] = useState<number>(STUDIO_SAVED_GAINS.master);
  const [layers, setLayers] = useState<ExperienceLayersState>(DEFAULT_LAYERS_STATE);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [progress01, setProgress01] = useState<number>(0);
  const [liveMetersState, setLiveMetersState] = useState<{ vu: AudioLevelsMap; masterDbFs: number }>({
    vu: ZERO_VU,
    masterDbFs: -99,
  });
  const [roomDimensions, setRoomDimensionsState] = useState<RoomDimensions>(
    loadInitialRoomDimensions
  );

  const loopSingleBar = useMemo(
    () => (barLoop && barLoop[0] === barLoop[1] ? barLoop[0] : null),
    [barLoop]
  );

  const country = useMemo(
    () => (selectedCountryId ? countryMap.get(selectedCountryId) ?? null : null),
    [countryMap, selectedCountryId]
  );

  const [countryMeta, setCountryMeta] = useState<CountryMetaJson | null>(null);
  const [metaLoadStatus, setMetaLoadStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');

  useEffect(() => {
    if (!country) {
      setCountryMeta(null);
      setMetaLoadStatus('idle');
      return;
    }
    const cached = countryMetaCache.get(country.id);
    if (cached) {
      setCountryMeta(cached);
      setMetaLoadStatus('ready');
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
    setMetaLoadStatus('loading');
    const url = resolveAssetUrl(`/countries/${country.id}/meta.json`);
    window
      .fetch(url)
      .then((res) => (res.ok ? (res.json() as Promise<CountryMetaJson>) : null))
      .then((json) => {
        if (cancelled) return;
        if (!json || !json.session?.region) {
          setMetaLoadStatus('error');
          return;
        }
        countryMetaCache.set(country.id, json);
        setCountryMeta(json);
        setMetaLoadStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setMetaLoadStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [country]);

  const isRegionTuning = layers.temperature.enabled && layers.temperature.tuningMode === 'region';
  const activeTuning = countryMeta
    ? isRegionTuning
      ? countryMeta.session.region
      : countryMeta.session.base
    : null;

  const studioData: CountryStudioPayload | null = countryMeta?.studio ?? null;
  const activeStudioSession: StudioSessionData | null = studioData
    ? isRegionTuning
      ? studioData.sessions.region
      : studioData.sessions.base
    : null;

  const bpm = activeStudioSession?.bpm ?? activeTuning?.bpm ?? 90;
  const keyRoot = activeStudioSession?.keyRoot ?? activeTuning?.keyRoot ?? '--';
  const keyRootPt = activeStudioSession?.keyRootPt ?? activeTuning?.keyRootPt ?? '--';
  const modeNamePt =
    activeStudioSession?.modeNamePt ?? activeTuning?.modeNamePt ?? '--';
  const modeNameEn =
    activeStudioSession?.modeNameEn ?? activeTuning?.modeNameEn ?? '--';
  const windMeanSpeed = activeTuning?.windMeanSpeed ?? 0;
  const chordList =
    activeStudioSession?.chordProgression ?? activeTuning?.chords ?? [];

  const totalBars = activeStudioSession?.totalBars ?? 8;
  const totalBeats = totalBars * 4;
  const durationSeconds =
    activeStudioSession?.durationSeconds ?? Number(((totalBeats * 60) / Math.max(40, bpm)).toFixed(2));

  const exactBeat = progress01 * totalBeats;
  const bar = Math.min(totalBars - 1, Math.floor(exactBeat / 4));
  const beat = Math.floor(exactBeat % 4);
  const activeChord = chordList[bar % Math.max(1, chordList.length)] ?? '--';

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
  const barLoopRef = useRef<BarLoopRange>(barLoop);
  barLoopRef.current = barLoop;

  const layersRef = useRef(layers);
  layersRef.current = layers;
  const masterGainRef = useRef(masterGain);
  masterGainRef.current = masterGain;
  const playbackRef = useRef(playback);
  playbackRef.current = playback;
  const countryMetaRef = useRef(countryMeta);
  countryMetaRef.current = countryMeta;
  const activeStudioSessionRef = useRef(activeStudioSession);
  activeStudioSessionRef.current = activeStudioSession;

  const extractRealNotesAtProgress = useCallback((prog01: number): LiveNoteEvent[] => {
    const l = layersRef.current;
    const spkSolo = l.melody.sparkleSolo;
    const anyGenSolo = spkSolo || l.melody.solo || l.chords.solo || l.bass.solo;

    const melodyAudible =
      !spkSolo && l.melody.enabled && (!anyGenSolo || l.melody.solo);
    const sparkleAudible = spkSolo
      ? l.melody.sparkleEnabled
      : l.melody.enabled && l.melody.sparkleEnabled && (!anyGenSolo || l.melody.solo);
    const chordsAudible = !spkSolo && l.chords.enabled && (!anyGenSolo || l.chords.solo);
    const bassAudible = !spkSolo && l.bass.enabled && (!anyGenSolo || l.bass.solo);

    const session = activeStudioSessionRef.current;
    if (session) {
      const tBeats = (session.totalBars || 8) * 4;
      const curBeat = prog01 * tBeats;
      const out: LiveNoteEvent[] = [];

      if (melodyAudible) {
        for (const n of session.tracks.melody) {
          if (curBeat >= n.start_beat && curBeat <= n.start_beat + Math.min(n.duration_beats, 0.65)) {
            out.push({
              layer: 'melody',
              source_x: n.source_x,
              source_y: n.source_y,
              sourceX: n.source_x,
              sourceY: n.source_y,
              pitch: n.pitch,
              velocity: n.velocity,
              isAnchor: Boolean(n.is_anchor),
            });
          }
        }
      }

      if (sparkleAudible) {
        for (const sp of session.tracks.melody_sparkle) {
          const win = sp.sub_role === 'crystal_sparkle' ? 0.28 : Math.min(sp.duration_beats, 0.55);
          if (curBeat >= sp.start_beat && curBeat <= sp.start_beat + win) {
            out.push({
              layer: 'sparkle',
              source_x: sp.source_x,
              source_y: sp.source_y,
              sourceX: sp.source_x,
              sourceY: sp.source_y,
              pitch: sp.pitch,
              velocity: sp.velocity,
              isAnchor: false,
              subRole: sp.sub_role,
            });
          }
        }
      }

      if (chordsAudible) {
        for (let i = 0; i < session.tracks.chords_pad.length; i += 3) {
          const c = session.tracks.chords_pad[i];
          if (curBeat >= c.start_beat && curBeat <= c.start_beat + c.duration_beats) {
            out.push({
              layer: 'chords',
              source_x: c.source_x,
              source_y: c.source_y,
              sourceX: c.source_x,
              sourceY: c.source_y,
              pitch: c.pitch,
              velocity: c.velocity,
              isAnchor: true,
            });
          }
        }
      }

      if (bassAudible) {
        for (const b of session.tracks.bass) {
          if (curBeat >= b.start_beat && curBeat <= b.start_beat + b.duration_beats) {
            out.push({
              layer: 'bass',
              source_x: b.source_x,
              source_y: b.source_y,
              sourceX: b.source_x,
              sourceY: b.source_y,
              pitch: b.pitch,
              velocity: b.velocity,
              isAnchor: Boolean(b.is_anchor),
            });
          }
        }
      }

      return out;
    }

    const meta = countryMetaRef.current;
    if (meta?.beatEvents && meta.beatEvents.length > 0) {
      const beatIdx = Math.min(31, Math.max(0, Math.floor(prog01 * 32) % 32));
      const realEvents: LiveNoteEvent[] = [];
      for (const ev of meta.beatEvents) {
        if (ev.beat !== beatIdx) continue;
        if (ev.layer === 'melody' && !melodyAudible) continue;
        if (ev.layer === 'sparkle' && !sparkleAudible) continue;
        if (ev.layer === 'chords' && !chordsAudible) continue;
        if (ev.layer === 'bass' && !bassAudible) continue;
        realEvents.push({
          layer: ev.layer,
          source_x: ev.source_x,
          source_y: ev.source_y,
          sourceX: ev.source_x,
          sourceY: ev.source_y,
          pitch: ev.pitch,
          velocity: ev.velocity,
          isAnchor: ev.isAnchor,
        });
      }
      return realEvents;
    }

    return [];
  }, []);

  const computeEstimatedMetersFromNotes = useCallback(
    (active: boolean, notes: LiveNoteEvent[]): AudioLevelsMap => {
      if (!active) return ZERO_VU;
      const l = layersRef.current;
      const spkSolo = l.melody.sparkleSolo;
      const anyGenSolo = spkSolo || l.melody.solo || l.chords.solo || l.bass.solo;

      const melAudible = !spkSolo && l.melody.enabled && (!anyGenSolo || l.melody.solo);
      const spkAudible = spkSolo
        ? l.melody.sparkleEnabled
        : l.melody.enabled && l.melody.sparkleEnabled && (!anyGenSolo || l.melody.solo);
      const chdAudible = !spkSolo && l.chords.enabled && (!anyGenSolo || l.chords.solo);
      const basAudible = !spkSolo && l.bass.enabled && (!anyGenSolo || l.bass.solo);

      let melVel = 0;
      let spkVel = 0;
      let chdVel = 0;
      let basVel = 0;
      for (const n of notes) {
        if (n.layer === 'melody' && n.velocity > melVel) melVel = n.velocity;
        else if (n.layer === 'sparkle' && n.velocity > spkVel) spkVel = n.velocity;
        else if (n.layer === 'chords' && n.velocity > chdVel) chdVel = n.velocity;
        else if (n.layer === 'bass' && n.velocity > basVel) basVel = n.velocity;
      }

      const melVu = melAudible ? Math.min(1, melVel * l.melody.gain) : 0;
      const spkVu = spkAudible ? Math.min(1, spkVel * l.melody.gain * l.melody.sparkleGain) : 0;
      const chdVu = chdAudible ? Math.min(1, chdVel * l.chords.gain) : 0;
      const basVu = basAudible ? Math.min(1, basVel * l.bass.gain) : 0;
      const wndVu = l.wind.enabled
        ? Math.min(1, l.wind.wetMix * Math.max(melVu, spkVu, chdVu, basVu) * 0.85)
        : 0;
      const masterVu = Math.min(
        1,
        Math.max(melVu, spkVu, chdVu, basVu) * masterGainRef.current
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

  // Loop 60fps sincronizado com o relógio sample-accurate Web Audio (ou relógio sincronizado LAN/Broadcast)
  useEffect(() => {
    if (!isPlaying) {
      setLiveMetersState({ vu: ZERO_VU, masterDbFs: -99 });
      return;
    }
    let raf = 0;
    let prevMs = performance.now();
    let lastCommittedQuarter = -1;
    let lastMeterCommitMs = 0;

    const tick = (nowMs: number) => {
      const dtSec = Math.min(0.1, Math.max(0, (nowMs - prevMs) / 1000));
      prevMs = nowMs;

      const eng = audioEngineRef.current;
      const hwProg = eng?.getPlayheadProgress01() ?? null;

      const nextProg =
        hwProg !== null
          ? hwProg
          : advanceLoopProgress(
              liveProgressRef.current,
              dtSec,
              durationSeconds,
              loopSingleBar,
              totalBars,
              barLoopRef.current
            );

      liveProgressRef.current = nextProg;

      if (eng && eng.isStemAudioPlaying()) {
        const activeNotes = extractRealNotesAtProgress(nextProg);
        const melFocus = activeNotes.find((n) => n.layer === 'melody' || n.layer === 'sparkle');
        if (melFocus) {
          eng.steerMelodySpatialFocus(melFocus.source_x, melFocus.source_y);
        }

        const wp = countryMeta?.studio?.windProfile;
        if (wp && wp.orientation.length > 0) {
          const nSlots = wp.orientation.length;
          const pos = Math.max(0, Math.min(nSlots - 1, nextProg * nSlots));
          const i0 = Math.floor(pos) % nSlots;
          const i1 = (i0 + 1) % nSlots;
          const t = pos - Math.floor(pos);
          const lerp = (arr: number[], fallback: number): number => {
            if (!arr || arr.length === 0) return fallback;
            const a = arr[i0] ?? fallback;
            const b = arr[i1] ?? a;
            return a + (b - a) * t;
          };
          const orient = lerp(wp.orientation, 0);
          const hx = lerp(wp.hotspotX, 0.5);
          const hy = lerp(wp.hotspotY, 0.5);
          const spd = lerp(wp.speed, 0.45);
          const turb = lerp(wp.turbulence, 0.2);
          const panX = Math.max(-1, Math.min(1, orient * 0.65 + (hx - 0.5) * 2 * 0.55));
          const depthY = Math.max(-1, Math.min(1, (hy - 0.5) * 2));
          eng.steerWindByTelemetry(panX, depthY, spd, turb);
        }
      }

      const currentQuarter = Math.floor(nextProg * totalBeats * 2);
      if (currentQuarter !== lastCommittedQuarter) {
        lastCommittedQuarter = currentQuarter;
        setProgress01(nextProg);
      }

      if (nowMs - lastMeterCommitMs >= 55) {
        lastMeterCommitMs = nowMs;
        if (eng && eng.isStemAudioPlaying()) {
          setLiveMetersState(eng.readLiveMeters());
        } else {
          const notes = extractRealNotesAtProgress(nextProg);
          const vu = computeEstimatedMetersFromNotes(true, notes);
          const db = vu.master > 1e-4 ? Number((20 * Math.log10(vu.master)).toFixed(1)) : -99;
          setLiveMetersState({ vu, masterDbFs: db });
        }
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [
    computeEstimatedMetersFromNotes,
    durationSeconds,
    extractRealNotesAtProgress,
    isPlaying,
    loopSingleBar,
    totalBars,
    totalBeats,
  ]);

  const isLiveOrScrubbing = isPlaying || scrubPreviewActive;

  const beatTimeline = useMemo(
    () => buildBeatTimeline(countryMeta?.beatEvents),
    [countryMeta]
  );

  const liveEvents = useMemo(
    () => (isLiveOrScrubbing ? extractRealNotesAtProgress(progress01) : []),
    [countryMeta, extractRealNotesAtProgress, isLiveOrScrubbing, layers, progress01]
  );

  const audioLevels = useMemo<AudioLevelsMap>(() => {
    if (isPlaying) return liveMetersState.vu;
    if (scrubPreviewActive) return computeEstimatedMetersFromNotes(true, liveEvents);
    return ZERO_VU;
  }, [computeEstimatedMetersFromNotes, isPlaying, liveEvents, liveMetersState.vu, scrubPreviewActive]);

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
    const pb = playbackRef.current;
    const eng = audioEngineRef.current;
    const hwProg = eng?.getPlayheadProgress01() ?? null;
    const prog = hwProg !== null ? hwProg : liveProgressRef.current;
    const active = pb.isPlaying || scrubPreviewActive;

    const activeNotes = active ? extractRealNotesAtProgress(prog) : [];

    let vu = ZERO_VU;
    let masterDbFs = -99;
    if (eng && eng.isStemAudioPlaying()) {
      const meters = eng.readLiveMeters();
      vu = meters.vu;
      masterDbFs = meters.masterDbFs;
    } else if (active) {
      vu = computeEstimatedMetersFromNotes(true, activeNotes);
      masterDbFs = vu.master > 1e-4 ? Number((20 * Math.log10(vu.master)).toFixed(1)) : -99;
    }

    const yc = countryMetaRef.current?.studio?.yellowCounts;
    const lightningCount =
      yc && yc.length > 0
        ? yc[Math.min(yc.length - 1, Math.floor(prog * yc.length))] ?? 0
        : activeNotes.filter((n) => n.layer === 'melody' || n.layer === 'sparkle').length;

    return {
      currentTime: prog * pb.durationSeconds,
      progress01: prog,
      vu,
      masterDbFs,
      activeNotes,
      lightningCount,
    };
  }, [computeEstimatedMetersFromNotes, extractRealNotesAtProgress, scrubPreviewActive]);

  const applyIncomingSync = useCallback((data: SyncPayload) => {
    if (!data || data.senderId === senderIdRef.current) return;
    suppressBroadcastRef.current = true;
    setSelectedCountryId(data.countryId);
    setLangState(data.lang);
    setStoryStepState(data.storyStep ?? 0);
    if (data.missionPhase) setMissionPhaseState(data.missionPhase);
    if (typeof data.sceneReplayKey === 'number') setSceneReplayKey(data.sceneReplayKey);
    if (data.barLoop !== undefined) {
      setBarLoopState(data.barLoop);
      barLoopRef.current = data.barLoop;
    } else if (data.loopSingleBar !== undefined) {
      const nextRange: BarLoopRange =
        data.loopSingleBar === null ? null : [data.loopSingleBar, data.loopSingleBar];
      setBarLoopState(nextRange);
      barLoopRef.current = nextRange;
    }
    if (data.compareCountries) setCompareCountriesState(data.compareCountries);
    setAudioModeState(data.audioMode);
    setMasterGainState(data.masterGain);
    setLayers(normalizeIncomingLayers(data.layers));
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
      sceneReplayKey,
      loopSingleBar,
      barLoop,
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
    barLoop,
    compareCountries,
    isPlaying,
    lang,
    layers,
    loopSingleBar,
    masterGain,
    missionPhase,
    roomDimensions,
    sceneReplayKey,
    seekSyncNonce,
    selectedCountryId,
    storyStep,
  ]);

  // --- Sincronização do Motor Web Audio 8D (100% Stems Pré-Gerados — Zero Fallback) ---
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
    if (!eng || !country || !countryMeta?.hasAudioStems || localAudioMuted) {
      eng?.stopStemPlayback();
      return;
    }
    const tuning = isRegionTuning ? 'region' : 'base';
    let cancelled = false;

    void eng
      .tryLoadPreRenderedStems(
        country.id,
        tuning,
        countryMeta.hasAudioStems,
        countryMeta.audioFormat ?? 'ogg'
      )
      .then((loaded) => {
        if (cancelled) return;
        setAudioSourceKind('stems');
        if (loaded && isPlaying) {
          eng.startStemPlayback(
            liveProgressRef.current,
            layersRef.current,
            barLoopRef.current,
            totalBars
          );
        } else {
          eng.stopStemPlayback();
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    barLoop,
    country,
    countryMeta,
    isPlaying,
    isRegionTuning,
    localAudioMuted,
    seekSyncNonce,
    totalBars,
  ]);

  const selectCountry = useCallback(
    (countryId: string | null) => {
      if (countryId && !availableCountryIds.has(countryId)) return;
      setSelectedCountryId(countryId);
      setProgress01(0);
      liveProgressRef.current = 0;
      setSeekSyncNonce((n) => n + 1);
    },
    [availableCountryIds]
  );

  const selectCountryPreserveBeat = useCallback(
    (countryId: string) => {
      if (!availableCountryIds.has(countryId)) return;
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
    setSelectedCountryId(nextId);
    setSeekSyncNonce((n) => n + 1);
  }, [availableCountryIds, compareCountries, selectedCountryId]);

  const activateMissionFrame = useCallback(
    (phase: MissionPhase, nextStoryStep?: number, focusLayer?: VisualLayerId) => {
      setMissionPhaseState(phase);
      if (typeof nextStoryStep === 'number') {
        const normalized =
          ((Math.round(nextStoryStep) % STORY_STEP_COUNT) + STORY_STEP_COUNT) %
          STORY_STEP_COUNT;
        setStoryStepState(normalized);
        if (phase === 'exploring' && normalized > 0 && !selectedCountryId) {
          setSelectedCountryId('076');
        }
      }
      if (focusLayer) {
        setLayers((prev) => ({
          ...prev,
          [focusLayer]: {
            ...prev[focusLayer],
            enabled: true,
          },
        }));
      }
      setSceneReplayKey((k) => k + 1);
    },
    [selectedCountryId]
  );

  const replayActiveFrame = useCallback(() => {
    setSceneReplayKey((k) => k + 1);
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

  const setSparkleGain = useCallback((gain: number) => {
    const clamped = Math.min(2, Math.max(0, gain));
    setLayers((prev) => ({
      ...prev,
      melody: {
        ...prev.melody,
        sparkleGain: clamped,
      },
    }));
  }, []);

  const toggleSparkleSolo = useCallback(() => {
    setLayers((prev) => {
      const nextSolo = !prev.melody.sparkleSolo;
      return {
        ...prev,
        melody: {
          ...prev.melody,
          solo: false,
          sparkleSolo: nextSolo,
          sparkleEnabled: nextSolo ? true : prev.melody.sparkleEnabled,
        },
        chords: { ...prev.chords, solo: false },
        bass: { ...prev.bass, solo: false },
      };
    });
  }, []);

  const setAllLayersEnabled = useCallback((enabled: boolean) => {
    setLayers((prev) => ({
      melody: {
        ...prev.melody,
        enabled,
        solo: false,
        sparkleSolo: false,
      },
      chords: { ...prev.chords, enabled, solo: false },
      temperature: {
        ...prev.temperature,
        enabled,
        tuningMode: enabled ? 'region' : 'base',
      },
      bass: { ...prev.bass, enabled, solo: false },
      wind: { ...prev.wind, enabled },
    }));
  }, []);

  const setLayerGain = useCallback((layerId: VisualLayerId, gainOrWet: number) => {
    setLayers((prev) => {
      if (layerId === 'temperature') {
        return prev;
      }
      if (layerId === 'wind') {
        const clampedWet = Math.min(1.4, Math.max(0, gainOrWet));
        return {
          ...prev,
          wind: { ...prev.wind, gain: clampedWet, wetMix: Math.min(1, clampedWet) },
        };
      }
      const clampedGain = Math.min(2, Math.max(0, gainOrWet));
      return {
        ...prev,
        [layerId]: {
          ...prev[layerId],
          gain: clampedGain,
        },
      };
    });
  }, []);

  const setWindWetMix = useCallback((wetMix: number) => {
    const clamped = Math.min(1.4, Math.max(0, wetMix));
    setLayers((prev) => ({
      ...prev,
      wind: { ...prev.wind, gain: clamped, wetMix: Math.min(1, clamped) },
    }));
  }, []);

  const toggleSolo = useCallback((layerId: SoloableLayerId) => {
    setLayers((prev) => {
      const nextSolo = !prev[layerId].solo;
      return {
        ...prev,
        melody: {
          ...prev.melody,
          solo: layerId === 'melody' ? nextSolo : false,
          sparkleSolo: false,
          enabled: layerId === 'melody' && nextSolo ? true : prev.melody.enabled,
        },
        chords: {
          ...prev.chords,
          solo: layerId === 'chords' ? nextSolo : false,
          enabled: layerId === 'chords' && nextSolo ? true : prev.chords.enabled,
        },
        bass: {
          ...prev.bass,
          solo: layerId === 'bass' ? nextSolo : false,
          enabled: layerId === 'bass' && nextSolo ? true : prev.bass.enabled,
        },
      };
    });
  }, []);

  const setMasterGain = useCallback((gain: number) => {
    setMasterGainState(Math.min(1.6, Math.max(0, gain)));
  }, []);

  const resetMixerGains = useCallback(() => {
    setLayers((prev) => ({
      melody: {
        ...prev.melody,
        gain: STUDIO_SAVED_GAINS.melody,
        sparkleGain: STUDIO_SAVED_GAINS.sparkle,
        solo: false,
        sparkleSolo: false,
      },
      chords: { ...prev.chords, gain: STUDIO_SAVED_GAINS.chords, solo: false },
      bass: { ...prev.bass, gain: STUDIO_SAVED_GAINS.bass, solo: false },
      wind: {
        ...prev.wind,
        gain: STUDIO_SAVED_GAINS.wind,
        wetMix: STUDIO_SAVED_GAINS.wind,
      },
      temperature: prev.temperature,
    }));
    setMasterGainState(STUDIO_SAVED_GAINS.master);
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
    setMasterGainState(STUDIO_SAVED_GAINS.master);
    setStoryStepState(0);
    setMissionPhaseState('idle');
    setSceneReplayKey((k) => k + 1);
    setBarLoopState(null);
    barLoopRef.current = null;
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

  const resetAllProjectionQuads = useCallback(
    (
      ) => {
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
    },
    [sendWsJson]
  );

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

  const markScrubPreviewIfPaused = useCallback(() => {
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
  }, []);

  const seekProgress = useCallback(
    (nextProgress01: number) => {
      const clamped = Math.min(0.999, Math.max(0, nextProgress01));
      const curRange = barLoopRef.current;
      if (curRange) {
        const clickedBar = Math.floor(clamped * totalBars);
        if (clickedBar < curRange[0] || clickedBar > curRange[1]) {
          barLoopRef.current = null;
          setBarLoopState(null);
        }
      }
      liveProgressRef.current = clamped;
      setProgress01(clamped);
      setSeekSyncNonce((n) => n + 1);
      markScrubPreviewIfPaused();
    },
    [markScrubPreviewIfPaused, totalBars]
  );

  const restartLoop = useCallback(() => {
    const curRange = barLoopRef.current;
    const startProg = curRange ? curRange[0] / Math.max(1, totalBars) : 0;
    liveProgressRef.current = startProg;
    setProgress01(startProg);
    setSeekSyncNonce((n) => n + 1);
  }, [totalBars]);

  const setBarLoop = useCallback(
    (range: BarLoopRange) => {
      if (!range) {
        barLoopRef.current = null;
        setBarLoopState(null);
        setSeekSyncNonce((n) => n + 1);
        return;
      }
      const b0 = Math.max(0, Math.min(totalBars - 1, Math.min(range[0], range[1])));
      const b1 = Math.max(b0, Math.min(totalBars - 1, Math.max(range[0], range[1])));
      const normalized: [number, number] = [b0, b1];
      barLoopRef.current = normalized;
      setBarLoopState(normalized);

      const startProg = b0 / totalBars;
      const endProg = (b1 + 1) / totalBars;
      if (liveProgressRef.current < startProg || liveProgressRef.current >= endProg) {
        liveProgressRef.current = startProg;
        setProgress01(startProg);
      }
      setSeekSyncNonce((n) => n + 1);
    },
    [totalBars]
  );

  const setLoopSingleBar = useCallback(
    (barIndex: number | null) => {
      setBarLoop(barIndex === null ? null : [barIndex, barIndex]);
    },
    [setBarLoop]
  );

  const seekBeat = useCallback(
    (beatIndex: number) => {
      const clampedBeat = Math.max(0, Math.min(totalBeats - 1, beatIndex));
      seekProgress(clampedBeat / totalBeats);
    },
    [seekProgress, totalBeats]
  );

  const stepBeat = useCallback(
    (delta: number) => {
      const curBeat = Math.floor(liveProgressRef.current * totalBeats);
      const nextBeat =
        (((curBeat + Math.round(delta)) % totalBeats) + totalBeats) % totalBeats;
      seekProgress(nextBeat / totalBeats);
    },
    [seekProgress, totalBeats]
  );

  const seekBar = useCallback(
    (barIndex: number) => {
      const clampedBar = Math.max(0, Math.min(totalBars - 1, barIndex));
      const targetBeat = clampedBar * 4;
      seekProgress(targetBeat / totalBeats);
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
      loadStatus: country ? metaLoadStatus : 'idle',
      lang,
      storyStep,
      missionPhase,
      sceneReplayKey,
      loopSingleBar,
      barLoop,
      compareCountries,
      beatTimeline,
      studioData,
      activeStudioSession,
      speakerLiveLevels,
      audioMode,
      masterGain,
      masterDbFs: liveMetersState.masterDbFs,
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
      activateMissionFrame,
      replayActiveFrame,
      setLoopSingleBar,
      setBarLoop,
      restartLoop,
      resetMixerGains,
      stepBeat,
      toggleEye,
      setAllLayersEnabled,
      toggleSparkle,
      setSparkleGain,
      toggleSparkleSolo,
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
      activateMissionFrame,
      activeStudioSession,
      allCountries,
      audioLevels,
      audioMode,
      audioSourceKind,
      availableCountryIds,
      barLoop,
      beatTimeline,
      compareCountries,
      country,
      getLiveFrame,
      lanClients,
      lanConnected,
      lang,
      layers,
      liveEvents,
      liveMetersState.masterDbFs,
      localAudioMuted,
      loopSingleBar,
      masterGain,
      metaLoadStatus,
      missionPhase,
      nextStoryStep,
      pilotSet,
      playback,
      pngUrls,
      prevStoryStep,
      replayActiveFrame,
      resetExperienceToDefault,
      resetMixerGains,
      restartLoop,
      roomDimensions,
      sceneReplayKey,
      seekBar,
      seekBeat,
      seekProgress,
      selectCountry,
      selectCountryPreserveBeat,
      setAllLayersEnabled,
      setAudioMode,
      setBarLoop,
      setCompareSlot,
      setLang,
      setLayerGain,
      setLocalAudioMuted,
      setLoopSingleBar,
      setMasterGain,
      setMissionPhase,
      setRoomDimensions,
      setSparkleGain,
      setStoryStep,
      setWindWetMix,
      speakerLiveLevels,
      stepBeat,
      storyStep,
      studioData,
      swapCompareCountries,
      toggleEye,
      togglePlay,
      toggleSolo,
      toggleSparkle,
      toggleSparkleSolo,
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
