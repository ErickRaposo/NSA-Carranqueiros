import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  SampledReading,
  playSonificationTone,
  sampleVideoAtLonLat,
  speakTextPt,
  stopSpeech,
} from '../accessibility/a11yEngine';
import { AstronautCopilot, CollectiveTabId } from './AstronautCopilot';
import { CountryDetailCard } from './CountryDetailCard';
import { CameraViewTarget, EarthCanvas, HoverInfo, VisualArtStyle } from './EarthCanvas';
import { HudOverlay, LaunchpadAreaId } from './HudOverlay';
import { InAppRobotGuide } from './InAppRobotGuide';
import { JukeboxPanel } from './JukeboxPanel';
import { NasaDatasetCard } from './NasaDatasetCard';
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
import { formatLatLon } from '../geo/projection';
import { clampVideoTime, stepVideoTime } from '../utils/playerMath';
import {
  CommunityUnlockState,
  EcosystemFeedEvent,
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
  createInitialProgressionState,
  loadProgressionState,
  reconcileCoauthoredSymphonies,
  recordCollectiveContribution,
  recordRegionDiscovery,
  saveProgressionState,
} from '../game/progressionStore';
import { ParticipantProfileInput } from '../auth/authStorage';

const INAPP_GUIDE_STORAGE_KEY = 'mineiro_inapp_guide_v1';
const NASA_CARD_AUTO_STORAGE_KEY = 'mineiro_nasa_card_auto_v1';
const VALID_VISUAL_STYLES: VisualArtStyle[] = [
  'bioluminescent',
  'infrared',
  'blueprint',
  'satellite',
];
const VALID_BLENDS: BlendMode[] = ['normal', 'screen', 'add', 'overlay', 'difference'];

interface EarthExplorerViewProps {
  userName: string;
  userId?: string;
  username?: string;
  userEmail?: string;
  originCountryCode?: string;
  onChangeOriginCountry?: (countryCode: string) => void;
  onUpdateProfile?: (input: ParticipantProfileInput) => { ok: boolean; errorPt?: string };
  onUpdatePassword?: (
    currentPassword: string,
    newPassword: string
  ) => { ok: boolean; errorPt?: string };
  isJuryQuickEntry?: boolean;
  isGuestSession?: boolean;
  onOpenAuth?: () => void;
  onOpenRegister?: () => void;
  highContrast: boolean;
  onToggleHighContrast: () => void;
  fontScale: number;
  onCycleFontScale: () => void;
  tourNonce?: number;
  onReopenTour?: () => void;
  onLogout: () => void;
}

export const EarthExplorerView: React.FC<EarthExplorerViewProps> = ({
  userName,
  userId = userName.toLowerCase(),
  username,
  userEmail,
  originCountryCode,
  onChangeOriginCountry,
  onUpdateProfile,
  onUpdatePassword,
  isJuryQuickEntry = false,
  isGuestSession = false,
  onOpenAuth,
  onOpenRegister,
  highContrast,
  onToggleHighContrast,
  fontScale,
  onCycleFontScale,
  tourNonce = 0,
  onReopenTour,
  onLogout,
}) => {
  const { countries, allRings, landBorderRings, coastlineRings } = useMemo(
    () => loadWorldCountries(),
    []
  );

  const videoRefs = useRef<Partial<Record<DatasetId, HTMLVideoElement | null>>>({});
  const posterCaptureRef = useRef<
    (() => { glCanvas: HTMLCanvasElement; fxCanvas: HTMLCanvasElement | null } | null) | null
  >(null);
  const [videoElements, setVideoElements] = useState<
    Partial<Record<DatasetId, HTMLVideoElement | null>>
  >({});
  const [readyMap, setReadyMap] = useState<Partial<Record<DatasetId, boolean>>>({});

  const [viewMode, setViewMode] = useState<'3d' | '2d'>('3d');
  const viewModeLiveRef = useRef<'3d' | '2d'>('3d');
  viewModeLiveRef.current = viewMode;
  const preCountryViewModeRef = useRef<'3d' | '2d' | null>(null);
  const selectedCountryLiveRef = useRef<CountryEntry | null>(null);

  const [visualStyle, setVisualStyle] = useState<VisualArtStyle>('satellite');
  const [orbitAutoRotate, setOrbitAutoRotate] = useState<boolean>(() =>
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      ? false
      : true
  );
  const [layers, setLayers] = useState<LayerConfig[]>(DEFAULT_LAYER_STACK);
  const [primaryTrackId, setPrimaryTrackId] = useState<DatasetId>('svs5011');

  const [liveToastEvent, setLiveToastEvent] = useState<EcosystemFeedEvent | null>(null);
  const [collectiveTabRequest, setCollectiveTabRequest] = useState<{
    tab: CollectiveTabId;
    nonce: number;
  } | null>(null);
  const [externalAreaRequest, setExternalAreaRequest] = useState<{
    area: LaunchpadAreaId;
    nonce: number;
  } | null>(null);
  const [robotGuideOpen, setRobotGuideOpen] = useState<boolean>(() => {
    if (isJuryQuickEntry) return false;
    try {
      return localStorage.getItem(INAPP_GUIDE_STORAGE_KEY) !== '1';
    } catch {
      return true;
    }
  });
  const [nasaCardAutoOpen, setNasaCardAutoOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem(NASA_CARD_AUTO_STORAGE_KEY) !== 'off';
    } catch {
      return true;
    }
  });
  const [nasaCardDatasetId, setNasaCardDatasetId] = useState<DatasetId>('svs5011');
  const [nasaCardOpen, setNasaCardOpen] = useState<boolean>(() => {
    if (isJuryQuickEntry) return false;
    try {
      const guideNeedsFirstRun = localStorage.getItem(INAPP_GUIDE_STORAGE_KEY) !== '1';
      const autoAllowed = localStorage.getItem(NASA_CARD_AUTO_STORAGE_KEY) !== 'off';
      return !guideNeedsFirstRun && autoAllowed;
    } catch {
      return false;
    }
  });

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
  selectedCountryLiveRef.current = selectedCountry;
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
  const [duration, setDuration] = useState(NASA_DATASETS.svs5011.durationHintSeconds);
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
    setProgression(loadProgressionState(userId));
    setUnlockState(localUnlockAdapter.load(countries));
  }, [countries, userId, userName]);

  const handleExportParticipantData = useCallback(() => {
    if (typeof document === 'undefined') return;
    const payload = {
      exportedAtIso: new Date().toISOString(),
      platform: 'MINEIRØ · NASA Earth Information Jukebox',
      participant: {
        name: userName,
        username: username ?? userId,
        email: isGuestSession ? null : userEmail ?? null,
        originCountryCode: originCountryCode ?? null,
        sessionType: isGuestSession ? 'guest' : 'authenticated',
      },
      telemetry: {
        exploredRegionsCount: progression.exploredRegionKeys.length,
        exploredRegionKeys: progression.exploredRegionKeys,
        contributedRegionsCount: progression.contributedRegionKeys.length,
        contributedRegionKeys: progression.contributedRegionKeys,
        completedSymphoniesCount: progression.unlockedSymphonyKeys.length,
        unlockedSymphonyKeys: progression.unlockedSymphonyKeys,
        discoveredPhenomena: progression.discoveredPhenomena,
        contributionHistory: progression.contributionHistory,
        xp: progression.xp,
      },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mineiro-dados-${(username ?? userId).toLowerCase()}.json`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    announce('Arquivo JSON com seus dados de exploração exportado.');
  }, [isGuestSession, originCountryCode, progression, userEmail, userId, userName, username]);

  const handleResetProgression = useCallback(() => {
    const fresh = createInitialProgressionState();
    setProgression(fresh);
    saveProgressionState(userId, fresh);
    announce('Histórico local de exploração redefinido.');
  }, [userId]);

  useEffect(() => {
    if (tourNonce > 0) {
      setRobotGuideOpen(true);
    }
  }, [tourNonce]);

  const handleDismissRobotGuide = useCallback(() => {
    setRobotGuideOpen(false);
    try {
      localStorage.setItem(INAPP_GUIDE_STORAGE_KEY, '1');
    } catch {
      // Ignore storage quota errors
    }
    if (nasaCardAutoOpen && !selectedCountryLiveRef.current) {
      setNasaCardOpen(true);
    }
  }, [nasaCardAutoOpen]);

  // Hydrate shared Generative Art Mix & Country from URL (?mix=...&country=...)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const mixParam = params.get('mix');
    if (mixParam) {
      const [styleRaw, modeRaw, layersRaw] = mixParam.split('|');
      if (styleRaw && VALID_VISUAL_STYLES.includes(styleRaw as VisualArtStyle)) {
        setVisualStyle(styleRaw as VisualArtStyle);
      }
      if (modeRaw === '2d' || modeRaw === '3d') {
        setViewMode(modeRaw);
      }
      if (layersRaw) {
        const parsedLayers: LayerConfig[] = [];
        const seen = new Set<DatasetId>();
        for (const token of layersRaw.split(',')) {
          const [idRaw, enRaw, opRaw, blendRaw] = token.split(':');
          if (
            idRaw &&
            DATASET_ORDER.includes(idRaw as DatasetId) &&
            !seen.has(idRaw as DatasetId)
          ) {
            const dsId = idRaw as DatasetId;
            seen.add(dsId);
            const opNum = Math.min(1, Math.max(0, Number(opRaw) / 100));
            const blend = VALID_BLENDS.includes(blendRaw as BlendMode)
              ? (blendRaw as BlendMode)
              : 'normal';
            parsedLayers.push({
              id: dsId,
              enabled: enRaw === '1',
              opacity: Number.isFinite(opNum) ? opNum : 0.8,
              blendMode: blend,
            });
          }
        }
        if (parsedLayers.length > 0) {
          for (const fallback of DEFAULT_LAYER_STACK) {
            if (!seen.has(fallback.id)) {
              parsedLayers.push({ ...fallback });
            }
          }
          setLayers(parsedLayers);
        }
      }
    }

    const countryIso = params.get('country');
    if (countryIso) {
      const targetCountry = countries.find(
        (c) =>
          c.id.toLowerCase() === countryIso.toLowerCase() ||
          c.nameEn.toLowerCase() === countryIso.toLowerCase()
      );
      if (targetCountry) {
        preCountryViewModeRef.current = '3d';
        setViewMode('2d');
        setNasaCardOpen(false);
        setSelectedCountry(targetCountry);
        nonceRef.current += 1;
        setFlyTarget({
          lon: targetCountry.lon,
          lat: targetCountry.lat,
          distance: Math.min(1.78, Math.max(1.14, targetCountry.idealDistance * 0.76)),
          nonce: nonceRef.current,
        });
      }
    }
  }, [countries]);

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
    if (!liveToastEvent) return;
    const timer = window.setTimeout(() => setLiveToastEvent(null), 9500);
    return () => window.clearTimeout(timer);
  }, [liveToastEvent]);

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
      setLayers((prev) => {
        const target = prev.find((l) => l.id === id);
        const turningOn = target ? !target.enabled : true;
        const next = prev.map((l) => (l.id === id ? { ...l, enabled: !l.enabled } : l));
        if (turningOn) {
          setNasaCardDatasetId(id);
          if (nasaCardAutoOpen && !selectedCountryLiveRef.current && !robotGuideOpen) {
            setNasaCardOpen(true);
          }
        } else {
          const remaining = next.find((l) => l.enabled);
          if (remaining) {
            setNasaCardDatasetId(remaining.id);
          }
        }
        return next;
      });
      const ds = NASA_DATASETS[id];
      announce(`Camada ${ds.shortName} alternada.`);
    },
    [announce, nasaCardAutoOpen, robotGuideOpen]
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
      setNasaCardDatasetId(id);
      if (nasaCardAutoOpen && !selectedCountryLiveRef.current && !robotGuideOpen) {
        setNasaCardOpen(true);
      }
      announce(`Exibindo 100% da camada original NASA ${NASA_DATASETS[id].shortName}.`);
    },
    [announce, nasaCardAutoOpen, robotGuideOpen]
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

  const handleApplyArtPreset = useCallback(
    (presetId: 'storm' | 'currents' | 'five') => {
      if (presetId === 'storm') {
        setVisualStyle('infrared');
        setLayers([
          { id: 'svs5147', enabled: true, opacity: 0.9, blendMode: 'normal' },
          { id: 'svs5153', enabled: true, opacity: 0.78, blendMode: 'screen' },
          { id: 'svs5011', enabled: true, opacity: 1, blendMode: 'add' },
          { id: 'svs5148', enabled: false, opacity: 0.65, blendMode: 'screen' },
          { id: 'svs5154', enabled: false, opacity: 0.7, blendMode: 'overlay' },
        ]);
        announce('Preset artístico Tempestade Áurea aplicado no globo.');
      } else if (presetId === 'currents') {
        setVisualStyle('blueprint');
        setLayers([
          { id: 'svs5148', enabled: true, opacity: 0.95, blendMode: 'normal' },
          { id: 'svs5154', enabled: true, opacity: 0.85, blendMode: 'add' },
          { id: 'svs5011', enabled: true, opacity: 0.9, blendMode: 'difference' },
          { id: 'svs5153', enabled: false, opacity: 0.65, blendMode: 'screen' },
          { id: 'svs5147', enabled: false, opacity: 0.6, blendMode: 'overlay' },
        ]);
        announce('Preset artístico Correntes Neon aplicado em estilo Blueprint.');
      } else {
        setVisualStyle('bioluminescent');
        setLayers([
          { id: 'svs5148', enabled: true, opacity: 0.85, blendMode: 'normal' },
          { id: 'svs5147', enabled: true, opacity: 0.65, blendMode: 'overlay' },
          { id: 'svs5153', enabled: true, opacity: 0.78, blendMode: 'screen' },
          { id: 'svs5154', enabled: true, opacity: 0.8, blendMode: 'screen' },
          { id: 'svs5011', enabled: true, opacity: 0.96, blendMode: 'add' },
        ]);
        announce('Preset artístico 5 Elementos: todas as 5 camadas NASA fundidas.');
      }
    },
    [announce]
  );

  const handleShareMix = useCallback(() => {
    if (typeof window === 'undefined') return;
    const layersToken = layers
      .map(
        (l) =>
          `${l.id}:${l.enabled ? '1' : '0'}:${Math.round(l.opacity * 100)}:${l.blendMode}`
      )
      .join(',');
    const mixValue = `${visualStyle}|${viewMode}|${layersToken}`;
    const url = new URL(window.location.href);
    url.searchParams.set('mix', mixValue);
    if (selectedCountry) {
      url.searchParams.set('country', selectedCountry.id);
    } else {
      url.searchParams.delete('country');
    }
    window.history.replaceState({}, '', url.toString());
    void navigator.clipboard?.writeText(url.toString()).catch(() => {});

    setDiscoveryToast({
      regionKey: selectedCountry ? buildCountryRegionKey(selectedCountry) : 'share-mix',
      label: 'Link da Criação Copiado',
      stemId: 'melody',
      phenomenonPt: 'Compartilhe a URL para abrir este exato estilo, ordem e cores no globo.',
      xpGained: 0,
      completedMissions: [],
    });
    announce('Link da composição visual copiado para a área de transferência.');
  }, [announce, layers, selectedCountry, viewMode, visualStyle]);

  const handleDownloadPoster = useCallback(() => {
    const capture = posterCaptureRef.current?.();
    if (!capture) {
      announce('Aguarde o carregamento do globo para salvar o postal PNG.');
      return;
    }
    const width = 1280;
    const height = 720;
    const out = document.createElement('canvas');
    out.width = width;
    out.height = height;
    const ctx = out.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#040814';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(capture.glCanvas, 0, 0, width, height);
    if (capture.fxCanvas) {
      ctx.drawImage(capture.fxCanvas, 0, 0, width, height);
    }

    // Bottom museum signature plaque
    const grad = ctx.createLinearGradient(0, height - 110, 0, height);
    grad.addColorStop(0, 'rgba(4, 8, 20, 0)');
    grad.addColorStop(1, 'rgba(4, 8, 20, 0.92)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, height - 110, width, 110);

    const styleNames: Record<VisualArtStyle, string> = {
      bioluminescent: 'Noturno Bioluminescente',
      infrared: 'Infravermelho Orbital',
      blueprint: 'Blueprint Cartográfico',
      satellite: 'Satélite Diurno',
    };
    const activeNames = layers
      .filter((l) => l.enabled)
      .map((l) => NASA_DATASETS[l.id].shortName)
      .join(' · ');

    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 20px system-ui, -apple-system, sans-serif';
    ctx.fillText(
      `MINEIRØ · ARTE PLANETÁRIA NASA${selectedCountry ? ` — ${selectedCountry.namePt.toUpperCase()}` : ''}`,
      32,
      height - 46
    );
    ctx.fillStyle = '#7dd3fc';
    ctx.font = '600 14px system-ui, -apple-system, sans-serif';
    ctx.fillText(
      `Estilo: ${styleNames[visualStyle]}  |  Camadas: ${activeNames || ' Globo Base'}  |  Autor: @${username ?? userId}`,
      32,
      height - 22
    );

    const dataUrl = out.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `mineiro-arte-${selectedCountry ? selectedCountry.id.toLowerCase() : visualStyle}.png`;
    a.click();
    announce('Postal PNG de arte planetária salvo.');
  }, [announce, layers, selectedCountry, userId, username, visualStyle]);

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
      const readings = sampleReadingsAt(country.lon, country.lat);
      const readingsText =
        readings.length > 0
          ? `Fenômenos captados pela NASA agora: ${readings
              .map((r) => `${r.svsId}, ${r.labelPt}`)
              .join('. ')}.`
          : 'Ative camadas no Estúdio Visual para ler os dados de satélite.';
      return `País selecionado: ${country.namePt}, ${country.regionPt}. Coordenadas ${formatLatLon(country.lat, country.lon)}. ${readingsText}`;
    },
    [sampleReadingsAt]
  );

  const handleSelectCountry = useCallback(
    (country: CountryEntry | null) => {
      const prevCountry = selectedCountryLiveRef.current;
      setSelectedCountry(country);
      if (country) {
        if (!prevCountry) {
          preCountryViewModeRef.current = viewModeLiveRef.current;
        }
        setViewMode('2d');
        setNasaCardOpen(false);
        setRadiusTarget(null);
        setSelectionMode('country');
      } else {
        const exitMode = preCountryViewModeRef.current ?? viewModeLiveRef.current;
        setViewMode(exitMode);
        preCountryViewModeRef.current = null;
        const anchorLon = prevCountry?.lon ?? cameraCenterRef.current.lon;
        const anchorLat = prevCountry?.lat ?? cameraCenterRef.current.lat;
        nonceRef.current += 1;
        setFlyTarget({
          lon: anchorLon,
          lat: anchorLat,
          distance: exitMode === '3d' ? 2.75 : 2.42,
          nonce: nonceRef.current,
        });
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
        distance: Math.min(1.78, Math.max(1.14, country.idealDistance * 0.76)),
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
      preCountryViewModeRef.current = '3d';
      setViewMode('2d');
      setSelectedCountry(brazil);
      nonceRef.current += 1;
      setFlyTarget({
        lon: brazil.lon,
        lat: brazil.lat,
        distance: Math.min(1.78, Math.max(1.14, brazil.idealDistance * 0.76)),
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

  // Surface a subtle collective live notification shortly after entering orbit
  useEffect(() => {
    if (ecosystemSummary.recentFeed.length === 0) return;
    const timer = window.setTimeout(() => {
      setLiveToastEvent((curr) => curr ?? ecosystemSummary.recentFeed[0]);
    }, 1100);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reconcile co-authored 5/5 symphonies so contributors 1–4 also earn 5/5 rewards!
  useEffect(() => {
    const completedKeys = ecosystemSummary.regions
      .filter((r) => r.isComplete)
      .map((r) => r.regionKey);
    if (completedKeys.length === 0) return;
    setProgression((prev) => {
      const rec = reconcileCoauthoredSymphonies(prev, completedKeys);
      if (rec.xpGained > 0 && rec.nextState.lastDiscovery) {
        setDiscoveryToast(rec.nextState.lastDiscovery);
      }
      return rec.xpGained > 0 ? rec.nextState : prev;
    });
  }, [ecosystemSummary.regions]);

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
      (c) =>
        !c.isMinorUninhabited &&
        c.id !== selectedCountry?.id &&
        !unlockState.regions[buildCountryRegionKey(c)]
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
        const nextEco = getGlobalEcosystemSummary(res.nextState, countries);
        if (nextEco.recentFeed[0]) {
          setLiveToastEvent(nextEco.recentFeed[0]);
        }
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
    [activeRegionKey, announce, countries, soundscapeTarget, unlockState, userId, userName]
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
    if (res.ok) {
      setUnlockPulseNonce((n) => n + 1);
      const nextEco = getGlobalEcosystemSummary(res.nextState, countries);
      if (nextEco.recentFeed[0]) {
        setLiveToastEvent(nextEco.recentFeed[0]);
      }
    }
    setUnlockFeedback(res.reasonPt);
    announce(res.reasonPt);
  }, [
    activeRegionKey,
    announce,
    countries,
    soundscapeTarget,
    unlockState,
    unlockSummary.record?.contributions,
  ]);

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
      const regionCheck = getRegionUnlockSummary(unlockState, activeRegionKey, userId);
      setProgression((prev) => {
        const res = recordRegionDiscovery(prev, {
          regionKey: activeRegionKey,
          regionLabel: soundscapeTarget.label,
          telemetry: initialTel,
          isRegionComplete5of5: regionCheck.isCompleteReal,
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
        visualStyle={visualStyle}
        orbitAutoRotate={orbitAutoRotate}
        onRegisterPosterCapture={(fn) => {
          posterCaptureRef.current = fn;
        }}
        showBorders={showBorders}
        showGrid={showGrid}
        showLabels={showLabels}
        highContrast={highContrast}
        hdEnhance={hdEnhance}
        countries={countries}
        allRings={allRings}
        landBorderRings={landBorderRings}
        coastlineRings={coastlineRings}
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
        hasGoldenTrailReward={Boolean(progression.unlockedSymphonyKeys.length > 0)}
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

      {!selectedCountry && !radiusTarget && (
        <InAppRobotGuide
          open={robotGuideOpen}
          userName={userName}
          highContrast={highContrast}
          motionPaused={motionPaused}
          spotlightCountryLabel={ecosystemSummary.spotlightRegion?.regionLabel ?? null}
          spotlightUnlockedCount={ecosystemSummary.spotlightRegion?.unlockedCount ?? 4}
          onDismiss={handleDismissRobotGuide}
          onCycleVisualStyle={() => {
            setVisualStyle((curr) => {
              const idx = VALID_VISUAL_STYLES.indexOf(curr);
              const next = VALID_VISUAL_STYLES[(idx + 1) % VALID_VISUAL_STYLES.length];
              announce(`Estilo visual alterado para ${next}.`);
              return next;
            });
          }}
          onOpenVisualStudio={() => {
            nonceRef.current += 1;
            setExternalAreaRequest({ area: 'frequencias', nonce: nonceRef.current });
          }}
          onFlyToSpotlight={() => {
            const spotCountry = ecosystemSummary.spotlightRegion?.country;
            if (spotCountry) {
              handleSelectCountry(spotCountry);
            }
          }}
        />
      )}

      <HudOverlay
        viewMode={viewMode}
        onToggleViewMode={(mode) => {
          if (selectedCountryLiveRef.current) {
            preCountryViewModeRef.current = mode;
          } else {
            preCountryViewModeRef.current = null;
          }
          setViewMode(mode);
          announce(mode === '3d' ? 'Modo Globo 3D ativado.' : 'Modo Mapa 2D plano ativado.');
        }}
        visualStyle={visualStyle}
        onChangeVisualStyle={(style) => {
          setVisualStyle(style);
          announce(`Estilo artístico ${style} ativado no globo.`);
        }}
        onApplyArtPreset={handleApplyArtPreset}
        onShareMix={handleShareMix}
        onDownloadPoster={handleDownloadPoster}
        orbitAutoRotate={orbitAutoRotate}
        onToggleOrbitAutoRotate={() => {
          setOrbitAutoRotate((prev) => {
            const next = !prev;
            if (!next) {
              setMotionPaused(false);
            }
            announce(
              next
                ? 'Giro orbital contínuo do globo ativado.'
                : 'Giro orbital do globo pausado.'
            );
            return next;
          });
        }}
        onOpenCollectiveTab={(tab) => {
          nonceRef.current += 1;
          setCollectiveTabRequest({ tab, nonce: nonceRef.current });
        }}
        externalAreaRequest={externalAreaRequest}
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
        onReopenTour={() => {
          handleSelectCountry(null);
          setRadiusTarget(null);
          setNasaCardOpen(false);
          setRobotGuideOpen(true);
          onReopenTour?.();
        }}
        hoverInfo={hoverInfo}
        hoverReadings={hoverReadings}
        approxAltKm={approxAltKm}
        onLogout={() => {
          stopSpeech();
          onLogout();
        }}
        userName={userName}
        username={username ?? userId}
        userEmail={userEmail}
        originCountryCode={originCountryCode}
        onChangeOriginCountry={onChangeOriginCountry}
        onUpdateProfile={onUpdateProfile}
        onUpdatePassword={onUpdatePassword}
        onExportParticipantData={handleExportParticipantData}
        onResetProgression={handleResetProgression}
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
            username={username ?? userId}
            originCountryCode={originCountryCode}
            ecosystemSummary={ecosystemSummary}
            progression={progression}
            jukeboxPlaying={jukeboxPlaying}
            motionPaused={motionPaused}
            highContrast={highContrast}
            isGuestSession={isGuestSession}
            liveAnnouncement={liveAnnouncement}
            liveToastEvent={liveToastEvent}
            onDismissToast={() => setLiveToastEvent(null)}
            externalOpenRequest={collectiveTabRequest}
            onSelectCountry={handleSelectCountry}
            onOpenAuth={onOpenAuth}
          />
        }
        detailCard={
          soundscapeTarget ? (
            <CountryDetailCard
              country={selectedCountry}
              radiusTarget={radiusTarget}
              liveReadings={selectedCountryReadings}
              telemetry={soundscapeTelemetry}
              onShareMix={handleShareMix}
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
        nasaDatasetCard={
          <NasaDatasetCard
            open={nasaCardOpen && !robotGuideOpen}
            datasetId={nasaCardDatasetId}
            enabledDatasetIds={enabledDatasetIds}
            autoOpenEnabled={nasaCardAutoOpen}
            onSelectDataset={(id) => {
              setNasaCardDatasetId(id);
              if (!enabledDatasetIds.includes(id) && enabledDatasetIds.length <= 1) {
                setLayers((prev) =>
                  prev.map((l) =>
                    l.id === id
                      ? { ...l, enabled: true, opacity: 1, blendMode: 'normal' }
                      : { ...l, enabled: false }
                  )
                );
                setPrimaryTrackId(id);
                announce(`Exibindo 100% da camada original NASA ${NASA_DATASETS[id].shortName}.`);
              }
            }}
            onCloseOnce={() => setNasaCardOpen(false)}
            onCloseAndDisableAuto={() => {
              setNasaCardAutoOpen(false);
              setNasaCardOpen(false);
              try {
                localStorage.setItem(NASA_CARD_AUTO_STORAGE_KEY, 'off');
              } catch {
                // Ignore storage quota errors
              }
              announce(
                'Card científico NASA fechado. Não será aberto automaticamente ao entrar; use o botão Escala NASA quando quiser consultar.'
              );
            }}
            onRestoreAutoOpen={() => {
              setNasaCardAutoOpen(true);
              try {
                localStorage.removeItem(NASA_CARD_AUTO_STORAGE_KEY);
              } catch {
                // Ignore storage quota errors
              }
              announce('Exibição automática do card científico NASA reativada.');
            }}
          />
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
            isCelebrating5of5={Boolean(unlockSummary?.isCompleteReal)}
            onShareMix={handleShareMix}
            nasaCardOpen={nasaCardOpen && !robotGuideOpen}
            onToggleNasaCard={() => {
              setNasaCardOpen((prev) => {
                const next = !prev;
                if (next && enabledDatasetIds.length > 0) {
                  setNasaCardDatasetId((curr) =>
                    enabledDatasetIds.includes(curr) ? curr : enabledDatasetIds[0]
                  );
                }
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
