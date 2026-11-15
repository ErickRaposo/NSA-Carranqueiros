import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Headphones,
  Info,
  Pause,
  Play,
  RotateCcw,
  Search,
  SkipBack,
  Sparkles,
  Volume2,
  X,
} from 'lucide-react';
import {
  ALL_COUNTRY_OPTIONS,
  ALL_ISO_ALPHA2_CODES,
  CountryFlagIcon,
} from '../components/CountryFlag';
import { preloadPiperVoice } from '../accessibility/a11yEngine';
import { playLaunchThrust8D } from '../audio/spaceAmbient';
import { NasaDatasetCard } from '../components/NasaDatasetCard';
import { DatasetId } from '../datasets/nasaDatasets';
import { useExperience } from '../experience/ExperienceContext';
import {
  GENERATED_COUNTRY_IDS,
  LAYER_METAS,
  PILOT_COUNTRY_IDS,
  SoloableLayerId,
  VISUAL_LAYER_ORDER,
} from '../experience/types';
import { CountryEntry, loadWorldCountries, searchCountries } from '../geo/countries';
import { JukeboxStudioStage } from '../scenes/JukeboxStudioStage';
import { COUNTRY_ID_TO_ALPHA2 } from '../scenes/studioGeometry';

interface TabletControllerViewProps {
  embeddedInDemo?: boolean;
}

const PILOT_ID_SET = new Set<string>(PILOT_COUNTRY_IDS);

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
  } = useExperience();

  const isPt = lang === 'pt';
  const world = useMemo(() => loadWorldCountries(), []);

  const [isPickingCountry, setIsPickingCountry] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [inspectedDataset, setInspectedDataset] = useState<DatasetId | null>(null);
  const [countdownNum, setCountdownNum] = useState<number>(5);

  const ensureLayersAwakeForStudio = useCallback(() => {
    const allSilent =
      !layers.melody.enabled && !layers.chords.enabled && !layers.bass.enabled;
    if (allSilent) {
      setAllLayersEnabled(true);
    }
    if (!playback.isPlaying) {
      togglePlay();
    }
  }, [
    layers.bass.enabled,
    layers.chords.enabled,
    layers.melody.enabled,
    playback.isPlaying,
    setAllLayersEnabled,
    togglePlay,
  ]);

  // Se o visitante escolheu um país pelo Teto ou já entrou em exploring com storyStep >= 1, abre direto o Mixer
  useEffect(() => {
    if (missionPhase === 'exploring' && storyStep >= 1 && country) {
      setIsPickingCountry(false);
    }
  }, [country, missionPhase, storyStep]);

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

  // Na gravidade zero, espera a fala completa + respiro (13.5s) antes de abrir a exploração
  useEffect(() => {
    if (missionPhase !== 'zero_g') return;
    const timer = window.setTimeout(() => {
      setStoryStep(1);
      setAllLayersEnabled(true);
      setIsPickingCountry(false);
      setMissionPhase('exploring');
    }, 13500);
    return () => window.clearTimeout(timer);
  }, [missionPhase, setAllLayersEnabled, setMissionPhase, setStoryStep]);

  const handleStartOperation = useCallback(() => {
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
    if (!playback.isPlaying) {
      togglePlay();
    }
    setAllLayersEnabled(false);
    setStoryStep(0);
    setIsPickingCountry(true);
    setMissionPhase('briefing');
  }, [lang, playback.isPlaying, setAllLayersEnabled, setMissionPhase, setStoryStep, togglePlay]);

  const handleEnterStudioDirectly = useCallback(() => {
    ensureLayersAwakeForStudio();
    if (!country) {
      selectCountry('076');
    }
    setStoryStep(1);
    setIsPickingCountry(false);
    setMissionPhase('exploring');
  }, [country, ensureLayersAwakeForStudio, selectCountry, setMissionPhase, setStoryStep]);

  const handleBoardSpaceship = useCallback(() => {
    setMissionPhase('boarding');
  }, [setMissionPhase]);

  const handleAuthorizeLiftoff = useCallback(() => {
    playLaunchThrust8D(10.0);
    setMissionPhase('countdown');
  }, [setMissionPhase]);

  const handleEnterExploringFromZeroG = useCallback(() => {
    ensureLayersAwakeForStudio();
    setStoryStep(1);
    setIsPickingCountry(false);
    setMissionPhase('exploring');
  }, [ensureLayersAwakeForStudio, setMissionPhase, setStoryStep]);

  const handleEndMission = useCallback(() => {
    setMissionPhase('ended');
    setInspectedDataset(null);
  }, [setMissionPhase]);

  const handleResetNewMission = useCallback(() => {
    if (playback.isPlaying) {
      togglePlay();
    }
    setAllLayersEnabled(false);
    setStoryStep(0);
    setIsPickingCountry(false);
    setInspectedDataset(null);
    setSearchQuery('');
    setMissionPhase('idle');
  }, [playback.isPlaying, setAllLayersEnabled, setMissionPhase, setStoryStep, togglePlay]);

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

  const enabledDatasetIds = useMemo(
    () =>
      VISUAL_LAYER_ORDER.filter((id) => layers[id].enabled).map(
        (id) => LAYER_METAS[id].datasetId
      ),
    [layers]
  );

  const handlePickCountryEntry = useCallback(
    (entry: CountryEntry) => {
      ensureLayersAwakeForStudio();
      selectCountry(entry.id);
      if (storyStep === 0) {
        setStoryStep(1);
      }
      setSearchQuery('');
      setInspectedDataset(null);
      setIsPickingCountry(false);
    },
    [ensureLayersAwakeForStudio, selectCountry, setStoryStep, storyStep]
  );

  const handleOpenCountrySearch = useCallback(() => {
    setInspectedDataset(null);
    setSearchQuery('');
    setIsPickingCountry(true);
  }, []);

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
  const showSelectionScreen = isPickingCountry || !country;

  const melParams = activeStudioSession?.musicalParameters.melody;
  const chdParams = activeStudioSession?.musicalParameters.chords;
  const basParams = activeStudioSession?.musicalParameters.bass;
  const wndParams = activeStudioSession?.musicalParameters.wind;

  const spkSolo = layers.melody.sparkleSolo;
  const anySolo = spkSolo || layers.melody.solo || layers.chords.solo || layers.bass.solo;
  const dbText = masterDbFs <= -60 ? '-∞ dBFS' : `${masterDbFs.toFixed(1)} dBFS`;

  return (
    <div
      className={`relative flex w-full flex-col overflow-hidden bg-[#060913] font-['Poppins',system-ui,sans-serif] text-slate-50 ${
        embeddedInDemo ? 'h-full' : 'h-dvh'
      }`}
      style={{ overscrollBehavior: 'none' }}
      data-testid="tablet-controller-view"
    >
      {/* Barra superior permanente: Idioma + Encerrar Missão (ou Nova Missão) */}
      <div className="z-30 flex shrink-0 items-center justify-between border-b border-slate-400/15 bg-[#060913]/95 px-4 py-2 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold tracking-[0.06em] text-slate-200 uppercase">
            EARTH JUKEBOX
          </span>
          <span className="hidden rounded-full border border-slate-400/20 bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-slate-400 sm:inline-block">
            {isPt ? 'Controle Studio' : 'Studio Controller'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setLang(isPt ? 'en' : 'pt')}
            className="inline-flex min-h-[38px] min-w-[62px] cursor-pointer items-center justify-center rounded-full border border-slate-400/20 bg-[#060c1a]/85 px-3 text-xs font-semibold text-slate-100 transition hover:border-slate-300/40 active:scale-95"
            aria-label={isPt ? 'Mudar idioma para Inglês' : 'Switch language to Portuguese'}
          >
            {isPt ? 'PT · BR' : 'EN · US'}
          </button>

          {missionPhase !== 'ended' ? (
            <button
              type="button"
              onClick={handleEndMission}
              className="inline-flex min-h-[38px] cursor-pointer items-center gap-1.5 rounded-full border border-rose-400/40 bg-rose-500/15 px-3.5 text-xs font-semibold text-rose-100 transition hover:border-rose-400/75 hover:bg-rose-500/25 active:scale-95"
            >
              <span>{isPt ? 'Encerrar Missão' : 'End Mission'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleResetNewMission}
              className="inline-flex min-h-[38px] cursor-pointer items-center gap-1.5 rounded-full border border-sky-400/50 bg-sky-500/20 px-3.5 text-xs font-semibold text-sky-100 transition hover:border-sky-400/80 hover:bg-sky-500/30 active:scale-95"
            >
              <span>{isPt ? 'Nova Missão' : 'New Mission'}</span>
            </button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {showIntroScreen ? (
          /* =====================================================================
             TELA 0 — INICIAL (INICIAR EXPEDIÇÃO OU ABRIR ESTÚDIO DIRETO)
             ===================================================================== */
          <div className="mx-auto flex h-full w-full max-w-2xl flex-col px-4 py-4 sm:px-6 sm:py-6">
            <main className="flex flex-1 flex-col items-center justify-center py-6">
              <div className="flex w-full max-w-md flex-col items-center gap-6 rounded-[18px] border border-slate-400/15 bg-[#080d19]/95 px-6 py-8 text-center backdrop-blur-xl sm:px-8 sm:py-10">
                <span className="inline-flex items-center gap-2 rounded-full border border-slate-400/20 bg-[#060c1a]/85 px-3.5 py-1.5 text-[11px] font-medium tracking-wide text-slate-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#7dd3fc]" />
                  {isPt ? 'Quarto Projetado · Áudio 8D' : 'Projected Room · 8D Audio'}
                </span>

                <div className="space-y-2.5">
                  <h1 className="text-xl font-bold tracking-tight text-slate-50 sm:text-2xl">
                    {isPt ? 'Pronto para a expedição?' : 'Ready for the expedition?'}
                  </h1>
                  <p className="text-sm leading-relaxed text-slate-400">
                    {isPt
                      ? 'Embarque na nave com o Mineiro ou abra diretamente o Jukebox Studio para mixar os dados da NASA em tempo real.'
                      : 'Board the spacecraft with Mineiro or jump straight into the Jukebox Studio to mix real NASA data.'}
                  </p>
                </div>

                <div className="flex w-full flex-col items-center gap-3">
                  <button
                    type="button"
                    onClick={handleStartOperation}
                    className="inline-flex min-h-[50px] w-full max-w-[260px] cursor-pointer items-center justify-center gap-2.5 rounded-full bg-white px-7 text-sm font-semibold text-[#060913] transition hover:bg-slate-100 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7dd3fc]"
                  >
                    <Play size={18} className="fill-current" />
                    <span>{isPt ? 'Iniciar Operação' : 'Start Operation'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleEnterStudioDirectly}
                    className="inline-flex min-h-[46px] w-full max-w-[260px] cursor-pointer items-center justify-center gap-2 rounded-full border border-slate-400/25 bg-[#060c1a]/85 px-6 text-xs font-semibold text-slate-200 transition hover:border-sky-400/50 hover:text-white active:scale-95"
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
          <div className="mx-auto flex h-full w-full max-w-2xl flex-col px-4 py-4 sm:px-6 sm:py-6">
            <main className="flex flex-1 flex-col items-center justify-center py-6">
              {missionPhase === 'briefing' ? (
                <div className="flex w-full max-w-md flex-col items-center gap-6 rounded-[18px] border border-sky-400/25 bg-[#080d19]/95 px-6 py-8 text-center backdrop-blur-xl sm:px-8 sm:py-10">
                  <span className="inline-flex items-center gap-2 rounded-full border border-sky-400/30 bg-sky-500/10 px-3.5 py-1.5 text-[11px] font-semibold tracking-wide text-sky-200">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-sky-400" />
                    {isPt ? 'Briefing da Missão · MINEIRØ' : 'Mission Briefing · MINEIRØ'}
                  </span>

                  <div className="space-y-2.5">
                    <h2 className="text-xl font-bold tracking-tight text-slate-50">
                      {isPt ? 'Embarcar na Nave' : 'Board the Spacecraft'}
                    </h2>
                    <p className="text-sm leading-relaxed text-slate-400">
                      {isPt
                        ? 'Ouça o astronauta MINEIRØ na parede à sua frente e toque abaixo para fechar as comportas de metal e embarcar.'
                        : 'Listen to astronaut MINEIRØ on the front wall and tap below to seal the blast doors and board.'}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleBoardSpaceship}
                    className="inline-flex min-h-[54px] min-w-[230px] cursor-pointer items-center justify-center gap-2.5 rounded-full bg-white px-8 text-sm font-bold text-[#060913] transition hover:bg-slate-100 active:scale-95"
                  >
                    <Play size={18} className="fill-current" />
                    <span>{isPt ? 'Embarcar na Nave' : 'Board Spacecraft'}</span>
                  </button>
                </div>
              ) : missionPhase === 'boarding' ? (
                <div className="flex w-full max-w-md flex-col items-center gap-6 rounded-[18px] border border-amber-400/30 bg-[#080d19]/95 px-6 py-8 text-center backdrop-blur-xl sm:px-8 sm:py-10">
                  <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-500/10 px-3.5 py-1.5 text-[11px] font-semibold tracking-wide text-amber-200">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
                    {isPt ? 'Portas Lacradas · Cabine Ativa' : 'Doors Sealed · Cabin Active'}
                  </span>

                  <div className="space-y-2.5">
                    <h2 className="text-xl font-bold tracking-tight text-slate-50">
                      {isPt ? 'Autorizar Decolagem' : 'Authorize Liftoff'}
                    </h2>
                    <p className="text-sm leading-relaxed text-slate-400">
                      {isPt
                        ? 'Olhe pela vigia metálica à esquerda: o campo de lançamento está pronto. Toque abaixo para iniciar a contagem 5, 4, 3, 2, 1.'
                        : 'Look through the metal porthole on your left: the launch field is ready. Tap below to start the 5, 4, 3, 2, 1 countdown.'}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleAuthorizeLiftoff}
                    className="inline-flex min-h-[54px] min-w-[230px] cursor-pointer items-center justify-center gap-2.5 rounded-full bg-sky-400 px-8 text-sm font-bold text-[#060913] shadow-[0_0_24px_rgba(56,189,248,0.45)] transition hover:bg-sky-300 active:scale-95"
                  >
                    <Play size={18} className="fill-current" />
                    <span>{isPt ? 'Autorizar Decolagem' : 'Authorize Liftoff'}</span>
                  </button>
                </div>
              ) : missionPhase === 'countdown' ? (
                <div className="flex w-full max-w-md flex-col items-center gap-6 rounded-[18px] border border-amber-400/30 bg-[#080d19]/95 px-6 py-10 text-center backdrop-blur-xl">
                  <div className="relative flex h-24 w-24 items-center justify-center rounded-full border border-amber-400/40 bg-amber-500/10">
                    <span className="text-4xl font-extrabold text-amber-300 [font-variant-numeric:tabular-nums]">
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
                <div className="flex w-full max-w-md flex-col items-center gap-6 rounded-[18px] border border-sky-400/25 bg-[#080d19]/95 px-6 py-10 text-center backdrop-blur-xl">
                  <span className="inline-flex items-center gap-2 rounded-full border border-sky-400/30 bg-sky-500/10 px-3.5 py-1.5 text-[11px] font-semibold tracking-wide text-sky-200">
                    {isPt ? 'Órbita Alcançada · Gravidade Zero' : 'Orbit Reached · Zero Gravity'}
                  </span>

                  <div className="space-y-2">
                    <p className="text-lg font-bold text-slate-100">
                      {isPt ? 'Você está no comando' : 'You are in command'}
                    </p>
                    <p className="text-xs leading-relaxed text-slate-400">
                      {isPt
                        ? 'Olhe para o globo à esquerda e o Jukebox Studio à direita: este tablet comanda todas as camadas da NASA.'
                        : 'Look at the globe on your left and the Jukebox Studio on your right: this tablet commands every NASA layer.'}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleEnterExploringFromZeroG}
                    className="inline-flex min-h-[46px] cursor-pointer items-center justify-center rounded-full bg-white px-7 text-xs font-bold text-[#060913] transition hover:bg-slate-100 active:scale-95"
                  >
                    {isPt ? 'Abrir Jukebox Studio' : 'Open Jukebox Studio'}
                  </button>
                </div>
              ) : (
                <div className="flex w-full max-w-md flex-col items-center gap-6 rounded-[18px] border border-emerald-400/30 bg-[#080d19]/95 px-6 py-9 text-center backdrop-blur-xl">
                  <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/35 bg-emerald-500/10 px-3.5 py-1.5 text-[11px] font-semibold tracking-wide text-emerald-200">
                    {isPt ? 'Missão Concluída · NASA Tribute' : 'Mission Complete · NASA Tribute'}
                  </span>

                  <div className="space-y-2">
                    <h2 className="text-xl font-bold text-slate-50">
                      {isPt ? 'Obrigado pelos seus serviços!' : 'Thank you for your service!'}
                    </h2>
                    <p className="text-xs leading-relaxed text-slate-300">
                      {isPt
                        ? 'Os dados coletados durante sua expedição foram relevantes para compreender o nosso planeta.'
                        : 'The data collected during your expedition was vital to understanding our planet.'}
                    </p>
                    <p className="pt-2 text-xs font-semibold tracking-wider text-sky-300 uppercase">
                      Expedição Mineira · MINEIRØ
                    </p>
                    <p className="text-[11px] text-slate-400">
                      by Erick Raposo · Samuel Amorim · Shayene Figueredo
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleResetNewMission}
                    className="inline-flex min-h-[48px] min-w-[200px] cursor-pointer items-center justify-center rounded-full bg-white px-7 text-sm font-semibold text-[#060913] transition hover:bg-slate-100 active:scale-95"
                  >
                    {isPt ? 'Nova Missão' : 'New Mission'}
                  </button>
                </div>
              )}
            </main>
          </div>
        ) : showSelectionScreen ? (
          /* =====================================================================
             TELA 1 — PESQUISA & SELEÇÃO LIMPA DE PAÍS (APENAS PAÍSES GERADOS)
             ===================================================================== */
          <div className="mx-auto flex h-full w-full max-w-2xl flex-col gap-3.5 px-4 py-4 sm:px-6 sm:py-5">
            <header className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h1 className="truncate text-lg font-bold tracking-tight text-slate-50">
                  {isPt ? 'Escolher País no Estúdio' : 'Select Studio Country'}
                </h1>
                <p className="text-xs text-slate-400">
                  {isPt
                    ? 'Pacotes reais NASA pré-gerados (5 PNGs + 16 Stems + Partitura MIDI)'
                    : 'Pre-generated real NASA packages (5 PNGs + 16 Stems + MIDI Score)'}
                </p>
              </div>

              {country && (
                <button
                  type="button"
                  onClick={() => setIsPickingCountry(false)}
                  className="inline-flex min-h-[44px] shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-slate-400/20 bg-[#060c1a]/85 px-3.5 text-xs font-semibold text-slate-200 transition hover:border-slate-300/40 active:scale-95"
                >
                  <ArrowLeft size={14} />
                  <span>{isPt ? 'Voltar ao Mixer' : 'Back to Mixer'}</span>
                </button>
              )}
            </header>

            {/* Barra de pesquisa */}
            <div className="flex min-h-[48px] items-center gap-2.5 rounded-xl border border-slate-400/20 bg-[#0c1a36]/80 px-3.5 transition-colors focus-within:border-sky-400/50">
              <Search size={18} className="shrink-0 text-slate-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isPt ? 'Pesquisar país...' : 'Search country...'}
                className="w-full bg-transparent text-sm text-slate-50 placeholder:text-slate-400 focus:outline-none"
                aria-label={isPt ? 'Pesquisar país' : 'Search country'}
              />
              {searchQuery.trim().length > 0 && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="inline-flex min-h-[44px] min-w-[44px] -mr-2 items-center justify-center rounded-lg text-slate-400 transition hover:text-slate-100"
                  aria-label={isPt ? 'Limpar pesquisa' : 'Clear search'}
                >
                  <X size={16} />
                </button>
              )}
            </div>

            <section
              className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[18px] border border-slate-400/15 bg-[#080d19]/95 backdrop-blur-xl"
              aria-label={isPt ? 'Lista de países disponíveis' : 'Available countries list'}
            >
              <div className="flex items-center justify-between border-b border-slate-400/15 px-4 py-2.5 text-[11px] font-medium text-slate-400">
                <span>
                  {isPt ? 'Países com pacote NASA gerado' : 'Countries with NASA package'}
                </span>
                <span className="[font-variant-numeric:tabular-nums]">
                  {filteredCountries.length}
                </span>
              </div>

              {filteredCountries.length === 0 ? (
                <div className="flex flex-1 items-center justify-center px-4 text-center text-sm text-slate-400">
                  {isPt
                    ? 'Nenhum país encontrado para esta pesquisa.'
                    : 'No countries found for this search.'}
                </div>
              ) : (
                <ul className="flex-1 divide-y divide-slate-400/10 overflow-y-auto p-1.5">
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
                          className={`flex min-h-[48px] w-full cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition ${
                            isCurrent
                              ? 'bg-white/[0.09] ring-1 ring-slate-300/25'
                              : 'hover:bg-white/[0.05] active:bg-white/[0.08]'
                          }`}
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="inline-flex h-6 w-7 shrink-0 items-center justify-center rounded-md border border-slate-400/15 bg-white/[0.03]">
                              <CountryFlagIcon code={alpha2} />
                            </span>
                            <div className="min-w-0">
                              <span className="block truncate text-sm font-medium text-slate-100">
                                {displayName}
                              </span>
                              <span className="block truncate text-[11px] text-slate-400">
                                {isPt ? item.regionPt : item.regionEn}
                              </span>
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center gap-2">
                            {isPilot && (
                              <span className="rounded-full border border-slate-400/25 bg-white/[0.06] px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-slate-200">
                                {isPt ? 'Destaque' : 'Featured'}
                              </span>
                            )}
                            <span className="text-[11px] text-slate-500 [font-variant-numeric:tabular-nums]">
                              #{item.id}
                            </span>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        ) : (
          /* =====================================================================
             TELA 2 — CONTROLE COMPLETO DO JUKEBOX STUDIO NO TABLET
             ===================================================================== */
          <div className="mx-auto flex h-full w-full max-w-3xl flex-col gap-2.5 overflow-y-auto px-3.5 py-3 sm:px-5 sm:py-4">
            {/* 1. Barra de Presets Rápidos de Países + Botão Pesquisar */}
            <section
              className="flex flex-col gap-2 rounded-[18px] border border-slate-400/15 bg-[#080d19]/95 p-2.5 backdrop-blur-xl"
              aria-label={isPt ? 'Seleção rápida de país' : 'Quick country presets'}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2.5 pl-1">
                  <span className="inline-flex h-7 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-400/20 bg-white/[0.04]">
                    <CountryFlagIcon code={selectedAlpha2} />
                  </span>
                  <div className="min-w-0">
                    <h1 className="truncate text-sm font-bold text-slate-50 sm:text-base">
                      {isPt ? country.namePt : country.nameEn}
                    </h1>
                    <p className="truncate text-[11px] text-slate-400 [font-variant-numeric:tabular-nums]">
                      #{country.id} · {isPt ? country.regionPt : country.regionEn}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleOpenCountrySearch}
                  className="inline-flex min-h-[44px] shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-slate-400/20 bg-[#060c1a]/90 px-3.5 text-xs font-semibold text-slate-100 transition hover:border-slate-300/40 active:scale-95"
                >
                  <Search size={14} />
                  <span>{isPt ? 'Pesquisar país' : 'Search country'}</span>
                </button>
              </div>

              {/* Pílulas Horizontais dos Países Pré-Gerados */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none]">
                {quickPresetCountries.map((preset) => {
                  const active = preset.id === country.id;
                  const pAlpha2 = getAlpha2ForCountry(preset.id, preset.namePt, preset.nameEn);
                  const shortName = isPt ? preset.namePt : preset.nameEn;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handlePickCountryEntry(preset)}
                      className={`inline-flex min-h-[44px] shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition active:scale-95 ${
                        active
                          ? 'border-slate-200/40 bg-white/[0.12] text-white'
                          : 'border-slate-400/15 bg-white/[0.03] text-slate-300 hover:bg-white/[0.07]'
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

            {/* 2. Palco Jukebox Studio Ao Vivo (5 Vídeos NASA + Partitura MIDI Interativa) + Transporte */}
            <section
              className="flex flex-col gap-2 rounded-[18px] border border-slate-400/15 bg-[#080d19]/95 p-2.5 backdrop-blur-xl"
              aria-label={isPt ? 'Estúdio Jukebox Ao Vivo' : 'Live Jukebox Studio'}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                <div className="flex items-center gap-2">
                  {/* Play / Pause */}
                  <button
                    type="button"
                    onClick={togglePlay}
                    className="inline-flex h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 cursor-pointer items-center justify-center rounded-full bg-white text-[#060913] shadow-sm transition hover:bg-slate-100 active:scale-95"
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
                    onClick={restartLoop}
                    className="inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-xl border border-slate-400/20 bg-[#060c1a]/85 px-3 text-xs font-semibold text-slate-200 transition hover:border-slate-300/40 active:scale-95"
                    title={isPt ? 'Voltar ao início' : 'Restart from start'}
                  >
                    <SkipBack size={15} />
                    <span>{isPt ? 'Início' : 'Start'}</span>
                  </button>
                </div>

                {/* Restaurar Padrão */}
                <button
                  type="button"
                  onClick={resetMixerGains}
                  className="inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-xl border border-slate-400/20 bg-[#060c1a]/85 px-3 text-xs font-semibold text-slate-300 transition hover:border-slate-300/40 hover:text-white active:scale-95"
                  title={
                    isPt
                      ? 'Restaurar volumes salvos e religar camadas'
                      : 'Reset mixer gains and re-enable layers'
                  }
                >
                  <RotateCcw size={14} />
                  <span>{isPt ? 'Padrão' : 'Reset'}</span>
                </button>
              </div>

              <div className="h-[320px] w-full overflow-hidden rounded-2xl border border-slate-400/20 bg-black sm:h-[400px]">
                <JukeboxStudioStage renderContext="controller" hideRobot />
              </div>
            </section>

            {/* 3. Mixer das 5 Camadas NASA Estilo Photoshop + Sub-camada Tempestade */}
            <section
              className="flex flex-col gap-2"
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

                let telemetryDetail = isPt ? meta.musicalRolePt : meta.musicalRoleEn;
                if (layerId === 'melody' && melParams) {
                  telemetryDetail = isPt
                    ? `${melParams.noteCount} notas (${melParams.anchorNoteCount} âncoras) · Celesta/Rhodes`
                    : `${melParams.noteCount} notes (${melParams.anchorNoteCount} anchors) · Celesta/Rhodes`;
                } else if (layerId === 'chords' && chdParams) {
                  telemetryDetail = isPt
                    ? `${playback.modeNamePt} · ${chdParams.noteCount} vozes Pad Unison`
                    : `${playback.modeNameEn} · ${chdParams.noteCount} Unison Pad voices`;
                } else if (layerId === 'bass' && basParams) {
                  telemetryDetail = isPt
                    ? `Cutoff ${basParams.cutoffHz} Hz · Drive ${Math.round(basParams.drive * 100)}% · ${basParams.noteCount} notas`
                    : `Cutoff ${basParams.cutoffHz} Hz · Drive ${Math.round(basParams.drive * 100)}% · ${basParams.noteCount} notes`;
                } else if (layerId === 'wind' && wndParams) {
                  telemetryDetail = isPt
                    ? `Vento ${playback.windMeanSpeed.toFixed(1)} m/s · Reverb ${wndParams.reverbDecaySeconds.toFixed(1)}s · 8D`
                    : `Wind ${playback.windMeanSpeed.toFixed(1)} m/s · Reverb ${wndParams.reverbDecaySeconds.toFixed(1)}s · 8D`;
                }

                return (
                  <div
                    key={layerId}
                    className="flex flex-col gap-2 rounded-[18px] border p-3 transition"
                    style={{
                      borderColor: isAudible
                        ? `color-mix(in srgb, ${meta.accentHex} 45%, rgba(148,163,184,0.16))`
                        : 'rgba(148, 163, 184, 0.14)',
                      background: isAudible
                        ? `color-mix(in srgb, ${meta.accentHex} 8%, rgba(8, 13, 25, 0.92))`
                        : 'rgba(8, 13, 25, 0.62)',
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      {/* Olhinho (>= 44px) */}
                      <button
                        type="button"
                        onClick={() => toggleEye(layerId)}
                        className="inline-flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-xl border border-slate-400/20 bg-black/35 text-slate-100 transition active:scale-95"
                        aria-pressed={isEnabled}
                        aria-label={`${isPt ? 'Alternar camada' : 'Toggle layer'} ${
                          isPt ? meta.labelPt : meta.labelEn
                        }`}
                      >
                        {isEnabled ? (
                          <Eye size={18} style={{ color: meta.accentHex }} />
                        ) : (
                          <EyeOff size={18} className="text-slate-500" />
                        )}
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: meta.accentHex }}
                          />
                          <span className="truncate text-sm font-semibold text-slate-50">
                            {isPt ? meta.labelPt : meta.labelEn}
                          </span>
                          <span
                            className="inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wide"
                            style={{
                              borderColor: `color-mix(in srgb, ${meta.accentHex} 50%, transparent)`,
                              backgroundColor: `color-mix(in srgb, ${meta.accentHex} 14%, transparent)`,
                              color: meta.accentHex,
                            }}
                          >
                            {isPt ? meta.phenomenonPt : meta.phenomenonEn}
                          </span>
                        </div>
                        <div className="truncate text-[11px] text-slate-300 [font-variant-numeric:tabular-nums]">
                          {telemetryDetail}
                        </div>
                      </div>

                      {/* Solo (S) para geradores principais */}
                      {meta.roleKind === 'generator' && (
                        <button
                          type="button"
                          onClick={() => toggleSolo(layerId as SoloableLayerId)}
                          className={`min-h-[44px] min-w-[44px] cursor-pointer rounded-xl border text-xs font-bold transition active:scale-95 ${
                            layers[layerId as SoloableLayerId].solo
                              ? 'border-amber-300 bg-amber-400 text-slate-950'
                              : 'border-slate-400/20 bg-black/30 text-slate-300 hover:text-white'
                          }`}
                          title="Solo"
                          aria-label={`Solo ${isPt ? meta.labelPt : meta.labelEn}`}
                        >
                          S
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setInspectedDataset(meta.datasetId)}
                        className="inline-flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-xl border border-slate-400/15 bg-black/25 text-slate-300 transition hover:text-white active:scale-95"
                        title={isPt ? 'Escala científica NASA' : 'NASA scientific scale'}
                        aria-label={`${isPt ? 'Escala científica NASA' : 'NASA scientific scale'} ${
                          isPt ? meta.labelPt : meta.labelEn
                        }`}
                      >
                        <Info size={16} />
                      </button>
                    </div>

                    {/* Slider 0%–200% + Medidor VU Vivo (Geradores) */}
                    {meta.roleKind === 'generator' && (
                      <div className="flex flex-col gap-1.5 pl-1">
                        <div className="flex items-center gap-3">
                          <input
                            type="range"
                            min={0}
                            max={200}
                            value={Math.round(layers[layerId as SoloableLayerId].gain * 100)}
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

                        {/* Barra VU viva da camada */}
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

                    {/* Sub-camada Indentada sob Melodia: ↳ Tempestade (5ª/8ª + Brilho) */}
                    {layerId === 'melody' && (
                      <div className="mt-1 ml-3 flex flex-col gap-1.5 rounded-xl border border-dashed border-cyan-400/30 bg-black/35 p-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={toggleSparkle}
                            className="inline-flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-xl border border-slate-400/20 bg-black/40 text-slate-100 transition active:scale-95"
                            aria-pressed={layers.melody.sparkleEnabled}
                            aria-label={
                              isPt
                                ? 'Alternar sub-camada Tempestade'
                                : 'Toggle Storm Sparkle sub-layer'
                            }
                          >
                            {layers.melody.sparkleEnabled ? (
                              <Sparkles size={17} className="text-[#67f3ff]" />
                            ) : (
                              <EyeOff size={17} className="text-slate-500" />
                            )}
                          </button>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="h-2 w-2 shrink-0 rounded-full bg-[#67f3ff]" />
                              <span className="truncate text-xs font-semibold text-cyan-100">
                                {isPt
                                  ? '↳ Tempestade · 5ª/8ª + Cintilação'
                                  : '↳ Storm · 5th/8ve + Crystal Sparkle'}
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
                            onClick={toggleSparkleSolo}
                            className={`min-h-[44px] min-w-[44px] cursor-pointer rounded-xl border text-xs font-bold transition active:scale-95 ${
                              layers.melody.sparkleSolo
                                ? 'border-cyan-300 bg-[#67f3ff] text-slate-950'
                                : 'border-slate-400/20 bg-black/30 text-slate-300 hover:text-white'
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
                            onChange={(e) => setSparkleGain(Number(e.target.value) / 100)}
                            style={{ touchAction: 'none', accentColor: '#67f3ff' }}
                            className="h-10 min-w-[110px] flex-1 cursor-pointer"
                            aria-label={isPt ? 'Ganho da Tempestade' : 'Storm Sparkle Gain'}
                          />
                          <span className="w-14 text-right text-xs font-semibold text-cyan-200 [font-variant-numeric:tabular-nums]">
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

                    {/* Bus de Efeito Vento 8D: Dry/Wet 0%–100% + VU */}
                    {meta.roleKind === 'fxBus' && (
                      <div className="flex flex-col gap-1.5 pl-1">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-medium text-slate-400">Dry/Wet 8D</span>
                          <input
                            type="range"
                            min={0}
                            max={100}
                            value={Math.round(layers.wind.wetMix * 100)}
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

                    {/* Regente Temperatura: Clima Real (REGION) vs Base Neutra (90 BPM) */}
                    {meta.roleKind === 'conductor' && (
                      <div className="flex min-h-[42px] items-center justify-between rounded-xl bg-black/30 px-3 py-2 text-xs text-slate-200 [font-variant-numeric:tabular-nums]">
                        <span>
                          {layers.temperature.enabled
                            ? isPt
                              ? `Clima Real ativo (REGION): ${playback.keyRootPt} · ${playback.bpm} BPM`
                              : `Real Climate active (REGION): ${playback.keyRoot} · ${playback.bpm} BPM`
                            : isPt
                              ? 'Olhinho desligado → Terra Neutra (BASE: Lá · 90 BPM)'
                              : 'Eye off → Neutral Earth (BASE: A · 90 BPM)'}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </section>

            {/* 4. Rodapé Master Bus (0–160% + VU + dBFS) + Etapa da Fala na Parede Direita */}
            <footer className="mt-auto flex flex-col gap-2 pb-1">
              <div className="flex flex-col gap-1.5 rounded-[18px] border border-slate-400/15 bg-[#080d19]/95 px-3.5 py-2.5">
                <div className="flex items-center gap-3">
                  <Volume2 size={18} className="shrink-0 text-slate-300" />
                  <span className="text-xs font-semibold text-slate-200">Master</span>
                  <input
                    type="range"
                    min={0}
                    max={160}
                    value={Math.round(masterGain * 100)}
                    onChange={(e) => setMasterGain(Number(e.target.value) / 100)}
                    style={{ touchAction: 'none' }}
                    className="h-10 flex-1 cursor-pointer accent-sky-400"
                    aria-label="Master Volume"
                  />
                  <span className="w-12 text-right text-xs font-semibold text-slate-100 [font-variant-numeric:tabular-nums]">
                    {Math.round(masterGain * 100)}%
                  </span>
                  <span className="inline-flex min-h-[30px] items-center rounded-lg border border-slate-400/20 bg-black/40 px-2 text-[11px] font-semibold text-slate-200 [font-variant-numeric:tabular-nums]">
                    {dbText}
                  </span>
                  <span className="hidden min-h-[30px] items-center gap-1 rounded-full border border-sky-400/25 bg-sky-400/10 px-2.5 text-[11px] font-medium text-sky-300 sm:inline-flex">
                    <Headphones size={12} />
                    <span>8D</span>
                  </span>
                </div>

                {/* Master VU Meter Bar */}
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-900">
                  <div
                    className="h-full rounded-full transition-[width] duration-75"
                    style={{
                      width: `${Math.min(100, Math.round(audioLevels.master * 100))}%`,
                      background: 'linear-gradient(90deg, #22c55e 0%, #eab308 72%, #ef4444 100%)',
                    }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 rounded-[18px] border border-slate-400/15 bg-white/[0.025] px-3.5 py-2">
                <span className="text-xs font-medium text-slate-300">
                  {isPt ? 'Fala do Mineiro (Parede Dir.)' : 'Mineiro Commentary (Right Wall)'}
                </span>
                <div className="flex items-center gap-1.5">
                  {[0, 1, 2, 3].map((idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setStoryStep(idx)}
                      className={`min-h-[44px] min-w-[44px] cursor-pointer rounded-xl text-xs font-semibold transition [font-variant-numeric:tabular-nums] ${
                        storyStep === idx
                          ? 'border border-sky-400/50 bg-sky-400/20 text-sky-200'
                          : 'bg-black/30 text-slate-400 hover:text-white'
                      }`}
                      aria-label={`${isPt ? 'Etapa da história' : 'Story step'} ${idx + 1}`}
                    >
                      {idx + 1}
                    </button>
                  ))}
                </div>
              </div>
            </footer>

            {inspectedDataset && (
              <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center">
                <div className="w-full max-w-md">
                  <NasaDatasetCard
                    open={true}
                    datasetId={inspectedDataset}
                    enabledDatasetIds={enabledDatasetIds}
                    lang={lang}
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
