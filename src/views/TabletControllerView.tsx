import React, { useCallback, useMemo, useState } from 'react';
import {
  Eye,
  EyeOff,
  Globe2,
  Headphones,
  Info,
  Map as MapIcon,
  Pause,
  Play,
  Search,
  Sparkles,
  Volume2,
} from 'lucide-react';
import { CameraViewTarget, EarthCanvas, HoverInfo } from '../components/EarthCanvas';
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
import { buildGlobeLayerStack, useNasaVideoPool } from '../hooks/useNasaVideoPool';

interface TabletControllerViewProps {
  embeddedInDemo?: boolean;
}

export const TabletControllerView: React.FC<TabletControllerViewProps> = ({
  embeddedInDemo = false,
}) => {
  const {
    country,
    availableCountryIds,
    lang,
    storyStep,
    layers,
    playback,
    masterGain,
    pngUrls,
    selectCountry,
    toggleEye,
    toggleSparkle,
    setLayerGain,
    setWindWetMix,
    toggleSolo,
    setMasterGain,
    togglePlay,
    seekBar,
    setLang,
    setStoryStep,
  } = useExperience();

  const isPt = lang === 'pt';
  const world = useMemo(() => loadWorldCountries(), []);

  const [viewMode, setViewMode] = useState<'3d' | '2d'>('3d');
  const [searchQuery, setSearchQuery] = useState('');
  const [flyTarget, setFlyTarget] = useState<CameraViewTarget | null>(null);
  const [, setHoverInfo] = useState<HoverInfo | null>(null);
  const [inspectedDataset, setInspectedDataset] = useState<DatasetId | null>(null);

  const globeLayerStack = useMemo(() => buildGlobeLayerStack(layers), [layers]);
  const videoElements = useNasaVideoPool(globeLayerStack, true);

  const enabledDatasetIds = useMemo(
    () => globeLayerStack.filter((l) => l.enabled).map((l) => l.id),
    [globeLayerStack]
  );

  const selectedGeoEntry = useMemo(
    () => (country ? world.countries.find((c) => c.id === country.id) ?? null : null),
    [country, world.countries]
  );

  const searchableCountries = useMemo(
    () => world.countries.filter((c) => availableCountryIds.has(c.id)),
    [availableCountryIds, world.countries]
  );

  const searchResults = useMemo(
    () => (searchQuery.trim() ? searchCountries(searchQuery, searchableCountries, 6) : []),
    [searchQuery, searchableCountries]
  );

  const handlePickCountryEntry = useCallback(
    (entry: CountryEntry | null) => {
      if (!entry) return;
      selectCountry(entry.id);
      setSearchQuery('');
      setFlyTarget({
        lon: entry.lon,
        lat: entry.lat,
        distance: entry.idealDistance,
        nonce: Date.now(),
      });
    },
    [selectCountry]
  );

  const handlePickPilot = useCallback(
    (pilotId: string) => {
      const found = world.countries.find((c) => c.id === pilotId);
      if (found) {
        handlePickCountryEntry(found);
      }
    },
    [handlePickCountryEntry, world.countries]
  );

  return (
    <div
      className={`relative flex w-full flex-col overflow-hidden bg-[#060913] text-slate-50 lg:flex-row ${
        embeddedInDemo ? 'h-full' : 'h-dvh'
      }`}
      style={{ overscrollBehavior: 'none' }}
      data-testid="tablet-controller-view"
    >
      {/* Coluna Esquerda / Fundo: Globo 3D / Mapa 2D com as 5 layers de vídeo NASA */}
      <div className="relative min-h-[42vh] flex-1 overflow-hidden bg-[#020617] lg:min-h-0">
        <EarthCanvas
          videoElements={videoElements}
          layers={globeLayerStack}
          viewMode={viewMode}
          visualStyle="bioluminescent"
          orbitAutoRotate={!country}
          showBorders={true}
          showGrid={false}
          showLabels={true}
          highContrast={false}
          lang={lang}
          availableCountryIds={availableCountryIds}
          countries={world.countries}
          allRings={world.allRings}
          landBorderRings={world.landBorderRings}
          coastlineRings={world.coastlineRings}
          selectedCountry={selectedGeoEntry}
          jukeboxPlaying={playback.isPlaying}
          flyTarget={flyTarget}
          onHoverChange={setHoverInfo}
          onCameraDistanceChange={() => {}}
          onSelectCountry={handlePickCountryEntry}
        />

        {/* Topbar flutuante sobre o Globo (Busca + Pilotos + 3D/2D + PT/EN) */}
        <div className="pointer-events-none absolute inset-x-3 top-3 z-20 flex flex-wrap items-start justify-between gap-2">
          <div className="pointer-events-auto relative w-full max-w-xs">
            <div className="flex min-h-[44px] items-center gap-2 rounded-full border border-slate-400/20 bg-[#060c1a]/85 px-3.5 backdrop-blur-md">
              <Search size={16} className="shrink-0 text-slate-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isPt ? 'Buscar país (PT / EN)...' : 'Search country (PT / EN)...'}
                className="w-full bg-transparent text-xs text-slate-50 placeholder:text-slate-400 focus:outline-none"
                aria-label={isPt ? 'Buscar país' : 'Search country'}
              />
            </div>

            {searchResults.length > 0 && (
              <ul className="mt-1.5 overflow-hidden rounded-2xl border border-slate-400/20 bg-[#080d19]/95 py-1 shadow-2xl backdrop-blur-xl">
                {searchResults.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => handlePickCountryEntry(item)}
                      className="flex min-h-[44px] w-full items-center justify-between px-3.5 text-left text-xs text-slate-100 hover:bg-white/10"
                    >
                      <span className="font-medium">{isPt ? item.namePt : item.nameEn}</span>
                      <span className="text-[11px] text-slate-400 [font-variant-numeric:tabular-nums]">
                        #{item.id}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="pointer-events-auto flex flex-wrap items-center gap-1.5">
            {/* Atalhos dos 3 Países Piloto (Brasil, Egito, China) */}
            <div className="flex items-center gap-1 rounded-full border border-slate-400/20 bg-[#060c1a]/85 p-1 backdrop-blur-md">
              {PILOT_COUNTRY_IDS.map((pid) => {
                const entry = world.countries.find((c) => c.id === pid);
                if (!entry) return null;
                const active = country?.id === pid;
                return (
                  <button
                    key={pid}
                    type="button"
                    onClick={() => handlePickPilot(pid)}
                    className={`min-h-[38px] rounded-full px-3 text-xs font-semibold transition ${
                      active
                        ? 'bg-white/15 text-white ring-1 ring-slate-200/30'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {isPt ? entry.namePt : entry.nameEn}
                  </button>
                );
              })}
            </div>

            {/* Toggle 3D / 2D */}
            <button
              type="button"
              onClick={() => setViewMode((m) => (m === '3d' ? '2d' : '3d'))}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-slate-400/20 bg-[#060c1a]/85 px-3.5 text-xs font-semibold text-slate-100 backdrop-blur-md hover:border-slate-300/40"
            >
              {viewMode === '3d' ? <MapIcon size={15} /> : <Globe2 size={15} />}
              <span>{viewMode === '3d' ? '2D' : '3D'}</span>
            </button>

            {/* Toggle PT / EN */}
            <button
              type="button"
              onClick={() => setLang(isPt ? 'en' : 'pt')}
              className="inline-flex min-h-[44px] min-w-[54px] items-center justify-center rounded-full border border-slate-400/20 bg-[#060c1a]/85 px-3 text-xs font-semibold text-slate-100 backdrop-blur-md hover:border-slate-300/40"
              aria-label={isPt ? 'Mudar idioma para Inglês' : 'Switch language to Portuguese'}
            >
              {isPt ? 'PT · BR' : 'EN · US'}
            </button>
          </div>
        </div>

        {inspectedDataset && (
          <div className="pointer-events-auto absolute bottom-3 left-3 z-30 max-w-md">
            <NasaDatasetCard
              open={true}
              datasetId={inspectedDataset}
              enabledDatasetIds={enabledDatasetIds}
              lang={lang}
              onSelectDataset={setInspectedDataset}
              onCloseOnce={() => setInspectedDataset(null)}
            />
          </div>
        )}
      </div>

      {/* Coluna Direita: Console Tátil Ardósia-Obsidiana (Mixer 5 Linhas estilo Photoshop + Transporte) */}
      <aside className="flex w-full shrink-0 flex-col gap-3 overflow-y-auto border-t border-slate-400/15 bg-[#080d19]/95 p-4 backdrop-blur-xl lg:w-[430px] lg:border-t-0 lg:border-l">
        {/* Cabeçalho do País + Preview da Silhueta Recortada */}
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-400/15 bg-white/[0.025] p-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-slate-400 [font-variant-numeric:tabular-nums]">
                #{country?.id ?? '—'} · {country ? (isPt ? country.regionPt : country.regionEn) : ''}
              </span>
              {country?.isPilot && (
                <span className="rounded-full border border-sky-400/30 bg-sky-400/10 px-2 py-0.5 text-[10px] font-semibold text-sky-300">
                  {isPt ? 'Piloto' : 'Pilot'}
                </span>
              )}
            </div>
            <h1 className="truncate text-lg font-semibold text-slate-50">
              {country
                ? isPt
                  ? country.namePt
                  : country.nameEn
                : isPt
                  ? 'Selecione um país'
                  : 'Select a country'}
            </h1>
            <div className="mt-0.5 text-xs text-slate-300 [font-variant-numeric:tabular-nums]">
              {isPt ? playback.keyRootPt : playback.keyRoot} ·{' '}
              {isPt ? playback.modeNamePt : playback.modeNameEn} ·{' '}
              <strong>{playback.bpm} BPM</strong> · <span>{playback.activeChord}</span>
            </div>
          </div>

          {/* Mini-stack dos 5 PNGs recortados */}
          <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-400/15 bg-black">
            <span className="z-0 text-[9px] font-medium text-slate-700">5 PNG</span>
            {pngUrls &&
              VISUAL_LAYER_ORDER.map((layerId) =>
                layers[layerId].enabled ? (
                  <img
                    key={layerId}
                    src={pngUrls[layerId]}
                    alt=""
                    className="z-10 absolute inset-1 h-[calc(100%-8px)] w-[calc(100%-8px)] object-contain"
                    style={{ mixBlendMode: 'screen' }}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : null
              )}
          </div>
        </div>

        {/* Transporte Musical + Timeline de Compassos */}
        <div className="flex items-center gap-2.5 rounded-2xl border border-slate-400/15 bg-white/[0.025] p-2.5">
          <button
            type="button"
            onClick={togglePlay}
            className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-[#060913] shadow transition active:scale-95"
            aria-label={playback.isPlaying ? (isPt ? 'Pausar' : 'Pause') : isPt ? 'Tocar' : 'Play'}
          >
            {playback.isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
          </button>

          <div className="flex flex-1 flex-col gap-1.5">
            <div className="flex items-center justify-between text-[11px] text-slate-400 [font-variant-numeric:tabular-nums]">
              <span>
                {isPt ? 'Compasso' : 'Bar'} {playback.bar + 1}/{playback.totalBars}
              </span>
              <span>{playback.durationSeconds.toFixed(1)}s</span>
            </div>
            <div className="grid grid-cols-8 gap-1">
              {Array.from({ length: playback.totalBars }).map((_, barIdx) => {
                const isCurrent = playback.bar === barIdx;
                return (
                  <button
                    key={barIdx}
                    type="button"
                    onClick={() => seekBar(barIdx)}
                    className={`h-6 rounded-md text-[10px] font-semibold transition [font-variant-numeric:tabular-nums] ${
                      isCurrent
                        ? 'bg-slate-100 text-slate-950'
                        : 'bg-white/[0.06] text-slate-400 hover:bg-white/15'
                    }`}
                  >
                    {barIdx + 1}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Mixer 5 Camadas Estilo Photoshop (1:1 com os 5 recortes PNG da NASA) */}
        <div className="flex flex-col gap-2" role="group" aria-label="NASA Layers Mixer">
          {VISUAL_LAYER_ORDER.map((layerId) => {
            const meta = LAYER_METAS[layerId];
            const isEnabled = layers[layerId].enabled;

            return (
              <div
                key={layerId}
                className="flex flex-col gap-2 rounded-2xl border p-2.5 transition"
                style={{
                  borderColor: isEnabled
                    ? `color-mix(in srgb, ${meta.accentHex} 45%, rgba(148,163,184,0.16))`
                    : 'rgba(148, 163, 184, 0.14)',
                  background: isEnabled
                    ? `color-mix(in srgb, ${meta.accentHex} 9%, rgba(8, 15, 30, 0.82))`
                    : 'rgba(8, 15, 30, 0.55)',
                }}
              >
                <div className="flex items-center justify-between gap-2">
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
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: meta.accentHex }}
                      />
                      <span className="truncate text-xs font-semibold text-slate-50">
                        {isPt ? meta.labelPt : meta.labelEn}
                      </span>
                      <span className="truncate text-[11px] text-slate-400">
                        · {isPt ? meta.phenomenonPt : meta.phenomenonEn}
                      </span>
                    </div>
                    <div className="truncate text-[11px] text-slate-400">
                      {isPt ? meta.musicalRolePt : meta.musicalRoleEn}
                    </div>
                  </div>

                  {/* Controles específicos por tipo de camada */}
                  {meta.roleKind === 'generator' && (
                    <button
                      type="button"
                      onClick={() => toggleSolo(layerId as SoloableLayerId)}
                      className={`min-h-[44px] min-w-[44px] rounded-xl border text-xs font-bold transition ${
                        layers[layerId as SoloableLayerId].solo
                          ? 'border-amber-300 bg-amber-400 text-slate-950'
                          : 'border-slate-400/20 bg-black/30 text-slate-300 hover:text-white'
                      }`}
                      title="Solo"
                    >
                      S
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setInspectedDataset(meta.datasetId)}
                    className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-slate-400/15 bg-black/25 text-slate-300 hover:text-white"
                    title={isPt ? 'Escala científica NASA' : 'NASA scientific scale'}
                    aria-label={isPt ? 'Escala científica NASA' : 'NASA scientific scale'}
                  >
                    <Info size={16} />
                  </button>
                </div>

                {/* Segunda faixa enxuta: Slider de Volume, Dry/Wet ou Status do Regente + Sub-toggle Tempestade */}
                {meta.roleKind === 'generator' && (
                  <div className="flex items-center gap-2.5 pl-1">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={Math.round(layers[layerId as SoloableLayerId].gain * 100)}
                      onChange={(e) =>
                        setLayerGain(layerId as SoloableLayerId, Number(e.target.value) / 100)
                      }
                      style={{ touchAction: 'none', accentColor: meta.accentHex }}
                      className="h-6 flex-1 cursor-pointer"
                      aria-label={`${isPt ? 'Volume' : 'Gain'} ${
                        isPt ? meta.labelPt : meta.labelEn
                      }`}
                    />
                    <span className="w-10 text-right text-[11px] text-slate-300 [font-variant-numeric:tabular-nums]">
                      {Math.round(layers[layerId as SoloableLayerId].gain * 100)}%
                    </span>

                    {layerId === 'melody' && (
                      <button
                        type="button"
                        onClick={toggleSparkle}
                        className={`inline-flex min-h-[38px] items-center gap-1 rounded-full border px-2.5 text-[11px] font-semibold transition ${
                          layers.melody.sparkleEnabled
                            ? 'border-amber-400/50 bg-amber-400/15 text-amber-200'
                            : 'border-slate-400/20 bg-black/20 text-slate-400'
                        }`}
                      >
                        <Sparkles size={12} />
                        <span>{isPt ? 'Tempestade' : 'Storm'}</span>
                      </button>
                    )}
                  </div>
                )}

                {meta.roleKind === 'fxBus' && (
                  <div className="flex items-center gap-2.5 pl-1">
                    <span className="text-[11px] text-slate-400">Dry/Wet 8D</span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={Math.round(layers.wind.wetMix * 100)}
                      onChange={(e) => setWindWetMix(Number(e.target.value) / 100)}
                      style={{ touchAction: 'none', accentColor: meta.accentHex }}
                      className="h-6 flex-1 cursor-pointer"
                      aria-label="Wind 8D Dry/Wet"
                    />
                    <span className="w-10 text-right text-[11px] text-slate-300 [font-variant-numeric:tabular-nums]">
                      {Math.round(layers.wind.wetMix * 100)}%
                    </span>
                  </div>
                )}

                {meta.roleKind === 'conductor' && (
                  <div className="flex items-center justify-between rounded-xl bg-black/25 px-3 py-2 text-[11px] text-slate-300 [font-variant-numeric:tabular-nums]">
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
        </div>

        {/* Sincronia das falas do Robozinho na Parede Direita (storyStep 0..3) + Volume Master */}
        <div className="mt-auto flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2 rounded-2xl border border-slate-400/15 bg-white/[0.025] px-3 py-2">
            <span className="text-[11px] font-medium text-slate-300">
              {isPt ? 'História do Robô (Parede Dir.):' : 'Robot Story (Right Wall):'}
            </span>
            <div className="flex items-center gap-1">
              {[0, 1, 2, 3].map((idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setStoryStep(idx)}
                  className={`min-h-[36px] min-w-[36px] rounded-lg text-xs font-semibold transition [font-variant-numeric:tabular-nums] ${
                    storyStep === idx
                      ? 'bg-sky-400/20 text-sky-200 ring-1 ring-sky-400/50'
                      : 'bg-black/30 text-slate-400 hover:text-white'
                  }`}
                >
                  {idx + 1}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-slate-400/15 bg-white/[0.025] px-3 py-2.5">
            <Volume2 size={16} className="shrink-0 text-slate-300" />
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(masterGain * 100)}
              onChange={(e) => setMasterGain(Number(e.target.value) / 100)}
              style={{ touchAction: 'none' }}
              className="h-6 flex-1 cursor-pointer accent-sky-400"
              aria-label="Master Volume"
            />
            <span className="w-10 text-right text-xs font-semibold text-slate-200 [font-variant-numeric:tabular-nums]">
              {Math.round(masterGain * 100)}%
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-sky-400/25 bg-sky-400/10 px-2.5 py-1 text-[11px] font-medium text-sky-300">
              <Headphones size={12} />
              <span>8D</span>
            </span>
          </div>
        </div>
      </aside>
    </div>
  );
};
