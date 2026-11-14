import React, { useEffect, useState } from 'react';
import {
  AudioLines,
  Award,
  Compass,
  Contrast,
  Orbit,
  PanelRightClose,
  PanelRightOpen,
  Sparkles,
  User,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { CountryEntry } from '../geo/countries';
import {
  GlobalEcosystemSummary,
  STEM_METAS,
  STEM_ORDER,
} from '../community/unlockStore';
import {
  getExplorerRank,
  ProgressionState,
} from '../game/progressionStore';
import { Mineiro3D } from './Mineiro3D';

interface AstronautCopilotProps {
  selectedCountry: CountryEntry | null;
  userName: string;
  ecosystemSummary: GlobalEcosystemSummary;
  progression?: ProgressionState;
  jukeboxPlaying: boolean;
  motionPaused?: boolean;
  compactByDefault?: boolean;
  isGuestSession?: boolean;
  onSelectCountry: (country: CountryEntry) => void;
  voiceEnabled: boolean;
  sonifyEnabled: boolean;
  highContrast: boolean;
  fontScale: number;
  liveAnnouncement: string;
  onToggleVoice: () => void;
  onToggleSonify: () => void;
  onToggleHighContrast: () => void;
  onCycleFontScale: () => void;
}

export const AstronautCopilot: React.FC<AstronautCopilotProps> = ({
  selectedCountry,
  userName,
  ecosystemSummary,
  progression,
  jukeboxPlaying,
  motionPaused = false,
  compactByDefault = false,
  isGuestSession = false,
  onSelectCountry,
  voiceEnabled,
  sonifyEnabled,
  highContrast,
  fontScale,
  liveAnnouncement,
  onToggleVoice,
  onToggleSonify,
  onToggleHighContrast,
  onCycleFontScale,
}) => {
  const [collapsed, setCollapsed] = useState(
    () =>
      compactByDefault ||
      (typeof window !== 'undefined' && window.innerWidth <= 860)
  );

  useEffect(() => {
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 860;
    setCollapsed(compactByDefault || isMobile);
  }, [compactByDefault]);

  const explorerRank = progression ? getExplorerRank(progression.xp) : null;

  const planetPct = Math.min(
    100,
    Math.round(
      (ecosystemSummary.unlockedVoicesCount /
        Math.max(1, ecosystemSummary.totalVoicesTarget)) *
        100
    )
  );
  const spotlight = ecosystemSummary.spotlightRegion;

  const companionSpeechPt = (() => {
    if (selectedCountry) {
      return `Explorando ${selectedCountry.namePt}. Ouça os dados reais da NASA ou acenda uma frequência para a comunidade.`;
    }
    if (spotlight && !spotlight.isComplete) {
      return `Faltam ${5 - spotlight.unlockedCount} vozes em ${spotlight.regionLabel} para despertar uma sinfonia 5/5. Vamos juntos?`;
    }
    return 'A Terra está viva! Clique nos faróis luminosos do globo ou escolha um país para ouvir seus fenômenos.';
  })();

  return (
    <aside
      className={`right-side-panel planet-live-panel console-frame ${collapsed ? 'is-collapsed' : ''}`}
      aria-label="Painel Planeta Vivo, comunidade e acessibilidade"
      data-testid="astronaut-copilot"
    >
      <div className="panel-header">
        <button
          type="button"
          className="planet-pill-trigger"
          onClick={() => setCollapsed((v) => !v)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expandir painel Planeta Vivo' : 'Recolher painel Planeta Vivo'}
          title={collapsed ? 'Expandir painel Planeta Vivo' : 'Recolher painel Planeta Vivo'}
          data-testid="planet-live-toggle-btn"
        >
          <Sparkles size={14} className="planet-spark-icon" aria-hidden="true" />
          <span>Planeta Vivo</span>
          <span className="planet-pill-count">
            {ecosystemSummary.unlockedVoicesCount}/{ecosystemSummary.totalVoicesTarget}
          </span>
          <span className="planet-pill-chevron" aria-hidden="true">
            {collapsed ? <PanelRightOpen size={14} /> : <PanelRightClose size={14} />}
          </span>
        </button>
      </div>

      {/* Screen-reader-only live announcements — never dumped into visible copy */}
      <span className="sr-only" aria-live="polite">
        {liveAnnouncement}
      </span>

      {!collapsed && (
        <div className="panel-body planet-panel-body" data-testid="community-panel">
          <div className="copilot-user-row">
            <span
              className="copilot-user-tag"
              title={`Sessão ativa: ${userName}`}
              data-testid="logged-user-pill"
            >
              <User size={12} aria-hidden="true" />
              <span>{isGuestSession ? 'Visitante (Demo)' : userName}</span>
            </span>
            {progression && explorerRank && (
              <span className="copilot-xp-pill" data-testid="explorer-xp-pill">
                <Award size={12} aria-hidden="true" />
                <span>
                  {progression.xp} XP · {explorerRank.title}
                </span>
              </span>
            )}
          </div>

          {/* MINEIRØ 3D COMPANION & ORBITAL GUIDE */}
          <div className="mineiro-companion-box" data-testid="mineiro-companion-box">
            <div className="mineiro-avatar-orb" aria-hidden="true">
              {!highContrast && !motionPaused ? (
                <Mineiro3D
                  size="avatar"
                  stepIndex={selectedCountry ? 2 : jukeboxPlaying ? 1 : 0}
                  isExplaining={jukeboxPlaying || voiceEnabled}
                />
              ) : (
                <span className="copilot-orbital-badge">
                  <Orbit size={18} />
                </span>
              )}
            </div>
            <div className="mineiro-dialogue-col">
              <p className="copilot-title font-display">
                {selectedCountry
                  ? `Em órbita: ${selectedCountry.namePt}`
                  : jukeboxPlaying
                    ? 'Sinfonia Planetária Ativa'
                    : 'Guia Mineirø · Ecossistema Vivo'}
              </p>
              <p className="copilot-speech">{companionSpeechPt}</p>
            </div>
          </div>

          {/* GLOBAL ECOSYSTEM THERMOMETER */}
          <section
            className="planet-meter-box"
            aria-label="Progresso coletivo de iluminação do planeta"
          >
            <div className="planet-meter-header">
              <span>{ecosystemSummary.litRegionsCount} regiões acesas no globo</span>
              <strong>
                {ecosystemSummary.unlockedVoicesCount}/{ecosystemSummary.totalVoicesTarget} vozes
              </strong>
            </div>
            <div className="planet-meter-track" aria-hidden="true">
              <div
                className="planet-meter-fill"
                style={{ transform: `scaleX(${planetPct / 100})` }}
              />
            </div>
            <div className="planet-legend-dots" aria-hidden="true">
              {STEM_ORDER.map((id) => (
                <span
                  key={id}
                  className="planet-legend-pill"
                  style={{ color: STEM_METAS[id].accentHex }}
                >
                  <span
                    className="planet-dot"
                    style={{ background: STEM_METAS[id].accentHex }}
                  />
                  {STEM_METAS[id].labelPt}
                </span>
              ))}
            </div>
          </section>

          {/* FEATURED COLLABORATIVE MISSION */}
          {spotlight && spotlight.country && (
            <button
              type="button"
              className="mission-spotlight-card"
              onClick={() => onSelectCountry(spotlight.country!)}
              data-testid="spotlight-mission-btn"
            >
              <div className="mission-spotlight-top">
                <span className="mission-tag">
                  <Compass size={12} aria-hidden="true" />
                  <span>
                    {spotlight.isComplete ? 'Região em Sinfonia' : 'Chamado Coletivo'}
                  </span>
                </span>
                <span className="mission-count">
                  {spotlight.unlockedCount}/5 vozes
                </span>
              </div>
              <strong className="mission-country">{spotlight.regionLabel}</strong>
              <span className="mission-cta">
                {spotlight.isComplete
                  ? '5/5 camadas acesas — clique para ouvir a sinfonia completa'
                  : `Faltam ${5 - spotlight.unlockedCount} pessoa(s) para iluminar 100% — Voar agora`}
              </span>
            </button>
          )}

          {/* LIVE COMMUNITY REGIONS LIST */}
          <div className="community-regions-section">
            <div className="community-section-head">
              <span>Quem está acendendo o globo</span>
              <span>{ecosystemSummary.completedRegionsCount} sinfonias 5/5</span>
            </div>

            <div className="community-regions-list" role="list">
              {ecosystemSummary.regions.map((item) => {
                const isSelected =
                  selectedCountry && item.country?.id === selectedCountry.id;
                return (
                  <button
                    key={item.regionKey}
                    type="button"
                    role="listitem"
                    disabled={!item.country}
                    onClick={() => item.country && onSelectCountry(item.country)}
                    className={`community-region-card ${item.isComplete ? 'is-complete' : ''} ${
                      isSelected ? 'is-selected' : ''
                    }`}
                  >
                    <div className="community-region-top">
                      <span className="community-region-name">{item.regionLabel}</span>
                      <span className="community-region-score">
                        {item.isComplete ? '5/5 ★' : `${item.unlockedCount}/5`}
                      </span>
                    </div>

                    <div className="community-region-bottom">
                      <div className="community-stems-mini" aria-hidden="true">
                        {STEM_ORDER.map((stemId) => (
                          <span
                            key={stemId}
                            className="community-stem-pip"
                            style={{
                              background: item.unlockedStems[stemId]
                                ? STEM_METAS[stemId].accentHex
                                : 'rgba(148, 163, 184, 0.2)',
                            }}
                          />
                        ))}
                      </div>

                      <div className="community-avatars" aria-label="Participantes nesta região">
                        {item.contributors.slice(0, 5).map((c) => (
                          <span
                            key={c.stemId}
                            className="community-avatar-dot"
                            title={`${c.contributorName} acendeu ${STEM_METAS[c.stemId].labelPt}`}
                            style={{ background: c.accentHex }}
                          >
                            {c.initial}
                          </span>
                        ))}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ACCESSIBILITY DOCK — ALWAYS VISIBLE EVEN WHEN COLLAPSED OR MOBILE */}
      <div
        className={`copilot-controls-grid ${collapsed ? 'is-compact-dock' : ''}`}
        role="group"
        aria-label="Controles globais de acessibilidade"
      >
        <button
          type="button"
          className={`copilot-btn ${voiceEnabled ? 'is-on' : ''}`}
          onClick={onToggleVoice}
          aria-pressed={voiceEnabled}
          title="Ativar ou desativar narração por voz em PT-BR (Tecla V / R)"
          data-testid="a11y-voice-btn"
        >
          {voiceEnabled ? (
            <Volume2 size={12} aria-hidden="true" />
          ) : (
            <VolumeX size={12} aria-hidden="true" />
          )}
          <span>Voz (V)</span>
        </button>

        <button
          type="button"
          className={`copilot-btn ${sonifyEnabled ? 'is-on' : ''}`}
          onClick={onToggleSonify}
          aria-pressed={sonifyEnabled}
          title="Sonificação: converter intensidade dos dados em som (Tecla S)"
          data-testid="a11y-sonify-btn"
        >
          <AudioLines size={12} aria-hidden="true" />
          <span>Som (S)</span>
        </button>

        <button
          type="button"
          className={`copilot-btn ${highContrast ? 'is-on' : ''}`}
          onClick={onToggleHighContrast}
          aria-pressed={highContrast}
          title="Modo Alto Contraste (Tecla C)"
          data-testid="a11y-contrast-btn"
        >
          <Contrast size={12} aria-hidden="true" />
          <span>Contraste</span>
        </button>

        <button
          type="button"
          className="copilot-btn"
          onClick={onCycleFontScale}
          title="Alternar tamanho do texto da interface"
          aria-label={`Tamanho da fonte atual ${Math.round(fontScale * 100)} por cento`}
          data-testid="a11y-font-btn"
        >
          <span>A+{Math.round(fontScale * 100)}%</span>
        </button>
      </div>
    </aside>
  );
};
