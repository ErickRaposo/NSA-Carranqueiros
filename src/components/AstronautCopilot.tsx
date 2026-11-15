import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  Globe,
  LogIn,
  Trophy,
  User,
  Waypoints,
  X,
} from 'lucide-react';
import { CountryEntry } from '../geo/countries';
import {
  EcosystemFeedEvent,
  GlobalEcosystemSummary,
  STEM_METAS,
  STEM_ORDER,
} from '../community/unlockStore';
import { ProgressionState } from '../game/progressionStore';
import { CountryFlagBadge } from './CountryFlag';
import { GlobalRankingEntry } from './RankingPopover';

export type CollectiveTabId = 'constellation' | 'ranking';

interface AstronautCopilotProps {
  selectedCountry: CountryEntry | null;
  userName: string;
  username?: string;
  originCountryCode?: string;
  ecosystemSummary: GlobalEcosystemSummary;
  progression?: ProgressionState;
  jukeboxPlaying: boolean;
  motionPaused?: boolean;
  highContrast: boolean;
  isGuestSession?: boolean;
  liveAnnouncement: string;
  liveToastEvent?: EcosystemFeedEvent | null;
  onDismissToast?: () => void;
  externalOpenRequest?: { tab: CollectiveTabId; nonce: number } | null;
  onSelectCountry: (country: CountryEntry) => void;
  onOpenAuth?: () => void;
  remoteRankingEntries?: GlobalRankingEntry[] | null;
}

export const AstronautCopilot: React.FC<AstronautCopilotProps> = ({
  selectedCountry,
  userName,
  username = 'visitante',
  originCountryCode,
  ecosystemSummary,
  progression,
  isGuestSession = false,
  liveAnnouncement,
  liveToastEvent = null,
  onDismissToast,
  externalOpenRequest = null,
  onSelectCountry,
  onOpenAuth,
  remoteRankingEntries = null,
}) => {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<CollectiveTabId>('constellation');
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  // Auto-recede when a country is selected so Focus Mode stays 100% clean
  useEffect(() => {
    if (selectedCountry) {
      setSheetOpen(false);
    }
  }, [selectedCountry]);

  // Allow PlayerHUD ("Ranking Global") or external triggers to open directly on a tab
  useEffect(() => {
    if (!externalOpenRequest || externalOpenRequest.nonce === 0) return;
    setActiveTab(externalOpenRequest.tab);
    setSheetOpen(true);
  }, [externalOpenRequest]);

  useEffect(() => {
    if (!sheetOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSheetOpen(false);
        requestAnimationFrame(() => triggerRef.current?.focus());
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sheetOpen]);

  const spotlight = ecosystemSummary.spotlightRegion;
  const isBackendConnected =
    Array.isArray(remoteRankingEntries) && remoteRankingEntries.length > 0;
  const completionRatio01 = Math.min(
    1,
    ecosystemSummary.completedRegionsCount / Math.max(1, ecosystemSummary.litRegionsCount || 1)
  );

  const hasPullToast = Boolean(!sheetOpen && liveToastEvent);

  return (
    <div
      className={`collective-orbit-dock ${sheetOpen ? 'is-sheet-open' : 'is-collapsed'} ${
        hasPullToast ? 'has-pull-toast' : ''
      }`}
      data-testid="astronaut-copilot"
    >
      {/* Screen-reader-only live announcements */}
      <span className="sr-only" aria-live="polite">
        {liveAnnouncement}
      </span>

      {/* SUBTLE OBSIDIAN PULL-UP TAB DOCKED TO ÓRBITA GLOBAL */}
      {hasPullToast && liveToastEvent && (
        <div
          className="collective-live-toast is-pull-tab console-frame"
          role="status"
          data-testid="collective-live-toast"
        >
          <button
            type="button"
            className="collective-toast-main"
            onClick={() => {
              onDismissToast?.();
              setActiveTab('constellation');
              setSheetOpen(true);
            }}
          >
            <span
              className="collective-avatar-badge"
              aria-hidden="true"
              data-testid="collective-toast-avatar"
            >
              {liveToastEvent.initial || <User size={11} />}
            </span>
            <span className="collective-toast-text">
              <strong>{liveToastEvent.contributorName}</strong> desbloqueou{' '}
              <span className="collective-stem-ref">
                <i
                  className="collective-stem-dot"
                  style={{ background: liveToastEvent.accentHex }}
                  aria-hidden="true"
                />
                {liveToastEvent.stemLabelPt}
              </span>{' '}
              em <strong>{liveToastEvent.regionLabel}</strong>
            </span>
          </button>
          <button
            type="button"
            className="collective-toast-close"
            onClick={() => onDismissToast?.()}
            aria-label="Dispensar notificação"
          >
            <X size={12} aria-hidden="true" />
          </button>
        </div>
      )}

      {/* EXPANDED SHEET MATCHING LEFT/RIGHT ORBITAL INSTRUMENT DRAWERS */}
      {sheetOpen && (
        <aside
          className="collective-bottom-sheet console-frame"
          role="dialog"
          aria-label="Órbita Global e Ranking Global"
          data-testid="collective-orbit-sheet"
        >
          <div className="collective-sheet-top">
            <div
              className="collective-tabs-bar"
              role="tablist"
              aria-label="Alternar entre Órbita Global e Ranking Global"
            >
              <button
                type="button"
                role="tab"
                id="collective-tab-constellation"
                aria-selected={activeTab === 'constellation'}
                aria-controls="collective-panel-constellation"
                className={`collective-tab-btn ${
                  activeTab === 'constellation' ? 'is-active' : ''
                }`}
                onClick={() => setActiveTab('constellation')}
                data-testid="collective-tab-constellation"
              >
                <Globe size={13} aria-hidden="true" />
                <span>Órbita Global</span>
              </button>

              <button
                type="button"
                role="tab"
                id="collective-tab-ranking"
                aria-selected={activeTab === 'ranking'}
                aria-controls="collective-panel-ranking"
                className={`collective-tab-btn ${activeTab === 'ranking' ? 'is-active' : ''}`}
                onClick={() => setActiveTab('ranking')}
                data-testid="collective-tab-ranking"
              >
                <Trophy size={13} aria-hidden="true" />
                <span>Ranking Global</span>
              </button>
            </div>

            <button
              type="button"
              className="icon-btn-sm"
              onClick={() => setSheetOpen(false)}
              title="Recolher Órbita Global (Esc)"
              aria-label="Fechar Órbita Global"
              data-testid="close-collective-sheet-btn"
            >
              <ChevronDown size={15} aria-hidden="true" />
            </button>
          </div>

          {/* TAB 1: REDE DE CONTRIBUIÇÃO GLOBAL */}
          {activeTab === 'constellation' && (
            <div
              id="collective-panel-constellation"
              role="tabpanel"
              aria-labelledby="collective-tab-constellation"
              className="collective-sheet-body"
              data-testid="community-panel"
            >
              <div className="collective-telemetry-summary">
                <div className="collective-summary-row">
                  <span>{ecosystemSummary.litRegionsCount} países com camadas ativas</span>
                  <strong>{ecosystemSummary.completedRegionsCount} em sinfonia 5/5</strong>
                </div>
                <div className="participant-hairline-track" aria-hidden="true">
                  <div
                    className="participant-hairline-fill"
                    style={{ transform: `scaleX(${Math.max(0.08, completionRatio01)})` }}
                  />
                </div>
              </div>

              {spotlight && spotlight.country && (
                <button
                  type="button"
                  className="collective-convergence-row"
                  onClick={() => {
                    setSheetOpen(false);
                    onSelectCountry(spotlight.country!);
                  }}
                  data-testid="spotlight-mission-btn"
                >
                  <div className="collective-convergence-copy">
                    <span className="collective-convergence-kicker">
                      {spotlight.isComplete ? 'Sinfonia completa' : 'Próxima convergência'}
                    </span>
                    <strong>{spotlight.regionLabel}</strong>
                  </div>
                  <span className="collective-convergence-right">
                    <span>{spotlight.unlockedCount}/5 camadas</span>
                    <ArrowUpRight size={13} aria-hidden="true" />
                  </span>
                </button>
              )}

              <section className="lounge-feed-section" aria-label="Atividade recente na Terra">
                <div className="participant-section-head">
                  <span>Últimas transmissões</span>
                  <span>{ecosystemSummary.unlockedVoicesCount} camadas</span>
                </div>

                <div className="lounge-feed-list" role="list" data-testid="lounge-social-feed">
                  {ecosystemSummary.recentFeed.map((ev) => (
                    <button
                      key={ev.id}
                      type="button"
                      role="listitem"
                      disabled={!ev.country}
                      onClick={() => {
                        if (!ev.country) return;
                        setSheetOpen(false);
                        onSelectCountry(ev.country);
                      }}
                      className="lounge-feed-row"
                      title={ev.country ? `Ir para ${ev.regionLabel}` : ev.regionLabel}
                    >
                      <span className="lounge-feed-avatar" aria-hidden="true">
                        {ev.initial}
                      </span>
                      <span className="lounge-feed-copy">
                        <strong>{ev.contributorName}</strong> desbloqueou{' '}
                        <span className="collective-stem-ref">
                          <i
                            className="collective-stem-dot"
                            style={{ background: ev.accentHex }}
                            aria-hidden="true"
                          />
                          {ev.stemLabelPt}
                        </span>{' '}
                        em <strong>{ev.regionLabel}</strong>
                      </span>
                      {ev.isRegionComplete && (
                        <span className="lounge-feed-tag" title="Sinfonia 5/5 completa">
                          5/5
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                <div className="lounge-regions-pills" role="group" aria-label="Países ativos">
                  {ecosystemSummary.regions.map((item) => (
                    <button
                      key={item.regionKey}
                      type="button"
                      disabled={!item.country}
                      onClick={() => {
                        if (!item.country) return;
                        setSheetOpen(false);
                        onSelectCountry(item.country);
                      }}
                      className={`lounge-region-chip ${item.isComplete ? 'is-complete' : ''}`}
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
                                : 'rgba(148, 163, 184, 0.22)',
                            }}
                          />
                        ))}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            </div>
          )}

          {/* TAB 2: RANKING GLOBAL HONESTA E SÓBRIA */}
          {activeTab === 'ranking' && (
            <div
              id="collective-panel-ranking"
              role="tabpanel"
              aria-labelledby="collective-tab-ranking"
              className="collective-sheet-body"
              data-testid="ranking-global-popover"
            >
              <div
                className="collective-sync-note"
                role="status"
                data-testid="ranking-availability-banner"
              >
                <Waypoints size={13} aria-hidden="true" />
                <span>
                  {isBackendConnected
                    ? 'Sincronizado em tempo real com a rede global.'
                    : 'Modo local ativo — aguardando conexão com o servidor Realtime.'}
                </span>
              </div>

              <div className="ranking-table-shell" role="table" aria-label="Tabela do Ranking Global">
                <div className="ranking-table-head" role="row">
                  <span role="columnheader">#</span>
                  <span role="columnheader">Participante</span>
                  <span role="columnheader">Regiões</span>
                  <span role="columnheader">5/5</span>
                  <span role="columnheader">Camadas</span>
                </div>

                {isBackendConnected ? (
                  <div className="ranking-table-body" role="rowgroup">
                    {remoteRankingEntries!.map((entry) => (
                      <div key={entry.username} className="ranking-row" role="row">
                        <span role="cell" className="ranking-pos">
                          #{entry.position}
                        </span>
                        <span role="cell" className="ranking-explorer-cell">
                          <CountryFlagBadge code={entry.originCountryCode} showName={false} />
                          <span className="ranking-explorer-names">
                            <strong>{entry.explorerName}</strong>
                            <small>@{entry.username}</small>
                          </span>
                        </span>
                        <span role="cell">{entry.contributionsCount}</span>
                        <span role="cell">{entry.achievementsCount}</span>
                        <span role="cell" className="ranking-xp-val">
                          {entry.xp.toLocaleString('pt-BR')}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="ranking-empty-state" data-testid="ranking-empty-state">
                    <p className="ranking-empty-title">Rede multiusuário pronta para conexão</p>
                    <p className="ranking-empty-desc">
                      Nenhum placar fictício é exibido antes da conexão com o banco de dados.
                    </p>
                  </div>
                )}
              </div>

              {!isGuestSession ? (
                <div className="ranking-local-self-card" data-testid="ranking-local-self">
                  <div className="ranking-local-top">
                    <div className="ranking-local-identity">
                      <strong>{userName}</strong>
                      <span>@{username}</span>
                    </div>
                    <CountryFlagBadge code={originCountryCode} showName />
                  </div>
                  <div className="participant-metrics-strip is-compact">
                    <div className="participant-metric-cell">
                      <strong className="participant-metric-val">
                        {progression?.exploredRegionKeys.length ?? 0}
                      </strong>
                      <span className="participant-metric-lbl">Regiões</span>
                    </div>
                    <div className="participant-metric-cell">
                      <strong className="participant-metric-val">
                        {progression?.contributedRegionKeys.length ?? 0}
                      </strong>
                      <span className="participant-metric-lbl">Camadas</span>
                    </div>
                    <div className="participant-metric-cell">
                      <strong className="participant-metric-val">
                        {progression?.unlockedSymphonyKeys.length ?? 0}
                      </strong>
                      <span className="participant-metric-lbl">Sinfonias 5/5</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="ranking-guest-cta-box">
                  <p>
                    Crie sua conta no menu do participante para registrar suas contribuições na rede.
                  </p>
                  {onOpenAuth && (
                    <button
                      type="button"
                      className="hud-auth-cta-btn"
                      onClick={() => {
                        setSheetOpen(false);
                        onOpenAuth();
                      }}
                    >
                      <LogIn size={13} aria-hidden="true" />
                      <span>Entrar ou criar conta</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </aside>
      )}

      {/* QUIET ORBITAL INSTRUMENT CAPSULE FOR ÓRBITA GLOBAL */}
      <button
        ref={triggerRef}
        type="button"
        className={`collective-orbit-pill console-frame ${sheetOpen ? 'is-active' : ''} ${
          hasPullToast ? 'is-toast-docked' : ''
        }`}
        onClick={() => {
          onDismissToast?.();
          setSheetOpen((v) => !v);
        }}
        title="Órbita Global — rede coletiva e Ranking Global"
        aria-expanded={sheetOpen}
        aria-haspopup="dialog"
        aria-label={
          sheetOpen
            ? 'Recolher Órbita Global e Ranking Global'
            : 'Abrir Órbita Global e Ranking Global'
        }
        data-testid="planet-live-toggle-btn"
      >
        <span
          className="collective-connection-icon"
          aria-hidden="true"
          data-testid="collective-connection-icon"
        >
          <Waypoints size={13} />
        </span>
        <span className="collective-pill-title">Órbita Global</span>
        <span className="collective-pill-meta">{ecosystemSummary.litRegionsCount} países</span>
        <span className="planet-pill-chevron" aria-hidden="true">
          {sheetOpen ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
        </span>
      </button>
    </div>
  );
};
