import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { resolveAssetUrl } from '../datasets/nasaDatasets';
import { CountryEntry, loadWorldCountries } from '../geo/countries';
import {
  AudioLevelsMap,
  AudioOutputMode,
  ExperienceContextValue,
  ExperienceCountry,
  ExperienceLayersState,
  ExperiencePlaybackState,
  Lang,
  LiveFrameSnapshot,
  LiveNoteEvent,
  MissionPhase,
  PILOT_COUNTRY_IDS,
  RoomDimensions,
  SoloableLayerId,
  VISUAL_LAYER_ORDER,
  VisualLayerId,
} from './types';

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
  missionPhase: MissionPhase;
  audioMode: AudioOutputMode;
  masterGain: number;
  layers: ExperienceLayersState;
  isPlaying: boolean;
  progress01: number;
  roomDimensions: RoomDimensions;
}

const ExperienceContext = createContext<ExperienceContextValue | null>(null);

export const ExperienceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const senderIdRef = useRef<string>(`node-${Math.random().toString(36).slice(2, 9)}`);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const suppressBroadcastRef = useRef(false);

  const world = useMemo(() => loadWorldCountries(), []);
  const pilotSet = useMemo<ReadonlySet<string>>(() => new Set(PILOT_COUNTRY_IDS), []);

  const { countryMap, availableCountryIds } = useMemo(() => {
    const map = new Map<string, ExperienceCountry>();
    const available = new Set<string>();
    for (const c of world.countries) {
      const ec = toExperienceCountry(c, pilotSet);
      map.set(c.id, ec);
      if (!c.isMinorUninhabited) {
        available.add(c.id);
      }
    }
    return { countryMap: map, availableCountryIds: available as ReadonlySet<string> };
  }, [pilotSet, world.countries]);

  const [selectedCountryId, setSelectedCountryId] = useState<string | null>('076');
  const [lang, setLangState] = useState<Lang>('pt');
  const [storyStep, setStoryStepState] = useState<number>(0);
  const [missionPhase, setMissionPhaseState] = useState<MissionPhase>('idle');
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
      const nextProg = (liveProgressRef.current + dtSec / Math.max(1, durationSeconds)) % 1;
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
  }, [durationSeconds, isPlaying, totalBeats]);

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

  const liveEvents = useMemo(
    () => (isPlaying ? computeSyntheticNotes(progress01) : []),
    [computeSyntheticNotes, countryMeta, isPlaying, progress01]
  );

  const audioLevels = useMemo<AudioLevelsMap>(() => {
    const beatPulse = isPlaying ? (beat % 2 === 0 ? 0.92 : 0.72) : 0;
    return computeAudioLevels(isPlaying, beatPulse);
  }, [beat, computeAudioLevels, isPlaying, layers, masterGain]);

  const getLiveFrame = useCallback((): LiveFrameSnapshot => {
    const l = layersRef.current;
    const pb = playbackRef.current;
    const prog = liveProgressRef.current;
    const active = pb.isPlaying;
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
  }, [computeAudioLevels, computeSyntheticNotes]);

  // Multi-tab 1-PC sync via BroadcastChannel
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const ch = new BroadcastChannel(SYNC_CHANNEL_NAME);
    channelRef.current = ch;

    ch.onmessage = (ev: MessageEvent<SyncPayload>) => {
      const data = ev.data;
      if (!data || data.senderId === senderIdRef.current) return;
      suppressBroadcastRef.current = true;
      setSelectedCountryId(data.countryId);
      setLangState(data.lang);
      setStoryStepState(data.storyStep ?? 0);
      setMissionPhaseState(data.missionPhase ?? 'idle');
      setAudioModeState(data.audioMode);
      setMasterGainState(data.masterGain);
      setLayers(data.layers);
      setIsPlaying(data.isPlaying);
      setProgress01(data.progress01);
      setRoomDimensionsState(data.roomDimensions);
      queueMicrotask(() => {
        suppressBroadcastRef.current = false;
      });
    };

    return () => {
      ch.close();
      channelRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (suppressBroadcastRef.current || !channelRef.current) return;
    const payload: SyncPayload = {
      senderId: senderIdRef.current,
      countryId: selectedCountryId,
      lang,
      storyStep,
      missionPhase,
      audioMode,
      masterGain,
      layers,
      isPlaying,
      progress01: liveProgressRef.current,
      roomDimensions,
    };
    try {
      channelRef.current.postMessage(payload);
    } catch {
      // ignore closed channel errors
    }
  }, [
    audioMode,
    isPlaying,
    lang,
    layers,
    masterGain,
    missionPhase,
    roomDimensions,
    selectedCountryId,
    storyStep,
  ]);

  const selectCountry = useCallback(
    (countryId: string | null) => {
      if (countryId && !availableCountryIds.has(countryId)) return;
      setSelectedCountryId(countryId);
      setProgress01(0);
      liveProgressRef.current = 0;
    },
    [availableCountryIds]
  );

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

  const setAudioMode = useCallback((mode: AudioOutputMode) => {
    setAudioModeState(mode);
  }, []);

  const togglePlay = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  const seekProgress = useCallback((nextProgress01: number) => {
    const clamped = Math.min(0.999, Math.max(0, nextProgress01));
    liveProgressRef.current = clamped;
    setProgress01(clamped);
  }, []);

  const seekBeat = useCallback(
    (beatIndex: number) => {
      const clampedBeat = Math.max(0, Math.min(totalBeats - 1, beatIndex));
      seekProgress(clampedBeat / totalBeats);
    },
    [seekProgress, totalBeats]
  );

  const seekBar = useCallback(
    (barIndex: number) => {
      const clampedBar = Math.max(0, Math.min(totalBars - 1, barIndex));
      seekProgress((clampedBar * 4) / totalBeats);
    },
    [seekProgress, totalBars, totalBeats]
  );

  const setLang = useCallback((nextLang: Lang) => {
    setLangState(nextLang);
  }, []);

  const setStoryStep = useCallback((step: number) => {
    const normalized = ((Math.round(step) % STORY_STEP_COUNT) + STORY_STEP_COUNT) % STORY_STEP_COUNT;
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

  const value: ExperienceContextValue = useMemo(
    () => ({
      country,
      availableCountryIds,
      pilotCountryIds: pilotSet,
      loadStatus: country ? 'ready' : 'idle',
      lang,
      storyStep,
      missionPhase,
      audioMode,
      masterGain,
      layers,
      playback,
      liveEvents,
      audioLevels,
      pngUrls,
      roomDimensions,
      getLiveFrame,
      selectCountry,
      toggleEye,
      setAllLayersEnabled,
      toggleSparkle,
      setLayerGain,
      setWindWetMix,
      toggleSolo,
      setMasterGain,
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
    }),
    [
      audioLevels,
      audioMode,
      availableCountryIds,
      country,
      getLiveFrame,
      lang,
      layers,
      liveEvents,
      masterGain,
      missionPhase,
      nextStoryStep,
      pilotSet,
      playback,
      pngUrls,
      prevStoryStep,
      roomDimensions,
      seekBar,
      seekBeat,
      seekProgress,
      selectCountry,
      setAllLayersEnabled,
      setAudioMode,
      setLang,
      setLayerGain,
      setMasterGain,
      setRoomDimensions,
      setStoryStep,
      setWindWetMix,
      storyStep,
      toggleEye,
      togglePlay,
      toggleSolo,
      toggleSparkle,
    ]
  );

  return <ExperienceContext.Provider value={value}>{children}</ExperienceContext.Provider>;
};

export function useExperience(): ExperienceContextValue {
  const ctx = useContext(ExperienceContext);
  if (!ctx) {
    throw new Error('useExperience() deve ser usado dentro de <ExperienceProvider>.');
  }
  return ctx;
}
