import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  SampledReading,
  playSonificationTone,
  sampleVideoAtLonLat,
  speakTextPt,
  stopSpeech,
} from '../accessibility/a11yEngine';
import { AstronautCopilot } from './AstronautCopilot';
import { CountryDetailCard } from './CountryDetailCard';
import { CameraViewTarget, EarthCanvas, HoverInfo } from './EarthCanvas';
import { HudOverlay } from './HudOverlay';
import { JukeboxPanel } from './JukeboxPanel';
import { PlayerBar } from './PlayerBar';
import {
  BlendMode,
  DATASET_ORDER,
  DEFAULT_LAYER_STACK,
  DatasetId,
  LayerConfig,
  NASA_DATASETS,
  QuickPreset,
} from '../datasets/nasaDatasets';
import { CountryEntry, loadWorldCountries } from '../geo/countries';
import { getCountryLogistics } from '../geo/countryLogistics';
import { formatLatLon } from '../geo/projection';
import { clampVideoTime, stepVideoTime } from '../utils/playerMath';
import {
  CommunityUnlockState,
  STEM_METAS,
  STEM_ORDER,
  StemId,
  buildCountryRegionKey,
  buildRadiusRegionKey,
  contributeRegionStem,
  getGlobalEcosystemSummary,
  getRegionUnlockSummary,
  localUnlockAdapter,
} from '../community/unlockStore';
import {
  EMPTY_AUDIO_FRAME,
  SoundscapeRadiusTarget,
  SoundscapeSynthPlayer,
  SoundscapeTarget,
  SoundscapeVisualTelemetry,
  buildExplainMusicPt,
  deriveMusicalParameters,
  getTargetBounds,
  sampleSoundscapeStats,
} from '../audio/soundscapeEngine';
import {
  DiscoveryEvent,
  ProgressionState,
  loadProgressionState,
  recordCollectiveContribution,
  recordRegionDiscovery,
  saveProgressionState,
} from '../game/progressionStore';

interface EarthExplorerViewProps {
  userName: string;
  userId?: string;
  username?: string;
  originCountryCode?: string;
  onChangeOriginCountry?: (countryCode: string) => void;
  isJuryQuickEntry?: boolean;
  isGuestSession?: boolean;
  onOpenAuth?: () => void;
  onOpenRegister?: () => void;
  highContrast: boolean;
  onToggleHighContrast: () => void;
  fontScale: number;
  onCycleFontScale: () => void;
  onReopenTour?: () => void;
  onLogout: () => void;
}

export const EarthExplorerView: React.FC<EarthExplorerViewProps> = ({
  userName,
  userId = userName.toLowerCase(),
  username,
  originCountryCode,
  onChangeOriginCountry,
  isJuryQuickEntry = false,
  isGuestSession = false,
  onOpenAuth,
  onOpenRegister,
  highContrast,
  onToggleHighContrast,
  fontScale,
  onCycleFontScale,
  onReopenTour,
  onLogout,
}) => {
  const { countries, allRings } = useMemo(() => loadWorldCountries(), []);

  const videoRefs = useRef<Partial<Record<DatasetId, HTMLVideoElement | null>>>({});
  const [videoElements, setVideoElements] = useState<
    Partial<Record<DatasetId, HTMLVideoElement | null>>
  >({});
  const [readyMap, setReadyMap] = useState<Partial<Record<DatasetId, boolean>>>({});

  const [viewMode, setViewMode] = useState<'3d' | '2d'>('3d');
  const [layers, setLayers] = useState<LayerConfig[]>(DEFAULT_LAYER_STACK);
  const [primaryTrackId, setPrimaryTrackId] = useState<DatasetId>('svs5148');

  const [showBorders, setShowBorders] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [hdEnhance, setHdEnhance] = useState(true);
  const [showUnlockMap, setShowUnlockMap] = useState(true);

  const [selectionMode, setSelectionMode] = useState<'country' | 'radius'>('country');
  const [radiusKm, setRadiusKm] = useState(900);
  const [radiusTarget, setRadiusTarget] = useState<SoundscapeRadiusTarget | null>(null);

  const [unlockState, setUnlockState] = useState<CommunityUnlockState>(() =>
    localUnlockAdapter.load(countries)
  );
  const [progression, setProgression] = useState<ProgressionState>(() =>
    loadProgressionState(userId)
  );
  const [discoveryToast, setDiscoveryToast] = useState<DiscoveryEvent | null>(null);
  const [unlockFeedback, setUnlockFeedback] = useState<string | null>(null);
  const [jukeboxPlaying, setJukeboxPlaying] = useState(false);
  const [stemUserMuted, setStemUserMuted] = useState<Record<StemId, boolean>>({
    melody: false,
    harmony: false,
    rhythm: false,
    bass: false,
    fx: false,
  });
  const [soundscapeTelemetry, setSoundscapeTelemetry] =
    useState<SoundscapeVisualTelemetry | null>(null);
  const synthRef = useRef<SoundscapeSynthPlayer | null>(null);
  const stepCounterRef = useRef(0);

  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [sonifyEnabled, setSonifyEnabled] = useState(false);
  const [masterVolume, setMasterVolume] = useState(0.72);
  const [motionPaused, setMotionPaused] = useState(() =>
    typeof window !== 'undefined' &&
    Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
  );
  const [liveAnnouncement, setLiveAnnouncement] = useState(
    'Explorador carregado. Use Tab para navegar ou setas para mover o globo.'
  );

  const [selectedCountry, setSelectedCountry] = useState<CountryEntry | null>(null);
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);
  const [cameraDistance, setCameraDistance] = useState(2.98);
  const [unlockPulseNonce, setUnlockPulseNonce] = useState(0);
  const cameraCenterRef = useRef({ lon: -35, lat: -5 });

  const [flyTarget, setFlyTarget] = useState<CameraViewTarget | null>(null);
  const [zoomCommand, setZoomCommand] = useState<{ delta: number; nonce: number } | null>(null);
  const [panCommand, setPanCommand] = useState<{
    dLon: number;
    dLat: number;
    nonce: number;
  } | null>(null);
  const nonceRef = useRef(1);

  const [isPlaying, setIsPlaying] = useState(() =>
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      ? false
      : true
  );
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(NASA_DATASETS.svs5148.durationHintSeconds);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isLoop, setIsLoop] = useState(true);

  const [sampleTick, setSampleTick] = useState(0);
  const approxAltKm = Math.max(380, Math.round((cameraDistance - 1) * 6371));

  const enabledDatasetIds = useMemo(
    () => layers.filter((l) => l.enabled).map((l) => l.id),
    [layers]
  );

  useEffect(() => {
    if (enabledDatasetIds.length > 0 && !enabledDatasetIds.includes(primaryTrackId)) {
      setPrimaryTrackId(enabledDatasetIds[0]);
    }
  }, [enabledDatasetIds, primaryTrackId]);

  const setVideoRef = useCallback((id: DatasetId, el: HTMLVideoElement | null) => {
    videoRefs.current[id] = el;
  }, []);

  useEffect(() => {
    setVideoElements({ ...videoRefs.current });
    return () => {
      stopSpeech();
      synthRef.current?.dispose();
      synthRef.current = null;
    };
  }, []);

  useEffect(() => {
    localUnlockAdapter.save(unlockState);
  }, [unlockState]);

  useEffect(() => {
    saveProgressionState(userId, progression);
  }, [progression, userId]);

  useEffect(() => {
    if (!discoveryToast) return;
    const timer = window.setTimeout(() => setDiscoveryToast(null), 4600);
    return () => window.clearTimeout(timer);
  }, [discoveryToast]);

  useEffect(() => {
    synthRef.current?.setMasterVolume(masterVolume);
  }, [masterVolume]);

  const announce = useCallback(
    (msg: string, forceSpeak = false) => {
      setLiveAnnouncement(msg);
      if (voiceEnabled || forceSpeak) {
        speakTextPt(msg);
      }
    },
    [voiceEnabled]
  );

  const handleToggleLayer = useCallback(
    (id: DatasetId) => {
      setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, enabled: !l.enabled } : l)));
      const ds = NASA_DATASETS[id];
      announce(`Camada ${ds.shortName} alternada.`);
    },
    [announce]
  );

  const handleSoloLayer = useCallback(
    (id: DatasetId) => {
      setLayers((prev) =>
        prev.map((l) =>
          l.id === id
            ? { ...l, enabled: true, opacity: 1, blendMode: 'normal' }
            : { ...l, enabled: false }
        )
      );
      setPrimaryTrackId(id);
      announce(`Exibindo somente a camada ${NASA_DATASETS[id].shortName}.`);
    },
    [announce]
  );

  const handleChangeLayerOpacity = useCallback((id: DatasetId, opacity: number) => {
    setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, opacity } : l)));
  }, []);

  const handleChangeLayerBlendMode = useCallback((id: DatasetId, blendMode: BlendMode) => {
    setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, blendMode } : l)));
  }, []);

  const handleReorderLayer = useCallback((fromId: DatasetId, toId: DatasetId) => {
    if (fromId === toId) return;
    setLayers((prev) => {
      const fromIdx = prev.findIndex((l) => l.id === fromId);
      const toIdx = prev.findIndex((l) => l.id === toId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
  }, []);

  const handleMixAllLayers = useCallback(() => {
    setLayers((prev) => {
      const allActive = prev.every((l) => l.enabled);
      if (allActive) {
        return DEFAULT_LAYER_STACK.map((l) => ({ ...l }));
      }
      return [
        { id: 'svs5148', enabled: true, opacity: 0.85, blendMode: 'normal' },
        { id: 'svs5147', enabled: true, opacity: 0.55, blendMode: 'overlay' },
        { id: 'svs5153', enabled: true, opacity: 0.72, blendMode: 'screen' },
        { id: 'svs5154', enabled: true, opacity: 0.75, blendMode: 'screen' },
        { id: 'svs5011', enabled: true, opacity: 0.92, blendMode: 'add' },
      ];
    });
    announce('Alternando mistura visual das 5 cores musicais no planeta.');
  }, [announce]);

  const getActiveVideos = useCallback((): HTMLVideoElement[] => {
    const list: HTMLVideoElement[] = [];
    for (const id of enabledDatasetIds) {
      const v = videoRefs.current[id];
      if (v) list.push(v);
    }
    return list;
  }, [enabledDatasetIds]);

  const getPrimaryVideo = useCallback((): HTMLVideoElement | null => {
    return videoRefs.current[primaryTrackId] ?? null;
  }, [primaryTrackId]);

  useEffect(() => {
    for (const id of DATASET_ORDER) {
      const vid = videoRefs.current[id];
      if (vid) {
        vid.loop = isLoop;
        vid.playbackRate = playbackRate;
      }
    }
  }, [isLoop, playbackRate]);

  useEffect(() => {
    const activeSet = new Set<DatasetId>(enabledDatasetIds);
    for (const id of DATASET_ORDER) {
      const vid = videoRefs.current[id];
      if (!vid) continue;
      if (activeSet.has(id)) {
        if (isPlaying) void vid.play().catch(() => {});
      } else {
        vid.pause();
      }
    }

    const primary = getPrimaryVideo();
    if (primary) {
      setCurrentTime(primary.currentTime || 0);
      setDuration(
        Number.isFinite(primary.duration) && primary.duration > 0
          ? primary.duration
          : NASA_DATASETS[primaryTrackId].durationHintSeconds
      );
    }
  }, [enabledDatasetIds, primaryTrackId, getPrimaryVideo, isPlaying]);

  useEffect(() => {
    let raf = 0;
    let lastSampleMs = 0;
    const sync = () => {
      const primary = getPrimaryVideo();
      if (primary) {
        setCurrentTime(primary.currentTime);
        if (Number.isFinite(primary.duration) && primary.duration > 0) {
          setDuration(primary.duration);
        }
        if (primary.ended && !isLoop) {
          setIsPlaying(false);
        }
      }
      const now = performance.now();
      if (now - lastSampleMs > 500) {
        lastSampleMs = now;
        setSampleTick((t) => t + 1);
      }
      if (isPlaying) {
        raf = requestAnimationFrame(sync);
      }
    };
    if (isPlaying) {
      raf = requestAnimationFrame(sync);
    }
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, isLoop, getPrimaryVideo]);

  const sampleReadingsAt = useCallback(
    (lon: number, lat: number): SampledReading[] => {
      const readings: SampledReading[] = [];
      for (const id of enabledDatasetIds) {
        const reading = sampleVideoAtLonLat(videoRefs.current[id] ?? null, lon, lat, id);
        if (reading) readings.push(reading);
      }
      return readings;
    },
    [enabledDatasetIds]
  );

  const selectedCountryReadings = useMemo(() => {
    void sampleTick;
    if (!selectedCountry) return [];
    return sampleReadingsAt(selectedCountry.lon, selectedCountry.lat);
  }, [selectedCountry, sampleReadingsAt, sampleTick]);

  const hoverReadings = useMemo(() => {
    void sampleTick;
    if (!hoverInfo) return [];
    return sampleReadingsAt(hoverInfo.lon, hoverInfo.lat);
  }, [hoverInfo, sampleReadingsAt, sampleTick]);

  useEffect(() => {
    if (!sonifyEnabled || hoverReadings.length === 0) return;
    playSonificationTone(hoverReadings[0].intensity01);
  }, [sonifyEnabled, hoverReadings]);

  const buildCountryAudioSummary = useCallback(
    (country: CountryEntry): string => {
      const log = getCountryLogistics(country);
      const readings = sampleReadingsAt(country.lon, country.lat);
      const readingsText =
        readings.length > 0
          ? `Leitura atual nas camadas: ${readings
              .map((r) => `${r.svsId}, ${r.labelPt}`)
              .join('. ')}.`
          : '';
      return `País selecionado: ${country.namePt}. Região: ${log.subregionPt}. ${log.summaryPt} Logística marítima: ${log.maritimePortsPt} Corredores: ${log.airAndLandCorridorsPt} ${readingsText}`;
    },
    [sampleReadingsAt]
  );

  const handleSelectCountry = useCallback(
    (country: CountryEntry | null) => {
      setSelectedCountry(country);
      if (country) {
        setRadiusTarget(null);
        setSelectionMode('country');
      }
      setUnlockFeedback(null);
      if (!country) {
        announce('Seleção de país removida.');
        return;
      }
      nonceRef.current += 1;
      setFlyTarget({
        lon: country.lon,
        lat: country.lat,
        distance: Math.min(2.38, country.idealDistance * 1.12),
        nonce: nonceRef.current,
      });
      announce(buildCountryAudioSummary(country));
    },
    [announce, buildCountryAudioSummary]
  );

  // Auto-focus Brazil (1/5 partially unlocked demo) when entering via Jury No-Login quick access
  useEffect(() => {
    if (!isJuryQuickEntry) return;
    const brazil = countries.find((c) => c.nameEn === 'Brazil') ?? countries[0];
    if (brazil) {
      setSelectedCountry(brazil);
      nonceRef.current += 1;
      setFlyTarget({
        lon: brazil.lon,
        lat: brazil.lat,
        distance: Math.min(2.38, brazil.idealDistance * 1.12),
        nonce: nonceRef.current,
      });
      setLiveAnnouncement(
        'Modo Júri ativado sem login. Exemplo em exibição: Brasil com 1 de 5 camadas liberadas pelo coletivo. Pressione J para tocar ou clique em Liberar Tudo (Júri).'
      );
    }
  }, [countries, isJuryQuickEntry]);

  const soundscapeTarget: SoundscapeTarget | null = useMemo(() => {
    if (selectedCountry) {
      return { type: 'country', country: selectedCountry, label: selectedCountry.namePt };
    }
    if (radiusTarget) {
      return radiusTarget;
    }
    return null;
  }, [radiusTarget, selectedCountry]);

  const activeRegionKey = useMemo(() => {
    if (selectedCountry) return buildCountryRegionKey(selectedCountry);
    if (radiusTarget) return buildRadiusRegionKey(radiusTarget.centerLon, radiusTarget.centerLat);
    return null;
  }, [radiusTarget, selectedCountry]);

  const unlockSummary = useMemo(() => {
    if (!activeRegionKey) {
      return getRegionUnlockSummary(unlockState, 'none', userId);
    }
    return getRegionUnlockSummary(unlockState, activeRegionKey, userId);
  }, [activeRegionKey, unlockState, userId]);

  const ecosystemSummary = useMemo(
    () => getGlobalEcosystemSummary(unlockState, countries),
    [countries, unlockState]
  );

  const nextIncompleteRegion = useMemo(() => {
    const candidate = ecosystemSummary.regions.find(
      (r) => !r.isComplete && r.country && r.country.id !== selectedCountry?.id
    );
    if (candidate && candidate.country) {
      return {
        label: candidate.regionLabel,
        unlockedCount: candidate.unlockedCount,
        country: candidate.country,
      };
    }
    const fallback = countries.find(
      (c) => c.id !== selectedCountry?.id && !unlockState.regions[buildCountryRegionKey(c)]
    );
    if (fallback) {
      return {
        label: fallback.namePt,
        unlockedCount: 0,
        country: fallback,
      };
    }
    return null;
  }, [countries, ecosystemSummary.regions, selectedCountry?.id, unlockState.regions]);

  const audibleStems = useMemo<Record<StemId, boolean>>(
    () => ({
      melody: unlockSummary.unlockedStems.melody && !stemUserMuted.melody,
      harmony: unlockSummary.unlockedStems.harmony && !stemUserMuted.harmony,
      rhythm: unlockSummary.unlockedStems.rhythm && !stemUserMuted.rhythm,
      bass: unlockSummary.unlockedStems.bass && !stemUserMuted.bass,
      fx: unlockSummary.unlockedStems.fx && !stemUserMuted.fx,
    }),
    [stemUserMuted, unlockSummary.unlockedStems]
  );

  const handlePickRadiusCenter = useCallback(
    (lon: number, lat: number) => {
      setSelectedCountry(null);
      setUnlockFeedback(null);
      const label = `Raio ${radiusKm} km`;
      setRadiusTarget({
        type: 'radius',
        centerLon: lon,
        centerLat: lat,
        radiusKm,
        label,
      });
      nonceRef.current += 1;
      setFlyTarget({
        lon,
        lat,
        distance: Math.max(1.35, Math.min(2.6, 1.15 + radiusKm / 1900)),
        nonce: nonceRef.current,
      });
      announce(`Raio sonoro de ${radiusKm} quilômetros posicionado em ${formatLatLon(lat, lon)}.`);
    },
    [announce, radiusKm]
  );

  const handleChangeSelectionMode = useCallback(
    (mode: 'country' | 'radius') => {
      setSelectionMode(mode);
      if (mode === 'radius' && !radiusTarget) {
        const lon = selectedCountry?.lon ?? cameraCenterRef.current.lon;
        const lat = selectedCountry?.lat ?? cameraCenterRef.current.lat;
        setSelectedCountry(null);
        setRadiusTarget({
          type: 'radius',
          centerLon: lon,
          centerLat: lat,
          radiusKm,
          label: `Raio ${radiusKm} km`,
        });
        announce('Modo Raio geográfico ativado. Clique no mapa ou ajuste o raio em km.');
      } else if (mode === 'country') {
        announce('Modo seleção por País ativado.');
      }
    },
    [announce, radiusKm, radiusTarget, selectedCountry]
  );

  const handleContributeStem = useCallback(
    (stemId: StemId) => {
      if (!activeRegionKey || !soundscapeTarget) return;
      const res = contributeRegionStem(unlockState, {
        regionKey: activeRegionKey,
        regionLabel: soundscapeTarget.label,
        stemId,
        contributorId: userId,
        contributorName: userName,
      });
      setUnlockState(res.nextState);
      setUnlockFeedback(res.reasonPt);
      announce(res.reasonPt);
      if (res.ok) {
        setUnlockPulseNonce((n) => n + 1);
        const nextSummary = getRegionUnlockSummary(res.nextState, activeRegionKey, userId);
        setProgression((prev) => {
          const progRes = recordCollectiveContribution(prev, {
            regionKey: activeRegionKey,
            regionLabel: soundscapeTarget.label,
            stemId,
            isRegionComplete5of5: nextSummary.unlockedCount >= 5,
          });
          if (progRes.xpGained > 0 && progRes.nextState.lastDiscovery) {
            setDiscoveryToast(progRes.nextState.lastDiscovery);
          }
          return progRes.nextState;
        });
      }
    },
    [activeRegionKey, announce, soundscapeTarget, unlockState, userId, userName]
  );

  const handleSimulateCollectiveNext = useCallback(() => {
    if (!activeRegionKey || !soundscapeTarget) return;
    const nextLocked = STEM_ORDER.find((s) => !unlockSummary.record?.contributions[s]);
    if (!nextLocked) return;
    const simIdx = Object.keys(unlockSummary.record?.contributions ?? {}).length + 1;
    const simNames = ['Camila (SP)', 'Davi (BA)', 'Elena (RS)', 'Marcos (AM)', 'Nadia (CE)'];
    const simName = simNames[simIdx % simNames.length];
    const res = contributeRegionStem(unlockState, {
      regionKey: activeRegionKey,
      regionLabel: soundscapeTarget.label,
      stemId: nextLocked,
      contributorId: `community-sim-${simIdx}`,
      contributorName: simName,
      bypassSingleLimit: true,
    });
    setUnlockState(res.nextState);
    if (res.ok) setUnlockPulseNonce((n) => n + 1);
    setUnlockFeedback(res.reasonPt);
    announce(res.reasonPt);
  }, [activeRegionKey, announce, soundscapeTarget, unlockState, unlockSummary.record?.contributions]);

  const handleExplainMusic = useCallback(() => {
    if (!soundscapeTelemetry) {
      announce('Selecione um país ou raio no mapa para explicar a música gerada.', true);
      return;
    }
    const text = buildExplainMusicPt(soundscapeTelemetry, audibleStems ? unlockSummary : unlockSummary, audibleStems);
    announce(text, true);
  }, [announce, audibleStems, soundscapeTelemetry, unlockSummary]);

  // Real-time 1:1 telemetry derivation & Jukebox step scheduler
  useEffect(() => {
    if (!soundscapeTarget) {
      setSoundscapeTelemetry(null);
      synthRef.current?.stop();
      setJukeboxPlaying(false);
      return;
    }
    const bounds = getTargetBounds(soundscapeTarget);
    const stats = sampleSoundscapeStats(videoRefs.current, bounds, stepCounterRef.current);
    const initialTel = deriveMusicalParameters(
      soundscapeTarget,
      bounds,
      stats,
      stepCounterRef.current,
      Math.floor(stepCounterRef.current / 2)
    );
    setSoundscapeTelemetry(initialTel);

    if (activeRegionKey) {
      setProgression((prev) => {
        const res = recordRegionDiscovery(prev, {
          regionKey: activeRegionKey,
          regionLabel: soundscapeTarget.label,
          telemetry: initialTel,
        });
        if (res.xpGained > 0 && res.nextState.lastDiscovery) {
          setDiscoveryToast(res.nextState.lastDiscovery);
        }
        return res.nextState;
      });
    }

    if (!jukeboxPlaying) {
      synthRef.current?.stop();
      return;
    }

    if (!synthRef.current) {
      synthRef.current = new SoundscapeSynthPlayer();
    }
    synthRef.current.setMasterVolume(masterVolume);

    // Also start NASA videos gently if paused so pixels evolve live with music
    if (!isPlaying) {
      getActiveVideos().forEach((v) => {
        void v.play().catch(() => {});
      });
      setIsPlaying(true);
    }

    const stepMs = Math.max(240, Math.round((60 / initialTel.bpm / 2) * 1000));
    const tickStep = () => {
      stepCounterRef.current += 1;
      const stepIdx = stepCounterRef.current;
      const liveStats = sampleSoundscapeStats(videoRefs.current, bounds, stepIdx);
      const tel = deriveMusicalParameters(
        soundscapeTarget,
        bounds,
        liveStats,
        stepIdx,
        Math.floor(stepIdx / 2)
      );
      setSoundscapeTelemetry(tel);
      synthRef.current?.triggerStep(tel, stepIdx, audibleStems);
    };

    tickStep();
    const timer = window.setInterval(tickStep, stepMs);
    return () => {
      window.clearInterval(timer);
    };
  }, [audibleStems, getActiveVideos, isPlaying, jukeboxPlaying, sampleTick, soundscapeTarget]);

  const handleToggleStemMute = useCallback(
    (stemId: StemId) => {
      if (!unlockSummary.unlockedStems[stemId]) {
        announce(`A camada ${STEM_METAS[stemId].labelPt} está bloqueada nesta região.`, true);
        return;
      }
      setStemUserMuted((prev) => {
        const nextMuted = !prev[stemId];
        announce(
          `${STEM_METAS[stemId].labelPt} ${nextMuted ? 'silenciada' : 'ativada'} na Jukebox.`
        );
        return { ...prev, [stemId]: nextMuted };
      });
    },
    [announce, unlockSummary.unlockedStems]
  );

  const handleSoloStem = useCallback(
    (stemId: StemId) => {
      setStemUserMuted({
        melody: stemId !== 'melody',
        harmony: stemId !== 'harmony',
        rhythm: stemId !== 'rhythm',
        bass: stemId !== 'bass',
        fx: stemId !== 'fx',
      });
      announce(`Ouvindo somente o instrumento ${STEM_METAS[stemId].labelPt}.`);
    },
    [announce]
  );

  const handleSpeakNow = useCallback(() => {
    if (selectedCountry) {
      announce(buildCountryAudioSummary(selectedCountry), true);
      return;
    }
    const targetLon = hoverInfo?.lon ?? cameraCenterRef.current.lon;
    const targetLat = hoverInfo?.lat ?? cameraCenterRef.current.lat;
    const readings = sampleReadingsAt(targetLon, targetLat);
    const countryName = hoverInfo?.country ? `Sobre ${hoverInfo.country.namePt}. ` : '';
    const coordsText = `Posição ${formatLatLon(targetLat, targetLon)}. `;
    const readingsText =
      readings.length > 0
        ? readings.map((r) => `${r.svsId}: ${r.labelPt}`).join('. ')
        : 'Nenhuma camada ativa pronta para leitura.';
    announce(`${countryName}${coordsText}${readingsText}`, true);
  }, [announce, buildCountryAudioSummary, hoverInfo, sampleReadingsAt, selectedCountry]);

  const handleTogglePlay = useCallback(() => {
    const videos = getActiveVideos();
    if (videos.length === 0) return;

    if (isPlaying) {
      videos.forEach((v) => v.pause());
      setIsPlaying(false);
      announce('Animação pausada.');
    } else {
      Promise.all(videos.map((v) => v.play().catch(() => {}))).then(() => {
        setIsPlaying(true);
        announce('Animação em reprodução.');
      });
    }
  }, [announce, getActiveVideos, isPlaying]);

  const handleSeek = useCallback(
    (time: number) => {
      const primary = getPrimaryVideo();
      if (!primary) return;
      const dur =
        Number.isFinite(primary.duration) && primary.duration > 0 ? primary.duration : duration;
      const clamped = clampVideoTime(time, dur);
      primary.currentTime = clamped;
      setCurrentTime(clamped);

      for (const id of enabledDatasetIds) {
        if (id === primaryTrackId) continue;
        const secondary = videoRefs.current[id];
        if (
          secondary &&
          Number.isFinite(secondary.duration) &&
          secondary.duration > 0 &&
          dur > 0
        ) {
          secondary.currentTime = (clamped / dur) * secondary.duration;
        }
      }
      setSampleTick((t) => t + 1);
    },
    [duration, enabledDatasetIds, getPrimaryVideo, primaryTrackId]
  );

  const handleStepFrame = useCallback(
    (direction: 1 | -1) => {
      const videos = getActiveVideos();
      videos.forEach((v) => v.pause());
      setIsPlaying(false);

      const primary = getPrimaryVideo();
      if (!primary) return;
      const dur =
        Number.isFinite(primary.duration) && primary.duration > 0 ? primary.duration : duration;
      const fps = NASA_DATASETS[primaryTrackId].fpsEstimate;
      const next = stepVideoTime(primary.currentTime, dur, direction, fps);
      primary.currentTime = next;
      setCurrentTime(next);
      setSampleTick((t) => t + 1);
    },
    [duration, getActiveVideos, getPrimaryVideo, primaryTrackId]
  );

  const handleRestart = useCallback(() => {
    getActiveVideos().forEach((v) => {
      v.currentTime = 0;
    });
    setCurrentTime(0);
    setSampleTick((t) => t + 1);
  }, [getActiveVideos]);

  const handleFlyPreset = useCallback(
    (preset: QuickPreset) => {
      setSelectedCountry(null);
      setRadiusTarget(null);
      nonceRef.current += 1;
      setFlyTarget({
        lon: preset.lon,
        lat: preset.lat,
        distance: preset.distance,
        nonce: nonceRef.current,
      });
      announce(`Movendo visualização para ${preset.label}.`);
    },
    [announce]
  );

  const handleZoomStep = useCallback((delta: number) => {
    nonceRef.current += 1;
    setZoomCommand({ delta, nonce: nonceRef.current });
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.code === 'Space') {
        e.preventDefault();
        handleTogglePlay();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        nonceRef.current += 1;
        setPanCommand({ dLon: -10, dLat: 0, nonce: nonceRef.current });
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        nonceRef.current += 1;
        setPanCommand({ dLon: 10, dLat: 0, nonce: nonceRef.current });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        nonceRef.current += 1;
        setPanCommand({ dLon: 0, dLat: 8, nonce: nonceRef.current });
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        nonceRef.current += 1;
        setPanCommand({ dLon: 0, dLat: -8, nonce: nonceRef.current });
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        handleZoomStep(-0.24);
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        handleZoomStep(0.24);
      } else if (e.key.toLowerCase() === 'v') {
        setVoiceEnabled((prev) => {
          const next = !prev;
          if (!next) stopSpeech();
          else speakTextPt('Narração por voz ativada.');
          return next;
        });
      } else if (e.key.toLowerCase() === 'r') {
        handleSpeakNow();
      } else if (e.key.toLowerCase() === 's') {
        setSonifyEnabled((prev) => !prev);
      } else if (e.key.toLowerCase() === 'c') {
        onToggleHighContrast();
      } else if (e.key.toLowerCase() === 'h') {
        setHdEnhance((prev) => {
          const next = !prev;
          announce(next ? 'Nitidez HD por GPU ativada.' : 'Nitidez HD por GPU desativada.');
          return next;
        });
      } else if (e.key.toLowerCase() === 'j') {
        e.preventDefault();
        if (!soundscapeTarget) {
          const brazil = countries.find((c) => c.nameEn === 'Brazil') ?? countries[0];
          if (brazil) handleSelectCountry(brazil);
        }
        setJukeboxPlaying((prev) => {
          const next = !prev;
          announce(next ? 'Jukebox espacial iniciada.' : 'Jukebox espacial pausada.');
          return next;
        });
      } else if (e.key.toLowerCase() === 'e') {
        e.preventDefault();
        handleExplainMusic();
      } else if (['1', '2', '3', '4', '5'].includes(e.key)) {
        const stemIdx = Number(e.key) - 1;
        const stemId = STEM_ORDER[stemIdx];
        if (stemId) handleToggleStemMute(stemId);
      } else if (e.key === 'Escape' && (selectedCountry || radiusTarget)) {
        handleSelectCountry(null);
        setRadiusTarget(null);
        setJukeboxPlaying(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    announce,
    countries,
    handleExplainMusic,
    handleSelectCountry,
    handleSpeakNow,
    handleTogglePlay,
    handleToggleStemMute,
    handleZoomStep,
    onToggleHighContrast,
    radiusTarget,
    selectedCountry,
    soundscapeTarget,
  ]);

  const isPrimaryReady = Boolean(readyMap[primaryTrackId]);

  return (
    <main
      id="main-earth-region"
      className={`app-shell ${highContrast ? 'high-contrast' : ''} ${motionPaused ? 'motion-paused' : ''}`}
      style={{ fontSize: `${Math.round(fontScale * 100)}%` }}
    >
      <div className="sr-only" aria-live="polite" aria-atomic="true" data-testid="a11y-live-region">
        {liveAnnouncement}
      </div>

      {DATASET_ORDER.map((id) => {
        const ds = NASA_DATASETS[id];
        const isActive = enabledDatasetIds.includes(id);
        return (
          <video
            key={id}
            ref={(el) => setVideoRef(id, el)}
            data-dataset-id={id}
            src={ds.videoUrl}
            muted
            playsInline
            loop={isLoop}
            preload={isActive ? 'auto' : 'metadata'}
            onLoadedData={() => {
              setReadyMap((prev) => ({ ...prev, [id]: true }));
              const vid = videoRefs.current[id];
              if (id === primaryTrackId && vid && Number.isFinite(vid.duration) && vid.duration > 0) {
                setDuration(vid.duration);
              }
            }}
            onCanPlay={() => {
              setReadyMap((prev) => ({ ...prev, [id]: true }));
              const vid = videoRefs.current[id];
              if (vid && isActive && isPlaying && !motionPaused) {
                void vid.play().catch(() => {});
              }
            }}
            style={{ display: 'none' }}
          />
        );
      })}

      <EarthCanvas
        videoElements={videoElements}
        layers={layers}
        viewMode={viewMode}
        showBorders={showBorders}
        showGrid={showGrid}
        showLabels={showLabels}
        highContrast={highContrast}
        hdEnhance={hdEnhance}
        countries={countries}
        allRings={allRings}
        selectedCountry={selectedCountry}
        selectionMode={selectionMode}
        radiusTarget={radiusTarget}
        onPickRadiusCenter={handlePickRadiusCenter}
        showUnlockMap={showUnlockMap}
        unlockState={unlockState}
        soundscapeTelemetry={soundscapeTelemetry}
        jukeboxPlaying={jukeboxPlaying}
        audibleStems={audibleStems}
        getAudioReactiveBands={() =>
          synthRef.current?.getAudioReactiveBands() ?? EMPTY_AUDIO_FRAME
        }
        motionPaused={motionPaused}
        isCelebrating5of5={Boolean(unlockSummary?.isCompleteReal)}
        hasGoldenTrailReward={Boolean(
          !isGuestSession && progression.unlockedSymphonyKeys.length > 0
        )}
        unlockPulseNonce={unlockPulseNonce}
        flyTarget={flyTarget}
        zoomCommand={zoomCommand}
        panCommand={panCommand}
        onHoverChange={setHoverInfo}
        onCameraDistanceChange={setCameraDistance}
        onCameraCenterChange={(lon, lat) => {
          cameraCenterRef.current = { lon, lat };
        }}
        onSelectCountry={handleSelectCountry}
      />

      <HudOverlay
        viewMode={viewMode}
        onToggleViewMode={(mode) => {
          setViewMode(mode);
          announce(mode === '3d' ? 'Modo Globo 3D ativado.' : 'Modo Mapa 2D plano ativado.');
        }}
        layers={layers}
        onToggleLayer={handleToggleLayer}
        onSoloLayer={handleSoloLayer}
        onMixAllLayers={handleMixAllLayers}
        onChangeLayerOpacity={handleChangeLayerOpacity}
        onChangeLayerBlendMode={handleChangeLayerBlendMode}
        onReorderLayer={handleReorderLayer}
        showBorders={showBorders}
        onToggleBorders={() => setShowBorders((v) => !v)}
        showGrid={showGrid}
        onToggleGrid={() => setShowGrid((v) => !v)}
        showLabels={showLabels}
        onToggleLabels={() => setShowLabels((v) => !v)}
        hdEnhance={hdEnhance}
        onToggleHdEnhance={() =>
          setHdEnhance((prev) => {
            const next = !prev;
            announce(next ? 'Nitidez HD por GPU ativada.' : 'Nitidez HD por GPU desativada.');
            return next;
          })
        }
        selectionMode={selectionMode}
        onChangeSelectionMode={handleChangeSelectionMode}
        showUnlockMap={showUnlockMap}
        onToggleUnlockMap={() =>
          setShowUnlockMap((prev) => {
            const next = !prev;
            announce(
              next
                ? 'Mapa de iluminação coletiva ativado.'
                : 'Mapa de iluminação coletiva ocultado.'
            );
            return next;
          })
        }
        countries={countries}
        selectedCountry={selectedCountry}
        onSelectAndFlyCountry={handleSelectCountry}
        onFlyPreset={handleFlyPreset}
        onZoomStep={handleZoomStep}
        onReopenTour={onReopenTour}
        hoverInfo={hoverInfo}
        hoverReadings={hoverReadings}
        approxAltKm={approxAltKm}
        onLogout={() => {
          stopSpeech();
          onLogout();
        }}
        userName={userName}
        username={username ?? userId}
        originCountryCode={originCountryCode}
        onChangeOriginCountry={onChangeOriginCountry}
        isGuestSession={isGuestSession}
        onOpenAuth={onOpenAuth}
        onOpenRegister={onOpenRegister}
        highContrast={highContrast}
        onToggleHighContrast={onToggleHighContrast}
        fontScale={fontScale}
        onCycleFontScale={onCycleFontScale}
        voiceEnabled={voiceEnabled}
        onToggleVoice={() =>
          setVoiceEnabled((prev) => {
            const next = !prev;
            if (!next) stopSpeech();
            else speakTextPt('Narração por voz em português ativada.');
            return next;
          })
        }
        sonifyEnabled={sonifyEnabled}
        onToggleSonify={() => setSonifyEnabled((v) => !v)}
        ecosystemSummary={ecosystemSummary}
        explorerXp={progression.xp}
        progression={progression}
        stemActivity={soundscapeTelemetry?.stemActivity}
        activeRegionLabel={soundscapeTarget?.label ?? null}
        activeRegionUnlockCount={unlockSummary?.unlockedCount ?? 0}
        discoveryToast={discoveryToast}
        onDismissDiscovery={() => setDiscoveryToast(null)}
        copilotWidget={
          <AstronautCopilot
            selectedCountry={selectedCountry}
            userName={userName}
            ecosystemSummary={ecosystemSummary}
            progression={progression}
            jukeboxPlaying={jukeboxPlaying}
            motionPaused={motionPaused}
            compactByDefault={true}
            isGuestSession={isGuestSession}
            onSelectCountry={handleSelectCountry}
            voiceEnabled={voiceEnabled}
            sonifyEnabled={sonifyEnabled}
            highContrast={highContrast}
            fontScale={fontScale}
            liveAnnouncement={liveAnnouncement}
            onToggleVoice={() =>
              setVoiceEnabled((prev) => {
                const next = !prev;
                if (!next) stopSpeech();
                else speakTextPt('Narração por voz em português ativada.');
                return next;
              })
            }
            onToggleSonify={() => setSonifyEnabled((v) => !v)}
            onToggleHighContrast={onToggleHighContrast}
            onCycleFontScale={onCycleFontScale}
          />
        }
        detailCard={
          soundscapeTarget ? (
            <CountryDetailCard
              country={selectedCountry}
              radiusTarget={radiusTarget}
              liveReadings={selectedCountryReadings}
              telemetry={soundscapeTelemetry}
              jukeboxSlot={
                <JukeboxPanel
                  regionLabel={soundscapeTarget.label}
                  isRadiusMode={Boolean(radiusTarget && !selectedCountry)}
                  radiusKm={radiusKm}
                  onChangeRadiusKm={(km) => {
                    setRadiusKm(km);
                    setRadiusTarget((prev) =>
                      prev
                        ? {
                            ...prev,
                            radiusKm: km,
                            label: `Raio ${km} km`,
                          }
                        : null
                    );
                  }}
                  jukeboxPlaying={jukeboxPlaying}
                  onToggleJukeboxPlay={() => {
                    setJukeboxPlaying((prev) => {
                      const next = !prev;
                      announce(
                        next
                          ? `Tocando Jukebox 1 para 1 de ${soundscapeTarget.label}.`
                          : 'Jukebox pausada.'
                      );
                      return next;
                    });
                  }}
                  onExplainMusic={handleExplainMusic}
                  telemetry={soundscapeTelemetry}
                  unlockSummary={unlockSummary}
                  juryUnlockAll={unlockState.juryUnlockAll}
                  onToggleJuryUnlockAll={() => {
                    setUnlockState((prev) => {
                      const nextAll = !prev.juryUnlockAll;
                      announce(
                        nextAll
                          ? 'Modo Júri: todas as 5 camadas musicais liberadas para demonstração.'
                          : 'Modo Júri desativado: retornando às camadas liberadas pelo coletivo.'
                      );
                      return { ...prev, juryUnlockAll: nextAll };
                    });
                  }}
                  onContributeStem={handleContributeStem}
                  onSimulateCollectiveNext={handleSimulateCollectiveNext}
                  stemUserMuted={stemUserMuted}
                  onToggleStemMute={handleToggleStemMute}
                  onSoloStem={handleSoloStem}
                  unlockFeedback={unlockFeedback}
                  nextIncompleteRegion={
                    nextIncompleteRegion
                      ? {
                          label: nextIncompleteRegion.label,
                          unlockedCount: nextIncompleteRegion.unlockedCount,
                          onFly: () => handleSelectCountry(nextIncompleteRegion.country),
                        }
                      : null
                  }
                />
              }
              onClose={() => {
                handleSelectCountry(null);
                setRadiusTarget(null);
                setJukeboxPlaying(false);
              }}
              onZoomIntoCountry={() => {
                if (!selectedCountry) return;
                nonceRef.current += 1;
                setFlyTarget({
                  lon: selectedCountry.lon,
                  lat: selectedCountry.lat,
                  distance: Math.max(1.12, selectedCountry.idealDistance * 0.78),
                  nonce: nonceRef.current,
                });
              }}
              onSpeakSummary={() => {
                if (selectedCountry) {
                  announce(buildCountryAudioSummary(selectedCountry), true);
                } else {
                  handleExplainMusic();
                }
              }}
            />
          ) : null
        }
        playerBar={
          <PlayerBar
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            playbackRate={playbackRate}
            isLoop={isLoop}
            isReady={isPrimaryReady}
            enabledDatasetIds={enabledDatasetIds}
            primaryTrackId={primaryTrackId}
            onChangePrimaryTrack={setPrimaryTrackId}
            onTogglePlay={handleTogglePlay}
            onSeek={handleSeek}
            onStepFrame={handleStepFrame}
            onChangeRate={setPlaybackRate}
            onToggleLoop={() => setIsLoop((v) => !v)}
            onRestart={handleRestart}
            jukeboxPlaying={jukeboxPlaying}
            activeRegionLabel={soundscapeTarget?.label ?? null}
            soundscapeTelemetry={soundscapeTelemetry}
            audibleStems={audibleStems}
            onToggleStemMute={handleToggleStemMute}
            onToggleLayer={handleToggleLayer}
            masterVolume={masterVolume}
            onChangeMasterVolume={(vol) => {
              setMasterVolume(vol);
              synthRef.current?.setMasterVolume(vol);
            }}
            motionPaused={motionPaused}
            isCelebrating5of5={Boolean(unlockSummary?.isCompleteReal)}
            onToggleMotionPaused={() => {
              setMotionPaused((prev) => {
                const next = !prev;
                if (next) {
                  getActiveVideos().forEach((v) => v.pause());
                  setIsPlaying(false);
                }
                announce(next ? 'Movimento orbital e animações pausados.' : 'Movimento orbital retomado.');
                return next;
              });
            }}
            getAudioReactiveBands={() =>
              synthRef.current?.getAudioReactiveBands() ?? EMPTY_AUDIO_FRAME
            }
          />
        }
      />
    </main>
  );
};
