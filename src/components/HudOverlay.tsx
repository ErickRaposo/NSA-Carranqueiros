import React, { useEffect, useMemo, useRef, useState } from 'react';
import mineiroLogo from '../assets/mineiro-logo.png';
import {
  ArrowDown,
  ArrowUp,
  AudioLines,
  Award,
  Compass,
  Contrast,
  Crown,
  Download,
  Eye,
  EyeOff,
  Flag,
  Globe,
  HelpCircle,
  Map as MapIcon,
  Orbit,
  Palette,
  PanelLeftClose,
  Search,
  Settings2,
  Share2,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Type,
  Volume2,
  VolumeX,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { PlayerHUD } from './PlayerHUD';
import type { VisualArtStyle } from './EarthCanvas';
import type { CollectiveTabId } from './AstronautCopilot';
import {
  GraticuleIcon,
  PolygonBorderIcon,
  SharpenKernelIcon,
  StemLayerIcon,
} from './CartographicIcons';
import { CountryEntry, searchCountries } from '../geo/countries';
import { formatLatLon } from '../geo/projection';
import {
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
  StemId,
} from '../community/unlockStore';
import {
  DiscoveryEvent,
  getAchievementBadges,
  getExplorerRank,
  getMissionProgressList,
  getSonicPassportSummary,
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

const VISUAL_STYLE_OPTIONS: { id: VisualArtStyle; label: string; shortLabel: string }[] = [
  { id: 'bioluminescent', label: 'Noturno Bioluminescente', shortLabel: 'Bioluminescente' },
  { id: 'infrared', label: 'Infravermelho Orbital', shortLabel: 'Infravermelho' },
  { id: 'blueprint', label: 'Blueprint Cartográfico', shortLabel: 'Blueprint' },
  { id: 'satellite', label: 'Satélite Diurno', shortLabel: 'Satélite' },
];

const ART_BLEND_SHORT: { value: BlendMode; label: string }[] = [
  { value: 'add', label: 'Soma' },
  { value: 'screen', label: 'Clarear' },
  { value: 'overlay', label: 'Contraste' },
  { value: 'difference', label: 'Arte Pop' },
  { value: 'normal', label: 'Normal' },
];

interface HudOverlayProps {
  viewMode: '3d' | '2d';
  onToggleViewMode: (mode: '3d' | '2d') => void;
  visualStyle?: VisualArtStyle;
  onChangeVisualStyle?: (style: VisualArtStyle) => void;
  onApplyArtPreset?: (presetId: 'storm' | 'currents' | 'five') => void;
  onShareMix?: () => void;
  onDownloadPoster?: () => void;
  orbitAutoRotate?: boolean;
  onToggleOrbitAutoRotate?: () => void;
  onOpenCollectiveTab?: (tab: CollectiveTabId) => void;
  externalAreaRequest?: { area: LaunchpadAreaId; nonce: number } | null;
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
  userName?: string;
  username?: string;
  userEmail?: string;
  originCountryCode?: string;
  onChangeOriginCountry?: (countryCode: string) => void;
  onUpdateProfile?: (input: {
    name: string;
    username: string;
    email: string;
    originCountryCode?: string;
  }) => { ok: boolean; errorPt?: string };
  onUpdatePassword?: (
    currentPassword: string,
    newPassword: string
  ) => { ok: boolean; errorPt?: string };
  onExportParticipantData?: () => void;
  onResetProgression?: () => void;
  isGuestSession?: boolean;
  onOpenAuth?: () => void;
  onOpenRegister?: () => void;
  highContrast?: boolean;
  onToggleHighContrast?: () => void;
  fontScale?: number;
  onCycleFontScale?: () => void;
  voiceEnabled?: boolean;
  onToggleVoice?: () => void;
  sonifyEnabled?: boolean;
  onToggleSonify?: () => void;
  ecosystemSummary?: GlobalEcosystemSummary;
  explorerXp?: number;
  progression?: ProgressionState;
  stemActivity?: Partial<Record<StemId, number>>;
  activeRegionLabel?: string | null;
  activeRegionUnlockCount?: number;
  discoveryToast?: DiscoveryEvent | null;
  onDismissDiscovery?: () => void;
  copilotWidget?: React.ReactNode;
  detailCard?: React.ReactNode;
  nasaDatasetCard?: React.ReactNode;
  playerBar?: React.ReactNode;
}

export const HudOverlay: React.FC<HudOverlayProps> = ({
  viewMode,
  onToggleViewMode,
  visualStyle = 'satellite',
  onChangeVisualStyle,
  onApplyArtPreset,
  onShareMix,
  onDownloadPoster,
  orbitAutoRotate = true,
  onToggleOrbitAutoRotate,
  onOpenCollectiveTab,
  externalAreaRequest = null,
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
  userName = 'Visitante',
  username = 'visitante',
  userEmail,
  originCountryCode,
  onChangeOriginCountry,
  onUpdateProfile,
  onUpdatePassword,
  onExportParticipantData,
  onResetProgression,
  isGuestSession = false,
  onOpenAuth,
  onOpenRegister,
  highContrast = false,
  onToggleHighContrast,
  fontScale = 1,
  onCycleFontScale,
  voiceEnabled = false,
  onToggleVoice,
  sonifyEnabled = false,
  onToggleSonify,
  ecosystemSummary,
  explorerXp: _explorerXp,
  progression,
  stemActivity,
  activeRegionLabel: _activeRegionLabel,
  activeRegionUnlockCount: _activeRegionUnlockCount = 0,
  discoveryToast,
  onDismissDiscovery,
  copilotWidget,
  detailCard,
  nasaDatasetCard,
  playerBar,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeArea, setActiveArea] = useState<LaunchpadAreaId | null>(null);
  const [visualMenuOpen, setVisualMenuOpen] = useState(false);
  const [playerPopoverOpen, setPlayerPopoverOpen] = useState(false);
  const [mobileCenterMenuOpen, setMobileCenterMenuOpen] = useState(false);
  const [samplingLayerId, setSamplingLayerId] = useState<DatasetId | null>(null);
  const [draggedLayerId, setDraggedLayerId] = useState<DatasetId | null>(null);
  const [dragOverLayerId, setDragOverLayerId] = useState<DatasetId | null>(null);
  const [zenMode, setZenMode] = useState(false);
  const [edgePeekZone, setEdgePeekZone] = useState<'top' | 'left' | 'bottom' | null>(null);

  const visualMenuRef = useRef<HTMLDivElement | null>(null);
  const mobileCenterWrapRef = useRef<HTMLDivElement | null>(null);
  const mobileCenterBtnRef = useRef<HTMLButtonElement | null>(null);
  const launchpadRefs = useRef<Partial<Record<LaunchpadAreaId, HTMLButtonElement | null>>>({});

  // Auto-recede left studio drawer when selecting a country so Focus Mode highlights the country card
  useEffect(() => {
    if (selectedCountry) {
      setActiveArea(null);
    }
  }, [selectedCountry]);

  useEffect(() => {
    if (!externalAreaRequest || externalAreaRequest.nonce === 0) return;
    setActiveArea(externalAreaRequest.area);
  }, [externalAreaRequest]);

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
    if (selectedCountry) {
      setActiveArea(null);
      setVisualMenuOpen(false);
    }
  }, [selectedCountry]);

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

  useEffect(() => {
    if (!mobileCenterMenuOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (mobileCenterWrapRef.current && !mobileCenterWrapRef.current.contains(e.target as Node)) {
        setMobileCenterMenuOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileCenterMenuOpen(false);
        requestAnimationFrame(() => mobileCenterBtnRef.current?.focus());
      }
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [mobileCenterMenuOpen]);

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

  const countriesByRegionKey = useMemo(() => {
    const map = new Map<string, { namePt: string; regionPt: string }>();
    for (const c of countries) {
      map.set(buildCountryRegionKey(c), { namePt: c.namePt, regionPt: c.regionPt });
    }
    return map;
  }, [countries]);

  const sonicPassport = useMemo(
    () =>
      !isGuestSession && progression
        ? getSonicPassportSummary(progression, countriesByRegionKey)
        : null,
    [isGuestSession, progression, countriesByRegionKey]
  );

  const isContextualCenterAwake = Boolean(
    hoverInfo || selectedCountry || visualMenuOpen || mobileCenterMenuOpen
  );

  const nextUnexploredCountry = useMemo(() => {
    const exploredSet = new Set(progression?.exploredRegionKeys ?? []);
    return (
      countries.find((c) => !c.isMinorUninhabited && !exploredSet.has(buildCountryRegionKey(c))) ??
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
      countries.find((c) => !c.isMinorUninhabited && !matchedSet.has(buildCountryRegionKey(c))) ??
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

  const handlePadVerticalFader = (
    e: React.PointerEvent<HTMLDivElement>,
    datasetId: DatasetId,
    isCurrentlyEnabled: boolean
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const rawRatio = 1 - (e.clientY - rect.top) / Math.max(1, rect.height);
    const clamped = Math.max(0.08, Math.min(1, Number(rawRatio.toFixed(2))));
    if (!isCurrentlyEnabled) {
      onToggleLayer(datasetId);
    }
    onChangeLayerOpacity(datasetId, clamped);
  };

  // Unified 4-area Explorer Launchpad (Mesa de Som Bioluminescente + Passaporte Sônico)
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
      description: 'Globo 3D/2D, voos rápidos e regiões para descobrir',
      badge: viewMode.toUpperCase(),
      icon: <Compass size={16} aria-hidden="true" />,
      testId: 'launchpad-area-explorar',
    },
    {
      id: 'frequencias',
      label: 'Estúdio Visual',
      shortLabel: 'Estúdio',
      description: 'Estilos artísticos, ordem das camadas, cores e compartilhamento',
      badge: `${enabledLayers.length}/5`,
      icon: <Palette size={16} aria-hidden="true" />,
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
      label: 'Diário & Passaporte',
      shortLabel: 'Diário',
      description: 'Seu Passaporte Sônico, títulos regionais, países iluminados e conquistas',
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

  const topHoverReadings = useMemo(() => {
    if (!hoverReadings || hoverReadings.length === 0) return [];
    return [...hoverReadings].sort((a, b) => b.intensity01 - a.intensity01).slice(0, 2);
  }, [hoverReadings]);

  const currentStyleMeta =
    VISUAL_STYLE_OPTIONS.find((s) => s.id === visualStyle) ?? VISUAL_STYLE_OPTIONS[0];

  const cycleNextVisualStyle = () => {
    if (!onChangeVisualStyle) return;
    const idx = VISUAL_STYLE_OPTIONS.findIndex((s) => s.id === visualStyle);
    const next = VISUAL_STYLE_OPTIONS[(idx + 1) % VISUAL_STYLE_OPTIONS.length];
    onChangeVisualStyle(next.id);
  };

  const isCountryFocusMode = Boolean(
    selectedCountry &&
      !activeArea &&
      !playerPopoverOpen &&
      !visualMenuOpen &&
      !mobileCenterMenuOpen
  );

  return (
    <div
      className={`hud-chrome ${zenMode ? 'is-zen' : ''} ${
        isCountryFocusMode ? 'is-country-focus' : ''
      } ${edgePeekZone ? `is-peeking-${edgePeekZone}` : ''}`}
    >
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

      {/* TOP BAR — 3 CONTEXTUAL FLOATING ISLANDS (GLOBE IS KING) */}
      <header
        className="top-hud top-hud-islands"
        aria-label="Ilhas superiores de identidade, estilos visuais e perfil"
        data-testid="explorer-topbar"
        onMouseEnter={() => setEdgePeekZone('top')}
        onMouseLeave={() => setEdgePeekZone((curr) => (curr === 'top' ? null : curr))}
      >
        {/* ILHA ESQUERDA: LOGO MINEIRØ + BUSCA COMPACTA */}
        <div
          className="topbar-zone topbar-zone-left topbar-island"
          data-testid="topbar-zone-left"
        >
          <div className="brand-block">
            <img src={mineiroLogo} alt="MINEIRØ" className="h-6 w-auto object-contain" />
          </div>

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
                aria-label="Buscar país ou região para explorar e acender camadas"
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
        </div>

        {/* ILHA CENTRAL CONTEXTUAL: DESPERTA AO INTERAGIR COM O GLOBO + MENU OPÇÕES */}
        <div
          className={`topbar-zone topbar-zone-center topbar-island is-contextual-island ${
            isContextualCenterAwake ? 'is-awake' : ''
          }`}
          data-testid="topbar-zone-center"
        >
          <div className="topbar-center-inline">
            <div className="segmented-control" role="group" aria-label="Alternância 3D e 2D">
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

            {onChangeVisualStyle && (
              <button
                type="button"
                className="toggle-chip art-style-cycle-chip"
                onClick={cycleNextVisualStyle}
                title={`Estilo artístico atual: ${currentStyleMeta.label} — clique para alternar a arte do globo`}
                aria-label={`Alternar estilo visual do globo (atual: ${currentStyleMeta.label})`}
                data-testid="cycle-visual-style-btn"
              >
                <Palette size={14} aria-hidden="true" />
                <span>{currentStyleMeta.shortLabel}</span>
              </button>
            )}

            <div className="map-visual-popover-wrap" ref={visualMenuRef}>
              <button
                type="button"
                className={`toggle-chip orbital-options-chip ${visualMenuOpen ? 'active' : ''}`}
                onClick={() => {
                  setVisualMenuOpen((v) => !v);
                  setPlayerPopoverOpen(false);
                  setMobileCenterMenuOpen(false);
                }}
                aria-expanded={visualMenuOpen}
                aria-haspopup="true"
                title="Opções orbitais: Mapa de Conexões, Camadas Cartográficas, Guia e Modo Zen"
                data-testid="visual-map-menu-btn"
              >
                <Settings2 size={14} aria-hidden="true" />
                <span>Opções</span>
              </button>

              {visualMenuOpen && (
                <div
                  className="map-visual-popover orbital-options-popover console-frame"
                  role="group"
                  aria-label="Opções orbitais e visuais do globo"
                >
                  <button
                    type="button"
                    className={`popover-toggle-item ${showUnlockMap ? 'is-on' : ''}`}
                    onClick={onToggleUnlockMap}
                    aria-pressed={showUnlockMap}
                    data-testid="unlock-map-btn"
                  >
                    <Sun size={14} aria-hidden="true" />
                    <span>Conexões &amp; Iluminação</span>
                  </button>
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
                  {onReopenTour && (
                    <button
                      type="button"
                      className="popover-toggle-item"
                      onClick={() => {
                        setVisualMenuOpen(false);
                        onReopenTour();
                      }}
                      data-testid="reopen-tour-btn"
                    >
                      <HelpCircle size={14} aria-hidden="true" />
                      <span>Guia do Explorador</span>
                    </button>
                  )}
                  <button
                    type="button"
                    className={`popover-toggle-item ${zenMode ? 'is-on' : ''}`}
                    onClick={() => {
                      setVisualMenuOpen(false);
                      setZenMode((v) => !v);
                    }}
                    aria-pressed={zenMode}
                    data-testid="zen-mode-btn"
                  >
                    <EyeOff size={14} aria-hidden="true" />
                    <span>Modo Zen (Z)</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* MENU EXPANSÍVEL EM TELAS MENORES (PRESERVA TODOS OS CONTROLES DO CENTRO) */}
          <div className="topbar-mobile-center-wrap" ref={mobileCenterWrapRef}>
            <button
              ref={mobileCenterBtnRef}
              type="button"
              className={`toggle-chip topbar-mobile-tools-btn ${
                mobileCenterMenuOpen ? 'active' : ''
              }`}
              onClick={() => {
                setMobileCenterMenuOpen((v) => !v);
                setPlayerPopoverOpen(false);
                setVisualMenuOpen(false);
              }}
              aria-expanded={mobileCenterMenuOpen}
              aria-haspopup="dialog"
              aria-label="Abrir controles de globo, mapa, iluminação, guia e modo Zen"
              data-testid="topbar-mobile-controls-btn"
            >
              <SlidersHorizontal size={14} aria-hidden="true" />
              <span>Controles</span>
            </button>

            {mobileCenterMenuOpen && (
              <div
                className="topbar-popover topbar-mobile-controls-popover console-frame"
                role="dialog"
                aria-label="Controles centrais do explorador"
                data-testid="topbar-mobile-controls-popover"
              >
                <div className="topbar-popover-header">
                  <strong>Controles do Globo</strong>
                  <button
                    type="button"
                    className="icon-btn-sm"
                    onClick={() => setMobileCenterMenuOpen(false)}
                    aria-label="Fechar controles do globo"
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                </div>

                <div className="mobile-controls-grid">
                  <div className="segmented-control" role="group" aria-label="Projeção">
                    <button
                      type="button"
                      className={`seg-btn ${viewMode === '3d' ? 'active' : ''}`}
                      onClick={() => onToggleViewMode('3d')}
                      aria-pressed={viewMode === '3d'}
                    >
                      <Globe size={13} aria-hidden="true" />
                      <span>3D</span>
                    </button>
                    <button
                      type="button"
                      className={`seg-btn ${viewMode === '2d' ? 'active' : ''}`}
                      onClick={() => onToggleViewMode('2d')}
                      aria-pressed={viewMode === '2d'}
                    >
                      <MapIcon size={13} aria-hidden="true" />
                      <span>2D</span>
                    </button>
                  </div>

                  {onChangeVisualStyle && (
                    <button
                      type="button"
                      className="popover-toggle-item is-on"
                      onClick={cycleNextVisualStyle}
                    >
                      <Palette size={14} aria-hidden="true" />
                      <span>Estilo: {currentStyleMeta.shortLabel}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    className={`popover-toggle-item ${showUnlockMap ? 'is-on' : ''}`}
                    onClick={onToggleUnlockMap}
                    aria-pressed={showUnlockMap}
                  >
                    <Sun size={14} aria-hidden="true" />
                    <span>Iluminação Coletiva</span>
                  </button>
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
                    <span>Nomes dos Países</span>
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
                  >
                    <SharpenKernelIcon size={14} />
                    <span>Nitidez HD</span>
                  </button>
                  {onReopenTour && (
                    <button
                      type="button"
                      className="popover-toggle-item"
                      onClick={() => {
                        setMobileCenterMenuOpen(false);
                        onReopenTour();
                      }}
                    >
                      <HelpCircle size={14} aria-hidden="true" />
                      <span>Guia do Explorador</span>
                    </button>
                  )}
                  <button
                    type="button"
                    className={`popover-toggle-item ${zenMode ? 'is-on' : ''}`}
                    onClick={() => {
                      setMobileCenterMenuOpen(false);
                      setZenMode((v) => !v);
                    }}
                    aria-pressed={zenMode}
                  >
                    <EyeOff size={14} aria-hidden="true" />
                    <span>Modo Zen (Z)</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ILHA DIREITA DO PARTICIPANTE (CÁPSULA ÚNICA COESA, SEM BORDA DUPLA) */}
        <div
          className="topbar-zone topbar-zone-right"
          data-testid="topbar-zone-right"
        >
          <PlayerHUD
            userName={userName}
            username={username}
            userEmail={userEmail}
            originCountryCode={originCountryCode}
            isGuestSession={isGuestSession}
            xp={progression?.xp ?? 0}
            rank={explorerRank}
            exploredCount={progression?.exploredRegionKeys.length ?? 0}
            contributionsCount={progression?.contributedRegionKeys.length ?? 0}
            symphoniesCount={progression?.unlockedSymphonyKeys.length ?? 0}
            completedMissionsCount={completedMissionsCount}
            totalMissionsCount={missions.length || 5}
            badges={badges}
            contributionHistory={progression?.contributionHistory ?? []}
            sonicPassport={sonicPassport}
            onChangeOriginCountry={onChangeOriginCountry}
            onUpdateProfile={onUpdateProfile}
            onUpdatePassword={onUpdatePassword}
            onExportParticipantData={onExportParticipantData}
            onResetProgression={onResetProgression}
            onOpenCollection={() => setActiveArea('colecao')}
            onOpenRanking={() => {
              setPlayerPopoverOpen(false);
              onOpenCollectiveTab?.('ranking');
            }}
            onOpenAuth={onOpenAuth}
            onOpenRegister={onOpenRegister}
            onLogout={onLogout}
            highContrast={highContrast}
            onToggleHighContrast={onToggleHighContrast}
            fontScale={fontScale}
            onCycleFontScale={onCycleFontScale}
            voiceEnabled={voiceEnabled}
            onToggleVoice={onToggleVoice}
            sonifyEnabled={sonifyEnabled}
            onToggleSonify={onToggleSonify}
            isOpen={playerPopoverOpen}
            onToggleOpen={() => {
              setPlayerPopoverOpen((v) => !v);
              setVisualMenuOpen(false);
              setMobileCenterMenuOpen(false);
            }}
            onClose={() => setPlayerPopoverOpen(false)}
          />
        </div>
      </header>

      <div className="hud-middle">
        <div
          className="hud-left-col launchpad-shell"
          onMouseEnter={() => setEdgePeekZone('left')}
          onMouseLeave={() => setEdgePeekZone((curr) => (curr === 'left' ? null : curr))}
        >
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
                      Gire o planeta vivo, passe o cursor para sentir os fenômenos em tempo real ou voe para países prontos para despertar.
                    </p>

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
                    {/* ESTILOS VISUAIS GENERATIVOS + PRESETS + COMPARTILHAMENTO */}
                    <div className="studio-art-header">
                      {onChangeVisualStyle && (
                        <div className="launchpad-subsection">
                          <span className="launchpad-subhead">Estilo de Arte Planetária</span>
                          <div className="studio-style-grid" role="group" aria-label="Estilos visuais do globo">
                            {VISUAL_STYLE_OPTIONS.map((opt) => (
                              <button
                                key={opt.id}
                                type="button"
                                className={`preset-ledger-btn ${
                                  visualStyle === opt.id ? 'is-active' : ''
                                }`}
                                onClick={() => onChangeVisualStyle(opt.id)}
                                aria-pressed={visualStyle === opt.id}
                                data-testid={`art-style-${opt.id}`}
                              >
                                {opt.shortLabel}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {onApplyArtPreset && (
                        <div className="launchpad-subsection">
                          <span className="launchpad-subhead">Combinações Artísticas Rápidas</span>
                          <div className="studio-preset-row">
                            <button
                              type="button"
                              className="tiny-btn"
                              onClick={() => onApplyArtPreset('storm')}
                              data-testid="art-preset-storm"
                            >
                              ⚡ Tempestade Áurea
                            </button>
                            <button
                              type="button"
                              className="tiny-btn"
                              onClick={() => onApplyArtPreset('currents')}
                              data-testid="art-preset-currents"
                            >
                              🌬 Correntes Neon
                            </button>
                            <button
                              type="button"
                              className="tiny-btn"
                              onClick={() => onApplyArtPreset('five')}
                              data-testid="art-preset-five"
                            >
                              ✦ 5 Elementos
                            </button>
                          </div>
                        </div>
                      )}

                      {(onShareMix || onDownloadPoster) && (
                        <div className="studio-share-bar">
                          {onShareMix && (
                            <button
                              type="button"
                              className="studio-action-btn is-primary"
                              onClick={onShareMix}
                              data-testid="studio-share-link-btn"
                            >
                              <Share2 size={13} aria-hidden="true" />
                              <span>Compartilhar Obra</span>
                            </button>
                          )}
                          {onDownloadPoster && (
                            <button
                              type="button"
                              className="studio-action-btn"
                              onClick={onDownloadPoster}
                              title="Baixar imagem PNG da sua composição planetária"
                              data-testid="studio-download-poster-btn"
                            >
                              <Download size={13} aria-hidden="true" />
                              <span>Postal PNG</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="studio-stack-order-banner">
                      <span>Topo da Pintura ↑ (arraste ou use ↑↓ para mudar a ordem)</span>
                    </div>

                    <div
                      className="layer-stack-list organic-soundboard-list"
                      role="list"
                      aria-label="Estúdio de camadas visuais e sonoras da NASA"
                    >
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
                        const activity01 = cfg.enabled ? (stemActivity?.[stemMeta.id] ?? 0.25) : 0;

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
                            className={`launchpad-pad discovery-freq-card organic-sound-pad ${
                              cfg.enabled ? 'is-enabled' : ''
                            } ${isDragging ? 'is-dragging' : ''} ${
                              isDragOver ? 'is-drag-over' : ''
                            }`}
                            style={
                              {
                                '--pad-accent': stemMeta.accentHex,
                                '--pad-pulse': activity01.toFixed(2),
                              } as React.CSSProperties
                            }
                            data-testid={`mixer-card-${cfg.id}`}
                          >
                            <div className="organic-pad-main">
                              <div className="organic-pad-body">
                                <div className="launchpad-pad-top">
                                  <button
                                    type="button"
                                    role="switch"
                                    aria-checked={cfg.enabled}
                                    onClick={() => onToggleLayer(cfg.id)}
                                    aria-label={`Ativar camada no globo: ${meta.headline}`}
                                    data-testid={`toggle-${cfg.id}`}
                                    className={`organic-orb-toggle ${cfg.enabled ? 'is-lit' : ''}`}
                                  >
                                    <span
                                      className="launchpad-icon-box organic-icon-orb"
                                      style={{
                                        color: cfg.enabled ? '#040914' : stemMeta.accentHex,
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
                                  </button>

                                  <button
                                    type="button"
                                    className={`tiny-btn freq-sample-btn ${
                                      isSampling ? 'is-on' : ''
                                    } ${cfg.enabled ? 'is-layer-lit' : ''}`}
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
                                    {cfg.enabled
                                      ? enabledLayers.length === 1
                                        ? '● 100% · Mapa Puro NASA'
                                        : `● Fusão ${Math.round(cfg.opacity * 100)}%`
                                      : '○ Oculta no globo'}
                                  </span>
                                  <span className="freq-community-count">
                                    Desbloqueada em {litRegionsCount}{' '}
                                    {litRegionsCount === 1 ? 'país' : 'países'}
                                  </span>
                                </div>
                              </div>

                              {/* GESTURAL VERTICAL FADER (DRAG UP/DOWN OR KEYBOARD ARROWS) */}
                              <div
                                role="slider"
                                tabIndex={0}
                                aria-label={`Intensidade de mesclagem de ${meta.headline}`}
                                aria-valuemin={8}
                                aria-valuemax={100}
                                aria-valuenow={Math.round(
                                  (cfg.enabled
                                    ? enabledLayers.length === 1
                                      ? 1
                                      : cfg.opacity
                                    : 0) * 100
                                )}
                                title={
                                  enabledLayers.length === 1 && cfg.enabled
                                    ? '100% opacidade pura NASA (ative uma 2ª camada para mesclar)'
                                    : 'Arraste verticalmente (ou use Setas ↑/↓) para mesclar a camada'
                                }
                                className={`pad-vertical-fader ${cfg.enabled ? 'is-lit' : ''}`}
                                data-testid={`vertical-fader-${cfg.id}`}
                                onPointerDown={(e) => {
                                  e.stopPropagation();
                                  e.currentTarget.setPointerCapture(e.pointerId);
                                  handlePadVerticalFader(e, cfg.id, cfg.enabled);
                                }}
                                onPointerMove={(e) => {
                                  if (e.buttons === 1 || e.pressure > 0) {
                                    e.stopPropagation();
                                    handlePadVerticalFader(e, cfg.id, cfg.enabled);
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
                                    e.preventDefault();
                                    if (!cfg.enabled) onToggleLayer(cfg.id);
                                    onChangeLayerOpacity(
                                      cfg.id,
                                      Math.min(1, Number((cfg.opacity + 0.1).toFixed(2)))
                                    );
                                  } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
                                    e.preventDefault();
                                    onChangeLayerOpacity(
                                      cfg.id,
                                      Math.max(0.08, Number((cfg.opacity - 0.1).toFixed(2)))
                                    );
                                  }
                                }}
                              >
                                <span
                                  className="pad-vertical-fader-fill"
                                  style={{
                                    transform: `scaleY(${
                                      cfg.enabled
                                        ? enabledLayers.length === 1
                                          ? 1
                                          : cfg.opacity
                                        : 0.06
                                    })`,
                                    background: stemMeta.accentHex,
                                  }}
                                  aria-hidden="true"
                                />
                                <span className="pad-vertical-fader-pct" aria-hidden="true">
                                  {cfg.enabled
                                    ? `${Math.round(
                                        (enabledLayers.length === 1 ? 1 : cfg.opacity) * 100
                                      )}`
                                    : '—'}
                                </span>
                              </div>
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

                            {/* DIRECT LAYER ORDER + BLEND MODE + SOLO CONTROLS ON CARD SURFACE */}
                            <div className="studio-pad-controls-bar">
                              <div
                                className="studio-blend-pills"
                                role="group"
                                aria-label={`Fusão de cores de ${ds.shortName}`}
                              >
                                {ART_BLEND_SHORT.map((bm) => (
                                  <button
                                    key={bm.value}
                                    type="button"
                                    className={`studio-blend-chip ${
                                      cfg.blendMode === bm.value ? 'is-active' : ''
                                    }`}
                                    onClick={() => onChangeLayerBlendMode(cfg.id, bm.value)}
                                    aria-pressed={cfg.blendMode === bm.value}
                                    data-testid={
                                      cfg.blendMode === bm.value ? `blend-active-${cfg.id}` : undefined
                                    }
                                  >
                                    {bm.label}
                                  </button>
                                ))}
                              </div>

                              <div className="mixer-reorder-btns">
                                <button
                                  type="button"
                                  className="tiny-btn"
                                  onClick={() => onSoloLayer(cfg.id)}
                                  title="Isolar apenas esta camada no globo"
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
                                  title="Subir camada na pilha de arte"
                                  aria-label={`Mover ${meta.headline} para cima na ordem`}
                                  data-testid={`move-up-${cfg.id}`}
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
                                  title="Descer camada na pilha de arte"
                                  aria-label={`Mover ${meta.headline} para baixo na ordem`}
                                  data-testid={`move-down-${cfg.id}`}
                                >
                                  <ArrowDown size={11} aria-hidden="true" />
                                </button>
                              </div>
                            </div>
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
                    {!isGuestSession && explorerRank ? (
                      <div className="planet-meter-box">
                        <div className="planet-meter-header">
                          <span>{explorerRank.title}</span>
                          <strong>{progression.xp.toLocaleString('pt-BR')} XP</strong>
                        </div>
                        <div className="journey-stats-row">
                          <span>{progression.exploredRegionKeys.length} regiões</span>
                          <span>{progression.contributedRegionKeys.length} acesas</span>
                          <span>{progression.unlockedSymphonyKeys.length} sinfonias 5/5</span>
                        </div>
                      </div>
                    ) : (
                      <div className="planet-meter-box">
                        <span className="launchpad-section-lead">
                          Crie sua conta ou faça login na ilha superior direita para gravar seu Passaporte Sônico permanente.
                        </span>
                      </div>
                    )}

                    {/* SONIC PASSPORT: REGIONAL TITLES, FAVORITE LAYER & ILLUMINATED COUNTRIES */}
                    {sonicPassport && (
                      <div className="launchpad-subsection" data-testid="logbook-sonic-passport">
                        <span className="launchpad-subhead">Passaporte Sônico &amp; Títulos</span>
                        <div className="collection-stems-list">
                          <div className="collection-stem-row">
                            <Crown size={12} className="ranking-gold-icon" aria-hidden="true" />
                            <span className="collection-stem-name">Rastro Áureo no Globo</span>
                            <strong className="collection-stem-val">
                              {sonicPassport.hasGoldenTrailReward ? 'Desbloqueado' : 'Complete 5/5'}
                            </strong>
                          </div>
                          {sonicPassport.favoriteStem && (
                            <div className="collection-stem-row">
                              <span
                                className="collection-stem-dot"
                                style={{ background: sonicPassport.favoriteStem.accentHex }}
                                aria-hidden="true"
                              />
                              <span className="collection-stem-name">Camada mais afinada</span>
                              <strong className="collection-stem-val">
                                {sonicPassport.favoriteStem.labelPt}
                              </strong>
                            </div>
                          )}
                        </div>

                        {sonicPassport.regionalTitles.length > 0 && (
                          <div className="badges-grid">
                            {sonicPassport.regionalTitles.map((t) => (
                              <span key={t} className="badge-chip is-unlocked">
                                <Crown size={11} aria-hidden="true" />
                                <span>{t}</span>
                              </span>
                            ))}
                          </div>
                        )}

                        {sonicPassport.illuminatedRegions.length > 0 && (
                          <div className="badges-grid">
                            {sonicPassport.illuminatedRegions.map((reg) => {
                              const targetC = countries.find(
                                (cItem) => buildCountryRegionKey(cItem) === reg.regionKey
                              );
                              return (
                                <button
                                  key={reg.regionKey}
                                  type="button"
                                  className="passport-country-pill is-clickable"
                                  disabled={!targetC}
                                  onClick={() => {
                                    if (targetC) {
                                      onSelectAndFlyCountry(targetC);
                                      setActiveArea(null);
                                    }
                                  }}
                                >
                                  <span>
                                    {reg.regionLabel}
                                    {reg.isComplete5of5 ? ' ★ 5/5' : ''}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        )}
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

          {/* CARD DE DESCOBERTA DO PAÍS (ANCORADO NA ESQUERDA PARA O PAÍS 2D OCUPAR A DIREITA) */}
          {!activeArea && detailCard && (
            <div className="hud-left-detail-slot" data-testid="hud-left-detail-slot">
              {detailCard}
            </div>
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
                  {discoveryToast.label}
                  {discoveryToast.xpGained > 0 ? ` · +${discoveryToast.xpGained} XP` : ''}
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

          {/* CARD CIENTÍFICO DA BASE NASA & ESCALA DE CORES */}
          {nasaDatasetCard && (
            <div className="nasa-dataset-card-slot" data-testid="nasa-dataset-card-slot">
              {nasaDatasetCard}
            </div>
          )}

          {/* ZONA 4 — ESTAÇÃO VERTICAL DEDICADA DE ACESSIBILIDADE + GIRO ORBITAL + ZOOM (MEIO-DIREITA) */}
          <aside
            className="a11y-spatial-dock console-frame"
            role="toolbar"
            aria-label="Estação de acessibilidade, giro orbital e zoom"
            data-testid="a11y-spatial-dock"
          >
            {onToggleVoice && (
              <button
                type="button"
                className={`spatial-dock-btn ${voiceEnabled ? 'is-on' : ''}`}
                onClick={onToggleVoice}
                aria-pressed={voiceEnabled}
                title="Narração por voz em português (Tecla V / R)"
                aria-label="Alternar narração por voz em português"
                data-testid="a11y-voice-btn"
              >
                {voiceEnabled ? (
                  <Volume2 size={15} aria-hidden="true" />
                ) : (
                  <VolumeX size={15} aria-hidden="true" />
                )}
                <span>Voz</span>
              </button>
            )}

            {onToggleSonify && (
              <button
                type="button"
                className={`spatial-dock-btn ${sonifyEnabled ? 'is-on' : ''}`}
                onClick={onToggleSonify}
                aria-pressed={sonifyEnabled}
                title="Sonificação tátil de dados da NASA (Tecla S)"
                aria-label="Alternar sonificação de dados"
                data-testid="a11y-sonify-btn"
              >
                <AudioLines size={15} aria-hidden="true" />
                <span>Som</span>
              </button>
            )}

            {onToggleHighContrast && (
              <button
                type="button"
                className={`spatial-dock-btn ${highContrast ? 'is-on' : ''}`}
                onClick={onToggleHighContrast}
                aria-pressed={highContrast}
                title="Modo Alto Contraste WCAG (Tecla C)"
                aria-label="Alternar modo de alto contraste"
                data-testid="a11y-contrast-btn"
              >
                <Contrast size={15} aria-hidden="true" />
                <span>Contraste</span>
              </button>
            )}

            {onCycleFontScale && (
              <button
                type="button"
                className={`spatial-dock-btn ${fontScale > 1 ? 'is-on' : ''}`}
                onClick={onCycleFontScale}
                title="Ampliar escala de texto da interface"
                aria-label={`Escala de texto atual ${Math.round(fontScale * 100)} por cento`}
                data-testid="a11y-font-btn"
              >
                <strong className="spatial-font-glyph">A+</strong>
                <span>{Math.round(fontScale * 100)}%</span>
              </button>
            )}

            <span className="spatial-dock-divider" aria-hidden="true" />

            {onToggleOrbitAutoRotate && (
              <button
                type="button"
                className={`spatial-dock-btn is-orbit-spin ${orbitAutoRotate ? 'is-on' : ''}`}
                onClick={onToggleOrbitAutoRotate}
                aria-pressed={orbitAutoRotate}
                title={
                  orbitAutoRotate
                    ? 'Rotação automática do globo ativa — clique para parar o giro'
                    : 'Rotação do globo parada — clique para girar suavemente'
                }
                aria-label={
                  orbitAutoRotate ? 'Parar giro orbital do globo' : 'Ativar giro orbital do globo'
                }
                data-testid="orbit-spin-toggle-btn"
              >
                <Orbit size={15} aria-hidden="true" />
                <span>{orbitAutoRotate ? 'Girando' : 'Parado'}</span>
              </button>
            )}

            <button
              type="button"
              className="spatial-dock-btn is-zoom"
              onClick={() => onZoomStep(-0.28)}
              title="Aproximar zoom no planeta (Tecla +)"
              aria-label="Aproximar zoom"
              data-testid="dock-zoom-in-btn"
            >
              <ZoomIn size={16} aria-hidden="true" />
            </button>

            <button
              type="button"
              className="spatial-dock-btn is-zoom"
              onClick={() => onZoomStep(0.28)}
              title="Afastar zoom do planeta (Tecla -)"
              aria-label="Afastar zoom"
              data-testid="dock-zoom-out-btn"
            >
              <ZoomOut size={16} aria-hidden="true" />
            </button>
          </aside>
        </div>
      </div>

      {/* ZONA 5 — SENSOR OLHO ORBITAL ACOPLADO ACIMA DO CONSOLE INFERIOR */}
      <div
        className="bottom-console-dock"
        onMouseEnter={() => setEdgePeekZone('bottom')}
        onMouseLeave={() => setEdgePeekZone((curr) => (curr === 'bottom' ? null : curr))}
      >
        <div
          className="orbital-eye-pill is-coupled-bottom console-frame"
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
              {hoverInfo.country && ecosystemSummary && (() => {
                const hoverRegion = ecosystemSummary.regions.find(
                  (r) => r.regionKey === buildCountryRegionKey(hoverInfo.country!)
                );
                if (!hoverRegion || hoverRegion.unlockedCount === 0) return null;
                return (
                  <span
                    className={`orbital-eye-unlock-tag ${
                      hoverRegion.isComplete ? 'is-complete' : ''
                    }`}
                  >
                    {hoverRegion.isComplete
                      ? '5/5 Sinfonia'
                      : `${hoverRegion.unlockedCount}/5 camadas`}
                  </span>
                );
              })()}
              <span className="orbital-eye-coords">
                {formatLatLon(hoverInfo.lat, hoverInfo.lon)}
              </span>
              {topHoverReadings.length > 0 ? (
                topHoverReadings.map((reading) => {
                  const stem = STEM_METAS[DATASET_TO_STEM[reading.datasetId]];
                  return (
                    <span
                      key={reading.datasetId}
                      className="orbital-eye-reading"
                      style={{ color: stem.accentHex }}
                    >
                      ● {stem.labelPt}: {reading.labelPt}
                    </span>
                  );
                })
              ) : (
                <span className="orbital-eye-hint">
                  Ative camadas no Estúdio para inspecionar este ponto
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
                Aponte qualquer ponto da Terra para ler os fenômenos NASA em tempo real
              </span>
            </>
          )}
        </div>

        {playerBar}
      </div>

      {/* ZONA 6 — ÓRBITA COLETIVA + RANKING GLOBAL (CANTO INFERIOR DIREITO) */}
      {copilotWidget && <div className="bottom-right-collective-slot">{copilotWidget}</div>}
    </div>
  );
};
