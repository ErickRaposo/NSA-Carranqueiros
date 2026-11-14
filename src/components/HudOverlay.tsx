import React, { useEffect, useMemo, useRef, useState } from 'react';
import mineiroLogo from '../assets/mineiro-logo.png';
import {
  ArrowDown,
  ArrowUp,
  Award,
  Compass,
  Eye,
  EyeOff,
  Flag,
  Globe,
  HelpCircle,
  Layers,
  LogIn,
  LogOut,
  Map as MapIcon,
  PanelLeftClose,
  Search,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Type,
  Volume2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  GraticuleIcon,
  PolygonBorderIcon,
  SharpenKernelIcon,
  StemLayerIcon,
} from './CartographicIcons';
import { CountryEntry, searchCountries } from '../geo/countries';
import { formatLatLon } from '../geo/projection';
import {
  BLEND_MODE_OPTIONS,
  BlendMode,
  DatasetId,
  LayerConfig,
  NASA_DATASETS,
  QUICK_PRESETS,
  QuickPreset,
} from '../datasets/nasaDatasets';
import {
  buildCountryRegionKey,
  DATASET_TO_STEM,
  GlobalEcosystemSummary,
  STEM_METAS,
  STEM_ORDER,
} from '../community/unlockStore';
import {
  DiscoveryEvent,
  getAchievementBadges,
  getExplorerRank,
  getMissionProgressList,
  MissionId,
  PROGRESSION_SYNC_NOTICE_PT,
  ProgressionState,
} from '../game/progressionStore';
import { playStemPreviewSample, SampledReading } from '../accessibility/a11yEngine';
import type { HoverInfo } from './EarthCanvas';

export type LaunchpadAreaId = 'explorar' | 'frequencias' | 'missoes' | 'colecao';

const FREQUENCY_DISCOVERY_META: Record<
  DatasetId,
  {
    headline: string;
    phenomenonPt: string;
    instrumentTag: string;
    storyPt: string;
  }
> = {
  svs5011: {
    headline: 'Melodia — Clarões Orbitais',
    phenomenonPt: 'Raios vistos da ISS',
    instrumentTag: 'Sinos & Piano Pentatônico',
    storyPt: 'Cada relâmpago real observado do espaço dispara notas cristalinas na sinfonia.',
  },
  svs5153: {
    headline: 'Harmonia — Respiração Atmosférica',
    phenomenonPt: 'Plumas de Monóxido de Carbono',
    instrumentTag: 'Acordes & Pads Quentes',
    storyPt: 'Nuvens atmosféricas de CO desenham a progressão harmônica de fundo da região.',
  },
  svs5147: {
    headline: 'Ritmo — Pulso Térmico',
    phenomenonPt: 'Temperatura da Superfície',
    instrumentTag: 'Percussão & BPM Vivo',
    storyPt: 'O calor dos continentes acelera ou acalma o batimento cardíaco musical (BPM).',
  },
  svs5154: {
    headline: 'Baixo — Energia Urbana',
    phenomenonPt: 'Dióxido de Nitrogênio (NO₂)',
    instrumentTag: 'Baixo Sub-Harmônico',
    storyPt: 'Grandes centros urbanos e corredores industriais sustentam o peso dos graves.',
  },
  svs5148: {
    headline: 'Efeitos — Correntes do Planeta',
    phenomenonPt: 'Ventos de Superfície a 10m',
    instrumentTag: 'Brisa Espacial & Eco',
    storyPt: 'Massas de ar sobre oceanos e cordilheiras envolvem a música em textura viva.',
  },
};

const MISSION_TARGET_HINTS: Record<MissionId, string[]> = {
  cacador_de_raios: ['Brazil', 'Democratic Republic of the Congo', 'India', 'Indonesia'],
  mestre_dos_ventos: ['United Kingdom', 'Chile', 'Argentina', 'Australia'],
  pulso_termico: ['Australia', 'Egypt', 'Mexico', 'Saudi Arabia'],
  ecos_invisiveis: ['United States of America', 'Japan', 'Germany', 'China'],
  guardiao_planetario: ['Brazil', 'United States of America', 'Japan', 'South Africa'],
};

interface HudOverlayProps {
  viewMode: '3d' | '2d';
  onToggleViewMode: (mode: '3d' | '2d') => void;
  layers: LayerConfig[];
  onToggleLayer: (id: DatasetId) => void;
  onSoloLayer: (id: DatasetId) => void;
  onMixAllLayers?: () => void;
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
  onReopenTour?: () => void;
  hoverInfo?: HoverInfo | null;
  hoverReadings?: SampledReading[];
  approxAltKm?: number;
  onLogout: () => void;
  isGuestSession?: boolean;
  onOpenAuth?: () => void;
  ecosystemSummary?: GlobalEcosystemSummary;
  explorerXp?: number;
  progression?: ProgressionState;
  activeRegionLabel?: string | null;
  activeRegionUnlockCount?: number;
  discoveryToast?: DiscoveryEvent | null;
  onDismissDiscovery?: () => void;
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
  onMixAllLayers,
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
  onReopenTour,
  hoverInfo = null,
  hoverReadings = [],
  approxAltKm = 12600,
  onLogout,
  isGuestSession = false,
  onOpenAuth,
  ecosystemSummary,
  explorerXp: _explorerXp,
  progression,
  activeRegionLabel: _activeRegionLabel,
  activeRegionUnlockCount: _activeRegionUnlockCount = 0,
  discoveryToast,
  onDismissDiscovery,
  copilotWidget,
  detailCard,
  playerBar,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeArea, setActiveArea] = useState<LaunchpadAreaId | null>(null);
  const [visualMenuOpen, setVisualMenuOpen] = useState(false);
  const [samplingLayerId, setSamplingLayerId] = useState<DatasetId | null>(null);
  const [draggedLayerId, setDraggedLayerId] = useState<DatasetId | null>(null);
  const [dragOverLayerId, setDragOverLayerId] = useState<DatasetId | null>(null);
  const [zenMode, setZenMode] = useState(false);

  const visualMenuRef = useRef<HTMLDivElement | null>(null);
  const launchpadRefs = useRef<Partial<Record<LaunchpadAreaId, HTMLButtonElement | null>>>({});

  // Keyboard shortcut: Z toggles Modo Zen (Esc exits Zen)
  useEffect(() => {
    const onZenKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (e.key.toLowerCase() === 'z') {
        e.preventDefault();
        setZenMode((prev) => !prev);
      } else if (e.key === 'Escape' && zenMode) {
        setZenMode(false);
      }
    };
    window.addEventListener('keydown', onZenKey);
    return () => window.removeEventListener('keydown', onZenKey);
  }, [zenMode]);

  useEffect(() => {
    if (!visualMenuOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (visualMenuRef.current && !visualMenuRef.current.contains(e.target as Node)) {
        setVisualMenuOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setVisualMenuOpen(false);
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [visualMenuOpen]);

  // Close Launchpad drawer on Escape and return focus to its trigger button
  useEffect(() => {
    if (!activeArea) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const prev = activeArea;
        setActiveArea(null);
        requestAnimationFrame(() => launchpadRefs.current[prev]?.focus());
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeArea]);

  const searchResults = useMemo(
    () => searchCountries(searchQuery, countries, 8),
    [searchQuery, countries]
  );

  const enabledLayers = layers.filter((l) => l.enabled);
  const displayLayers = [...layers].reverse();

  const missions = useMemo(
    () => (progression ? getMissionProgressList(progression) : []),
    [progression]
  );
  const completedMissionsCount = missions.filter((m) => m.completed).length;
  const badges = useMemo(
    () => (progression ? getAchievementBadges(progression) : []),
    [progression]
  );
  const unlockedBadgesCount = badges.filter((b) => b.unlocked).length;
  const explorerRank = useMemo(
    () => (progression ? getExplorerRank(progression.xp) : null),
    [progression]
  );

  const nextUnexploredCountry = useMemo(() => {
    const exploredSet = new Set(progression?.exploredRegionKeys ?? []);
    return (
      countries.find((c) => !exploredSet.has(buildCountryRegionKey(c))) ??
      countries[0] ??
      null
    );
  }, [countries, progression]);

  // Count how many community regions unlocked each stem
  const stemCommunityCounts = useMemo(() => {
    const counts: Record<string, number> = {
      melody: 0,
      harmony: 0,
      rhythm: 0,
      bass: 0,
      fx: 0,
    };
    if (!ecosystemSummary) return counts;
    for (const reg of ecosystemSummary.regions) {
      for (const s of STEM_ORDER) {
        if (reg.unlockedStems[s]) counts[s] += 1;
      }
    }
    return counts;
  }, [ecosystemSummary]);

  const pickMissionTargetCountry = (missionId: MissionId): CountryEntry | null => {
    if (missionId === 'guardiao_planetario' && ecosystemSummary?.spotlightRegion?.country) {
      return ecosystemSummary.spotlightRegion.country;
    }
    const matchedSet = new Set(progression?.missionMatches[missionId] ?? []);
    const candidates = MISSION_TARGET_HINTS[missionId] ?? [];
    for (const nameEn of candidates) {
      const found = countries.find((c) => c.nameEn === nameEn);
      if (found && !matchedSet.has(buildCountryRegionKey(found))) {
        return found;
      }
    }
    return (
      countries.find((c) => !matchedSet.has(buildCountryRegionKey(c))) ??
      countries[0] ??
      null
    );
  };

  const handlePlayFrequencySample = (datasetId: DatasetId, isCurrentlyEnabled: boolean) => {
    const stemId = DATASET_TO_STEM[datasetId];
    if (!isCurrentlyEnabled) {
      onToggleLayer(datasetId);
    }
    setSamplingLayerId(datasetId);
    playStemPreviewSample(stemId);
    window.setTimeout(() => {
      setSamplingLayerId((curr) => (curr === datasetId ? null : curr));
    }, 850);
  };

  // Unified 4-area Explorer Launchpad (no duplication with Planeta Vivo on the right)
  const launchpadAreas: {
    id: LaunchpadAreaId;
    label: string;
    shortLabel: string;
    description: string;
    badge: string;
    unavailable?: boolean;
    icon: React.ReactNode;
    testId?: string;
  }[] = [
    {
      id: 'explorar',
      label: 'Explorar',
      shortLabel: 'Explorar',
      description: 'Globo, voos rápidos, modo raio e regiões para descobrir',
      badge: selectionMode === 'country' ? 'País' : 'Raio',
      icon: <Compass size={16} aria-hidden="true" />,
      testId: 'launchpad-area-explorar',
    },
    {
      id: 'frequencias',
      label: 'Frequências',
      shortLabel: 'Freq.',
      description: 'Descubra os 5 fenômenos NASA e ouça cada instrumento',
      badge: `${enabledLayers.length}/5`,
      icon: <SlidersHorizontal size={16} aria-hidden="true" />,
      testId: 'expand-layers-btn',
    },
    {
      id: 'missoes',
      label: 'Missões',
      shortLabel: 'Missões',
      description: 'Desafios atmosféricos acionáveis pelo planeta',
      badge: `${completedMissionsCount}/${missions.length || 5}`,
      unavailable: !progression,
      icon: <Flag size={16} aria-hidden="true" />,
      testId: 'launchpad-area-missoes',
    },
    {
      id: 'colecao',
      label: 'Coleção',
      shortLabel: 'Coleção',
      description: 'Seu nível, descobertas, conquistas e histórico coletivo',
      badge: `${unlockedBadgesCount}/${badges.length || 5}`,
      unavailable: !progression,
      icon: <Award size={16} aria-hidden="true" />,
      testId: 'launchpad-area-colecao',
    },
  ];

  const handleLaunchpadKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    idx: number
  ) => {
    const order = launchpadAreas.map((a) => a.id);
    let nextIdx: number | null = null;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') nextIdx = (idx + 1) % order.length;
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft')
      nextIdx = (idx - 1 + order.length) % order.length;
    else if (e.key === 'Home') nextIdx = 0;
    else if (e.key === 'End') nextIdx = order.length - 1;
    if (nextIdx !== null) {
      e.preventDefault();
      launchpadRefs.current[order[nextIdx]]?.focus();
    }
  };

  const dominantHoverReading = useMemo(() => {
    if (!hoverReadings || hoverReadings.length === 0) return null;
    return [...hoverReadings].sort((a, b) => b.intensity01 - a.intensity01)[0] ?? null;
  }, [hoverReadings]);

  return (
    <div className={`hud-chrome ${zenMode ? 'is-zen' : ''}`}>
      <a href="#main-earth-region" className="skip-link">
        Pular para o mapa interativo
      </a>

      {zenMode && (
        <button
          type="button"
          className="zen-exit-pill console-frame"
          onClick={() => setZenMode(false)}
          title="Voltar a exibir os controles da interface (Tecla Z ou Esc)"
          data-testid="zen-exit-btn"
        >
          <Eye size={14} aria-hidden="true" />
          <span>Mostrar HUD (Z)</span>
        </button>
      )}

      {/* TOP BAR */}
      <header className="top-hud console-frame" aria-label="Barra principal e navegação">
        <div className="brand-block">
          <img src={mineiroLogo} alt="MINEIRØ" className="h-7 w-auto object-contain" />
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
              placeholder="Buscar país ou região..."
              className="search-input"
              aria-label="Buscar país para explorar e acender camadas"
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

        {/* COMPACT CONTROLS */}
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

          <div className="segmented-control" role="group" aria-label="Modo de seleção da Jukebox">
            <button
              type="button"
              className={`seg-btn ${selectionMode === 'country' ? 'active' : ''}`}
              onClick={() => onChangeSelectionMode('country')}
              aria-pressed={selectionMode === 'country'}
              title="Clicar no mapa escolhe um país para tocar e acender"
              data-testid="target-country-btn"
            >
              <span>País</span>
            </button>
            <button
              type="button"
              className={`seg-btn ${selectionMode === 'radius' ? 'active' : ''}`}
              onClick={() => onChangeSelectionMode('radius')}
              aria-pressed={selectionMode === 'radius'}
              title="Clicar no mapa posiciona um raio geográfico livre"
              data-testid="target-radius-btn"
            >
              <span>Raio</span>
            </button>
          </div>

          <button
            type="button"
            className={`toggle-chip illumination-pill ${showUnlockMap ? 'active' : ''}`}
            onClick={onToggleUnlockMap}
            aria-pressed={showUnlockMap}
            title="Exibir faróis coletivos e regiões iluminadas no globo"
            data-testid="unlock-map-btn"
          >
            <Sun size={14} aria-hidden="true" />
            <span>Iluminação</span>
          </button>

          <div className="map-visual-popover-wrap" ref={visualMenuRef}>
            <button
              type="button"
              className={`toggle-chip ${visualMenuOpen ? 'active' : ''}`}
              onClick={() => setVisualMenuOpen((v) => !v)}
              aria-expanded={visualMenuOpen}
              aria-haspopup="true"
              title="Ajustes cartográficos do globo (Fronteiras, Nomes, Grade, HD)"
              data-testid="visual-map-menu-btn"
            >
              <Layers size={14} aria-hidden="true" />
              <span>Mapa</span>
            </button>

            {visualMenuOpen && (
              <div
                className="map-visual-popover console-frame"
                role="group"
                aria-label="Opções visuais do mapa"
              >
                <button
                  type="button"
                  className={`popover-toggle-item ${showBorders ? 'is-on' : ''}`}
                  onClick={onToggleBorders}
                  aria-pressed={showBorders}
                >
                  <PolygonBorderIcon size={14} />
                  <span>Fronteiras</span>
                </button>
                <button
                  type="button"
                  className={`popover-toggle-item ${showLabels ? 'is-on' : ''}`}
                  onClick={onToggleLabels}
                  aria-pressed={showLabels}
                >
                  <Type size={14} aria-hidden="true" />
                  <span>Nomes</span>
                </button>
                <button
                  type="button"
                  className={`popover-toggle-item ${showGrid ? 'is-on' : ''}`}
                  onClick={onToggleGrid}
                  aria-pressed={showGrid}
                >
                  <GraticuleIcon size={14} />
                  <span>Grade Lat/Lon</span>
                </button>
                <button
                  type="button"
                  className={`popover-toggle-item ${hdEnhance ? 'is-on' : ''}`}
                  onClick={onToggleHdEnhance}
                  aria-pressed={hdEnhance}
                  data-testid="hd-enhance-btn"
                >
                  <SharpenKernelIcon size={14} />
                  <span>Nitidez HD (H)</span>
                </button>
              </div>
            )}
          </div>

          {onReopenTour && (
            <button
              type="button"
              className="toggle-chip"
              onClick={onReopenTour}
              title="Reabrir guia rápido de como explorar e despertar a sinfonia"
              data-testid="reopen-tour-btn"
            >
              <HelpCircle size={14} aria-hidden="true" />
              <span>Guia</span>
            </button>
          )}

          <button
            type="button"
            className={`toggle-chip ${zenMode ? 'active' : ''}`}
            onClick={() => setZenMode((v) => !v)}
            aria-pressed={zenMode}
            title="Modo Zen: ocultar painéis e contemplar a Terra viva (Tecla Z)"
            data-testid="zen-mode-btn"
          >
            <EyeOff size={14} aria-hidden="true" />
            <span>Zen</span>
          </button>

          {isGuestSession && onOpenAuth ? (
            <button
              type="button"
              className="toggle-chip account-entry-chip"
              onClick={onOpenAuth}
              title="Entrar com sua conta para salvar histórico coletivo"
              data-testid="topbar-login-btn"
            >
              <LogIn size={14} aria-hidden="true" />
              <span>Entrar</span>
            </button>
          ) : (
            <button
              type="button"
              className="toggle-chip logout-chip"
              onClick={onLogout}
              title="Sair da conta e voltar ao Portal"
              data-testid="logout-btn"
            >
              <LogOut size={14} aria-hidden="true" />
              <span>Sair</span>
            </button>
          )}
        </div>
      </header>

      <div className="hud-middle">
        <div className="hud-left-col launchpad-shell">
          {/* COMPACT 4-AREA EXPLORER LAUNCHPAD RAIL */}
          <nav
            className="launchpad-floating-dock console-frame"
            aria-label="Launchpad de exploração do planeta"
            data-testid="layers-floating-dock"
          >
            <div className="launchpad-areas-group" role="tablist" aria-label="Áreas de exploração">
              {launchpadAreas.map((area, idx) => {
                const isSelected = activeArea === area.id;
                return (
                  <button
                    key={area.id}
                    ref={(el) => {
                      launchpadRefs.current[area.id] = el;
                    }}
                    type="button"
                    role="tab"
                    id={`launchpad-tab-${area.id}`}
                    aria-selected={isSelected}
                    aria-expanded={isSelected}
                    aria-controls={`launchpad-drawer-${area.id}`}
                    aria-disabled={area.unavailable ? true : undefined}
                    onKeyDown={(e) => handleLaunchpadKeyDown(e, idx)}
                    className={`dock-area-btn ${isSelected ? 'is-active' : ''} ${
                      area.unavailable ? 'is-unavailable' : ''
                    }`}
                    onClick={() => {
                      if (area.unavailable) return;
                      setActiveArea((prev) => (prev === area.id ? null : area.id));
                    }}
                    title={`${area.label} — ${area.description}`}
                    aria-label={`${area.label} (${area.badge}): ${area.description}`}
                    data-testid={area.testId}
                  >
                    <span className="dock-area-icon">{area.icon}</span>
                    <span className="dock-btn-label">{area.shortLabel}</span>
                    {area.id === 'frequencias' ? (
                      <span className="dock-mini-pips" aria-hidden="true">
                        {displayLayers.map((l) => (
                          <span
                            key={l.id}
                            className="dock-mini-pip"
                            style={{
                              background: l.enabled
                                ? STEM_METAS[DATASET_TO_STEM[l.id]].accentHex
                                : 'rgba(148, 163, 184, 0.28)',
                            }}
                          />
                        ))}
                      </span>
                    ) : (
                      <span className="dock-area-badge" aria-hidden="true">
                        {area.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </nav>

          {/* CONTEXTUAL LAUNCHPAD DRAWER */}
          {activeArea && (
            <aside
              id={`launchpad-drawer-${activeArea}`}
              role="tabpanel"
              aria-labelledby={`launchpad-tab-${activeArea}`}
              className="side-panel launchpad-panel console-frame is-drawer-open"
              aria-label={`Painel ${launchpadAreas.find((a) => a.id === activeArea)?.label}`}
            >
              <div className="panel-header">
                <div className="panel-title-row">
                  <span>{launchpadAreas.find((a) => a.id === activeArea)?.label}</span>
                  {activeArea === 'frequencias' && (
                    <div
                      className="launchpad-pips"
                      aria-label={`${enabledLayers.length} de 5 camadas ativas`}
                    >
                      {displayLayers.map((l) => {
                        const stem = STEM_METAS[DATASET_TO_STEM[l.id]];
                        return (
                          <span
                            key={l.id}
                            className={`launchpad-pip ${l.enabled ? 'is-lit' : ''}`}
                            style={{
                              background: l.enabled
                                ? stem.accentHex
                                : 'rgba(148, 163, 184, 0.25)',
                            }}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="panel-header-actions">
                  {activeArea === 'frequencias' && onMixAllLayers && (
                    <button
                      type="button"
                      className="mini-action-btn launchpad-mix-btn"
                      onClick={onMixAllLayers}
                      title="Acender ou restaurar a mistura das 5 cores no globo"
                      data-testid="mix-all-layers-btn"
                    >
                      <Sparkles size={12} aria-hidden="true" />
                      <span>5 Cores</span>
                    </button>
                  )}
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => {
                      const prev = activeArea;
                      setActiveArea(null);
                      requestAnimationFrame(() => launchpadRefs.current[prev]?.focus());
                    }}
                    title="Recolher painel do Launchpad (Esc)"
                    aria-label="Recolher painel do Launchpad"
                    data-testid="collapse-layers-btn"
                  >
                    <PanelLeftClose size={14} aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div className="panel-body">
                {activeArea === 'explorar' && (
                  <div className="launchpad-section-stack" data-testid="launchpad-panel-explorar">
                    <p className="launchpad-section-lead">
                      Gire o planeta vivo, passe o cursor para sentir os fenômenos em tempo real ou voe para regiões prontas para despertar.
                    </p>

                    <div className="launchpad-subsection">
                      <span className="launchpad-subhead">Modo de captura no mapa</span>
                      <div className="launchpad-mode-grid">
                        <button
                          type="button"
                          className={`preset-ledger-btn ${selectionMode === 'country' ? 'is-active' : ''}`}
                          onClick={() => onChangeSelectionMode('country')}
                          aria-pressed={selectionMode === 'country'}
                        >
                          País / Fronteira
                        </button>
                        <button
                          type="button"
                          className={`preset-ledger-btn ${selectionMode === 'radius' ? 'is-active' : ''}`}
                          onClick={() => onChangeSelectionMode('radius')}
                          aria-pressed={selectionMode === 'radius'}
                        >
                          Raio Livre no Mapa
                        </button>
                      </div>
                    </div>

                    <div className="launchpad-subsection">
                      <span className="launchpad-subhead">Voos rápidos pelo globo</span>
                      <nav className="presets-ledger" aria-label="Viajar pelo planeta">
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
                    </div>

                    {nextUnexploredCountry && (
                      <div className="launchpad-spotlight-card">
                        <span className="launchpad-subhead">Sugestão de próxima descoberta</span>
                        <strong className="launchpad-spotlight-title">
                          {nextUnexploredCountry.namePt}
                        </strong>
                        <span className="launchpad-sub">
                          {nextUnexploredCountry.regionPt} · Região ainda inexplorada por você
                        </span>
                        <button
                          type="button"
                          className="primary-glow-btn launchpad-cta-sm"
                          onClick={() => {
                            onSelectAndFlyCountry(nextUnexploredCountry);
                            setActiveArea(null);
                          }}
                        >
                          <Compass size={14} aria-hidden="true" />
                          <span>Voar para {nextUnexploredCountry.namePt}</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {activeArea === 'frequencias' && (
                  <div className="launchpad-section-stack" data-testid="launchpad-panel-frequencias">
                    <p className="launchpad-section-lead">
                      Cada cor no globo é um fenômeno real da NASA transformado em instrumento musical. Ative ou ouça uma amostra:
                    </p>

                    <div className="layer-stack-list" role="list" aria-label="Descobertas de frequências planetárias">
                      {displayLayers.map((cfg, displayIdx) => {
                        const ds = NASA_DATASETS[cfg.id];
                        const stemMeta = STEM_METAS[DATASET_TO_STEM[cfg.id]];
                        const meta = FREQUENCY_DISCOVERY_META[cfg.id];
                        const isDragging = draggedLayerId === cfg.id;
                        const isDragOver = dragOverLayerId === cfg.id && draggedLayerId !== cfg.id;
                        const isSampling = samplingLayerId === cfg.id;
                        const prevDisplayLayer = displayLayers[displayIdx - 1];
                        const nextDisplayLayer = displayLayers[displayIdx + 1];
                        const litRegionsCount = stemCommunityCounts[stemMeta.id] ?? 0;

                        return (
                          <div
                            key={cfg.id}
                            role="listitem"
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
                              const fromId =
                                (e.dataTransfer.getData('text/plain') as DatasetId) || draggedLayerId;
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
                            className={`launchpad-pad discovery-freq-card ${cfg.enabled ? 'is-enabled' : ''} ${
                              isDragging ? 'is-dragging' : ''
                            } ${isDragOver ? 'is-drag-over' : ''}`}
                            style={{ '--pad-accent': stemMeta.accentHex } as React.CSSProperties}
                            data-testid={`mixer-card-${cfg.id}`}
                          >
                            <div className="launchpad-pad-top">
                              <label className="launchpad-toggle-label">
                                <input
                                  type="checkbox"
                                  checked={cfg.enabled}
                                  onChange={() => onToggleLayer(cfg.id)}
                                  aria-label={`Exibir no globo: ${meta.headline}`}
                                  data-testid={`toggle-${cfg.id}`}
                                  className="launchpad-checkbox"
                                />
                                <span
                                  className="launchpad-icon-box"
                                  style={{
                                    color: cfg.enabled ? 'var(--bg-void)' : stemMeta.accentHex,
                                    background: cfg.enabled
                                      ? stemMeta.accentHex
                                      : 'rgba(255,255,255,0.06)',
                                  }}
                                  aria-hidden="true"
                                >
                                  <StemLayerIcon stem={stemMeta.id} size={15} />
                                </span>

                                <div className="launchpad-titles">
                                  <span className="launchpad-title">{meta.headline}</span>
                                  <span className="launchpad-sub">
                                    {meta.phenomenonPt} · {meta.instrumentTag}
                                  </span>
                                </div>
                              </label>

                              <button
                                type="button"
                                className={`tiny-btn freq-sample-btn ${isSampling ? 'is-on' : ''}`}
                                onClick={() => handlePlayFrequencySample(cfg.id, cfg.enabled)}
                                title={`Ouvir amostra sonora de ${stemMeta.labelPt} e exibir no globo`}
                                data-testid={`sample-freq-${cfg.id}`}
                              >
                                <Volume2 size={11} aria-hidden="true" />
                                <span>{isSampling ? 'Tocando...' : 'Amostra'}</span>
                              </button>
                            </div>

                            <p className="freq-story-copy">{meta.storyPt}</p>

                            <div className="freq-meta-strip">
                              <span
                                className="freq-status-pill"
                                style={{
                                  color: cfg.enabled ? stemMeta.accentHex : 'var(--text-muted)',
                                }}
                              >
                                {cfg.enabled ? '● Visível no globo' : '○ Oculta no globo'}
                              </span>
                              <span className="freq-community-count">
                                Acesa em {litRegionsCount}{' '}
                                {litRegionsCount === 1 ? 'região' : 'regiões'}
                              </span>
                            </div>

                            <div className="launchpad-energy-track" aria-hidden="true">
                              <div
                                className="launchpad-energy-fill"
                                style={{
                                  transform: `scaleX(${cfg.enabled ? cfg.opacity : 0})`,
                                  background: stemMeta.accentHex,
                                }}
                              />
                            </div>

                            {/* Official NASA Colorbar directly visible when layer is active */}
                            {cfg.enabled && ds.colorbarUrl && (
                              <div className="freq-inline-colorbar">
                                <img
                                  src={ds.colorbarUrl}
                                  alt={ds.colorbarCaption}
                                  className="colorbar-img"
                                />
                              </div>
                            )}

                            {/* Secondary Collapsible Composer & SVS Drawer */}
                            <details className="composer-advanced-details">
                              <summary>Ajustes de Compositor &amp; {ds.svsId}</summary>
                              <div className="launchpad-drawer">
                                <div className="mixer-opacity-row">
                                  <span>Intensidade visual</span>
                                  <span>{Math.round(cfg.opacity * 100)}%</span>
                                </div>
                                <input
                                  type="range"
                                  min={0}
                                  max={1}
                                  step={0.02}
                                  value={cfg.opacity}
                                  onChange={(e) =>
                                    onChangeLayerOpacity(cfg.id, Number(e.target.value))
                                  }
                                  className="blend-slider"
                                  aria-label={`Intensidade visual de ${meta.headline}`}
                                  style={{ accentColor: stemMeta.accentHex }}
                                />
                                <div className="composer-drawer-actions">
                                  <label className="blend-inline-label">
                                    <span>Mescla:</span>
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

                                  <div className="mixer-reorder-btns">
                                    <button
                                      type="button"
                                      className="tiny-btn"
                                      onClick={() => onSoloLayer(cfg.id)}
                                      title="Isolar apenas esta frequência no globo"
                                      data-testid={`solo-${cfg.id}`}
                                    >
                                      Solo
                                    </button>
                                    <button
                                      type="button"
                                      className="tiny-icon-btn"
                                      disabled={!prevDisplayLayer}
                                      onClick={() =>
                                        prevDisplayLayer && onReorderLayer(cfg.id, prevDisplayLayer.id)
                                      }
                                      title="Mover camada para cima"
                                      aria-label={`Mover ${meta.headline} para cima`}
                                    >
                                      <ArrowUp size={11} aria-hidden="true" />
                                    </button>
                                    <button
                                      type="button"
                                      className="tiny-icon-btn"
                                      disabled={!nextDisplayLayer}
                                      onClick={() =>
                                        nextDisplayLayer && onReorderLayer(cfg.id, nextDisplayLayer.id)
                                      }
                                      title="Mover camada para baixo"
                                      aria-label={`Mover ${meta.headline} para baixo`}
                                    >
                                      <ArrowDown size={11} aria-hidden="true" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </details>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {activeArea === 'missoes' && progression && (
                  <div className="launchpad-section-stack" data-testid="launchpad-panel-missoes">
                    <p className="launchpad-section-lead">
                      Viaje diretamente para regiões com fenômenos ativos e desperte vozes coletivas para ganhar XP:
                    </p>
                    <div className="missions-panel-list">
                      {missions.map((m) => {
                        const targetCountry = pickMissionTargetCountry(m.id);
                        return (
                          <div
                            key={m.id}
                            className={`mission-card ${m.completed ? 'is-done' : ''}`}
                            style={{ '--mission-accent': m.accentHex } as React.CSSProperties}
                            data-testid={`mission-card-${m.id}`}
                          >
                            <div className="mission-top-row">
                              <span
                                className="mission-dot"
                                style={{ background: m.accentHex }}
                                aria-hidden="true"
                              />
                              <strong className="mission-title">{m.titlePt}</strong>
                              <span className="mission-reward">
                                {m.completed ? 'Concluída' : `+${m.xpReward} XP`}
                              </span>
                            </div>
                            <p className="mission-desc">{m.descriptionPt}</p>
                            <div className="mission-progress-row">
                              <div className="mission-track" aria-hidden="true">
                                <div
                                  className="mission-fill"
                                  style={{
                                    transform: `scaleX(${Math.min(
                                      1,
                                      m.currentCount / Math.max(1, m.targetCount)
                                    )})`,
                                    background: m.accentHex,
                                  }}
                                />
                              </div>
                              <span className="mission-count">
                                {m.currentCount}/{m.targetCount}
                              </span>
                            </div>
                            {!m.completed && targetCountry && (
                              <button
                                type="button"
                                className="mission-fly-btn"
                                onClick={() => {
                                  onSelectAndFlyCountry(targetCountry);
                                  setActiveArea(null);
                                }}
                                data-testid={`mission-fly-${m.id}`}
                              >
                                <Compass size={12} aria-hidden="true" />
                                <span>Investigar em {targetCountry.namePt}</span>
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {activeArea === 'colecao' && progression && (
                  <div className="launchpad-section-stack" data-testid="launchpad-panel-colecao">
                    {explorerRank && (
                      <div className="planet-meter-box">
                        <div className="planet-meter-header">
                          <span>{explorerRank.title}</span>
                          <strong>{progression.xp} XP</strong>
                        </div>
                        <div className="journey-stats-row">
                          <span>{progression.exploredRegionKeys.length} regiões</span>
                          <span>{progression.contributedRegionKeys.length} acesas</span>
                          <span>{progression.unlockedSymphonyKeys.length} sinfonias 5/5</span>
                        </div>
                      </div>
                    )}

                    <div className="launchpad-subsection">
                      <span className="launchpad-subhead">Fenômenos descobertos</span>
                      <div className="collection-stems-list">
                        {STEM_ORDER.map((stemId) => {
                          const meta = STEM_METAS[stemId];
                          const count = progression.discoveredPhenomena[stemId] ?? 0;
                          return (
                            <div key={stemId} className="collection-stem-row">
                              <span
                                className="collection-stem-dot"
                                style={{ background: meta.accentHex }}
                                aria-hidden="true"
                              />
                              <span className="collection-stem-name">{meta.labelPt}</span>
                              <strong className="collection-stem-val">{count}</strong>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="launchpad-subsection">
                      <span className="launchpad-subhead">
                        Conquistas ({unlockedBadgesCount}/{badges.length})
                      </span>
                      <div className="badges-grid">
                        {badges.map((b) => (
                          <div
                            key={b.id}
                            className={`badge-chip ${b.unlocked ? 'is-unlocked' : ''}`}
                            title={b.descriptionPt}
                          >
                            <Award size={12} aria-hidden="true" />
                            <span>{b.titlePt}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="launchpad-subsection">
                      <span className="launchpad-subhead">
                        Histórico de contribuições ({progression.contributionHistory.length})
                      </span>
                      {progression.contributionHistory.length > 0 ? (
                        <div className="collection-stems-list">
                          {progression.contributionHistory.slice(0, 5).map((entry) => (
                            <div
                              key={`${entry.regionKey}-${entry.stemId}`}
                              className="collection-stem-row"
                            >
                              <span
                                className="collection-stem-dot"
                                style={{ background: STEM_METAS[entry.stemId].accentHex }}
                                aria-hidden="true"
                              />
                              <span className="collection-stem-name">
                                {entry.regionLabel} · {STEM_METAS[entry.stemId].labelPt}
                              </span>
                              <span className="collection-stem-val">
                                {entry.isRegionComplete5of5 ? '5/5' : '+1 voz'}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="launchpad-section-lead">
                          Nenhuma contribuição registrada ainda. Acenda 1 camada em um país para iniciar seu histórico!
                        </p>
                      )}
                      <p className="launchpad-section-lead" data-testid="progression-sync-notice">
                        {PROGRESSION_SYNC_NOTICE_PT}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </aside>
          )}
        </div>

        <div className="hud-center-col">
          {discoveryToast && (
            <div
              className="discovery-toast console-frame"
              role="status"
              aria-live="polite"
              style={{ '--pad-accent': STEM_METAS[discoveryToast.stemId].accentHex } as React.CSSProperties}
              data-testid="discovery-toast"
            >
              <span
                className="discovery-toast-dot"
                style={{ background: STEM_METAS[discoveryToast.stemId].accentHex }}
                aria-hidden="true"
              />
              <div className="discovery-toast-copy">
                <strong>
                  {discoveryToast.label} · +{discoveryToast.xpGained} XP
                </strong>
                <span>{discoveryToast.phenomenonPt}</span>
              </div>
              {onDismissDiscovery && (
                <button
                  type="button"
                  className="discovery-toast-close"
                  onClick={onDismissDiscovery}
                  aria-label="Fechar notificação de descoberta"
                >
                  <X size={13} aria-hidden="true" />
                </button>
              )}
            </div>
          )}

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

          {/* OLHO ORBITAL — LIVE PLANETARY CURSOR & ALTITUDE SENSOR */}
          <div
            className="orbital-eye-pill console-frame"
            data-testid="orbital-eye-hud"
            aria-live="off"
          >
            {hoverInfo ? (
              <>
                <span className="orbital-eye-target">
                  <Compass size={12} aria-hidden="true" />
                  <strong>
                    {hoverInfo.country ? hoverInfo.country.namePt : 'Oceano / Atmosfera'}
                  </strong>
                </span>
                <span className="orbital-eye-coords">
                  {formatLatLon(hoverInfo.lat, hoverInfo.lon)}
                </span>
                {dominantHoverReading && (
                  <span
                    className="orbital-eye-reading"
                    style={{
                      color:
                        STEM_METAS[DATASET_TO_STEM[dominantHoverReading.datasetId]].accentHex,
                    }}
                  >
                    ● {dominantHoverReading.labelPt}
                  </span>
                )}
              </>
            ) : (
              <>
                <span className="orbital-eye-target">
                  <Globe size={12} aria-hidden="true" />
                  <strong>Altitude ~{approxAltKm.toLocaleString('pt-BR')} km</strong>
                </span>
                <span className="orbital-eye-hint">
                  Passe o cursor sobre o globo ou clique em um farol coletivo
                </span>
              </>
            )}
          </div>
        </div>

        <div className="hud-right-col">
          {detailCard}
          {copilotWidget}
        </div>
      </div>

      {/* DOCKED BOTTOM PLAYER CONSOLE */}
      <div className="bottom-console-dock">{playerBar}</div>
    </div>
  );
};
