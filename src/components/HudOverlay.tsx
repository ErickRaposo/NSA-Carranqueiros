import React, { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  AudioLines,
  Contrast,
  Globe,
  Layers3,
  LogOut,
  Map as MapIcon,
  Orbit,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Sun,
  Type,
  User,
  Volume2,
  VolumeX,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  MineiroOrbIcon,
  GraticuleIcon,
  IsothermIcon,
  LightningBoltIcon,
  No2MoleculeIcon,
  OrbitalReticleIcon,
  PolygonBorderIcon,
  SharpenKernelIcon,
  SpectralBandIcon,
  WindBarbIcon,
} from './CartographicIcons';
import { CountryEntry, searchCountries } from '../geo/countries';
import {
  BLEND_MODE_OPTIONS,
  BlendMode,
  DatasetId,
  LayerConfig,
  NASA_DATASETS,
  NasaDatasetMeta,
  QUICK_PRESETS,
  QuickPreset,
} from '../datasets/nasaDatasets';
import { formatLatLon } from '../geo/projection';
import { HoverInfo } from './EarthCanvas';
import { SampledReading } from '../accessibility/a11yEngine';

interface HudOverlayProps {
  viewMode: '3d' | '2d';
  onToggleViewMode: (mode: '3d' | '2d') => void;
  layers: LayerConfig[];
  onToggleLayer: (id: DatasetId) => void;
  onSoloLayer: (id: DatasetId) => void;
  onChangeLayerOpacity: (id: DatasetId, opacity: number) => void;
  onChangeLayerBlendMode: (id: DatasetId, mode: BlendMode) => void;
  onMoveLayer: (id: DatasetId, direction: -1 | 1) => void;
  onMixAllPreset: () => void;
  showBorders: boolean;
  onToggleBorders: () => void;
  showGrid: boolean;
  onToggleGrid: () => void;
  showLabels: boolean;
  onToggleLabels: () => void;
  hdEnhance: boolean;
  onToggleHdEnhance: () => void;
  selectionMode: 'country' | 'radius';
  onChangeSelectionMode: (mode: 'country' | 'radius') => void;
  showUnlockMap: boolean;
  onToggleUnlockMap: () => void;
  voiceEnabled: boolean;
  onToggleVoice: () => void;
  sonifyEnabled: boolean;
  onToggleSonify: () => void;
  highContrast: boolean;
  onToggleHighContrast: () => void;
  fontScale: number;
  onCycleFontScale: () => void;
  onSpeakNow: () => void;
  countries: CountryEntry[];
  selectedCountry: CountryEntry | null;
  onSelectAndFlyCountry: (country: CountryEntry) => void;
  onFlyPreset: (preset: QuickPreset) => void;
  onZoomStep: (delta: number) => void;
  hoverInfo: HoverInfo | null;
  hoverReadings: SampledReading[];
  cameraDistance: number;
  userName: string;
  copilotOpen: boolean;
  onToggleCopilot: () => void;
  onReopenTour: () => void;
  onLogout: () => void;
  copilotWidget?: React.ReactNode;
  detailCard?: React.ReactNode;
  playerBar?: React.ReactNode;
}

function DatasetIcon({ category }: { category: NasaDatasetMeta['accentCategory'] }) {
  switch (category) {
    case 'lightning':
      return <LightningBoltIcon size={15} className="accent-amber" />;
    case 'temperature':
      return <IsothermIcon size={15} className="accent-rose" />;
    case 'wind':
      return <WindBarbIcon size={15} className="accent-cyan" />;
    case 'co':
      return <SpectralBandIcon size={15} className="accent-orange" />;
    case 'nox':
      return <No2MoleculeIcon size={15} className="accent-emerald" />;
  }
}

export const HudOverlay: React.FC<HudOverlayProps> = ({
  viewMode,
  onToggleViewMode,
  layers,
  onToggleLayer,
  onSoloLayer,
  onChangeLayerOpacity,
  onChangeLayerBlendMode,
  onMoveLayer,
  onMixAllPreset,
  showBorders,
  onToggleBorders,
  showGrid,
  onToggleGrid,
  showLabels,
  onToggleLabels,
  hdEnhance,
  onToggleHdEnhance,
  selectionMode,
  onChangeSelectionMode,
  showUnlockMap,
  onToggleUnlockMap,
  voiceEnabled,
  onToggleVoice,
  sonifyEnabled,
  onToggleSonify,
  highContrast,
  onToggleHighContrast,
  fontScale,
  onCycleFontScale,
  onSpeakNow,
  countries,
  selectedCountry,
  onSelectAndFlyCountry,
  onFlyPreset,
  onZoomStep,
  hoverInfo,
  hoverReadings,
  cameraDistance,
  userName,
  copilotOpen,
  onToggleCopilot,
  onReopenTour,
  onLogout,
  copilotWidget,
  detailCard,
  playerBar,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [panelCollapsed, setPanelCollapsed] = useState(false);

  const searchResults = useMemo(
    () => searchCountries(searchQuery, countries, 8),
    [searchQuery, countries]
  );

  const approxAltKm = Math.max(400, Math.round((cameraDistance - 1) * 6371));
  const enabledLayers = layers.filter((l) => l.enabled);

  // Display top-most layer first in the stack UI while keeping shader bottom-to-top
  const displayLayers = [...layers].reverse();

  return (
    <div className="hud-chrome">
      <a href="#main-earth-region" className="skip-link">
        Pular para o mapa interativo
      </a>

      {/* TOP BAR */}
      <header className="top-hud console-frame" aria-label="Barra principal e acessibilidade">
        <div className="brand-block">
          <div className="brand-reticle" aria-hidden="true">
            <OrbitalReticleIcon size={18} />
          </div>
          <div>
            <h1 className="brand-title font-display">EARTHSONG</h1>
            <p className="brand-subtitle">SVS 5011–5154 / Console Cartográfico</p>
          </div>
        </div>

        {/* COUNTRY SEARCH */}
        <div className="search-wrapper">
          <div className="search-input-box">
            <Search size={15} className="search-icon" aria-hidden="true" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              placeholder="Buscar país (ex: Brasil, Japão)..."
              className="search-input"
              aria-label="Buscar país para destacar e abrir detalhes logísticos"
              aria-expanded={searchOpen && searchResults.length > 0}
              data-testid="country-search-input"
            />
            {searchQuery && (
              <button
                type="button"
                className="clear-search-btn"
                onClick={() => {
                  setSearchQuery('');
                  setSearchOpen(false);
                }}
                aria-label="Limpar busca de país"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {searchOpen && searchResults.length > 0 && (
            <ul
              className="search-dropdown console-frame"
              role="listbox"
              aria-label="Países encontrados"
              data-testid="country-search-results"
            >
              {searchResults.map((c) => (
                <li key={c.id} role="option" aria-selected={selectedCountry?.id === c.id}>
                  <button
                    type="button"
                    className="search-result-btn"
                    onClick={() => {
                      onSelectAndFlyCountry(c);
                      setSearchQuery(c.namePt);
                      setSearchOpen(false);
                    }}
                  >
                    <span>{c.namePt}</span>
                    <span className="muted-sm">{c.regionPt}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ACCESSIBILITY + MAP CONTROLS */}
        <div className="top-actions">
          <div className="a11y-toolbar" role="group" aria-label="Recursos de acessibilidade">
            <button
              type="button"
              className={`toggle-chip ${voiceEnabled ? 'active' : ''}`}
              onClick={onToggleVoice}
              aria-pressed={voiceEnabled}
              title="Ativar ou desativar narração automática por voz em PT-BR (Tecla V)"
              data-testid="a11y-voice-btn"
            >
              {voiceEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
              <span>Voz (V)</span>
            </button>

            <button
              type="button"
              className="toggle-chip"
              onClick={onSpeakNow}
              title="Ouvir posição e leituras atmosféricas atuais (Tecla R)"
              data-testid="a11y-read-now-btn"
            >
              <Volume2 size={14} />
              <span>Ler (R)</span>
            </button>

            <button
              type="button"
              className={`toggle-chip ${sonifyEnabled ? 'active' : ''}`}
              onClick={onToggleSonify}
              aria-pressed={sonifyEnabled}
              title="Sonificação: converter intensidade dos dados em tom sonoro (Tecla S)"
              data-testid="a11y-sonify-btn"
            >
              <AudioLines size={14} />
              <span>Som (S)</span>
            </button>

            <button
              type="button"
              className={`toggle-chip ${highContrast ? 'active' : ''}`}
              onClick={onToggleHighContrast}
              aria-pressed={highContrast}
              title="Modo Alto Contraste e Baixa Visão (Tecla C)"
              data-testid="a11y-contrast-btn"
            >
              <Contrast size={14} />
              <span>Contraste (C)</span>
            </button>

            <button
              type="button"
              className="toggle-chip"
              onClick={onCycleFontScale}
              title="Alternar tamanho do texto da interface"
              aria-label={`Tamanho da fonte atual ${Math.round(fontScale * 100)} por cento`}
              data-testid="a11y-font-btn"
            >
              <span>A+{Math.round(fontScale * 100)}%</span>
            </button>
          </div>

          <span className="toolbar-divider" aria-hidden="true" />

          <div className="segmented-control" role="group" aria-label="Modo de visualização">
            <button
              type="button"
              className={`seg-btn ${viewMode === '3d' ? 'active' : ''}`}
              onClick={() => onToggleViewMode('3d')}
              aria-pressed={viewMode === '3d'}
              data-testid="mode-3d-btn"
            >
              <Globe size={14} aria-hidden="true" />
              <span>3D</span>
            </button>
            <button
              type="button"
              className={`seg-btn ${viewMode === '2d' ? 'active' : ''}`}
              onClick={() => onToggleViewMode('2d')}
              aria-pressed={viewMode === '2d'}
              data-testid="mode-2d-btn"
            >
              <MapIcon size={14} aria-hidden="true" />
              <span>2D</span>
            </button>
          </div>

          <span className="toolbar-divider" aria-hidden="true" />

          <div className="map-layers-toolbar" role="group" aria-label="Camadas cartográficas e nitidez">
            <button
              type="button"
              className={`toggle-chip ${showBorders ? 'active' : ''}`}
              onClick={onToggleBorders}
              aria-pressed={showBorders}
              title="Mostrar ou ocultar fronteiras"
            >
              <PolygonBorderIcon size={14} />
              <span>Fronteiras</span>
            </button>

            <button
              type="button"
              className={`toggle-chip ${showLabels ? 'active' : ''}`}
              onClick={onToggleLabels}
              aria-pressed={showLabels}
              title="Mostrar ou ocultar nomes dos países"
            >
              <Type size={14} aria-hidden="true" />
              <span>Nomes</span>
            </button>

            <button
              type="button"
              className={`toggle-chip ${showGrid ? 'active' : ''}`}
              onClick={onToggleGrid}
              aria-pressed={showGrid}
              title="Mostrar ou ocultar grade Lat/Lon"
            >
              <GraticuleIcon size={14} />
              <span>Grade</span>
            </button>

            <button
              type="button"
              className={`toggle-chip ${hdEnhance ? 'active' : ''}`}
              onClick={onToggleHdEnhance}
              aria-pressed={hdEnhance}
              title="Filtro Bicúbico + Nitidez Adaptativa (CAS) na GPU para zoom mais nítido (Tecla H)"
              data-testid="hd-enhance-btn"
            >
              <SharpenKernelIcon size={14} />
              <span>HD GPU (H)</span>
            </button>

            <button
              type="button"
              className={`toggle-chip ${showUnlockMap ? 'active' : ''}`}
              onClick={onToggleUnlockMap}
              aria-pressed={showUnlockMap}
              title="Mostrar mapa de iluminação progressiva dos desbloqueios coletivos"
              data-testid="unlock-map-btn"
            >
              <Sun size={14} aria-hidden="true" />
              <span>Iluminação</span>
            </button>
          </div>

          <span className="toolbar-divider" aria-hidden="true" />

          <div className="segmented-control" role="group" aria-label="Modo de seleção da Jukebox">
            <button
              type="button"
              className={`seg-btn ${selectionMode === 'country' ? 'active' : ''}`}
              onClick={() => onChangeSelectionMode('country')}
              aria-pressed={selectionMode === 'country'}
              title="Clicar no mapa seleciona um país para a Jukebox 1:1"
              data-testid="target-country-btn"
            >
              <span>País</span>
            </button>
            <button
              type="button"
              className={`seg-btn ${selectionMode === 'radius' ? 'active' : ''}`}
              onClick={() => onChangeSelectionMode('radius')}
              aria-pressed={selectionMode === 'radius'}
              title="Clicar no mapa posiciona um raio geográfico customizado para a Jukebox 1:1"
              data-testid="target-radius-btn"
            >
              <span>Raio</span>
            </button>
          </div>

          <span className="toolbar-divider" aria-hidden="true" />

          <div className="session-controls" role="group" aria-label="Guia MINEIRØ e sessão do usuário">
            <button
              type="button"
              className={`toggle-chip ${copilotOpen ? 'active' : ''}`}
              onClick={onToggleCopilot}
              aria-pressed={copilotOpen}
              title="Mostrar ou ocultar o Guia 3D MINEIRØ"
              data-testid="toggle-copilot-btn"
            >
              <MineiroOrbIcon size={14} />
              <span>MINEIRØ</span>
            </button>

            <button
              type="button"
              className="toggle-chip"
              onClick={onReopenTour}
              title="Reabrir introdução guiada pelo MINEIRØ"
              data-testid="reopen-tour-btn"
            >
              <Orbit size={14} aria-hidden="true" />
              <span>Tour</span>
            </button>

            <span className="user-pill" title={`Sessão ativa: ${userName}`} data-testid="logged-user-pill">
              <User size={13} aria-hidden="true" />
              <span>{userName}</span>
            </span>

            <button
              type="button"
              className="toggle-chip logout-chip"
              onClick={onLogout}
              title="Encerrar sessão e voltar ao Login"
              data-testid="logout-btn"
            >
              <LogOut size={14} aria-hidden="true" />
              <span>Sair</span>
            </button>
          </div>
        </div>
      </header>

      <div className="hud-middle">
        <div className="hud-left-col">
          {/* LEFT MULTI-VIDEO COMPOSITOR PANEL */}
          <aside
            className={`side-panel console-frame ${panelCollapsed ? 'is-collapsed' : ''}`}
            aria-label="Mixer de camadas de vídeo da NASA e modos de mesclagem"
          >
            <div className="panel-header">
              <div className="panel-title-row">
                <Layers3 size={15} aria-hidden="true" />
                <span>Mixer NASA ({enabledLayers.length}/5)</span>
              </div>
              <div className="panel-header-actions">
                {!panelCollapsed && (
                  <button
                    type="button"
                    className="mini-action-btn"
                    onClick={onMixAllPreset}
                    title="Ativar todas as 5 camadas simultaneamente com mesclagem"
                    data-testid="mix-all-btn"
                  >
                    <Layers3 size={12} aria-hidden="true" />
                    <span>Misturar 5</span>
                  </button>
                )}
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => setPanelCollapsed((v) => !v)}
                  title={panelCollapsed ? 'Expandir mixer de camadas' : 'Recolher mixer de camadas'}
                  aria-label={panelCollapsed ? 'Expandir mixer de camadas' : 'Recolher mixer de camadas'}
                  aria-expanded={!panelCollapsed}
                >
                  {panelCollapsed ? <PanelLeftOpen size={14} aria-hidden="true" /> : <PanelLeftClose size={14} aria-hidden="true" />}
                </button>
              </div>
            </div>

            {!panelCollapsed && (
              <div className="panel-body">
                <nav className="presets-ledger" aria-label="Atalhos rápidos de região">
                  {QUICK_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      className="preset-ledger-btn"
                      onClick={() => onFlyPreset(preset)}
                    >
                      {preset.label}
                    </button>
                  ))}
                </nav>

                <p className="mixer-hint">
                  Combine camadas simultâneas, reordene a pilha e selecione o método de mesclagem.
                </p>

            <div className="layer-stack-list">
              {displayLayers.map((cfg, displayIdx) => {
                const ds = NASA_DATASETS[cfg.id];
                const isTop = displayIdx === 0;
                const isBottom = displayIdx === displayLayers.length - 1;

                return (
                  <div
                    key={cfg.id}
                    className={`mixer-card ${cfg.enabled ? 'is-enabled' : ''}`}
                    data-testid={`mixer-card-${cfg.id}`}
                  >
                    <div className="mixer-card-top">
                      <label className="mixer-toggle-label">
                        <input
                          type="checkbox"
                          checked={cfg.enabled}
                          onChange={() => onToggleLayer(cfg.id)}
                          aria-label={`Ativar camada ${ds.shortName} (${ds.svsId})`}
                          data-testid={`toggle-${cfg.id}`}
                        />
                        <DatasetIcon category={ds.accentCategory} />
                        <span className="mixer-title">
                          {ds.shortName} <small className="muted-tag">{ds.svsId}</small>
                        </span>
                      </label>

                      <div className="mixer-reorder-btns">
                        <button
                          type="button"
                          className="tiny-btn"
                          onClick={() => onSoloLayer(cfg.id)}
                          title="Exibir apenas esta camada (Solo)"
                          data-testid={`solo-${cfg.id}`}
                        >
                          Solo
                        </button>
                        <button
                          type="button"
                          className="tiny-icon-btn"
                          disabled={isTop}
                          onClick={() => onMoveLayer(cfg.id, 1)}
                          aria-label={`Mover ${ds.shortName} para cima`}
                          title="Mover para cima na pilha"
                        >
                          <ArrowUp size={12} />
                        </button>
                        <button
                          type="button"
                          className="tiny-icon-btn"
                          disabled={isBottom}
                          onClick={() => onMoveLayer(cfg.id, -1)}
                          aria-label={`Mover ${ds.shortName} para baixo`}
                          title="Mover para baixo na pilha"
                        >
                          <ArrowDown size={12} />
                        </button>
                      </div>
                    </div>

                    {cfg.enabled && (
                      <div className="mixer-controls">
                        <div className="mixer-control-row">
                          <label className="blend-inline-label">
                            <span>Mesclagem:</span>
                            <select
                              value={cfg.blendMode}
                              onChange={(e) =>
                                onChangeLayerBlendMode(cfg.id, e.target.value as BlendMode)
                              }
                              className="blend-select-sm"
                              aria-label={`Método de mesclagem para ${ds.shortName}`}
                              data-testid={`blend-mode-${cfg.id}`}
                            >
                              {BLEND_MODE_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.labelPt}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>

                        <div className="mixer-opacity-row">
                          <span>Opacidade</span>
                          <span>{Math.round(cfg.opacity * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.02}
                          value={cfg.opacity}
                          onChange={(e) => onChangeLayerOpacity(cfg.id, Number(e.target.value))}
                          className="blend-slider"
                          aria-label={`Opacidade de ${ds.shortName}`}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {enabledLayers
              .filter((l) => NASA_DATASETS[l.id].colorbarUrl)
              .slice(-2)
              .map((l) => {
                const ds = NASA_DATASETS[l.id];
                return (
                  <div key={l.id} className="colorbar-box">
                    <div className="colorbar-title">Escala {ds.svsId}</div>
                    <img
                      src={ds.colorbarUrl}
                      alt={ds.colorbarCaption}
                      className="colorbar-img"
                    />
                  </div>
                );
              })}
          </div>
        )}
      </aside>
        </div>

        <div className="hud-center-col">
          {copilotWidget}

          {/* RIGHT ZOOM STEPPER */}
          <div className="right-zoom-stack console-frame" role="group" aria-label="Controles de zoom do mapa">
            <button
              type="button"
              className="zoom-btn"
              onClick={() => onZoomStep(-0.28)}
              title="Aproximar zoom (Tecla +)"
              aria-label="Aproximar zoom"
            >
              <ZoomIn size={17} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="zoom-btn"
              onClick={() => onZoomStep(0.28)}
              title="Afastar zoom (Tecla -)"
              aria-label="Afastar zoom"
            >
              <ZoomOut size={17} aria-hidden="true" />
            </button>
          </div>
        </div>

        {detailCard}
      </div>

      {/* DOCKED BOTTOM TELEMETRY + PLAYER CONSOLE */}
      <div className="bottom-console-dock">
        <div className="telemetry-strip console-frame" data-testid="telemetry-bar">
          <span className="telemetry-cell">
            <strong>ALT</strong> {approxAltKm.toLocaleString('pt-BR')} km
          </span>
          <span className="sep" aria-hidden="true">|</span>
          <span className="telemetry-cell">
            <strong>COORD</strong>{' '}
            {hoverInfo ? formatLatLon(hoverInfo.lat, hoverInfo.lon) : 'Passe o cursor ou use setas'}
          </span>
          {hoverInfo?.country && (
            <>
              <span className="sep" aria-hidden="true">|</span>
              <span className="country-tag">{hoverInfo.country.namePt}</span>
            </>
          )}
          {hoverReadings[0] && (
            <>
              <span className="sep" aria-hidden="true">|</span>
              <span className="reading-inline">
                {hoverReadings[0].svsId}: {hoverReadings[0].labelPt}
              </span>
            </>
          )}
        </div>

        {playerBar}
      </div>
    </div>
  );
};
