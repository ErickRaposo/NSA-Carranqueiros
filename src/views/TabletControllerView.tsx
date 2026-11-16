import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Database,
  Eye,
  EyeOff,
  Globe2,
  Headphones,
  Info,
  Pause,
  Play,
  Rocket,
  RotateCcw,
  Search,
  SkipBack,
  SlidersHorizontal,
  Square,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';
import {
  ALL_COUNTRY_OPTIONS,
  ALL_ISO_ALPHA2_CODES,
  CountryFlagIcon,
} from '../components/CountryFlag';
import { EarthCanvas } from '../components/EarthCanvas';
import { MissionGameButton } from '../components/MissionGameButton';
import { preloadPiperVoice } from '../accessibility/a11yEngine';
import { playLaunchThrust8D, startSpaceAmbient } from '../audio/spaceAmbient';
import { NasaDatasetCard } from '../components/NasaDatasetCard';
import { buildCountryNasaReport } from '../datasets/countryNasaReport';
import { DatasetId } from '../datasets/nasaDatasets';
import { useExperience } from '../experience/ExperienceContext';
import {
  GENERATED_COUNTRY_IDS,
  LAYER_METAS,
  MissionPhase,
  PILOT_COUNTRY_IDS,
  SoloableLayerId,
  VISUAL_LAYER_ORDER,
  VisualLayerId,
} from '../experience/types';
import { CountryEntry, loadWorldCountries, searchCountries } from '../geo/countries';
import { JukeboxStudioStage } from '../scenes/JukeboxStudioStage';
import { COUNTRY_ID_TO_ALPHA2 } from '../scenes/studioGeometry';
import {
  CONSOLE_HAPTIC_PATTERNS,
  stopConsoleHaptic,
  triggerConsoleHaptic,
} from '../utils/haptics';

interface TabletControllerViewProps {
  embeddedInDemo?: boolean;
}

const PILOT_ID_SET = new Set<string>(PILOT_COUNTRY_IDS);

const MISSION_JOURNEY_STEPS: ReadonlyArray<{
  phase: MissionPhase;
  order: number;
  labelPt: string;
  labelEn: string;
}> = [
  { phase: 'idle', order: 0, labelPt: 'Início', labelEn: 'Start' },
  { phase: 'briefing', order: 1, labelPt: 'Briefing', labelEn: 'Briefing' },
  { phase: 'boarding', order: 2, labelPt: 'Embarque', labelEn: 'Board' },
  { phase: 'countdown', order: 3, labelPt: 'Decolagem', labelEn: 'Launch' },
  { phase: 'zero_g', order: 4, labelPt: 'Zero-G', labelEn: 'Zero-G' },
  { phase: 'exploring', order: 5, labelPt: 'Estúdio', labelEn: 'Studio' },
  { phase: 'ended', order: 6, labelPt: 'Fim', labelEn: 'End' },
];

function normalizeLookupName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export const TabletControllerView: React.FC<TabletControllerViewProps> = ({
  embeddedInDemo = false,
}) => {
  const {
    country,
    availableCountryIds,
    lang,
    storyStep,
    missionPhase,
    layers,
    playback,
    audioLevels,
    masterGain,
    masterDbFs,
    activeStudioSession,
    studioData,
    telemetrySummary,
    voiceAutoEnabled,
    speechStatus,
    selectCountry,
    toggleEye,
    setAllLayersEnabled,
    toggleSparkle,
    setSparkleGain,
    toggleSparkleSolo,
    setLayerGain,
    setWindWetMix,
    toggleSolo,
    setMasterGain,
    restartLoop,
    resetMixerGains,
    togglePlay,
    setLang,
    setStoryStep,
    setMissionPhase,
    isPickingCountry,
    setIsPickingCountry,
    sendGlobeCameraPose,
    unlockAudioSession,
    unlockAudioContext,
    setVoiceAutoEnabled,
    stopRobotSpeech,
    togglePauseRobotSpeech,
  } = useExperience();

  const isPt = lang === 'pt';
  const world = useMemo(() => loadWorldCountries(), []);

  const [searchQuery, setSearchQuery] = useState('');
  const [unavailableCountryNotice, setUnavailableCountryNotice] = useState<string | null>(null);
  const [inspectedDataset, setInspectedDataset] = useState<DatasetId | null>(null);
  const [adjustedLayerId, setAdjustedLayerId] = useState<VisualLayerId | null>(null);
  const [countryNasaModalOpen, setCountryNasaModalOpen] = useState(false);
  const [countdownNum, setCountdownNum] = useState<number>(5);
  const [visitedCountryIds, setVisitedCountryIds] = useState<string[]>([]);
  const [activatedLayerIds, setActivatedLayerIds] = useState<VisualLayerId[]>([]);
  const prevMissionPhaseRef = useRef<MissionPhase>(missionPhase);
  const lastGestureHapticPhaseRef = useRef<MissionPhase | null>(null);

  // Cancela qualquer vibração ativa se o tablet sair da tela
  useEffect(() => () => stopConsoleHaptic(), []);

  // Impactos físicos sincronizados com transições automáticas / remotas da missão (Android)
  useEffect(() => {
    const prev = prevMissionPhaseRef.current;
    prevMissionPhaseRef.current = missionPhase;
    if (prev === missionPhase) return;

    if (missionPhase === 'ended') {
      const landingTimer = window.setTimeout(() => {
        triggerConsoleHaptic(CONSOLE_HAPTIC_PATTERNS.landingThud);
      }, 3200);
      return () => window.clearTimeout(landingTimer);
    }

    if (lastGestureHapticPhaseRef.current === missionPhase) {
      lastGestureHapticPhaseRef.current = null;
      return;
    }
    lastGestureHapticPhaseRef.current = null;

    if (missionPhase === 'briefing') {
      triggerConsoleHaptic(CONSOLE_HAPTIC_PATTERNS.briefingStart);
    } else if (missionPhase === 'boarding') {
      triggerConsoleHaptic(CONSOLE_HAPTIC_PATTERNS.boardingSlam);
    } else if (missionPhase === 'countdown') {
      triggerConsoleHaptic(CONSOLE_HAPTIC_PATTERNS.launchSequence);
    } else if (missionPhase === 'zero_g') {
      triggerConsoleHaptic(CONSOLE_HAPTIC_PATTERNS.zeroGEject);
    } else if (prev === 'zero_g' && missionPhase === 'exploring') {
      triggerConsoleHaptic(CONSOLE_HAPTIC_PATTERNS.studioArrive);
    } else if (missionPhase === 'idle') {
      stopConsoleHaptic();
    }
  }, [missionPhase]);

  useEffect(() => {
    if (!unavailableCountryNotice) return;
    const timer = window.setTimeout(() => setUnavailableCountryNotice(null), 2500);
    return () => window.clearTimeout(timer);
  }, [unavailableCountryNotice]);

  useEffect(() => {
    if (missionPhase !== 'exploring' || !country) return;
    setVisitedCountryIds((prev) => (prev.includes(country.id) ? prev : [...prev, country.id]));
  }, [country, missionPhase]);

  useEffect(() => {
    if (missionPhase !== 'exploring') return;
    const activeIds = VISUAL_LAYER_ORDER.filter((id) => layers[id].enabled);
    if (activeIds.length === 0) return;
    setActivatedLayerIds((prev) => {
      const missing = activeIds.filter((id) => !prev.includes(id));
      return missing.length > 0 ? [...prev, ...missing] : prev;
    });
  }, [layers, missionPhase]);

  // Contagem regressiva 5..1 -> subida lenta (10s) -> zero_g
  useEffect(() => {
    if (missionPhase !== 'countdown') {
      setCountdownNum(5);
      return;
    }
    setCountdownNum(5);
    const timers: number[] = [];
    [4, 3, 2, 1, 0].forEach((val, idx) => {
      timers.push(window.setTimeout(() => setCountdownNum(val), (idx + 1) * 1100));
    });
    timers.push(window.setTimeout(() => setMissionPhase('zero_g'), 10000));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [missionPhase, setMissionPhase]);

  // Na gravidade zero, espera a fala completa + respiro (13.5s) antes de abrir o Quadro 6 (exploring-0)
  useEffect(() => {
    if (missionPhase !== 'zero_g') return;
    const timer = window.setTimeout(() => {
      unlockAudioSession();
      void unlockAudioContext();
      setAllLayersEnabled(false);
      setStoryStep(0);
      setIsPickingCountry(true);
      setMissionPhase('exploring');
    }, 13500);
    return () => window.clearTimeout(timer);
  }, [
    missionPhase,
    setAllLayersEnabled,
    setMissionPhase,
    setStoryStep,
    unlockAudioContext,
    unlockAudioSession,
  ]);

  const handleStartOperation = useCallback(() => {
    lastGestureHapticPhaseRef.current = 'briefing';
    unlockAudioSession();
    void unlockAudioContext();
    startSpaceAmbient();
    preloadPiperVoice(lang);
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        const unlock = new SpeechSynthesisUtterance(' ');
        unlock.volume = 0;
        window.speechSynthesis.speak(unlock);
      } catch {
        // ignore
      }
    }
    setAllLayersEnabled(false);
    setStoryStep(0);
    selectCountry(null);
    setIsPickingCountry(false);
    setMissionPhase('briefing');
  }, [
    lang,
    selectCountry,
    setAllLayersEnabled,
    setMissionPhase,
    setStoryStep,
    unlockAudioContext,
    unlockAudioSession,
  ]);

  const handleEnterStudioDirectly = useCallback(() => {
    triggerConsoleHaptic(CONSOLE_HAPTIC_PATTERNS.studioArrive);
    lastGestureHapticPhaseRef.current = 'exploring';
    unlockAudioSession();
    void unlockAudioContext();
    startSpaceAmbient();
    setAllLayersEnabled(false);
    if (!country) {
      selectCountry('076');
    }
    setStoryStep(1);
    setIsPickingCountry(false);
    setMissionPhase('exploring');
    if (!playback.isPlaying) {
      togglePlay();
    }
  }, [
    country,
    playback.isPlaying,
    selectCountry,
    setAllLayersEnabled,
    setMissionPhase,
    setStoryStep,
    togglePlay,
    unlockAudioContext,
    unlockAudioSession,
  ]);

  const handleBoardSpaceship = useCallback(() => {
    lastGestureHapticPhaseRef.current = 'boarding';
    unlockAudioSession();
    setMissionPhase('boarding');
  }, [setMissionPhase, unlockAudioSession]);

  const handleAuthorizeLiftoff = useCallback(() => {
    lastGestureHapticPhaseRef.current = 'countdown';
    unlockAudioSession();
    playLaunchThrust8D(10.0);
    setMissionPhase('countdown');
  }, [setMissionPhase, unlockAudioSession]);

  const handleEnterExploringFromZeroG = useCallback(() => {
    lastGestureHapticPhaseRef.current = 'exploring';
    unlockAudioSession();
    void unlockAudioContext();
    setAllLayersEnabled(false);
    setStoryStep(0);
    setIsPickingCountry(true);
    setMissionPhase('exploring');
  }, [
    setAllLayersEnabled,
    setMissionPhase,
    setStoryStep,
    unlockAudioContext,
    unlockAudioSession,
  ]);

  const handleEndMission = useCallback(() => {
    stopConsoleHaptic();
    triggerConsoleHaptic(CONSOLE_HAPTIC_PATTERNS.tap);
    unlockAudioSession();
    setAllLayersEnabled(false);
    if (playback.isPlaying) {
      togglePlay();
    }
    setIsPickingCountry(false);
    setUnavailableCountryNotice(null);
    setMissionPhase('ended');
    setInspectedDataset(null);
    setAdjustedLayerId(null);
    setCountryNasaModalOpen(false);
  }, [
    playback.isPlaying,
    setAllLayersEnabled,
    setIsPickingCountry,
    setMissionPhase,
    togglePlay,
    unlockAudioSession,
  ]);

  const handleResetNewMission = useCallback(() => {
    stopConsoleHaptic();
    triggerConsoleHaptic(CONSOLE_HAPTIC_PATTERNS.tap);
    lastGestureHapticPhaseRef.current = 'idle';
    if (playback.isPlaying) {
      togglePlay();
    }
    setAllLayersEnabled(false);
    selectCountry(null);
    setStoryStep(0);
    setIsPickingCountry(false);
    setInspectedDataset(null);
    setAdjustedLayerId(null);
    setCountryNasaModalOpen(false);
    setSearchQuery('');
    setUnavailableCountryNotice(null);
    setVisitedCountryIds([]);
    setActivatedLayerIds([]);
    setMissionPhase('idle');
  }, [
    playback.isPlaying,
    selectCountry,
    setAllLayersEnabled,
    setMissionPhase,
    setStoryStep,
    togglePlay,
  ]);

  const alpha2ByName = useMemo(() => {
    const map = new Map<string, string>();
    for (const opt of ALL_COUNTRY_OPTIONS) {
      map.set(normalizeLookupName(opt.namePt), opt.code);
    }
    if (typeof Intl !== 'undefined' && typeof Intl.DisplayNames === 'function') {
      const enDisplay = new Intl.DisplayNames(['en'], { type: 'region' });
      for (const code of ALL_ISO_ALPHA2_CODES) {
        const enName = enDisplay.of(code);
        if (enName) {
          map.set(normalizeLookupName(enName), code);
        }
      }
    }
    return map;
  }, []);

  const getAlpha2ForCountry = useCallback(
    (id: string, namePt: string, nameEn: string): string | null => {
      if (COUNTRY_ID_TO_ALPHA2[id]) {
        return COUNTRY_ID_TO_ALPHA2[id];
      }
      return (
        alpha2ByName.get(normalizeLookupName(nameEn)) ??
        alpha2ByName.get(normalizeLookupName(namePt)) ??
        null
      );
    },
    [alpha2ByName]
  );

  const searchableCountries = useMemo(() => {
    const available = world.countries.filter((c) => availableCountryIds.has(c.id));
    const locale = isPt ? 'pt-BR' : 'en';
    return [...available].sort((a, b) => {
      const nameA = isPt ? a.namePt : a.nameEn;
      const nameB = isPt ? b.namePt : b.nameEn;
      return nameA.localeCompare(nameB, locale);
    });
  }, [availableCountryIds, isPt, world.countries]);

  const quickPresetCountries = useMemo(() => {
    const byId = new Map(searchableCountries.map((c) => [c.id, c]));
    const ordered: CountryEntry[] = [];
    for (const id of GENERATED_COUNTRY_IDS) {
      const entry = byId.get(id);
      if (entry) ordered.push(entry);
    }
    for (const c of searchableCountries) {
      if (!ordered.some((o) => o.id === c.id)) {
        ordered.push(c);
      }
    }
    return ordered;
  }, [searchableCountries]);

  const filteredCountries = useMemo(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return searchableCountries;
    return searchCountries(trimmed, searchableCountries, searchableCountries.length);
  }, [searchQuery, searchableCountries]);

  const selectedGeoEntry = useMemo(
    () => (country ? world.countries.find((c) => c.id === country.id) ?? null : null),
    [country, world.countries]
  );

  const enabledDatasetIds = useMemo(
    () =>
      VISUAL_LAYER_ORDER.filter((id) => layers[id].enabled).map(
        (id) => LAYER_METAS[id].datasetId
      ),
    [layers]
  );
  const enabledCount = enabledDatasetIds.length;

  const handlePickCountryEntry = useCallback(
    (entry: CountryEntry) => {
      triggerConsoleHaptic(CONSOLE_HAPTIC_PATTERNS.countrySelect);
      unlockAudioSession();
      void unlockAudioContext();
      startSpaceAmbient();
      setAllLayersEnabled(false);
      selectCountry(entry.id);
      setStoryStep(1);
      if (!playback.isPlaying) {
        togglePlay();
      }
      setSearchQuery('');
      setInspectedDataset(null);
      setAdjustedLayerId(null);
      setCountryNasaModalOpen(false);
      setUnavailableCountryNotice(null);
      setIsPickingCountry(false);
    },
    [
      playback.isPlaying,
      selectCountry,
      setAllLayersEnabled,
      setIsPickingCountry,
      setStoryStep,
      togglePlay,
      unlockAudioContext,
      unlockAudioSession,
    ]
  );

  const handleGlobeCountrySelect = useCallback(
    (clicked: CountryEntry | null) => {
      if (!clicked) return;
      if (availableCountryIds.has(clicked.id)) {
        handlePickCountryEntry(clicked);
        return;
      }
      triggerConsoleHaptic(10);
      const name = isPt ? clicked.namePt : clicked.nameEn;
      setUnavailableCountryNotice(
        isPt
          ? `${name} em preparo — escolha um país iluminado, pesquise pelo nome ou use as sugestões abaixo.`
          : `${name} in preparation — pick a highlighted country, search by name, or use the quick picks below.`
      );
    },
    [availableCountryIds, handlePickCountryEntry, isPt]
  );

  const handleOpenCountrySearch = useCallback(() => {
    triggerConsoleHaptic(12);
    if (playback.isPlaying) {
      togglePlay();
    }
    setInspectedDataset(null);
    setAdjustedLayerId(null);
    setCountryNasaModalOpen(false);
    setSearchQuery('');
    setUnavailableCountryNotice(null);
    setIsPickingCountry(true);
  }, [playback.isPlaying, setIsPickingCountry, togglePlay]);

  const handleBackToMixer = useCallback(() => {
    triggerConsoleHaptic(12);
    setIsPickingCountry(false);
    setUnavailableCountryNotice(null);
    if (!playback.isPlaying) {
      togglePlay();
    }
  }, [playback.isPlaying, setIsPickingCountry, togglePlay]);

  const selectedAlpha2 = country
    ? getAlpha2ForCountry(country.id, country.namePt, country.nameEn)
    : null;

  const showIntroScreen = missionPhase === 'idle';
  const showMissionStageScreen =
    missionPhase === 'briefing' ||
    missionPhase === 'boarding' ||
    missionPhase === 'countdown' ||
    missionPhase === 'zero_g' ||
    missionPhase === 'ended';
  const showSelectionScreen =
    missionPhase === 'exploring' && (isPickingCountry || storyStep === 0 || !country);

  const melParams = activeStudioSession?.musicalParameters.melody;
  const nasaReport = useMemo(
    () =>
      buildCountryNasaReport({
        country,
        telemetrySummary,
        studioData,
        playback,
        layers,
        lang,
      }),
    [country, lang, layers, playback, studioData, telemetrySummary]
  );

  const spkSolo = layers.melody.sparkleSolo;
  const anySolo = spkSolo || layers.melody.solo || layers.chords.solo || layers.bass.solo;
  const dbText = masterDbFs <= -60 ? '-∞ dBFS' : `${masterDbFs.toFixed(1)} dBFS`;

  const activeJourneyOrder =
    MISSION_JOURNEY_STEPS.find((s) => s.phase === missionPhase)?.order ?? 0;
  const stageCardPadClass = embeddedInDemo
    ? 'flex w-full max-w-md flex-col items-center gap-3 rounded-[18px] px-4 py-4 text-center backdrop-blur-xl sm:px-5 sm:py-5'
    : 'flex w-full max-w-md flex-col items-center gap-6 rounded-[18px] px-6 py-8 text-center backdrop-blur-xl sm:px-8 sm:py-10';

  return (
    <div
      className={`@container relative flex w-full min-w-0 flex-col overflow-hidden bg-[#060913] font-['Poppins',system-ui,sans-serif] text-slate-50 ${
        embeddedInDemo ? 'h-full' : 'h-dvh'
      }`}
      style={{ overscrollBehavior: 'none' }}
      data-testid="tablet-controller-view"
    >
      {/* Barra superior permanente: exibida no Tablet físico (?view=controller); na Demo é absorvida pelo header unificado */}
      {!embeddedInDemo && (
        <div className="z-30 flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[#1e3a66]/45 bg-[#040b1a]/95 px-3.5 py-2 backdrop-blur-md">
          <div className="flex min-w-0 items-center gap-2">
            <span className="text-xs font-bold tracking-[0.06em] text-slate-100 uppercase">
              EARTH JUKEBOX
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => {
                triggerConsoleHaptic(CONSOLE_HAPTIC_PATTERNS.tap);
                setVoiceAutoEnabled(!voiceAutoEnabled);
              }}
              data-testid="tablet-voice-toggle"
              aria-pressed={voiceAutoEnabled}
              aria-label={
                voiceAutoEnabled
                  ? isPt
                    ? 'Silenciar narração automática'
                    : 'Mute auto narration'
                  : isPt
                    ? 'Ativar narração automática'
                    : 'Enable auto narration'
              }
              className={`inline-flex min-h-[36px] min-w-[44px] cursor-pointer items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold transition active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7dd3fc] ${
                voiceAutoEnabled
                  ? 'border-[#1e3a66] bg-[#060c1a] text-sky-200 hover:border-[#2563eb]'
                  : 'border-rose-400/40 bg-rose-500/15 text-rose-200 hover:border-rose-400/70'
              }`}
            >
              {voiceAutoEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
              <span>{voiceAutoEnabled ? (isPt ? 'Voz: ON' : 'Voice: ON') : isPt ? 'Voz: OFF' : 'Voice: OFF'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                triggerConsoleHaptic(CONSOLE_HAPTIC_PATTERNS.tap);
                setLang(isPt ? 'en' : 'pt');
              }}
              className="inline-flex min-h-[36px] min-w-[58px] cursor-pointer items-center justify-center rounded-full border border-[#1e3a66] bg-[#060c1a] px-2.5 text-xs font-semibold text-slate-200 transition hover:border-[#2563eb] hover:text-white active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7dd3fc]"
              aria-label={isPt ? 'Mudar idioma para Inglês' : 'Switch language to Portuguese'}
            >
              {isPt ? 'PT · BR' : 'EN · US'}
            </button>

            {missionPhase !== 'ended' ? (
              <button
                type="button"
                onClick={handleEndMission}
                className="inline-flex min-h-[36px] cursor-pointer items-center gap-1.5 rounded-full border border-rose-400/40 bg-rose-500/15 px-3 text-xs font-semibold text-rose-100 transition hover:border-rose-400/75 hover:bg-rose-500/25 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7dd3fc]"
              >
                <span>{isPt ? 'Encerrar Missão' : 'End Mission'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleResetNewMission}
                className="inline-flex min-h-[36px] cursor-pointer items-center gap-1.5 rounded-full border border-sky-400/50 bg-sky-500/15 px-3 text-xs font-semibold text-sky-100 transition hover:border-sky-300/80 hover:bg-sky-500/25 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7dd3fc]"
              >
                <span>{isPt ? 'Nova Missão' : 'New Mission'}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Etapas da Missão sincronizadas com a sala */}
      <nav
        aria-label={isPt ? 'Etapas da missão' : 'Mission stages'}
        data-testid="mission-progress-bar"
        className="z-20 flex min-h-[46px] shrink-0 items-center justify-between gap-2 overflow-x-auto border-b border-[#1e3a66]/45 bg-[#040b1a]/95 px-3.5 py-1.5"
      >
        <div className="flex shrink-0 flex-nowrap items-center gap-1">
          {MISSION_JOURNEY_STEPS.map((step, idx) => {
            const isDone = activeJourneyOrder > step.order || (missionPhase === 'ended' && step.phase === 'ended');
            const isCurrent = activeJourneyOrder === step.order && !(missionPhase === 'ended' && step.phase === 'ended');
            return (
              <React.Fragment key={step.phase}>
                <span
                  aria-current={isCurrent ? 'step' : undefined}
                  className={`inline-flex min-h-[30px] shrink-0 items-center gap-1 rounded-full border px-2.5 text-[11px] font-semibold tracking-tight transition [font-variant-numeric:tabular-nums] ${
                    isCurrent
                      ? 'border-[#2563eb]/75 bg-[#0c1a36] text-white'
                      : isDone
                        ? 'border-sky-400/35 bg-sky-500/10 text-sky-200'
                        : 'border-[#1e3a66]/55 bg-[#060c1a] text-slate-400'
                  }`}
                >
                  {isDone ? (
                    <Check size={11} className="shrink-0 text-[#7dd3fc]" aria-hidden="true" />
                  ) : (
                    <span>{idx + 1}.</span>
                  )}
                  <span>{isPt ? step.labelPt : step.labelEn}</span>
                </span>
                {idx < MISSION_JOURNEY_STEPS.length - 1 && (
                  <span
                    className={`h-px w-1.5 shrink-0 ${
                      isDone ? 'bg-sky-400/45' : 'bg-[#1e3a66]/65'
                    }`}
                    aria-hidden="true"
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {(visitedCountryIds.length > 0 || activatedLayerIds.length > 0) && (
            <span className="inline-flex min-h-[30px] shrink-0 items-center rounded-full border border-[#1e3a66]/55 bg-[#060c1a] px-2.5 text-[11px] font-medium text-slate-300 [font-variant-numeric:tabular-nums]">
              {visitedCountryIds.length} {isPt ? 'país(es)' : 'country(ies)'} ·{' '}
              {activatedLayerIds.length}/5 NASA
            </span>
          )}

          {embeddedInDemo && missionPhase !== 'idle' && (
            missionPhase !== 'ended' ? (
              <button
                type="button"
                onClick={handleEndMission}
                className="inline-flex min-h-[30px] shrink-0 cursor-pointer items-center rounded-full border border-rose-400/40 bg-rose-500/15 px-3 text-[11px] font-semibold text-rose-100 transition hover:border-rose-400/75 hover:bg-rose-500/25 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7dd3fc]"
              >
                {isPt ? 'Encerrar Missão' : 'End Mission'}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleResetNewMission}
                className="inline-flex min-h-[30px] shrink-0 cursor-pointer items-center rounded-full border border-sky-400/50 bg-sky-500/15 px-3 text-[11px] font-semibold text-sky-100 transition hover:border-sky-300/80 hover:bg-sky-500/25 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7dd3fc]"
              >
                {isPt ? 'Nova Missão' : 'New Mission'}
              </button>
            )
          )}
        </div>
      </nav>

      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
        {showIntroScreen ? (
          /* =====================================================================
             TELA 0 — INICIAL (INICIAR EXPEDIÇÃO OU ABRIR ESTÚDIO DIRETO)
             ===================================================================== */
          <div className="mx-auto flex h-full w-full min-w-0 max-w-2xl flex-col overflow-y-auto px-4 py-3 sm:px-6 sm:py-5">
            <main className="my-auto flex w-full flex-col items-center py-2">
              <div className={`${stageCardPadClass} border border-[#1e3a66]/55 bg-[#080d19]/95`}>
                <span className="inline-flex items-center gap-2 rounded-full border border-[#1e3a66]/65 bg-[#060c1a]/90 px-3.5 py-1 text-[11px] font-medium tracking-wide text-slate-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#7dd3fc]" />
                  {isPt ? 'Quarto Projetado · Áudio 8D' : 'Projected Room · 8D Audio'}
                </span>

                <div className="space-y-2">
                  <h1 className="text-lg font-bold tracking-tight text-slate-50 sm:text-2xl">
                    {isPt ? 'Pronto para a expedição?' : 'Ready for the expedition?'}
                  </h1>
                  <p className="text-xs leading-relaxed text-slate-400 sm:text-sm">
                    {isPt
                      ? 'Embarque na nave com o MINEIRØ ou abra diretamente o Jukebox Studio para explorar os sons da Terra.'
                      : 'Board the spacecraft with MINEIRØ or jump straight into the Jukebox Studio to explore Earth data.'}
                  </p>
                </div>

                <div className="flex w-full flex-col items-center gap-3">
                  <MissionGameButton
                    label={isPt ? 'Iniciar' : 'Start'}
                    icon={Play}
                    size="lg"
                    hapticPattern={CONSOLE_HAPTIC_PATTERNS.briefingStart}
                    onClick={handleStartOperation}
                    testId="tablet-start-mission-btn"
                  />

                  <button
                    type="button"
                    onClick={handleEnterStudioDirectly}
                    className="inline-flex min-h-[44px] w-full max-w-[260px] cursor-pointer items-center justify-center gap-2 rounded-full border border-[#1e3a66]/65 bg-[#060c1a]/90 px-6 text-xs font-semibold text-slate-300 transition hover:border-[#2563eb] hover:text-white active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7dd3fc]"
                  >
                    <span>
                      {isPt ? 'Abrir Jukebox Studio Direto' : 'Open Jukebox Studio Directly'}
                    </span>
                  </button>
                </div>
              </div>
            </main>
          </div>
        ) : showMissionStageScreen ? (
          /* =====================================================================
             FASES DA EXPEDIÇÃO: EMBARQUE -> DECOLAGEM -> GRAVIDADE ZERO -> FIM
             ===================================================================== */
          <div className="mx-auto flex h-full w-full min-w-0 max-w-2xl flex-col overflow-y-auto px-4 py-3 sm:px-6 sm:py-5">
            <main className="my-auto flex w-full flex-col items-center py-2">
              {missionPhase === 'briefing' ? (
                <div className={`${stageCardPadClass} border border-[#1e3a66]/55 bg-[#080d19]/95`}>
                  <span className="inline-flex items-center gap-2 rounded-full border border-[#1e3a66]/65 bg-[#060c1a] px-3.5 py-1 text-[11px] font-semibold tracking-wide text-[#7dd3fc]">
                    {isPt ? 'Briefing · MINEIRØ' : 'Briefing · MINEIRØ'}
                  </span>

                  <div className="space-y-2">
                    <h2 className="text-lg font-bold tracking-tight text-slate-50 sm:text-xl">
                      {isPt ? 'Embarcar na Nave' : 'Board the Spacecraft'}
                    </h2>
                    <p className="text-xs leading-relaxed text-slate-400 sm:text-sm">
                      {isPt
                        ? 'Ouça o astronauta MINEIRØ na parede à sua frente e toque abaixo para fechar as comportas e embarcar.'
                        : 'Listen to astronaut MINEIRØ on the wall ahead and tap below to seal the blast doors and board.'}
                    </p>
                  </div>

                  <MissionGameButton
                    label={isPt ? 'Embarcar na Nave' : 'Board Ship'}
                    icon={Rocket}
                    size="md"
                    hapticPattern={CONSOLE_HAPTIC_PATTERNS.boardingSlam}
                    onClick={handleBoardSpaceship}
                  />
                </div>
              ) : missionPhase === 'boarding' ? (
                <div className={`${stageCardPadClass} border border-[#1e3a66]/55 bg-[#080d19]/95`}>
                  <span className="inline-flex items-center gap-2 rounded-full border border-[#1e3a66]/65 bg-[#060c1a] px-3.5 py-1 text-[11px] font-semibold tracking-wide text-[#7dd3fc]">
                    {isPt ? 'Portas Lacradas · Cabine Ativa' : 'Doors Sealed · Cabin Active'}
                  </span>

                  <div className="space-y-2">
                    <h2 className="text-lg font-bold tracking-tight text-slate-50 sm:text-xl">
                      {isPt ? 'Autorizar Decolagem' : 'Authorize Liftoff'}
                    </h2>
                    <p className="text-xs leading-relaxed text-slate-400 sm:text-sm">
                      {isPt
                        ? 'Olhe pela vigia metálica à esquerda: o campo de lançamento está pronto. Toque abaixo para iniciar a contagem 5, 4, 3, 2, 1.'
                        : 'Look through the metal porthole on your left: the launch field is ready. Tap below to start the 5, 4, 3, 2, 1 countdown.'}
                    </p>
                  </div>

                  <MissionGameButton
                    label={isPt ? 'Autorizar Decolagem' : 'Authorize Liftoff'}
                    icon={Rocket}
                    size="md"
                    hapticPattern={CONSOLE_HAPTIC_PATTERNS.launchSequence}
                    onClick={handleAuthorizeLiftoff}
                  />
                </div>
              ) : missionPhase === 'countdown' ? (
                <div className={`${stageCardPadClass} border border-[#1e3a66]/55 bg-[#080d19]/95`}>
                  <div className="relative flex h-20 w-20 items-center justify-center rounded-full border border-[#1e3a66] bg-[#060c1a] sm:h-24 sm:w-24">
                    <span className="text-3xl font-extrabold text-[#7dd3fc] [font-variant-numeric:tabular-nums] sm:text-4xl">
                      {countdownNum > 0 ? countdownNum : '🚀'}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <p className="text-base font-bold text-slate-100 [font-variant-numeric:tabular-nums]">
                      {countdownNum > 0
                        ? isPt
                          ? `Contagem regressiva: ${countdownNum}`
                          : `Countdown: ${countdownNum}`
                        : isPt
                          ? 'Motores de Propulsão 8D!'
                          : '8D Propulsion Engines!'}
                    </p>
                    <p className="text-xs text-slate-400">
                      {isPt
                        ? 'Sinta o som espacial percorrendo as três caixas e subindo para a órbita...'
                        : 'Feel the spatial audio sweeping across the room as we climb into orbit...'}
                    </p>
                  </div>
                </div>
              ) : missionPhase === 'zero_g' ? (
                <div className={`${stageCardPadClass} border border-[#1e3a66]/55 bg-[#080d19]/95`}>
                  <span className="inline-flex items-center gap-2 rounded-full border border-[#1e3a66]/65 bg-[#060c1a] px-3.5 py-1 text-[11px] font-semibold tracking-wide text-[#7dd3fc]">
                    {isPt ? 'Órbita Alcançada · Gravidade Zero' : 'Orbit Reached · Zero Gravity'}
                  </span>

                  <div className="space-y-2">
                    <p className="text-base font-bold text-slate-100 sm:text-lg">
                      {isPt ? 'Você está no comando' : 'You are in command'}
                    </p>
                    <p className="text-xs leading-relaxed text-slate-400">
                      {isPt
                        ? 'Olhe para o globo à esquerda e o espaço à direita: escolha um país no tablet para começar a ouvir a Terra.'
                        : 'Look at the globe on your left and open space on your right: pick a country on the tablet to start listening to Earth.'}
                    </p>
                  </div>

                  <MissionGameButton
                    label={isPt ? 'Escolher País' : 'Choose Country'}
                    icon={Globe2}
                    size="md"
                    hapticPattern={CONSOLE_HAPTIC_PATTERNS.studioArrive}
                    onClick={handleEnterExploringFromZeroG}
                  />
                </div>
              ) : (
                <div className={`${stageCardPadClass} border border-[#1e3a66]/55 bg-[#080d19]/95`}>
                  <span className="inline-flex items-center gap-2 rounded-full border border-[#1e3a66]/65 bg-[#060c1a] px-3.5 py-1 text-[11px] font-semibold tracking-wide text-[#7dd3fc]">
                    {isPt ? 'Expedição Mineira · MINEIRØ' : 'Mineiro Expedition · MINEIRØ'}
                  </span>

                  <div className="space-y-2">
                    <h2 className="text-lg font-bold text-slate-50 sm:text-xl">
                      {isPt ? 'Obrigado por explorar a Terra conosco!' : 'Thank you for exploring Earth with us!'}
                    </h2>
                    <p className="text-xs leading-relaxed text-slate-300">
                      {isPt
                        ? 'Os dados coletados da NASA ajudaram a transformar os sinais do nosso planeta em música pelo quarto.'
                        : 'Real NASA observations helped transform our planet’s signals into music across the room.'}
                    </p>
                    {(visitedCountryIds.length > 0 || activatedLayerIds.length > 0) && (
                      <p className="pt-1 text-xs font-medium text-slate-300 [font-variant-numeric:tabular-nums]">
                        {isPt
                          ? `${visitedCountryIds.length} país(es) ouvido(s) · ${activatedLayerIds.length}/5 camadas exploradas`
                          : `${visitedCountryIds.length} country(ies) heard · ${activatedLayerIds.length}/5 layers explored`}
                      </p>
                    )}
                  </div>

                  <MissionGameButton
                    label={isPt ? 'Nova Missão' : 'New Mission'}
                    icon={RotateCcw}
                    size="md"
                    onClick={handleResetNewMission}
                  />
                </div>
              )}

              {/* Controles de Voz do MINEIRØ sincronizados com a sala (Pausar / Retomar / Interromper) */}
              <div
                data-testid="tablet-stage-speech-bar"
                className="mt-3 flex w-full max-w-md flex-wrap items-center justify-between gap-2 rounded-[18px] border border-[#1e3a66]/45 bg-[#080d19]/95 px-3.5 py-2.5 backdrop-blur-xl"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      !voiceAutoEnabled || speechStatus === 'stopped'
                        ? 'bg-slate-500'
                        : speechStatus === 'paused'
                          ? 'bg-amber-400'
                          : speechStatus === 'speaking'
                            ? 'animate-pulse bg-sky-400'
                            : 'bg-[#7dd3fc]/80'
                    }`}
                  />
                  <span className="text-xs font-semibold text-slate-200">
                    {!voiceAutoEnabled
                      ? isPt
                        ? 'Voz silenciada'
                        : 'Voice muted'
                      : speechStatus === 'paused'
                        ? isPt
                          ? 'Fala pausada'
                          : 'Speech paused'
                        : speechStatus === 'stopped'
                          ? isPt
                            ? 'Fala interrompida'
                            : 'Speech stopped'
                          : speechStatus === 'speaking'
                            ? isPt
                              ? 'MINEIRØ falando'
                              : 'MINEIRØ speaking'
                            : isPt
                              ? 'Narração MINEIRØ'
                              : 'MINEIRØ narration'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      triggerConsoleHaptic(CONSOLE_HAPTIC_PATTERNS.tap);
                      togglePauseRobotSpeech();
                    }}
                    data-testid="tablet-speech-pause"
                    aria-pressed={speechStatus === 'paused'}
                    className={`inline-flex min-h-[44px] min-w-[44px] cursor-pointer items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7dd3fc] ${
                      speechStatus === 'paused'
                        ? 'border-[#2563eb]/65 bg-[#0c1a36] text-sky-100'
                        : 'border-[#1e3a66]/55 bg-[#060c1a] text-slate-200 hover:border-[#2563eb]'
                    }`}
                  >
                    {speechStatus === 'paused' ? <Play size={14} className="fill-current" /> : <Pause size={14} />}
                    <span>
                      {speechStatus === 'paused'
                        ? isPt
                          ? 'Retomar'
                          : 'Resume'
                        : isPt
                          ? 'Pausar'
                          : 'Pause'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      triggerConsoleHaptic(CONSOLE_HAPTIC_PATTERNS.tap);
                      stopRobotSpeech();
                    }}
                    data-testid="tablet-speech-stop"
                    disabled={!voiceAutoEnabled || speechStatus === 'stopped'}
                    className="inline-flex min-h-[44px] min-w-[44px] cursor-pointer items-center gap-1.5 rounded-xl border border-rose-400/40 bg-rose-500/15 px-3 text-xs font-semibold text-rose-100 transition hover:border-rose-400/70 hover:bg-rose-500/25 active:scale-95 disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7dd3fc]"
                  >
                    <Square size={13} className="fill-current" />
                    <span>{isPt ? 'Parar' : 'Stop'}</span>
                  </button>
                </div>
              </div>
            </main>
          </div>
        ) : showSelectionScreen || !country ? (
          /* =====================================================================
             TELA 1 — GLOBO 3D + SUGESTÕES + PESQUISA DE PAÍS (CONSOLE HORIZONTAL)
             ===================================================================== */
          <div className="mx-auto flex h-full w-full min-w-0 max-w-6xl flex-col gap-3 overflow-y-auto px-4 py-3 sm:px-6 @[740px]:overflow-hidden @[740px]:py-3">
            <header className="flex shrink-0 items-center justify-between gap-3">
              <div className="min-w-0">
                <h1 className="truncate text-lg font-bold tracking-tight text-slate-50">
                  {isPt ? 'Escolher País' : 'Choose Country'}
                </h1>
                <p className="truncate text-xs text-slate-400">
                  {isPt
                    ? 'Gire o globo para mirar na parede, pesquise pelo nome ou escolha um destaque.'
                    : 'Spin the globe to mirror on the wall, search by name, or pick a quick destination.'}
                </p>
              </div>

              {country && storyStep >= 1 && (
                <button
                  type="button"
                  onClick={handleBackToMixer}
                  className="inline-flex min-h-[44px] shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-[#1e3a66] bg-[#060c1a] px-3.5 text-xs font-semibold text-slate-200 transition hover:border-[#2563eb] hover:text-white active:translate-y-[2px] active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7dd3fc]"
                >
                  <ArrowLeft size={14} />
                  <span>{isPt ? 'Voltar ao Controle' : 'Back to Mixer'}</span>
                </button>
              )}
            </header>

            <div className="flex min-h-0 flex-1 flex-col gap-3 @[740px]:grid @[740px]:grid-cols-[1.15fr_1fr] @[740px]:gap-4">
              {/* Coluna Esquerda (Horizontal) — Globo 3D Interativo Espelhado */}
              <section
                className="relative flex shrink-0 flex-col overflow-hidden rounded-[18px] border border-[#1e3a66]/55 bg-[#040b1a] @[740px]:h-full @[740px]:min-h-0"
                aria-label={isPt ? 'Globo 3D interativo para escolher país' : 'Interactive 3D globe country picker'}
              >
                <div
                  className={`relative w-full @[740px]:h-auto @[740px]:min-h-0 @[740px]:flex-1 ${
                    embeddedInDemo ? 'h-[210px] sm:h-[250px]' : 'h-[250px] sm:h-[300px]'
                  }`}
                  style={{ touchAction: 'none' }}
                >
                  {typeof window !== 'undefined' && (
                    <EarthCanvas
                      videoElements={{}}
                      layers={[]}
                      viewMode="3d"
                      visualStyle="bioluminescent"
                      backgroundHex="#040b1a"
                      showGrid={false}
                      showBorders={true}
                      showLabels={true}
                      highContrast={true}
                      availableCountryIds={availableCountryIds}
                      countries={world.countries}
                      allRings={world.allRings}
                      landBorderRings={world.landBorderRings}
                      coastlineRings={world.coastlineRings}
                      selectedCountry={selectedGeoEntry}
                      orbitAutoRotate={true}
                      interactive={true}
                      jukeboxPlaying={false}
                      lang={lang}
                      flyTarget={null}
                      onHoverChange={() => {}}
                      onCameraDistanceChange={() => {}}
                      onUserCameraChange={sendGlobeCameraPose}
                      onSelectCountry={handleGlobeCountrySelect}
                    />
                  )}

                  <div className="pointer-events-none absolute bottom-2.5 left-3 rounded-full border border-[#1e3a66]/70 bg-[#060c1a]/85 px-3 py-1 text-[11px] font-medium text-slate-300 backdrop-blur-md">
                    {isPt
                      ? 'Arraste para girar · Toque em um país iluminado'
                      : 'Drag to spin · Tap any highlighted country'}
                  </div>
                </div>

                {unavailableCountryNotice && (
                  <div
                    role="status"
                    className="shrink-0 border-t border-[#1e3a66]/55 bg-[#080d19]/95 px-3.5 py-2 text-xs font-medium text-sky-200"
                  >
                    {unavailableCountryNotice}
                  </div>
                )}
              </section>

              {/* Coluna Direita (Horizontal) — Sugestões + Pesquisa + Lista Rolável */}
              <div className="flex min-h-0 flex-1 flex-col gap-2.5 @[740px]:overflow-hidden">
                {/* Sugestões para explorar (Presets para indecisos) */}
                <section
                  className="flex shrink-0 flex-col gap-1.5"
                  aria-label={isPt ? 'Sugestões para explorar' : 'Quick picks'}
                >
                  <span className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
                    {isPt ? 'Sugestões para explorar' : 'Quick picks'}
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {quickPresetCountries.slice(0, 8).map((preset) => {
                      const active = country?.id === preset.id;
                      const pAlpha2 = getAlpha2ForCountry(preset.id, preset.namePt, preset.nameEn);
                      const shortName = isPt ? preset.namePt : preset.nameEn;
                      return (
                        <button
                          key={`quick-pick-${preset.id}`}
                          type="button"
                          onClick={() => handlePickCountryEntry(preset)}
                          className={`inline-flex min-h-[44px] shrink-0 cursor-pointer items-center gap-2 rounded-full border px-3.5 text-xs font-semibold transition active:translate-y-[2px] active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7dd3fc] ${
                            active
                              ? 'border-[#2563eb]/75 bg-[#0c1a36] text-white'
                              : 'border-[#1e3a66]/65 bg-[#060c1a] text-slate-200 hover:border-[#2563eb]/65 hover:text-white'
                          }`}
                        >
                          <span className="inline-flex h-4 w-5 shrink-0 items-center justify-center overflow-hidden rounded-[3px]">
                            <CountryFlagIcon code={pAlpha2} />
                          </span>
                          <span>{shortName}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>

                {/* Barra de pesquisa */}
                <div className="flex min-h-[48px] shrink-0 items-center gap-2.5 rounded-xl border border-[#1e3a66]/60 bg-[#0c1a36] px-3.5 transition-colors focus-within:border-[#7dd3fc]">
                  <Search size={18} className="shrink-0 text-slate-400" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={isPt ? 'Pesquisar país pelo nome...' : 'Search country by name...'}
                    className="w-full bg-transparent text-sm text-slate-50 placeholder:text-slate-400 focus:outline-none"
                    aria-label={isPt ? 'Pesquisar país' : 'Search country'}
                  />
                  {searchQuery.trim().length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        triggerConsoleHaptic(8);
                        setSearchQuery('');
                      }}
                      className="inline-flex min-h-[44px] min-w-[44px] -mr-2 items-center justify-center rounded-lg text-slate-400 transition hover:text-slate-100 active:translate-y-[1px] active:scale-95"
                      aria-label={isPt ? 'Limpar pesquisa' : 'Clear search'}
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>

                <section
                  className="flex min-h-[190px] flex-1 flex-col overflow-hidden rounded-[18px] border border-[#1e3a66]/50 bg-[#080d19]/95 backdrop-blur-xl"
                  aria-label={isPt ? 'Lista de países disponíveis' : 'Available countries list'}
                >
                  <div className="flex shrink-0 items-center justify-between border-b border-[#1e3a66]/45 px-4 py-2 text-[11px] font-medium text-slate-400">
                    <span>
                      {isPt ? 'Países disponíveis' : 'Available countries'}
                    </span>
                    <span className="[font-variant-numeric:tabular-nums]">
                      {filteredCountries.length}
                    </span>
                  </div>

                  {filteredCountries.length === 0 ? (
                    <div className="flex flex-1 items-center justify-center px-4 py-6 text-center text-sm text-slate-400">
                      {isPt
                        ? 'Nenhum país encontrado para esta pesquisa.'
                        : 'No countries found for this search.'}
                    </div>
                  ) : (
                    <ul className="flex-1 divide-y divide-[#1e3a66]/30 overflow-y-auto p-1.5">
                      {filteredCountries.map((item) => {
                        const isPilot = PILOT_ID_SET.has(item.id);
                        const isCurrent = country?.id === item.id;
                        const alpha2 = getAlpha2ForCountry(item.id, item.namePt, item.nameEn);
                        const displayName = isPt ? item.namePt : item.nameEn;

                        return (
                          <li key={item.id}>
                            <button
                              type="button"
                              onClick={() => handlePickCountryEntry(item)}
                              className={`flex min-h-[48px] w-full cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition active:translate-y-[1px] active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7dd3fc] ${
                                isCurrent
                                  ? 'bg-[#0c1a36] ring-1 ring-[#2563eb]/60'
                                  : 'hover:bg-white/[0.04] active:bg-white/[0.08]'
                              }`}
                            >
                              <div className="flex min-w-0 items-center gap-3">
                                <span className="inline-flex h-6 w-7 shrink-0 items-center justify-center rounded-md border border-[#1e3a66]/50 bg-[#060c1a]">
                                  <CountryFlagIcon code={alpha2} />
                                </span>
                                <div className="min-w-0">
                                  <span className="block truncate text-sm font-medium text-slate-100">
                                    {displayName}
                                  </span>
                                  <span className="block truncate text-[11px] text-slate-400 [font-variant-numeric:tabular-nums]">
                                    {`${Math.abs(item.lat).toFixed(1)}°${item.lat >= 0 ? 'N' : 'S'} · ${Math.abs(item.lon).toFixed(1)}°${item.lon >= 0 ? 'E' : 'W'} · NASA SVS 5011–5154`}
                                  </span>
                                </div>
                              </div>

                              {isPilot && (
                                <span className="shrink-0 rounded-full border border-[#1e3a66] bg-[#060c1a] px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-slate-300">
                                  {isPt ? 'Destaque' : 'Featured'}
                                </span>
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              </div>
            </div>
          </div>
        ) : (
          /* =====================================================================
             TELA 2 — CONSOLE HORIZONTAL / MANETE DO JUKEBOX STUDIO NO TABLET
             ===================================================================== */
          <div className="mx-auto flex h-full w-full min-w-0 max-w-6xl flex-col gap-2 overflow-x-hidden overflow-y-auto px-3.5 py-3 sm:px-5 @[740px]:overflow-hidden @[740px]:py-2.5">
            {/* 1. Cabeçalho do País Ativo + Pílulas Rápidas + Ir para outro país */}
            <section
              className="flex min-w-0 max-w-full shrink-0 flex-col gap-2 rounded-[18px] border border-[#1e3a66]/50 bg-[#080d19]/95 p-2.5 backdrop-blur-xl @[740px]:flex-row @[740px]:items-center @[740px]:justify-between"
              aria-label={isPt ? 'País selecionado' : 'Selected country'}
            >
              <div className="flex items-center justify-between gap-2 @[740px]:min-w-0">
                <div className="flex min-w-0 items-center gap-2.5 pl-1">
                  <span className="inline-flex h-7 w-8 shrink-0 items-center justify-center rounded-lg border border-[#1e3a66]/55 bg-[#060c1a]">
                    <CountryFlagIcon code={selectedAlpha2} />
                  </span>
                  <div className="min-w-0">
                    <h1 className="truncate text-sm font-bold text-slate-50 sm:text-base">
                      {isPt ? country.namePt : country.nameEn}
                    </h1>
                    <p className="truncate text-[11px] text-sky-200/85 [font-variant-numeric:tabular-nums]">
                      {nasaReport?.summaryLine ??
                        `${Math.abs(country.lat).toFixed(1)}° · ${Math.abs(country.lon).toFixed(1)}° · NASA SVS`}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1.5 @[740px]:hidden">
                  <button
                    type="button"
                    onClick={() => {
                      triggerConsoleHaptic(10);
                      setCountryNasaModalOpen(true);
                    }}
                    data-testid="tablet-nasa-report-btn"
                    className="inline-flex min-h-[44px] shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-sky-400/50 bg-[#0c1a36] px-3 text-xs font-semibold text-sky-100 transition hover:border-sky-300 hover:text-white active:translate-y-[2px] active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7dd3fc]"
                    title={isPt ? 'Dados oficiais NASA por camada' : 'Official NASA data per layer'}
                  >
                    <Database size={14} className="text-[#7dd3fc]" aria-hidden="true" />
                    <span>{isPt ? 'Curiosidades' : 'Fun Facts'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleOpenCountrySearch}
                    data-testid="tablet-switch-country-btn"
                    className="inline-flex min-h-[44px] shrink-0 cursor-pointer items-center gap-2 rounded-full border border-[#1e3a66] bg-[#060c1a] px-3.5 text-xs font-semibold text-slate-100 transition hover:border-[#2563eb] hover:text-white active:translate-y-[2px] active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7dd3fc]"
                  >
                    <Globe2 size={15} className="text-[#7dd3fc]" aria-hidden="true" />
                    <span>{isPt ? 'Ir para outro país' : 'Switch Country'}</span>
                  </button>
                </div>
              </div>

              {/* Pílulas Horizontais de Troca Rápida */}
              <div className="flex min-w-0 max-w-full flex-1 items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] @[740px]:justify-center @[740px]:pb-0">
                {quickPresetCountries.slice(0, 6).map((preset) => {
                  const active = preset.id === country.id;
                  const pAlpha2 = getAlpha2ForCountry(preset.id, preset.namePt, preset.nameEn);
                  const shortName = isPt ? preset.namePt : preset.nameEn;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handlePickCountryEntry(preset)}
                      className={`inline-flex min-h-[44px] shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition active:translate-y-[2px] active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7dd3fc] ${
                        active
                          ? 'border-[#2563eb]/75 bg-[#0c1a36] text-white'
                          : 'border-[#1e3a66]/55 bg-[#060c1a] text-slate-300 hover:border-[#2563eb]/65 hover:text-white'
                      }`}
                    >
                      <span className="inline-flex h-4 w-5 shrink-0 items-center justify-center overflow-hidden rounded-[3px]">
                        <CountryFlagIcon code={pAlpha2} />
                      </span>
                      <span>{shortName}</span>
                    </button>
                  );
                })}
              </div>

              <div className="hidden shrink-0 items-center gap-1.5 @[740px]:inline-flex">
                <button
                  type="button"
                  onClick={() => {
                    triggerConsoleHaptic(10);
                    setCountryNasaModalOpen(true);
                  }}
                  className="inline-flex min-h-[44px] shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-sky-400/50 bg-[#0c1a36] px-3.5 text-xs font-semibold text-sky-100 transition hover:border-sky-300 hover:text-white active:translate-y-[2px] active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7dd3fc]"
                  title={isPt ? 'Dados oficiais NASA por camada' : 'Official NASA data per layer'}
                >
                  <Database size={14} className="text-[#7dd3fc]" aria-hidden="true" />
                  <span>{isPt ? 'Curiosidades NASA' : 'NASA Fun Facts'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleOpenCountrySearch}
                  className="inline-flex min-h-[44px] shrink-0 cursor-pointer items-center gap-2 rounded-full border border-[#1e3a66] bg-[#060c1a] px-4 text-xs font-semibold text-slate-100 transition hover:border-[#2563eb] hover:text-white active:translate-y-[2px] active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7dd3fc]"
                >
                  <Globe2 size={15} className="text-[#7dd3fc]" aria-hidden="true" />
                  <span>{isPt ? 'Ir para outro país' : 'Switch Country'}</span>
                </button>
              </div>
            </section>

            {/* 2. Palco Jukebox Studio + Deck de Transporte & Master Bus */}
            <section
              className="flex min-w-0 max-w-full shrink-0 flex-col gap-2 rounded-[18px] border border-[#1e3a66]/50 bg-[#080d19]/95 p-2.5 backdrop-blur-xl @[740px]:grid @[740px]:grid-cols-[minmax(0,1fr)_272px] @[740px]:items-stretch @[740px]:gap-2.5"
              aria-label={isPt ? 'Estúdio Jukebox Ao Vivo' : 'Live Jukebox Studio'}
            >
              <div
                className={`w-full overflow-hidden rounded-2xl border border-[#1e3a66]/45 bg-black @[740px]:order-1 @[740px]:h-[168px] @[960px]:h-[190px] ${
                  embeddedInDemo ? 'h-[220px] sm:h-[250px]' : 'h-[240px] sm:h-[280px]'
                }`}
              >
                <JukeboxStudioStage renderContext="controller" hideRobot />
              </div>

              <div className="flex flex-col justify-between gap-2 rounded-2xl border border-[#1e3a66]/45 bg-[#060c1a]/90 p-2.5 @[740px]:order-2">
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5">
                    {/* Play / Pause */}
                    <button
                      type="button"
                      onClick={() => {
                        triggerConsoleHaptic(12);
                        togglePlay();
                      }}
                      className="inline-flex h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 cursor-pointer items-center justify-center rounded-full bg-white text-[#060913] shadow-sm transition hover:bg-slate-100 active:translate-y-[2px] active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7dd3fc]"
                      aria-label={
                        playback.isPlaying ? (isPt ? 'Pausar' : 'Pause') : isPt ? 'Tocar' : 'Play'
                      }
                    >
                      {playback.isPlaying ? (
                        <Pause size={18} />
                      ) : (
                        <Play size={18} className="ml-0.5 fill-current" />
                      )}
                    </button>

                    {/* Voltar ao Início */}
                    <button
                      type="button"
                      onClick={() => {
                        triggerConsoleHaptic(12);
                        restartLoop();
                      }}
                      className="inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-xl border border-[#1e3a66]/55 bg-[#040b1a] px-3 text-xs font-semibold text-slate-200 transition hover:border-[#2563eb] hover:text-white active:translate-y-[2px] active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7dd3fc]"
                      title={isPt ? 'Voltar ao início' : 'Restart from start'}
                    >
                      <SkipBack size={15} />
                      <span>{isPt ? 'Início' : 'Start'}</span>
                    </button>
                  </div>

                  {/* Restaurar Padrão */}
                  <button
                    type="button"
                    onClick={() => {
                      triggerConsoleHaptic(12);
                      resetMixerGains();
                    }}
                    className="inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-xl border border-[#1e3a66]/55 bg-[#040b1a] px-3 text-xs font-semibold text-slate-300 transition hover:border-[#2563eb] hover:text-white active:translate-y-[2px] active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7dd3fc]"
                    title={
                      isPt
                        ? 'Restaurar volumes salvos do estúdio'
                        : 'Reset studio mixer gains'
                    }
                  >
                    <RotateCcw size={14} />
                    <span>{isPt ? 'Padrão' : 'Reset'}</span>
                  </button>
                </div>

                {/* Master Bus Volume + dBFS + VU */}
                <div className="flex flex-col gap-1.5 rounded-xl border border-[#1e3a66]/45 bg-[#040b1a]/90 px-2.5 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Volume2 size={15} className="shrink-0 text-slate-300" />
                      <span className="text-[11px] font-semibold text-slate-200">Master</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-slate-100 [font-variant-numeric:tabular-nums]">
                        {Math.round(masterGain * 100)}%
                      </span>
                      <span className="inline-flex min-h-[24px] items-center rounded-md border border-[#1e3a66]/55 bg-[#060c1a] px-1.5 text-[10px] font-semibold text-slate-200 [font-variant-numeric:tabular-nums]">
                        {dbText}
                      </span>
                      <span className="hidden min-h-[24px] items-center gap-1 rounded-full border border-[#1e3a66] bg-[#060c1a] px-2 text-[10px] font-medium text-[#7dd3fc] sm:inline-flex">
                        <Headphones size={11} />
                        <span>8D</span>
                      </span>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={160}
                    value={Math.round(masterGain * 100)}
                    onPointerDown={() => triggerConsoleHaptic(CONSOLE_HAPTIC_PATTERNS.sliderTouch)}
                    onChange={(e) => setMasterGain(Number(e.target.value) / 100)}
                    style={{ touchAction: 'none' }}
                    className="h-9 w-full cursor-pointer accent-sky-400"
                    aria-label="Master Volume"
                  />
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-900">
                    <div
                      className="h-full rounded-full transition-[width] duration-75"
                      style={{
                        width: `${Math.min(100, Math.round(audioLevels.master * 100))}%`,
                        background: 'linear-gradient(90deg, #22c55e 0%, #eab308 72%, #ef4444 100%)',
                      }}
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Banner de Silêncio Intencional quando todas as 5 camadas estão desligadas */}
            {enabledCount === 0 && (
              <div
                role="status"
                data-testid="tablet-mixer-silence-banner"
                className="flex shrink-0 items-center gap-2.5 rounded-[16px] border border-[#1e3a66]/70 bg-[#040b1a] px-3.5 py-2 text-xs font-medium text-sky-100"
              >
                <span className="h-2 w-2 shrink-0 rounded-full bg-[#7dd3fc]" aria-hidden="true" />
                <span>
                  {isPt
                    ? 'Nenhuma camada ativa — toque nos blocos abaixo para acender os dados da NASA e ouvir a música surgir no ambiente.'
                    : 'No layers active — tap the pads below to light up NASA data and hear the music emerge in the room.'}
                </span>
              </div>
            )}

            {/* 3. Mixer / Manete Videogame das 5 Camadas NASA */}
            <section
              className="flex min-w-0 max-w-full flex-col gap-2 @[740px]:min-h-0 @[740px]:flex-1 @[740px]:grid @[740px]:grid-cols-5 @[740px]:gap-2.5"
              role="group"
              aria-label={isPt ? 'Mixer das 5 camadas NASA' : 'NASA 5-layer mixer'}
            >
              {VISUAL_LAYER_ORDER.map((layerId) => {
                const meta = LAYER_METAS[layerId];
                const isEnabled = layers[layerId].enabled;

                const isAudible =
                  layerId === 'melody'
                    ? (!spkSolo && isEnabled && (!anySolo || layers.melody.solo)) ||
                      (spkSolo && layers.melody.sparkleEnabled)
                    : layerId === 'chords'
                      ? !spkSolo && isEnabled && (!anySolo || layers.chords.solo)
                      : layerId === 'bass'
                        ? !spkSolo && isEnabled && (!anySolo || layers.bass.solo)
                        : layerId === 'wind'
                          ? isEnabled && layers.wind.wetMix > 0.005
                          : isEnabled;

                const vuVal =
                  layerId === 'melody'
                    ? audioLevels.melody
                    : layerId === 'temperature'
                      ? isEnabled
                        ? 1
                        : 0
                      : audioLevels[layerId];

                const layerMetric = nasaReport?.byLayerId[layerId];
                const telemetryDetail =
                  layerMetric?.compactLabel ??
                  (isPt ? meta.musicalRolePt : meta.musicalRoleEn);

                const padMetricLabel =
                  meta.roleKind === 'generator'
                    ? `${Math.round(layers[layerId as SoloableLayerId].gain * 100)}%`
                    : meta.roleKind === 'fxBus'
                      ? `8D ${Math.round(layers.wind.wetMix * 100)}%`
                      : isEnabled
                        ? `${playback.bpm} BPM · ${isPt ? playback.keyRootPt : playback.keyRoot}`
                        : isPt
                          ? '90 BPM · Lá'
                          : '90 BPM · A';

                return (
                  <div
                    key={layerId}
                    className="flex flex-col gap-2 rounded-[18px] border p-3 transition @[740px]:h-full @[740px]:min-h-0 @[740px]:justify-between @[740px]:p-2.5"
                    style={{
                      borderColor: isAudible
                        ? `color-mix(in srgb, ${meta.accentHex} 55%, rgba(30,58,102,0.55))`
                        : 'rgba(30, 58, 102, 0.45)',
                      background: isAudible
                        ? `color-mix(in srgb, ${meta.accentHex} 10%, rgba(8, 13, 25, 0.96))`
                        : 'rgba(8, 13, 25, 0.85)',
                    }}
                  >
                    {/* Zona Superior: Bloco Tátil Arcade (ON/OFF no toque) */}
                    <div className="flex items-center justify-between gap-2 @[740px]:min-h-0 @[740px]:flex-1 @[740px]:flex-col @[740px]:items-stretch">
                      <button
                        type="button"
                        data-testid={`tablet-layer-pad-${layerId}`}
                        onClick={() => {
                          triggerConsoleHaptic(12);
                          toggleEye(layerId);
                        }}
                        className="flex min-h-[48px] min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-xl text-left transition active:translate-y-[2px] active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7dd3fc] @[740px]:flex-col @[740px]:items-stretch @[740px]:justify-between @[740px]:border @[740px]:bg-[#060c1a]/75 @[740px]:p-2.5"
                        style={{
                          borderColor: isEnabled
                            ? `color-mix(in srgb, ${meta.accentHex} 60%, transparent)`
                            : 'rgba(30, 58, 102, 0.45)',
                        }}
                        aria-pressed={isEnabled}
                        aria-label={`${isPt ? 'Alternar camada' : 'Toggle layer'} ${
                          isPt ? meta.labelPt : meta.labelEn
                        }`}
                      >
                        {/* Topo do Bloco: LED + Eye + Pílula ON/OFF */}
                        <div className="flex shrink-0 items-center justify-between gap-2 @[740px]:w-full">
                          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#1e3a66]/55 bg-[#060c1a] text-slate-100 @[740px]:h-9 @[740px]:w-9">
                            {isEnabled ? (
                              <Eye size={17} style={{ color: meta.accentHex }} />
                            ) : (
                              <EyeOff size={17} className="text-slate-500" />
                            )}
                          </span>

                          <span
                            className={`hidden items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase @[740px]:inline-flex ${
                              isEnabled
                                ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-200'
                                : 'border-[#1e3a66]/60 bg-[#040b1a] text-slate-400'
                            }`}
                          >
                            <span
                              className="h-1.5 w-1.5 rounded-full"
                              style={{
                                backgroundColor: isEnabled ? meta.accentHex : '#475569',
                              }}
                            />
                            <span>{isEnabled ? 'ON' : 'OFF'}</span>
                          </span>
                        </div>

                        {/* Centro do Bloco: Nome + Fenômeno NASA + Telemetria */}
                        <div className="min-w-0 flex-1 @[740px]:my-1 @[740px]:flex-none">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-full @[740px]:hidden"
                              style={{ backgroundColor: meta.accentHex }}
                            />
                            <span className="truncate text-sm font-semibold text-slate-50 @[740px]:text-[13px]">
                              {isPt ? meta.labelPt : meta.labelEn}
                            </span>
                            <span className="inline-flex shrink-0 items-center rounded-full border border-[#1e3a66]/55 bg-[#060c1a] px-2 py-0.5 text-[10px] font-medium text-slate-300 @[740px]:px-1.5 @[740px]:text-[9px]">
                              {isPt ? meta.phenomenonPt : meta.phenomenonEn}
                            </span>
                          </div>
                          <div className="truncate text-[11px] text-slate-300 [font-variant-numeric:tabular-nums] @[740px]:mt-0.5 @[740px]:text-[10px] @[740px]:text-slate-400">
                            {telemetryDetail}
                          </div>
                        </div>

                        {/* Base do Bloco (Horizontal): Medidor VU + Valor */}
                        <div className="hidden w-full flex-col gap-1 @[740px]:flex">
                          <div className="flex items-center justify-between text-[10px] font-semibold text-slate-200 [font-variant-numeric:tabular-nums]">
                            <span className="text-slate-400">
                              {meta.roleKind === 'conductor'
                                ? isPt
                                  ? 'Tom'
                                  : 'Key'
                                : isPt
                                  ? 'Nível'
                                  : 'Level'}
                            </span>
                            <span>{padMetricLabel}</span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800/85">
                            <div
                              className="h-full rounded-full transition-[width] duration-75"
                              style={{
                                width: `${Math.min(100, Math.round(vuVal * 100))}%`,
                                backgroundColor: meta.accentHex,
                              }}
                            />
                          </div>
                        </div>
                      </button>

                      {/* Zona Inferior Isolada de Ações Secundárias (Solo / Tempestade / Ajustar / Info) */}
                      <div
                        className="flex shrink-0 items-center gap-1.5 @[740px]:justify-between"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {meta.roleKind === 'generator' && (
                          <button
                            type="button"
                            onClick={() => {
                              triggerConsoleHaptic(12);
                              toggleSolo(layerId as SoloableLayerId);
                            }}
                            className={`min-h-[44px] min-w-[44px] cursor-pointer rounded-xl border text-xs font-bold transition active:translate-y-[2px] active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7dd3fc] ${
                              layers[layerId as SoloableLayerId].solo
                                ? 'border-amber-300 bg-amber-400 text-slate-950'
                                : 'border-[#1e3a66]/55 bg-[#060c1a] text-slate-300 hover:text-white'
                            }`}
                            title="Solo"
                            aria-label={`Solo ${isPt ? meta.labelPt : meta.labelEn}`}
                          >
                            S
                          </button>
                        )}

                        {layerId === 'melody' && (
                          <button
                            type="button"
                            onClick={() => {
                              triggerConsoleHaptic(12);
                              toggleSparkle();
                            }}
                            data-testid="tablet-pad-sparkle-toggle"
                            className={`hidden min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-xl border text-xs font-bold transition active:translate-y-[2px] active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7dd3fc] @[740px]:inline-flex ${
                              layers.melody.sparkleEnabled
                                ? 'border-cyan-300/70 bg-[#0c2638] text-[#67f3ff]'
                                : 'border-[#1e3a66]/55 bg-[#060c1a] text-slate-400 hover:text-white'
                            }`}
                            aria-pressed={layers.melody.sparkleEnabled}
                            title={isPt ? 'Ativar/desativar Tempestade' : 'Toggle Storm Sparkle'}
                            aria-label={isPt ? 'Tempestade rápida' : 'Quick Storm Sparkle'}
                          >
                            <Zap size={15} />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            triggerConsoleHaptic(10);
                            setAdjustedLayerId(layerId);
                          }}
                          data-testid={`tablet-layer-adjust-${layerId}`}
                          className="hidden min-h-[44px] flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-[#1e3a66]/55 bg-[#060c1a] px-2.5 text-xs font-semibold text-slate-200 transition hover:border-[#2563eb] hover:text-white active:translate-y-[2px] active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7dd3fc] @[740px]:inline-flex"
                          title={isPt ? 'Ajustar volume e detalhes NASA' : 'Adjust gain and NASA details'}
                        >
                          <SlidersHorizontal size={14} className="shrink-0 text-[#7dd3fc]" />
                          <span className="truncate">{isPt ? 'Ajustar' : 'Tune'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            triggerConsoleHaptic(10);
                            setInspectedDataset(meta.datasetId);
                          }}
                          className="inline-flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-xl border border-[#1e3a66]/50 bg-[#060c1a] text-slate-300 transition hover:border-[#2563eb] hover:text-white active:translate-y-[2px] active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7dd3fc] @[740px]:hidden"
                          title={isPt ? 'Escala científica NASA' : 'NASA scientific scale'}
                          aria-label={`${isPt ? 'Escala científica NASA' : 'NASA scientific scale'} ${
                            isPt ? meta.labelPt : meta.labelEn
                          }`}
                        >
                          <Info size={16} />
                        </button>
                      </div>
                    </div>

                    {/* Sliders em linha mantidos apenas em telas estreitas (< 740px) */}
                    <div className="flex flex-col gap-2 @[740px]:hidden">
                      {meta.roleKind === 'generator' && (
                        <div className="flex flex-col gap-1.5 pl-1">
                          <div className="flex items-center gap-3">
                            <input
                              type="range"
                              min={0}
                              max={200}
                              value={Math.round(layers[layerId as SoloableLayerId].gain * 100)}
                              onPointerDown={() => triggerConsoleHaptic(CONSOLE_HAPTIC_PATTERNS.sliderTouch)}
                              onChange={(e) =>
                                setLayerGain(layerId as SoloableLayerId, Number(e.target.value) / 100)
                              }
                              style={{ touchAction: 'none', accentColor: meta.accentHex }}
                              className="h-10 min-w-[120px] flex-1 cursor-pointer"
                              aria-label={`${isPt ? 'Volume' : 'Gain'} ${
                                isPt ? meta.labelPt : meta.labelEn
                              }`}
                            />
                            <span className="w-14 text-right text-xs font-semibold text-slate-200 [font-variant-numeric:tabular-nums]">
                              {Math.round(layers[layerId as SoloableLayerId].gain * 100)}%
                            </span>
                          </div>

                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800/80">
                            <div
                              className="h-full rounded-full transition-[width] duration-75"
                              style={{
                                width: `${Math.min(100, Math.round(vuVal * 100))}%`,
                                backgroundColor: meta.accentHex,
                              }}
                            />
                          </div>
                        </div>
                      )}

                      {layerId === 'melody' && (
                        <div className="mt-1 ml-3 flex flex-col gap-1.5 rounded-xl border border-[#1e3a66]/55 bg-white/[0.025] p-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                triggerConsoleHaptic(12);
                                toggleSparkle();
                              }}
                              className="inline-flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-xl border border-[#1e3a66]/55 bg-[#060c1a] text-slate-100 transition active:translate-y-[2px] active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7dd3fc]"
                              aria-pressed={layers.melody.sparkleEnabled}
                              aria-label={
                                isPt
                                  ? 'Alternar sub-camada Tempestade'
                                  : 'Toggle Storm Sparkle sub-layer'
                              }
                            >
                              {layers.melody.sparkleEnabled ? (
                                <Eye size={17} className="text-[#67f3ff]" />
                              ) : (
                                <EyeOff size={17} className="text-slate-500" />
                              )}
                            </button>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="h-2 w-2 shrink-0 rounded-full bg-[#67f3ff]" />
                                <span className="truncate text-xs font-semibold text-slate-100">
                                  {isPt
                                    ? 'Tempestade · 5ª/8ª + Cintilação'
                                    : 'Storm · 5th/8ve + Crystal Sparkle'}
                                </span>
                              </div>
                              <div className="truncate text-[11px] text-slate-400 [font-variant-numeric:tabular-nums]">
                                {melParams
                                  ? isPt
                                    ? `${melParams.sparkleCount} eventos nos picos densos de raios`
                                    : `${melParams.sparkleCount} events on dense lightning bursts`
                                  : isPt
                                    ? 'Dobras de 5ª/8ª e brilho cristalino agudo'
                                    : '5th/8ve harmonic bloom & crystal sparkle'}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                triggerConsoleHaptic(12);
                                toggleSparkleSolo();
                              }}
                              className={`min-h-[44px] min-w-[44px] cursor-pointer rounded-xl border text-xs font-bold transition active:translate-y-[2px] active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7dd3fc] ${
                                layers.melody.sparkleSolo
                                  ? 'border-cyan-300 bg-[#67f3ff] text-slate-950'
                                  : 'border-[#1e3a66]/55 bg-[#060c1a] text-slate-300 hover:text-white'
                              }`}
                              title={isPt ? 'Solo apenas Tempestade' : 'Solo Storm Sparkle only'}
                              aria-label={isPt ? 'Solo Tempestade' : 'Solo Storm Sparkle'}
                            >
                              S
                            </button>
                          </div>

                          <div className="flex items-center gap-3 pl-1">
                            <input
                              type="range"
                              min={0}
                              max={200}
                              value={Math.round(layers.melody.sparkleGain * 100)}
                              onPointerDown={() => triggerConsoleHaptic(CONSOLE_HAPTIC_PATTERNS.sliderTouch)}
                              onChange={(e) => setSparkleGain(Number(e.target.value) / 100)}
                              style={{ touchAction: 'none', accentColor: '#67f3ff' }}
                              className="h-10 min-w-[110px] flex-1 cursor-pointer"
                              aria-label={isPt ? 'Ganho da Tempestade' : 'Storm Sparkle Gain'}
                            />
                            <span className="w-14 text-right text-xs font-semibold text-slate-200 [font-variant-numeric:tabular-nums]">
                              {layers.melody.sparkleGain.toFixed(2)}×
                            </span>
                          </div>

                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800/80">
                            <div
                              className="h-full rounded-full bg-[#67f3ff] transition-[width] duration-75"
                              style={{
                                width: `${Math.min(100, Math.round(audioLevels.sparkle * 100))}%`,
                              }}
                            />
                          </div>
                        </div>
                      )}

                      {meta.roleKind === 'fxBus' && (
                        <div className="flex flex-col gap-1.5 pl-1">
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-medium text-slate-400">Dry/Wet 8D</span>
                            <input
                              type="range"
                              min={0}
                              max={100}
                              value={Math.round(layers.wind.wetMix * 100)}
                              onPointerDown={() => triggerConsoleHaptic(CONSOLE_HAPTIC_PATTERNS.sliderTouch)}
                              onChange={(e) => setWindWetMix(Number(e.target.value) / 100)}
                              style={{ touchAction: 'none', accentColor: meta.accentHex }}
                              className="h-10 flex-1 cursor-pointer"
                              aria-label="Wind 8D Dry/Wet"
                            />
                            <span className="w-14 text-right text-xs font-semibold text-slate-200 [font-variant-numeric:tabular-nums]">
                              {Math.round(layers.wind.wetMix * 100)}%
                            </span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800/80">
                            <div
                              className="h-full rounded-full transition-[width] duration-75"
                              style={{
                                width: `${Math.min(100, Math.round(audioLevels.wind * 100))}%`,
                                backgroundColor: meta.accentHex,
                              }}
                            />
                          </div>
                        </div>
                      )}

                      {meta.roleKind === 'conductor' && (
                        <div className="flex min-h-[42px] items-center justify-between rounded-xl border border-[#1e3a66]/35 bg-white/[0.025] px-3 py-2 text-xs text-slate-200 [font-variant-numeric:tabular-nums]">
                          <span>
                            {layers.temperature.enabled
                              ? isPt
                                ? `Clima Real ativo: ${playback.keyRootPt} · ${playback.bpm} BPM`
                                : `Real Climate active: ${playback.keyRoot} · ${playback.bpm} BPM`
                              : isPt
                                ? 'Olhinho desligado → Base Neutra (Lá · 90 BPM)'
                                : 'Eye off → Neutral Base (A · 90 BPM)'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </section>

            {/* 4. Rodapé Compacto de Controle de Narração */}
            <footer className="mt-auto shrink-0 pb-0.5">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-[16px] border border-[#1e3a66]/45 bg-white/[0.025] px-3.5 py-1.5">
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      !voiceAutoEnabled || speechStatus === 'stopped'
                        ? 'bg-slate-500'
                        : speechStatus === 'paused'
                          ? 'bg-amber-400'
                          : speechStatus === 'speaking'
                            ? 'animate-pulse bg-sky-400'
                            : 'bg-[#7dd3fc]/80'
                    }`}
                  />
                  <span className="text-xs font-medium text-slate-300">
                    {!voiceAutoEnabled
                      ? isPt
                        ? 'Narração MINEIRØ silenciada'
                        : 'MINEIRØ narration muted'
                      : speechStatus === 'paused'
                        ? isPt
                          ? 'Narração pausada'
                          : 'Narration paused'
                        : speechStatus === 'stopped'
                          ? isPt
                            ? 'Fala interrompida'
                            : 'Speech stopped'
                          : isPt
                            ? 'Narração MINEIRØ'
                            : 'MINEIRØ Narration'}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      triggerConsoleHaptic(10);
                      togglePauseRobotSpeech();
                    }}
                    data-testid="tablet-speech-pause"
                    aria-pressed={speechStatus === 'paused'}
                    className={`inline-flex min-h-[44px] min-w-[44px] cursor-pointer items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition active:translate-y-[2px] active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7dd3fc] ${
                      speechStatus === 'paused'
                        ? 'border-[#2563eb]/65 bg-[#0c1a36] text-sky-100'
                        : 'border-[#1e3a66]/55 bg-[#060c1a] text-slate-200 hover:border-[#2563eb] hover:text-white'
                    }`}
                  >
                    {speechStatus === 'paused' ? <Play size={14} className="fill-current" /> : <Pause size={14} />}
                    <span>
                      {speechStatus === 'paused'
                        ? isPt
                          ? 'Retomar'
                          : 'Resume'
                        : isPt
                          ? 'Pausar fala'
                          : 'Pause speech'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      triggerConsoleHaptic(10);
                      stopRobotSpeech();
                    }}
                    data-testid="tablet-speech-stop"
                    disabled={!voiceAutoEnabled || speechStatus === 'stopped'}
                    className="inline-flex min-h-[44px] min-w-[44px] cursor-pointer items-center gap-1.5 rounded-xl border border-rose-400/35 bg-rose-500/15 px-3 text-xs font-semibold text-rose-100 transition hover:border-rose-400/70 hover:bg-rose-500/25 active:translate-y-[2px] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7dd3fc]"
                  >
                    <Square size={13} className="fill-current" />
                    <span>{isPt ? 'Interromper fala' : 'Stop speech'}</span>
                  </button>
                </div>
              </div>
            </footer>

            {/* Drawer de Ajuste Fino (Console Horizontal) */}
            {adjustedLayerId && (
              <div
                className="fixed inset-0 z-40 flex items-end justify-center bg-black/65 p-4 backdrop-blur-sm sm:items-center"
                onClick={() => setAdjustedLayerId(null)}
              >
                {(() => {
                  const meta = LAYER_METAS[adjustedLayerId];
                  const isEnabled = layers[adjustedLayerId].enabled;
                  const adjustedMetric = nasaReport?.byLayerId[adjustedLayerId];
                  const drawerVu =
                    adjustedLayerId === 'melody'
                      ? audioLevels.melody
                      : adjustedLayerId === 'temperature'
                        ? isEnabled
                          ? 1
                          : 0
                        : audioLevels[adjustedLayerId];

                  return (
                    <div
                      role="dialog"
                      aria-modal="true"
                      aria-label={isPt ? `Ajustes de ${meta.labelPt}` : `${meta.labelEn} settings`}
                      className="flex w-full max-w-md flex-col gap-3 rounded-[22px] border border-[#1e3a66]/80 bg-[#080d19]/98 p-4 shadow-2xl"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="h-3 w-3 shrink-0 rounded-full"
                            style={{ backgroundColor: meta.accentHex }}
                          />
                          <div>
                            <h2 className="text-sm font-bold text-slate-50">
                              {isPt ? meta.labelPt : meta.labelEn}
                            </h2>
                            <p className="text-[11px] text-slate-400">
                              {adjustedMetric
                                ? `${adjustedMetric.svsId} · ${adjustedMetric.metricHeadline}`
                                : `${isPt ? meta.phenomenonPt : meta.phenomenonEn} · ${
                                    isPt ? meta.musicalRolePt : meta.musicalRoleEn
                                  }`}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            triggerConsoleHaptic(CONSOLE_HAPTIC_PATTERNS.tap);
                            setAdjustedLayerId(null);
                          }}
                          className="inline-flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-xl border border-[#1e3a66]/55 bg-[#060c1a] text-slate-300 transition hover:text-white active:scale-95"
                          aria-label={isPt ? 'Fechar ajustes' : 'Close tuning drawer'}
                        >
                          <X size={18} />
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            triggerConsoleHaptic(12);
                            toggleEye(adjustedLayerId);
                          }}
                          className="inline-flex min-h-[44px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#1e3a66]/65 bg-[#060c1a] px-3 text-xs font-semibold text-slate-100 transition active:translate-y-[2px] active:scale-[0.97]"
                        >
                          {isEnabled ? (
                            <Eye size={16} style={{ color: meta.accentHex }} />
                          ) : (
                            <EyeOff size={16} className="text-slate-500" />
                          )}
                          <span>{isEnabled ? (isPt ? 'Camada Ligada' : 'Layer ON') : (isPt ? 'Camada Desligada' : 'Layer OFF')}</span>
                        </button>

                        {meta.roleKind === 'generator' && (
                          <button
                            type="button"
                            onClick={() => {
                              triggerConsoleHaptic(12);
                              toggleSolo(adjustedLayerId as SoloableLayerId);
                            }}
                            className={`inline-flex min-h-[44px] min-w-[74px] cursor-pointer items-center justify-center rounded-xl border px-3 text-xs font-bold transition active:translate-y-[2px] active:scale-[0.97] ${
                              layers[adjustedLayerId as SoloableLayerId].solo
                                ? 'border-amber-300 bg-amber-400 text-slate-950'
                                : 'border-[#1e3a66]/55 bg-[#060c1a] text-slate-200'
                            }`}
                          >
                            Solo (S)
                          </button>
                        )}
                      </div>

                      {meta.roleKind === 'generator' && (
                        <div className="flex flex-col gap-1.5 rounded-xl border border-[#1e3a66]/45 bg-[#060c1a]/90 p-3">
                          <div className="flex items-center justify-between text-xs font-semibold text-slate-200 [font-variant-numeric:tabular-nums]">
                            <span>{isPt ? 'Ganho da Camada' : 'Layer Gain'}</span>
                            <span>{Math.round(layers[adjustedLayerId as SoloableLayerId].gain * 100)}%</span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={200}
                            value={Math.round(layers[adjustedLayerId as SoloableLayerId].gain * 100)}
                            onPointerDown={() => triggerConsoleHaptic(CONSOLE_HAPTIC_PATTERNS.sliderTouch)}
                            onChange={(e) =>
                              setLayerGain(adjustedLayerId as SoloableLayerId, Number(e.target.value) / 100)
                            }
                            style={{ touchAction: 'none', accentColor: meta.accentHex }}
                            className="h-10 w-full cursor-pointer"
                            aria-label={`${isPt ? 'Ganho ajustado' : 'Adjusted gain'} ${
                              isPt ? meta.labelPt : meta.labelEn
                            }`}
                          />
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800/80">
                            <div
                              className="h-full rounded-full transition-[width] duration-75"
                              style={{
                                width: `${Math.min(100, Math.round(drawerVu * 100))}%`,
                                backgroundColor: meta.accentHex,
                              }}
                            />
                          </div>
                        </div>
                      )}

                      {adjustedLayerId === 'melody' && (
                        <div className="flex flex-col gap-2 rounded-xl border border-[#1e3a66]/55 bg-white/[0.03] p-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="h-2.5 w-2.5 rounded-full bg-[#67f3ff]" />
                              <span className="text-xs font-semibold text-slate-100">
                                {isPt ? 'Tempestade · 5ª/8ª + Cintilação' : 'Storm · 5th/8ve + Sparkle'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  triggerConsoleHaptic(12);
                                  toggleSparkle();
                                }}
                                className={`min-h-[40px] cursor-pointer rounded-xl border px-3 text-xs font-semibold transition active:scale-95 ${
                                  layers.melody.sparkleEnabled
                                    ? 'border-cyan-300/70 bg-[#0c2638] text-[#67f3ff]'
                                    : 'border-[#1e3a66]/55 bg-[#060c1a] text-slate-300'
                                }`}
                              >
                                {layers.melody.sparkleEnabled ? 'ON' : 'OFF'}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  triggerConsoleHaptic(12);
                                  toggleSparkleSolo();
                                }}
                                className={`min-h-[40px] min-w-[44px] cursor-pointer rounded-xl border text-xs font-bold transition active:scale-95 ${
                                  layers.melody.sparkleSolo
                                    ? 'border-cyan-300 bg-[#67f3ff] text-slate-950'
                                    : 'border-[#1e3a66]/55 bg-[#060c1a] text-slate-300'
                                }`}
                              >
                                S
                              </button>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <input
                              type="range"
                              min={0}
                              max={200}
                              value={Math.round(layers.melody.sparkleGain * 100)}
                              onPointerDown={() => triggerConsoleHaptic(CONSOLE_HAPTIC_PATTERNS.sliderTouch)}
                              onChange={(e) => setSparkleGain(Number(e.target.value) / 100)}
                              style={{ touchAction: 'none', accentColor: '#67f3ff' }}
                              className="h-10 flex-1 cursor-pointer"
                              aria-label={isPt ? 'Ganho Tempestade Drawer' : 'Drawer Storm Sparkle Gain'}
                            />
                            <span className="w-14 text-right text-xs font-semibold text-slate-200 [font-variant-numeric:tabular-nums]">
                              {layers.melody.sparkleGain.toFixed(2)}×
                            </span>
                          </div>
                        </div>
                      )}

                      {meta.roleKind === 'fxBus' && (
                        <div className="flex flex-col gap-1.5 rounded-xl border border-[#1e3a66]/45 bg-[#060c1a]/90 p-3">
                          <div className="flex items-center justify-between text-xs font-semibold text-slate-200 [font-variant-numeric:tabular-nums]">
                            <span>Dry/Wet 8D</span>
                            <span>{Math.round(layers.wind.wetMix * 100)}%</span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={100}
                            value={Math.round(layers.wind.wetMix * 100)}
                            onPointerDown={() => triggerConsoleHaptic(CONSOLE_HAPTIC_PATTERNS.sliderTouch)}
                            onChange={(e) => setWindWetMix(Number(e.target.value) / 100)}
                            style={{ touchAction: 'none', accentColor: meta.accentHex }}
                            className="h-10 w-full cursor-pointer"
                            aria-label="Drawer Wind 8D Dry/Wet"
                          />
                        </div>
                      )}

                      {meta.roleKind === 'conductor' && (
                        <div className="rounded-xl border border-[#1e3a66]/45 bg-[#060c1a]/90 p-3 text-xs text-slate-200">
                          {layers.temperature.enabled
                            ? isPt
                              ? `Clima Real ativo: ${playback.keyRootPt} · ${playback.bpm} BPM`
                              : `Real Climate active: ${playback.keyRoot} · ${playback.bpm} BPM`
                            : isPt
                              ? 'Desligada → Base Neutra (Lá · 90 BPM)'
                              : 'Off → Neutral Base (A · 90 BPM)'}
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          triggerConsoleHaptic(10);
                          setInspectedDataset(meta.datasetId);
                          setAdjustedLayerId(null);
                        }}
                        className="inline-flex min-h-[44px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#1e3a66] bg-[#060c1a] px-4 text-xs font-semibold text-sky-200 transition hover:border-[#2563eb] hover:text-white active:scale-95"
                      >
                        <Info size={15} />
                        <span>{isPt ? 'Ver Escala Científica NASA' : 'View NASA Scientific Scale'}</span>
                      </button>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Card Colorido de Curiosidades & Bandeira — Todas as 5 Camadas NASA */}
            {countryNasaModalOpen && nasaReport && (
              <div
                className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center"
                onClick={() => setCountryNasaModalOpen(false)}
              >
                <div
                  role="dialog"
                  aria-modal="true"
                  aria-label={
                    isPt
                      ? `Curiosidades NASA de ${nasaReport.countryName}`
                      : `NASA Curiosities for ${nasaReport.countryName}`
                  }
                  data-testid="country-nasa-report-modal"
                  className="flex max-h-[88dvh] w-full max-w-2xl flex-col overflow-hidden rounded-[24px] border border-white/15 bg-[#080d19]/98 shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div
                    className="h-1.5 w-full shrink-0"
                    style={{
                      background:
                        'linear-gradient(90deg, #facc15 0%, #22d3ee 25%, #4ade80 50%, #38bdf8 75%, #fb7185 100%)',
                    }}
                  />

                  <div className="flex flex-col gap-3 overflow-y-auto p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2.5">
                          <span className="inline-flex h-10 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/25 bg-[#060c1a] shadow-sm">
                            <CountryFlagIcon code={selectedAlpha2} />
                          </span>
                          <span className="text-[10px] font-bold tracking-[0.1em] text-sky-300 uppercase">
                            {isPt
                              ? 'Curiosidades da Órbita · NASA'
                              : 'Orbital Curiosities · NASA'}
                          </span>
                        </div>
                        <h2 className="text-xl font-extrabold tracking-tight text-white sm:text-2xl">
                          {nasaReport.countryName}
                          <span className="ml-2 text-xs font-medium text-slate-400">
                            {nasaReport.coordinatesLabel} · {nasaReport.regionBpm} BPM
                          </span>
                        </h2>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          triggerConsoleHaptic(CONSOLE_HAPTIC_PATTERNS.tap);
                          setCountryNasaModalOpen(false);
                        }}
                        className="inline-flex min-h-[44px] min-w-[44px] shrink-0 cursor-pointer items-center justify-center rounded-xl border border-[#1e3a66]/55 bg-[#060c1a] text-slate-300 transition hover:text-white active:scale-95"
                        aria-label={isPt ? 'Fechar curiosidades NASA' : 'Close NASA curiosities'}
                      >
                        <X size={18} />
                      </button>
                    </div>

                    <div className="rounded-2xl border border-amber-300/25 bg-white/[0.04] px-3.5 py-2.5">
                      <div className="text-[11px] font-bold tracking-wider text-amber-200 uppercase">
                        {nasaReport.curiosityTitle}
                      </div>
                      <p className="mt-0.5 text-xs font-medium leading-relaxed text-slate-100 sm:text-sm">
                        {nasaReport.curiosityText}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      {nasaReport.layers.map((row, idx) => (
                        <div
                          key={row.layerId}
                          className={`flex flex-col justify-between gap-2 rounded-2xl border p-3 ${
                            idx === 4 ? 'sm:col-span-2' : ''
                          }`}
                          style={{
                            borderColor: `color-mix(in srgb, ${row.accentHex} 45%, transparent)`,
                            background: `color-mix(in srgb, ${row.accentHex} 11%, rgba(6, 12, 26, 0.94))`,
                          }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                                  style={{ backgroundColor: row.accentHex }}
                                />
                                <span className="truncate text-xs font-bold text-slate-50">
                                  {row.funLabel}
                                </span>
                                <span
                                  className="rounded px-1.5 py-0.5 text-[9px] font-bold"
                                  style={{
                                    color: row.accentHex,
                                    backgroundColor: 'rgba(4, 9, 22, 0.75)',
                                  }}
                                >
                                  {row.svsId}
                                </span>
                              </div>
                              <div className="mt-0.5 text-[11px] text-slate-300">
                                {row.funHint}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                triggerConsoleHaptic(10);
                                setCountryNasaModalOpen(false);
                                setInspectedDataset(row.datasetId);
                              }}
                              className="inline-flex min-h-[34px] shrink-0 cursor-pointer items-center gap-1 rounded-lg border border-white/15 bg-[#040b1a]/80 px-2 text-[10px] font-semibold text-sky-200 transition hover:border-sky-400 hover:text-white"
                            >
                              <Info size={12} />
                              <span>{isPt ? 'Escala' : 'Scale'}</span>
                            </button>
                          </div>

                          <div>
                            <div className="text-sm font-extrabold text-white [font-variant-numeric:tabular-nums]">
                              {row.metricHeadline}
                            </div>
                            <div className="text-[11px] text-slate-300">{row.metricSubline}</div>
                          </div>

                          {row.normalized01 !== null && (
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/45">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${Math.max(6, Math.min(100, Math.round(row.normalized01 * 100)))}%`,
                                  backgroundColor: row.accentHex,
                                }}
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    <p className="text-center text-[11px] text-slate-400">
                      {isPt
                        ? 'Fatos baseados diretamente nas camadas NASA SVS 5011 · 5147 · 5148 · 5153 · 5154.'
                        : 'Facts grounded directly in NASA SVS layers 5011 · 5147 · 5148 · 5153 · 5154.'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {inspectedDataset && (
              <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center">
                <div className="w-full max-w-md">
                  <NasaDatasetCard
                    open={true}
                    datasetId={inspectedDataset}
                    enabledDatasetIds={enabledDatasetIds}
                    lang={lang}
                    countryName={nasaReport?.countryName}
                    countryCoordinates={nasaReport?.coordinatesLabel}
                    countryLayerMetric={nasaReport?.byDatasetId[inspectedDataset] ?? null}
                    onSelectDataset={setInspectedDataset}
                    onCloseOnce={() => setInspectedDataset(null)}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
