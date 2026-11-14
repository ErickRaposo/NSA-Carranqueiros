import React, { useEffect, useState } from 'react';
import {
  AudioLines,
  Award,
  Compass,
  Contrast,
  Crown,
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
  compactByDefault = true,
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
    if (selectedCountry && !collapsed && typeof window !== 'undefined' && window.innerWidth <= 1180) {
      setCollapsed(true);
    }
  }, [selectedCountry]);

  const explorerRank = !isGuestSession && progression ? getExplorerRank(progression.xp) : null;
  const hasMaestroHalo = Boolean(
    !isGuestSession && progression && progression.unlockedSymphonyKeys.length > 0
  );

  const planetPct = Math.min(
    100,
    Math.round(
      (ecosystemSummary.unlockedVoicesCount /
        Math.max(1, ecosystemSummary.totalVoicesTarget)) *
        100
    )
  );
  const spotlight = ecosystemSummary.spotlightRegion;
  const latestFeedItem = ecosystemSummary.recentFeed[0] ?? null;

  const companionSpeechPt = (() => {
    if (selectedCountry) {
      return `Explorando ${selectedCountry.namePt}. Ouça os dados reais da NASA ou acenda uma frequência para a comunidade.`;
    }
    if (spotlight && !spotlight.isComplete) {
      return `Faltam ${5 - spotlight.unlockedCount} vozes em ${spotlight.regionLabel} para despertar uma sinfonia 5/5. Vamos juntos?`;
    }
    return 'A Terra está viva! Passe o mouse nos faróis iluminados para ver quem colaborou ou escolha um país.';
  })();

  return (
    <aside
      className={`right-side-panel planet-live-panel console-frame ${collapsed ? 'is-collapsed' : ''}`}
      aria-label="Lounge do Astronauta, feed coletivo e acessibilidade"
      data-testid="astronaut-copilot"
    >
      <div className="panel-header lounge-header">
        <button
          type="button"
          className="planet-pill-trigger"
          onClick={() => setCollapsed((v) => !v)}
          aria-expanded={!collapsed}
          aria-label={
            collapsed
              ? 'Expandir Lounge do Astronauta e feed da comunidade'
              : 'Recolher Lounge do Astronauta'
          }
          title={
            collapsed
              ? latestFeedItem
                ? `Lounge do Astronauta · Última ação: ${latestFeedItem.contributorName} em ${latestFeedItem.regionLabel}`
                : 'Expandir Lounge do Astronauta'
              : 'Recolher Lounge do Astronauta'
          }
          data-testid="planet-live-toggle-btn"
        >
          <span className="lounge-live-pulse" aria-hidden="true" />
          <Sparkles size={14} className="planet-spark-icon" aria-hidden="true" />
          <span className="lounge-pill-label">Lounge</span>
          <span className="planet-pill-count">
            {ecosystemSummary.unlockedVoicesCount}/{ecosystemSummary.totalVoicesTarget}
          </span>
          <span className="planet-pill-chevron" aria-hidden="true">
            {collapsed ? <PanelRightOpen size={14} /> : <PanelRightClose size={14} />}
          </span>
        </button>
      </div>

      {/* Screen-reader-only live announcements */}
      <span className="sr-only" aria-live="polite">
        {liveAnnouncement}
      </span>

      {!collapsed && (
        <div className="panel-body planet-panel-body lounge-panel-body" data-testid="community-panel">
          <div className="copilot-user-row">
            <span
              className="copilot-user-tag"
              title={`Sessão ativa: ${isGuestSession ? 'Visitante' : userName}`}
            >
              <User size={12} aria-hidden="true" />
              <span>{isGuestSession ? 'Visitante · Sessão Livre' : userName}</span>
            </span>
            {!isGuestSession && progression && explorerRank && (
              <span className="copilot-xp-pill" data-testid="explorer-xp-pill">
                <Award size={12} aria-hidden="true" />
                <span>
                  {progression.xp.toLocaleString('pt-BR')} XP · {explorerRank.title}
                </span>
              </span>
            )}
          </div>

          {/* MINEIRØ 3D COMPANION WITH OPTIONAL 5/5 MAESTRO AURA ACCESSORY */}
          <div
            className={`mineiro-companion-box ${hasMaestroHalo ? 'has-maestro-reward' : ''}`}
            data-testid="mineiro-companion-box"
          >
            <div
              className={`mineiro-avatar-orb ${hasMaestroHalo ? 'has-maestro-halo' : ''}`}
              aria-hidden="true"
            >
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
              {hasMaestroHalo && (
                <span className="mineiro-crown-pip" title="Acessório desbloqueado: Halo de Maestro 5/5">
                  <Crown size={10} />
                </span>
              )}
            </div>
            <div className="mineiro-dialogue-col">
              <p className="copilot-title font-display">
                {selectedCountry
                  ? `Em órbita: ${selectedCountry.namePt}`
                  : jukeboxPlaying
                    ? 'Sinfonia Planetária Ativa'
                    : 'Lounge do Astronauta'}
              </p>
              <p className="copilot-speech">{companionSpeechPt}</p>
            </div>
          </div>

          {/* FEATURED COLLABORATIVE MISSION — CLICK FLIES TO REGION */}
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
                    {spotlight.isComplete ? 'Região em Sinfonia' : 'Missão em Destaque'}
                  </span>
                </span>
                <span className="mission-count">{spotlight.unlockedCount}/5 vozes</span>
              </div>
              <strong className="mission-country">{spotlight.regionLabel}</strong>
              <span className="mission-cta">
                {spotlight.isComplete
                  ? '5/5 camadas acesas — clique para voar e ouvir'
                  : `Faltam ${5 - spotlight.unlockedCount} pessoa(s) para iluminar 100% — Voar agora`}
              </span>
            </button>
          )}

          {/* LIVE SOCIAL FEED ("QUEM ESTÁ DESPERTANDO O PLANETA") */}
          <section className="lounge-feed-section" aria-label="Feed social vivo de colaborações">
            <div className="community-section-head">
              <span>Pulso da Comunidade</span>
              <span>
                {ecosystemSummary.litRegionsCount} regiões · {ecosystemSummary.completedRegionsCount} 5/5
              </span>
            </div>

            <div className="lounge-meter-inline" aria-hidden="true">
              <div className="planet-meter-track">
                <div
                  className="planet-meter-fill"
                  style={{ transform: `scaleX(${planetPct / 100})` }}
                />
              </div>
            </div>

            <div className="lounge-feed-list" role="list" data-testid="lounge-social-feed">
              {ecosystemSummary.recentFeed.map((ev) => (
                <button
                  key={ev.id}
                  type="button"
                  role="listitem"
                  disabled={!ev.country}
                  onClick={() => ev.country && onSelectCountry(ev.country)}
                  className="lounge-feed-row"
                  title={ev.country ? `Voar para ${ev.regionLabel}` : ev.regionLabel}
                >
                  <span
                    className="lounge-feed-avatar"
                    style={{
                      background: `color-mix(in srgb, ${ev.accentHex} 22%, rgba(8, 15, 32, 0.9))`,
                      borderColor: ev.accentHex,
                      color: ev.accentHex,
                    }}
                    aria-hidden="true"
                  >
                    {ev.initial}
                  </span>
                  <span className="lounge-feed-copy">
                    <strong>{ev.contributorName}</strong> acendeu{' '}
                    <span style={{ color: ev.accentHex, fontWeight: 700 }}>{ev.stemLabelPt}</span>{' '}
                    em <strong>{ev.regionLabel}</strong>
                  </span>
                  {ev.isRegionComplete && (
                    <span className="lounge-feed-star" title="Sinfonia 5/5 completa">
                      5/5
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* COMPACT REGION CONSTELLATIONS STRIP */}
            <div className="lounge-regions-pills" role="group" aria-label="Regiões iluminadas">
              {ecosystemSummary.regions.map((item) => {
                const isSelected = Boolean(
                  selectedCountry && item.country?.id === selectedCountry.id
                );
                return (
                  <button
                    key={item.regionKey}
                    type="button"
                    disabled={!item.country}
                    onClick={() => item.country && onSelectCountry(item.country)}
                    className={`lounge-region-chip ${item.isComplete ? 'is-complete' : ''} ${
                      isSelected ? 'is-selected' : ''
                    }`}
                  >
                    <span>{item.regionLabel}</span>
                    <span className="lounge-region-pips" aria-hidden="true">
                      {STEM_ORDER.map((s) => (
                        <span
                          key={s}
                          className="lounge-mini-dot"
                          style={{
                            background: item.unlockedStems[s]
                              ? STEM_METAS[s].accentHex
                              : 'rgba(148, 163, 184, 0.25)',
                          }}
                        />
                      ))}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* ACCESSIBILITY DOCK INSIDE LOUNGE */}
          <div
            className="copilot-controls-grid"
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
        </div>
      )}
    </aside>
  );
};
