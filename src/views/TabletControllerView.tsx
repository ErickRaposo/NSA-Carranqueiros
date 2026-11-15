import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Headphones,
  Info,
  Pause,
  Play,
  Search,
  Sparkles,
  Volume2,
  X,
} from 'lucide-react';
import {
  ALL_COUNTRY_OPTIONS,
  ALL_ISO_ALPHA2_CODES,
  CountryFlagIcon,
} from '../components/CountryFlag';
import { playLaunchThrust8D } from '../audio/spaceAmbient';
import { NasaDatasetCard } from '../components/NasaDatasetCard';
import { DatasetId } from '../datasets/nasaDatasets';
import { useExperience } from '../experience/ExperienceContext';
import {
  LAYER_METAS,
  PILOT_COUNTRY_IDS,
  SoloableLayerId,
  VISUAL_LAYER_ORDER,
} from '../experience/types';
import { CountryEntry, loadWorldCountries, searchCountries } from '../geo/countries';

interface TabletControllerViewProps {
  embeddedInDemo?: boolean;
}

const PILOT_ID_SET = new Set<string>(PILOT_COUNTRY_IDS);

const NUMERIC_TO_ALPHA2_OVERRIDES: Record<string, string> = {
  '076': 'BR',
  '818': 'EG',
  '156': 'CN',
  '840': 'US',
  '826': 'GB',
  '643': 'RU',
  '410': 'KR',
  '408': 'KP',
  '158': 'TW',
  '275': 'PS',
  '336': 'VA',
  '784': 'AE',
  '180': 'CD',
  '178': 'CG',
  '384': 'CI',
  '132': 'CV',
  '626': 'TL',
  '203': 'CZ',
  '748': 'SZ',
  '807': 'MK',
  '792': 'TR',
  '484': 'MX',
  '392': 'JP',
  '250': 'FR',
  '276': 'DE',
  '356': 'IN',
  '036': 'AU',
  '710': 'ZA',
  '620': 'PT',
};

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
    masterGain,
    pngUrls,
    selectCountry,
    toggleEye,
    setAllLayersEnabled,
    toggleSparkle,
    setLayerGain,
    setWindWetMix,
    toggleSolo,
    setMasterGain,
    togglePlay,
    seekBar,
    setLang,
    setStoryStep,
    setMissionPhase,
  } = useExperience();

  const isPt = lang === 'pt';
  const world = useMemo(() => loadWorldCountries(), []);

  const [hasSelectedCountry, setHasSelectedCountry] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [inspectedDataset, setInspectedDataset] = useState<DatasetId | null>(null);
  const [countdownNum, setCountdownNum] = useState<number>(5);

  // Contagem regressiva 5..1 -> subida lenta (10s) -> zero_g (sem cortar falas nem animações)
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

  // Na gravidade zero, espera a fala completa + respiro (13.5s) antes de dissolver a cabine e entrar as bandeiras
  useEffect(() => {
    if (missionPhase !== 'zero_g') return;
    const timer = window.setTimeout(() => {
      setStoryStep(0);
      setMissionPhase('exploring');
    }, 13500);
    return () => window.clearTimeout(timer);
  }, [missionPhase, setMissionPhase, setStoryStep]);

  const handleStartOperation = useCallback(() => {
    if (!playback.isPlaying) {
      togglePlay();
    }
    setAllLayersEnabled(false);
    setStoryStep(0);
    setHasSelectedCountry(false);
    setMissionPhase('briefing');
  }, [playback.isPlaying, setAllLayersEnabled, setMissionPhase, setStoryStep, togglePlay]);

  const handleBoardSpaceship = useCallback(() => {
    setMissionPhase('boarding');
  }, [setMissionPhase]);

  const handleAuthorizeLiftoff = useCallback(() => {
    playLaunchThrust8D(10.0);
    setMissionPhase('countdown');
  }, [setMissionPhase]);

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
    setHasSelectedCountry(false);
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
      if (NUMERIC_TO_ALPHA2_OVERRIDES[id]) {
        return NUMERIC_TO_ALPHA2_OVERRIDES[id];
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
      selectCountry(entry.id);
      setStoryStep(1);
      setSearchQuery('');
      setInspectedDataset(null);
      setHasSelectedCountry(true);
    },
    [selectCountry, setStoryStep]
  );

  const handleChangeCountry = useCallback(() => {
    setInspectedDataset(null);
    setSearchQuery('');
    setHasSelectedCountry(false);
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
  const showSelectionScreen = !hasSelectedCountry || !country;

  return (
    <div
      className={`relative flex w-full flex-col overflow-hidden bg-[#060913] font-['Poppins',system-ui,sans-serif] text-slate-50 ${
        embeddedInDemo ? 'h-full' : 'h-dvh'
      }`}
      style={{ overscrollBehavior: 'none' }}
      data-testid="tablet-controller-view"
    >
      {/* Barra superior permanente: botão Encerrar Missão (ou Nova Missão) sempre visível */}
      <div className="z-30 flex shrink-0 items-center justify-between border-b border-slate-400/15 bg-[#060913]/95 px-4 py-2 backdrop-blur-md">
        <span className="font-['Orbitron','Poppins',sans-serif] text-xs font-bold tracking-[0.04em] text-slate-300">
          EARTH JUKEBOX
        </span>
        <div className="flex items-center gap-2">
          {missionPhase !== 'ended' ? (
            <button
              type="button"
              onClick={handleEndMission}
              className="inline-flex min-h-[38px] cursor-pointer items-center gap-1.5 rounded-full border border-rose-400/50 bg-rose-500/20 px-4 text-xs font-semibold text-rose-100 transition hover:border-rose-400/80 hover:bg-rose-500/30 active:scale-95"
            >
              <span>{isPt ? 'Encerrar Missão' : 'End Mission'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleResetNewMission}
              className="inline-flex min-h-[38px] cursor-pointer items-center gap-1.5 rounded-full border border-sky-400/50 bg-sky-500/20 px-4 text-xs font-semibold text-sky-100 transition hover:border-sky-400/80 hover:bg-sky-500/30 active:scale-95"
            >
              <span>{isPt ? 'Nova Missão' : 'New Mission'}</span>
            </button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
      {showIntroScreen ? (
        /* =====================================================================
           TELA 0 — INICIAL (ANTES DE COMEÇAR: INICIAR OPERAÇÃO)
           ===================================================================== */
        <div className="mx-auto flex h-full w-full max-w-2xl flex-col px-4 py-4 sm:px-6 sm:py-6">
          <header className="flex items-center justify-between gap-3">
            <h1 className="truncate font-['Orbitron','Poppins',sans-serif] text-lg font-bold tracking-[0.03em] text-slate-50 sm:text-xl">
              EARTH JUKEBOX
            </h1>

            <button
              type="button"
              onClick={() => setLang(isPt ? 'en' : 'pt')}
              className="inline-flex min-h-[44px] min-w-[68px] shrink-0 items-center justify-center rounded-full border border-slate-400/20 bg-[#060c1a]/85 px-3.5 text-xs font-semibold text-slate-100 backdrop-blur-md transition hover:border-slate-300/40 active:scale-95"
              aria-label={isPt ? 'Mudar idioma para Inglês' : 'Switch language to Portuguese'}
            >
              {isPt ? 'PT · BR' : 'EN · US'}
            </button>
          </header>

          <main className="flex flex-1 flex-col items-center justify-center py-6">
            <div className="flex w-full max-w-md flex-col items-center gap-6 rounded-[18px] border border-slate-400/15 bg-[#080d19]/95 px-6 py-8 text-center backdrop-blur-xl sm:px-8 sm:py-10">
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-400/20 bg-[#060c1a]/85 px-3.5 py-1.5 text-[11px] font-medium tracking-wide text-slate-300">
                <span className="h-1.5 w-1.5 rounded-full bg-[#7dd3fc]" />
                {isPt ? 'Quarto Projetado · Áudio 8D' : 'Projected Room · 8D Audio'}
              </span>

              <div className="space-y-2.5">
                <h2 className="font-['Orbitron','Poppins',sans-serif] text-xl font-bold tracking-[0.02em] text-slate-50 sm:text-2xl">
                  {isPt ? 'Pronto para a expedição?' : 'Ready for the expedition?'}
                </h2>
                <p className="text-sm leading-relaxed text-slate-400">
                  {isPt
                    ? 'Embarque na nave com o Mineiro, decole para o espaço e comande os dados da NASA.'
                    : 'Board the spacecraft with Mineiro, launch into space, and command NASA atmospheric data.'}
                </p>
              </div>

              <button
                type="button"
                onClick={handleStartOperation}
                className="inline-flex min-h-[52px] min-w-[220px] cursor-pointer items-center justify-center gap-2.5 rounded-full bg-white px-8 text-sm font-semibold text-[#060913] transition hover:bg-slate-100 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7dd3fc]"
              >
                <Play size={18} className="fill-current" />
                <span>{isPt ? 'Iniciar Operação' : 'Start Operation'}</span>
              </button>
            </div>
          </main>
        </div>
      ) : showMissionStageScreen ? (
        /* =====================================================================
           FASES DA EXPEDIÇÃO: EMBARQUE -> DECOLAGEM -> GRAVIDADE ZERO -> FIM
           ===================================================================== */
        <div className="mx-auto flex h-full w-full max-w-2xl flex-col px-4 py-4 sm:px-6 sm:py-6">
          <header className="flex items-center justify-between gap-3">
            <h1 className="truncate font-['Orbitron','Poppins',sans-serif] text-lg font-bold tracking-[0.03em] text-slate-50 sm:text-xl">
              EARTH JUKEBOX
            </h1>

            <button
              type="button"
              onClick={() => setLang(isPt ? 'en' : 'pt')}
              className="inline-flex min-h-[44px] min-w-[68px] shrink-0 items-center justify-center rounded-full border border-slate-400/20 bg-[#060c1a]/85 px-3.5 text-xs font-semibold text-slate-100 backdrop-blur-md transition hover:border-slate-300/40 active:scale-95"
              aria-label={isPt ? 'Mudar idioma para Inglês' : 'Switch language to Portuguese'}
            >
              {isPt ? 'PT · BR' : 'EN · US'}
            </button>
          </header>

          <main className="flex flex-1 flex-col items-center justify-center py-6">
            {missionPhase === 'briefing' ? (
              <div className="flex w-full max-w-md flex-col items-center gap-6 rounded-[18px] border border-sky-400/25 bg-[#080d19]/95 px-6 py-8 text-center backdrop-blur-xl sm:px-8 sm:py-10">
                <span className="inline-flex items-center gap-2 rounded-full border border-sky-400/30 bg-sky-500/10 px-3.5 py-1.5 text-[11px] font-semibold tracking-wide text-sky-200">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-sky-400" />
                  {isPt ? 'Briefing da Missão · MINEIRØ' : 'Mission Briefing · MINEIRØ'}
                </span>

                <div className="space-y-2.5">
                  <h2 className="font-['Orbitron','Poppins',sans-serif] text-xl font-bold tracking-[0.02em] text-slate-50">
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
                  <h2 className="font-['Orbitron','Poppins',sans-serif] text-xl font-bold tracking-[0.02em] text-slate-50">
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
                  <span className="font-['Orbitron','Poppins',sans-serif] text-4xl font-extrabold text-amber-300">
                    {countdownNum > 0 ? countdownNum : '🚀'}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <p className="font-['Orbitron','Poppins',sans-serif] text-base font-bold text-slate-100">
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
                  <p className="font-['Orbitron','Poppins',sans-serif] text-lg font-bold text-slate-100">
                    {isPt ? 'Você está no controle' : 'You are in command'}
                  </p>
                  <p className="text-xs leading-relaxed text-slate-400">
                    {isPt
                      ? 'Olhe para o globo na sua esquerda: este tablet controla todas as camadas da Terra.'
                      : 'Look at the globe on your left: this tablet controls every Earth data layer.'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setMissionPhase('exploring')}
                  className="inline-flex min-h-[44px] cursor-pointer items-center justify-center rounded-full border border-slate-400/25 bg-[#060c1a]/85 px-6 text-xs font-semibold text-slate-100 transition hover:border-sky-400/50 active:scale-95"
                >
                  {isPt ? 'Explorar Países' : 'Explore Countries'}
                </button>
              </div>
            ) : (
              <div className="flex w-full max-w-md flex-col items-center gap-6 rounded-[18px] border border-emerald-400/30 bg-[#080d19]/95 px-6 py-9 text-center backdrop-blur-xl">
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/35 bg-emerald-500/10 px-3.5 py-1.5 text-[11px] font-semibold tracking-wide text-emerald-200">
                  {isPt ? 'Missão Concluída · NASA Tribute' : 'Mission Complete · NASA Tribute'}
                </span>

                <div className="space-y-2">
                  <h2 className="font-['Orbitron','Poppins',sans-serif] text-xl font-bold text-slate-50">
                    {isPt ? 'Obrigado pelos seus serviços!' : 'Thank you for your service!'}
                  </h2>
                  <p className="text-xs leading-relaxed text-slate-300">
                    {isPt
                      ? 'Os dados coletados durante sua expedição foram relevantes para compreender o nosso planeta.'
                      : 'The data collected during your expedition was vital to understanding our planet.'}
                  </p>
                  <p className="pt-2 font-['Orbitron','Poppins',sans-serif] text-[11px] tracking-wider text-sky-300">
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
           TELA 1 — PESQUISA & SELEÇÃO LIMPA DE PAÍS (ARDÓSIA-OBSIDIANA)
           ===================================================================== */
        <div className="mx-auto flex h-full w-full max-w-2xl flex-col gap-4 px-4 py-4 sm:px-6 sm:py-6">
          {/* Topo: Título curto Orbitron + Seletor PT/EN */}
          <header className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="truncate font-['Orbitron','Poppins',sans-serif] text-lg font-bold tracking-[0.03em] text-slate-50 sm:text-xl">
                EARTH JUKEBOX
              </h1>
              <p className="text-xs text-slate-400">
                {isPt
                  ? 'Escolha um país para iniciar a paisagem sonora NASA'
                  : 'Choose a country to launch the NASA soundscape'}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setLang(isPt ? 'en' : 'pt')}
              className="inline-flex min-h-[44px] min-w-[68px] shrink-0 items-center justify-center rounded-full border border-slate-400/20 bg-[#060c1a]/85 px-3.5 text-xs font-semibold text-slate-100 backdrop-blur-md transition hover:border-slate-300/40 active:scale-95"
              aria-label={isPt ? 'Mudar idioma para Inglês' : 'Switch language to Portuguese'}
            >
              {isPt ? 'PT · BR' : 'EN · US'}
            </button>
          </header>

          {/* Barra de pesquisa no topo (foco discreto, sem outline/ring ciano) */}
          <div className="flex min-h-[48px] items-center gap-2.5 rounded-xl border border-slate-400/20 bg-[#0c1a36]/80 px-3.5 transition-colors focus-within:border-slate-500/60">
            <Search size={18} className="shrink-0 text-slate-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isPt ? 'Pesquisar país...' : 'Search country...'}
              className="w-full bg-transparent text-sm text-slate-50 placeholder:text-slate-400 focus:outline-none focus:ring-0 focus-visible:outline-none"
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

          {/* Caixa seletora limpa listando todos os países disponíveis */}
          <section
            className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[18px] border border-slate-400/15 bg-[#080d19]/95 backdrop-blur-xl"
            aria-label={isPt ? 'Lista de países disponíveis' : 'Available countries list'}
          >
            <div className="flex items-center justify-between border-b border-slate-400/15 px-4 py-2.5 text-[11px] font-medium text-slate-400">
              <span>
                {isPt ? 'Países disponíveis' : 'Available countries'}
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
                  const alpha2 = getAlpha2ForCountry(item.id, item.namePt, item.nameEn);
                  const displayName = isPt ? item.namePt : item.nameEn;

                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => handlePickCountryEntry(item)}
                        className="flex min-h-[48px] w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-white/[0.05] active:bg-white/[0.08]"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="inline-flex h-6 w-7 shrink-0 items-center justify-center rounded-md border border-slate-400/15 bg-white/[0.03]">
                            <CountryFlagIcon code={alpha2} />
                          </span>
                          <span className="truncate text-sm font-medium text-slate-100">
                            {displayName}
                          </span>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          {isPilot && (
                            <span className="rounded-full border border-slate-400/25 bg-white/[0.06] px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-slate-200">
                              {isPt ? 'Piloto' : 'Pilot'}
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
           TELA 2 — MIXER ESTILO PHOTOSHOP DO PAÍS SELECIONADO
           ===================================================================== */
        <div className="mx-auto flex h-full w-full max-w-3xl flex-col gap-3 overflow-y-auto px-4 py-3 sm:px-6 sm:py-4">
          {/* Topo: Botão "Trocar país" + Cabeçalho do país + Botão PT/EN */}
          <header className="flex flex-wrap items-center justify-between gap-2.5 rounded-[18px] border border-slate-400/15 bg-[#080d19]/95 p-3 backdrop-blur-xl">
            <button
              type="button"
              onClick={handleChangeCountry}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-slate-400/20 bg-[#060c1a]/85 px-3.5 text-xs font-semibold text-slate-100 transition hover:border-slate-300/40 active:scale-95"
            >
              <ArrowLeft size={15} />
              <span>{isPt ? 'Trocar país' : 'Change country'}</span>
            </button>

            <div className="flex min-w-0 flex-1 items-center justify-center gap-2.5 px-2">
              <span className="inline-flex h-7 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-400/20 bg-white/[0.04]">
                <CountryFlagIcon code={selectedAlpha2} />
              </span>
              <div className="min-w-0 text-center sm:text-left">
                <div className="flex items-center justify-center gap-1.5 sm:justify-start">
                  <h1 className="truncate text-base font-semibold text-slate-50 sm:text-lg">
                    {isPt ? country.namePt : country.nameEn}
                  </h1>
                  {country.isPilot && (
                    <span className="shrink-0 rounded-full border border-slate-400/25 bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold text-slate-200">
                      {isPt ? 'Piloto' : 'Pilot'}
                    </span>
                  )}
                </div>
                <div className="truncate text-[11px] text-slate-400 [font-variant-numeric:tabular-nums]">
                  #{country.id} · {isPt ? country.regionPt : country.regionEn}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setLang(isPt ? 'en' : 'pt')}
              className="inline-flex min-h-[44px] min-w-[68px] shrink-0 items-center justify-center rounded-full border border-slate-400/20 bg-[#060c1a]/85 px-3 text-xs font-semibold text-slate-100 transition hover:border-slate-300/40 active:scale-95"
              aria-label={isPt ? 'Mudar idioma para Inglês' : 'Switch language to Portuguese'}
            >
              {isPt ? 'PT · BR' : 'EN · US'}
            </button>
          </header>

          {/* Preview visual empilhado dos 5 PNGs + Barra de Transporte (Play/Pause + Tom/BPM + 8 Compassos) */}
          <section className="flex flex-col gap-3 rounded-[18px] border border-slate-400/15 bg-[#080d19]/95 p-3 backdrop-blur-xl sm:flex-row sm:items-center">
            {/* Preview empilhado dos 5 PNGs */}
            <div className="flex items-center gap-3">
              <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-400/15 bg-black">
                <span className="z-0 text-[10px] font-medium text-slate-700 [font-variant-numeric:tabular-nums]">
                  5 PNG
                </span>
                {pngUrls &&
                  VISUAL_LAYER_ORDER.map((layerId) =>
                    layers[layerId].enabled ? (
                      <img
                        key={layerId}
                        src={pngUrls[layerId]}
                        alt=""
                        className="absolute inset-1 z-10 h-[calc(100%-8px)] w-[calc(100%-8px)] object-contain"
                        style={{ mixBlendMode: 'screen' }}
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : null
                  )}
              </div>

              <button
                type="button"
                onClick={togglePlay}
                className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-[#060913] transition active:scale-95"
                aria-label={
                  playback.isPlaying ? (isPt ? 'Pausar' : 'Pause') : isPt ? 'Tocar' : 'Play'
                }
              >
                {playback.isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
              </button>
            </div>

            {/* Tom / BPM + 8 Compassos */}
            <div className="flex flex-1 flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300 [font-variant-numeric:tabular-nums]">
                <div>
                  {isPt ? playback.keyRootPt : playback.keyRoot} ·{' '}
                  {isPt ? playback.modeNamePt : playback.modeNameEn} ·{' '}
                  <strong className="text-slate-50">{playback.bpm} BPM</strong> ·{' '}
                  <span className="text-slate-200">{playback.activeChord}</span>
                </div>
                <div className="text-[11px] text-slate-400">
                  {isPt ? 'Compasso' : 'Bar'} {playback.bar + 1}/{playback.totalBars} ·{' '}
                  {playback.durationSeconds.toFixed(1)}s
                </div>
              </div>

              <div className="grid grid-cols-8 gap-1.5">
                {Array.from({ length: playback.totalBars }).map((_, barIdx) => {
                  const isCurrent = playback.bar === barIdx;
                  return (
                    <button
                      key={barIdx}
                      type="button"
                      onClick={() => seekBar(barIdx)}
                      className={`min-h-[44px] rounded-lg text-xs font-semibold transition [font-variant-numeric:tabular-nums] ${
                        isCurrent
                          ? 'bg-slate-100 text-slate-950'
                          : 'bg-white/[0.06] text-slate-400 hover:bg-white/15 hover:text-slate-100'
                      }`}
                      aria-label={`${isPt ? 'Compasso' : 'Bar'} ${barIdx + 1}`}
                    >
                      {barIdx + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Mixer das 5 Camadas Estilo Photoshop */}
          <section
            className="flex flex-col gap-2"
            role="group"
            aria-label={isPt ? 'Mixer das 5 camadas NASA' : 'NASA 5-layer mixer'}
          >
            {VISUAL_LAYER_ORDER.map((layerId) => {
              const meta = LAYER_METAS[layerId];
              const isEnabled = layers[layerId].enabled;

              return (
                <div
                  key={layerId}
                  className="flex flex-col gap-2 rounded-2xl border p-3 transition"
                  style={{
                    borderColor: isEnabled
                      ? `color-mix(in srgb, ${meta.accentHex} 45%, rgba(148,163,184,0.16))`
                      : 'rgba(148, 163, 184, 0.14)',
                    background: isEnabled
                      ? `color-mix(in srgb, ${meta.accentHex} 9%, rgba(8, 15, 30, 0.85))`
                      : 'rgba(8, 15, 30, 0.58)',
                  }}
                >
                  <div className="flex items-center justify-between gap-2.5">
                    {/* Botão Olhinho (>= 44px) */}
                    <button
                      type="button"
                      onClick={() => toggleEye(layerId)}
                      className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-slate-400/20 bg-black/30 text-slate-100 transition active:scale-95"
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
                      <div className="flex items-center gap-1.5">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: meta.accentHex }}
                        />
                        <span className="truncate text-sm font-semibold text-slate-50">
                          {isPt ? meta.labelPt : meta.labelEn}
                        </span>
                        <span className="truncate text-xs text-slate-400">
                          · {isPt ? meta.phenomenonPt : meta.phenomenonEn}
                        </span>
                      </div>
                      <div className="truncate text-[11px] text-slate-400">
                        {isPt ? meta.musicalRolePt : meta.musicalRoleEn}
                      </div>
                    </div>

                    {/* Solo (S) apenas para geradores */}
                    {meta.roleKind === 'generator' && (
                      <button
                        type="button"
                        onClick={() => toggleSolo(layerId as SoloableLayerId)}
                        className={`min-h-[44px] min-w-[44px] rounded-xl border text-xs font-bold transition active:scale-95 ${
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
                      className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-slate-400/15 bg-black/25 text-slate-300 transition hover:text-white active:scale-95"
                      title={isPt ? 'Escala científica NASA' : 'NASA scientific scale'}
                      aria-label={isPt ? 'Escala científica NASA' : 'NASA scientific scale'}
                    >
                      <Info size={16} />
                    </button>
                  </div>

                  {/* Controles Touch-Friendly (>= 44px) por tipo de camada */}
                  {meta.roleKind === 'generator' && (
                    <div className="flex flex-wrap items-center gap-3 pl-1">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={Math.round(layers[layerId as SoloableLayerId].gain * 100)}
                        onChange={(e) =>
                          setLayerGain(layerId as SoloableLayerId, Number(e.target.value) / 100)
                        }
                        style={{ touchAction: 'none', accentColor: meta.accentHex }}
                        className="h-11 min-w-[140px] flex-1 cursor-pointer"
                        aria-label={`${isPt ? 'Volume' : 'Gain'} ${
                          isPt ? meta.labelPt : meta.labelEn
                        }`}
                      />
                      <span className="w-11 text-right text-xs font-medium text-slate-300 [font-variant-numeric:tabular-nums]">
                        {Math.round(layers[layerId as SoloableLayerId].gain * 100)}%
                      </span>

                      {layerId === 'melody' && (
                        <button
                          type="button"
                          onClick={toggleSparkle}
                          className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition active:scale-95 ${
                            layers.melody.sparkleEnabled
                              ? 'border-amber-400/50 bg-amber-400/15 text-amber-200'
                              : 'border-slate-400/20 bg-black/25 text-slate-400'
                          }`}
                        >
                          <Sparkles size={14} />
                          <span>{isPt ? 'Tempestade' : 'Storm'}</span>
                        </button>
                      )}
                    </div>
                  )}

                  {meta.roleKind === 'fxBus' && (
                    <div className="flex items-center gap-3 pl-1">
                      <span className="text-xs font-medium text-slate-400">Dry/Wet 8D</span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={Math.round(layers.wind.wetMix * 100)}
                        onChange={(e) => setWindWetMix(Number(e.target.value) / 100)}
                        style={{ touchAction: 'none', accentColor: meta.accentHex }}
                        className="h-11 flex-1 cursor-pointer"
                        aria-label="Wind 8D Dry/Wet"
                      />
                      <span className="w-11 text-right text-xs font-medium text-slate-300 [font-variant-numeric:tabular-nums]">
                        {Math.round(layers.wind.wetMix * 100)}%
                      </span>
                    </div>
                  )}

                  {meta.roleKind === 'conductor' && (
                    <div className="flex min-h-[44px] items-center justify-between rounded-xl bg-black/25 px-3 py-2 text-xs text-slate-300 [font-variant-numeric:tabular-nums]">
                      <span>
                        {layers.temperature.enabled
                          ? isPt
                            ? `Clima Real ativo (${playback.keyRootPt} · ${playback.bpm} BPM)`
                            : `Real Climate active (${playback.keyRoot} · ${playback.bpm} BPM)`
                          : isPt
                            ? 'Olhinho desligado → Base Neutra (Lá · 90 BPM)'
                            : 'Eye off → Neutral Base (A · 90 BPM)'}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </section>

          {/* Rodapé: Volume Master + História do Robô (Parede Direita) */}
          <footer className="mt-auto flex flex-col gap-2 pb-1">
            <div className="flex items-center gap-3 rounded-2xl border border-slate-400/15 bg-white/[0.025] px-3.5 py-2">
              <Volume2 size={18} className="shrink-0 text-slate-300" />
              <span className="text-xs font-medium text-slate-300">Master</span>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(masterGain * 100)}
                onChange={(e) => setMasterGain(Number(e.target.value) / 100)}
                style={{ touchAction: 'none' }}
                className="h-11 flex-1 cursor-pointer accent-sky-400"
                aria-label="Master Volume"
              />
              <span className="w-11 text-right text-xs font-semibold text-slate-200 [font-variant-numeric:tabular-nums]">
                {Math.round(masterGain * 100)}%
              </span>
              <span className="inline-flex min-h-[32px] items-center gap-1 rounded-full border border-sky-400/25 bg-sky-400/10 px-2.5 text-[11px] font-medium text-sky-300">
                <Headphones size={12} />
                <span>8D</span>
              </span>
            </div>

            <div className="flex items-center justify-between gap-2 rounded-2xl border border-slate-400/15 bg-white/[0.025] px-3.5 py-2">
              <span className="text-xs font-medium text-slate-300">
                {isPt ? 'História do Robô (Parede Dir.)' : 'Robot Story (Right Wall)'}
              </span>
              <div className="flex items-center gap-1.5">
                {[0, 1, 2, 3].map((idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setStoryStep(idx)}
                    className={`min-h-[44px] min-w-[44px] rounded-xl text-xs font-semibold transition [font-variant-numeric:tabular-nums] ${
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
