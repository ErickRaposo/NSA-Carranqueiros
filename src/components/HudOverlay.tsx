import React, { useMemo, useState } from 'react';
import mineiroLogo from '../assets/mineiro-logo.png';
import {
  ChevronsUpDown,
  Globe,
  LogOut,
  Map as MapIcon,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Sun,
  Type,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  GraticuleIcon,
  PolygonBorderIcon,
  SharpenKernelIcon,
} from './CartographicIcons';
import { CountryEntry, searchCountries } from '../geo/countries';
import {
  BLEND_MODE_OPTIONS,
  BlendMode,
  DatasetId,
  LayerConfig,
  NASA_DATASETS,
  QUICK_PRESETS,
  QuickPreset,
} from '../datasets/nasaDatasets';

interface HudOverlayProps {
  viewMode: '3d' | '2d';
  onToggleViewMode: (mode: '3d' | '2d') => void;
  layers: LayerConfig[];
  onToggleLayer: (id: DatasetId) => void;
  onSoloLayer: (id: DatasetId) => void;
  onChangeLayerOpacity: (id: DatasetId, opacity: number) => void;
  onChangeLayerBlendMode: (id: DatasetId, mode: BlendMode) => void;
  onReorderLayer: (fromId: DatasetId, toId: DatasetId) => void;
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
  countries: CountryEntry[];
  selectedCountry: CountryEntry | null;
  onSelectAndFlyCountry: (country: CountryEntry) => void;
  onFlyPreset: (preset: QuickPreset) => void;
  onZoomStep: (delta: number) => void;
  onLogout: () => void;
  copilotWidget?: React.ReactNode;
  detailCard?: React.ReactNode;
  playerBar?: React.ReactNode;
}

export const HudOverlay: React.FC<HudOverlayProps> = ({
  viewMode,
  onToggleViewMode,
  layers,
  onToggleLayer,
  onSoloLayer,
  onChangeLayerOpacity,
  onChangeLayerBlendMode,
  onReorderLayer,
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
  countries,
  selectedCountry,
  onSelectAndFlyCountry,
  onFlyPreset,
  onZoomStep,
  onLogout,
  copilotWidget,
  detailCard,
  playerBar,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [draggedLayerId, setDraggedLayerId] = useState<DatasetId | null>(null);
  const [dragOverLayerId, setDragOverLayerId] = useState<DatasetId | null>(null);

  const searchResults = useMemo(
    () => searchCountries(searchQuery, countries, 8),
    [searchQuery, countries]
  );

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
          <img
            src={mineiroLogo}
            alt="Logo"
            className="h-7 w-auto object-contain"
          />
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

        {/* MAP CONTROLS & SESSION */}
        <div className="top-actions">
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

          <div className="session-controls" role="group" aria-label="Sessão do usuário">
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
                <span>Mixer NASA ({enabledLayers.length}/5)</span>
              </div>
              <div className="panel-header-actions">
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
                  Ative, arraste ou mescle camadas.
                </p>

            <div className="layer-stack-list">
              {displayLayers.map((cfg) => {
                const ds = NASA_DATASETS[cfg.id];
                const isDragging = draggedLayerId === cfg.id;
                const isDragOver = dragOverLayerId === cfg.id && draggedLayerId !== cfg.id;

                return (
                  <div
                    key={cfg.id}
                    draggable
                    onDragStart={(e) => {
                      setDraggedLayerId(cfg.id);
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', cfg.id);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      if (dragOverLayerId !== cfg.id) {
                        setDragOverLayerId(cfg.id);
                      }
                    }}
                    onDragLeave={() => {
                      if (dragOverLayerId === cfg.id) {
                        setDragOverLayerId(null);
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const fromId = (e.dataTransfer.getData('text/plain') as DatasetId) || draggedLayerId;
                      if (fromId && fromId !== cfg.id) {
                        onReorderLayer(fromId, cfg.id);
                      }
                      setDraggedLayerId(null);
                      setDragOverLayerId(null);
                    }}
                    onDragEnd={() => {
                      setDraggedLayerId(null);
                      setDragOverLayerId(null);
                    }}
                    className={`mixer-card ${cfg.enabled ? 'is-enabled' : ''} ${isDragging ? 'is-dragging' : ''} ${isDragOver ? 'is-drag-over' : ''}`}
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
                        <span
                          className="drag-handle"
                          title="Arraste para cima ou para baixo para reordenar"
                          aria-label={`Arrastar ${ds.shortName} para reordenar`}
                        >
                          <ChevronsUpDown size={14} aria-hidden="true" />
                        </span>
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

        <div className="hud-right-col">
          {detailCard}
          {copilotWidget}
        </div>
      </div>

      {/* DOCKED BOTTOM PLAYER CONSOLE */}
      <div className="bottom-console-dock">
        {playerBar}
      </div>
    </div>
  );
};
