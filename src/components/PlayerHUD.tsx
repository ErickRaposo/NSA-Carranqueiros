import React, { useEffect, useRef, useState } from 'react';
import {
  AudioLines,
  Award,
  ChevronDown,
  Compass,
  Contrast,
  Crown,
  FolderHeart,
  LogIn,
  LogOut,
  Settings2,
  Sparkles,
  Trophy,
  User,
  UserPlus,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  AchievementBadge,
  ContributionHistoryItem,
  ExplorerRank,
  SonicPassportSummary,
} from '../game/progressionStore';
import { STEM_METAS } from '../community/unlockStore';
import {
  CountryFlagBadge,
  getOriginCountryNamePt,
  ORIGIN_COUNTRY_OPTIONS,
} from './CountryFlag';

export interface PlayerHUDProps {
  userName: string;
  username: string;
  originCountryCode?: string;
  isGuestSession: boolean;
  xp: number;
  rank: ExplorerRank | null;
  exploredCount: number;
  contributionsCount: number;
  symphoniesCount: number;
  completedMissionsCount: number;
  totalMissionsCount: number;
  badges: AchievementBadge[];
  contributionHistory: ContributionHistoryItem[];
  sonicPassport?: SonicPassportSummary | null;
  onChangeOriginCountry?: (countryCode: string) => void;
  onOpenCollection: () => void;
  onOpenRanking: () => void;
  onOpenAuth?: () => void;
  onOpenRegister?: () => void;
  onLogout: () => void;
  highContrast: boolean;
  onToggleHighContrast?: () => void;
  fontScale?: number;
  onCycleFontScale?: () => void;
  voiceEnabled?: boolean;
  onToggleVoice?: () => void;
  sonifyEnabled?: boolean;
  onToggleSonify?: () => void;
  isOpen: boolean;
  onToggleOpen: () => void;
  onClose: () => void;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'EX';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export const PlayerHUD: React.FC<PlayerHUDProps> = ({
  userName,
  username,
  originCountryCode,
  isGuestSession,
  xp,
  rank,
  exploredCount,
  contributionsCount,
  symphoniesCount,
  completedMissionsCount,
  totalMissionsCount,
  badges,
  contributionHistory,
  sonicPassport = null,
  onChangeOriginCountry,
  onOpenCollection,
  onOpenRanking,
  onOpenAuth,
  onOpenRegister,
  onLogout,
  highContrast,
  onToggleHighContrast,
  fontScale = 1,
  onCycleFontScale,
  voiceEnabled = false,
  onToggleVoice,
  sonifyEnabled = false,
  onToggleSonify,
  isOpen,
  onToggleOpen,
  onClose,
}) => {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const unlockedBadges = badges.filter((b) => b.unlocked);
  const levelNum = rank?.level ?? 1;
  const rankTitle = rank?.title ?? 'Ouvinte Orbital';
  const progress01 = rank?.progress01 ?? 0;
  const nextXp = rank?.nextXp ?? null;
  const countryNamePt = getOriginCountryNamePt(originCountryCode);

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        requestAnimationFrame(() => triggerRef.current?.focus());
      }
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, onClose]);

  const ariaLabel = isGuestSession
    ? 'Perfil de Visitante: abrir opções de entrada, cadastro e configurações'
    : `Perfil de ${userName} (@${username}), país ${countryNamePt}, Nível ${levelNum} ${rankTitle}, ${xp} XP`;

  return (
    <div className="player-hud-wrap" ref={wrapRef}>
      <button
        ref={triggerRef}
        type="button"
        className={`player-hud-trigger ${isOpen ? 'is-open' : ''} ${
          isGuestSession ? 'is-guest' : 'is-authenticated'
        }`}
        onClick={onToggleOpen}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label={ariaLabel}
        title={ariaLabel}
        data-testid="player-hud-trigger"
      >
        {/* AVATAR WITH ORBITAL LEVEL RING */}
        <span className="player-avatar-shell" aria-hidden="true">
          {isGuestSession ? (
            <span className="player-avatar-guest">
              <User size={14} />
            </span>
          ) : (
            <span
              className={`player-avatar-auth ${
                sonicPassport?.hasGoldenTrailReward ? 'has-maestro-crown' : ''
              }`}
            >
              <span>{getInitials(userName)}</span>
              <span className="player-level-pip">Nv.{levelNum}</span>
            </span>
          )}
        </span>

        {/* IDENTITY BLOCK — NEVER CUTS USERNAME */}
        <span className="player-identity-col" data-testid="logged-user-pill">
          {isGuestSession ? (
            <>
              <span className="player-primary-line">
                <strong className="player-display-name">Visitante</strong>
                <span className="player-guest-tag">Sem conta</span>
              </span>
              <span className="player-secondary-line">
                <span>Entrar ou cadastrar</span>
              </span>
            </>
          ) : (
            <>
              <span className="player-primary-line">
                <strong className="player-display-name">{userName}</strong>
                <span className="player-username" data-testid="player-hud-username">
                  @{username}
                </span>
                <CountryFlagBadge code={originCountryCode} showName compactOnSmall />
              </span>
              <span className="player-secondary-line">
                <span className="player-rank-title">{rankTitle}</span>
                <span className="player-xp-inline">
                  {xp.toLocaleString('pt-BR')}
                  {nextXp ? `/${nextXp}` : ''} XP
                </span>
              </span>
            </>
          )}
        </span>

        <ChevronDown
          size={14}
          className={`player-hud-chevron ${isOpen ? 'is-rotated' : ''}`}
          aria-hidden="true"
        />

        {/* LEVEL PROGRESS BAR ALONG BOTTOM EDGE (AUTHENTICATED ONLY) */}
        {!isGuestSession && (
          <span className="player-hud-progress-track" aria-hidden="true">
            <span
              className="player-hud-progress-fill"
              style={{ transform: `scaleX(${progress01})` }}
            />
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className="topbar-popover player-hud-popover console-frame"
          role="dialog"
          aria-label="Passaporte e perfil do explorador"
          data-testid="player-hud-popover"
        >
          <div className="topbar-popover-header">
            <div className="topbar-popover-title-group">
              <Compass size={15} className="player-cyan-icon" aria-hidden="true" />
              <strong>{isGuestSession ? 'Acesso do Explorador' : 'Passaporte Planetário'}</strong>
            </div>
            <button
              type="button"
              className="icon-btn-sm"
              onClick={() => {
                onClose();
                requestAnimationFrame(() => triggerRef.current?.focus());
              }}
              aria-label="Fechar perfil do jogador"
              title="Fechar (Esc)"
              data-testid="close-player-hud-btn"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>

          {isGuestSession ? (
            /* VISITOR STATE — DEDICATED HONEST ENTRY/REGISTER EXPERIENCE (NO FAKE STATS) */
            <div className="player-guest-card" data-testid="player-hud-guest-view">
              <div className="player-guest-hero">
                <span className="player-avatar-lg is-guest" aria-hidden="true">
                  <User size={20} />
                </span>
                <div>
                  <strong className="player-card-name">Sessão de Visitante</strong>
                  <p className="player-card-sub">
                    Explore o globo livremente. Crie sua conta para registrar seu{' '}
                    <strong>@username</strong>, escolher a bandeira do seu país e acumular XP e patentes reais.
                  </p>
                </div>
              </div>

              <div className="player-guest-actions">
                {onOpenAuth && (
                  <button
                    type="button"
                    className="hud-auth-cta-btn"
                    onClick={() => {
                      onClose();
                      onOpenAuth();
                    }}
                    data-testid="topbar-login-btn"
                  >
                    <LogIn size={14} aria-hidden="true" />
                    <span>Entrar na Conta</span>
                  </button>
                )}
                {(onOpenRegister || onOpenAuth) && (
                  <button
                    type="button"
                    className="hud-secondary-btn"
                    onClick={() => {
                      onClose();
                      if (onOpenRegister) onOpenRegister();
                      else if (onOpenAuth) onOpenAuth();
                    }}
                    data-testid="topbar-register-btn"
                  >
                    <UserPlus size={14} aria-hidden="true" />
                    <span>Criar Conta</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* AUTHENTICATED STATE — REAL IDENTITY, LEVEL, STATS, CONTRIBUTIONS & ACHIEVEMENTS */
            <>
              <section className="player-passport-hero" aria-label="Identidade completa">
                <div className="player-passport-top">
                  <span className="player-avatar-lg" aria-hidden="true">
                    {getInitials(userName)}
                  </span>
                  <div className="player-passport-meta">
                    <div className="player-passport-name-row">
                      <strong className="player-card-name">{userName}</strong>
                      <CountryFlagBadge code={originCountryCode} showName />
                    </div>
                    <span className="player-passport-handle">@{username}</span>
                    <div className="player-passport-rank-row">
                      <span className="player-level-badge">Nível {levelNum}</span>
                      <span className="player-patent-badge">{rankTitle}</span>
                    </div>
                  </div>
                </div>

                <div className="player-xp-box">
                  <div className="player-xp-labels">
                    <span className="xp-gold-text">
                      <Sparkles size={12} aria-hidden="true" />
                      <strong>{xp.toLocaleString('pt-BR')} XP</strong> acumulados
                    </span>
                    <span>
                      {nextXp
                        ? `Próximo nível em ${nextXp.toLocaleString('pt-BR')} XP`
                        : 'Patente máxima alcançada'}
                    </span>
                  </div>
                  <div className="player-xp-bar-track" aria-hidden="true">
                    <div
                      className="player-xp-bar-fill"
                      style={{ transform: `scaleX(${progress01})` }}
                    />
                  </div>
                </div>
              </section>

              {/* EXPLORATION & CONTRIBUTIONS STATS */}
              <section
                className="player-stats-grid"
                aria-label="Estatísticas reais de exploração e contribuições"
              >
                <div className="player-stat-cell is-cyan">
                  <span className="stat-val">{exploredCount}</span>
                  <span className="stat-lbl">Regiões exploradas</span>
                </div>
                <div className="player-stat-cell is-green">
                  <span className="stat-val">{contributionsCount}</span>
                  <span className="stat-lbl">Contribuições</span>
                </div>
                <div className="player-stat-cell is-gold">
                  <span className="stat-val">
                    {unlockedBadges.length}/{badges.length || 5}
                  </span>
                  <span className="stat-lbl">Conquistas</span>
                </div>
                <div className="player-stat-cell is-cyan">
                  <span className="stat-val">
                    {completedMissionsCount}/{totalMissionsCount || 5}
                  </span>
                  <span className="stat-lbl">Missões ({symphoniesCount} 5/5)</span>
                </div>
              </section>

              {/* SONIC PASSPORT: REGIONAL TITLES, FAVORITE FREQUENCY & ILLUMINATED COUNTRIES */}
              {sonicPassport && (
                <section
                  className="player-popover-section sonic-passport-section"
                  aria-label="Passaporte Sônico e recompensas visuais"
                  data-testid="sonic-passport-section"
                >
                  <div className="player-section-head">
                    <span>Passaporte Sônico</span>
                    <span
                      className={
                        sonicPassport.hasGoldenTrailReward ? 'xp-gold-text' : 'muted-sm'
                      }
                    >
                      {sonicPassport.hasGoldenTrailReward ? (
                        <>
                          <Crown size={11} aria-hidden="true" /> Rastro Áureo 5/5 Ativo
                        </>
                      ) : (
                        'Rastro 5/5: bloqueado'
                      )}
                    </span>
                  </div>

                  {sonicPassport.favoriteStem && (
                    <div className="player-mini-row">
                      <span
                        className="player-mini-dot"
                        style={{ background: sonicPassport.favoriteStem.accentHex }}
                        aria-hidden="true"
                      />
                      <span className="player-mini-label">
                        Frequência dominante: <strong>{sonicPassport.favoriteStem.labelPt}</strong>
                      </span>
                    </div>
                  )}

                  {sonicPassport.regionalTitles.length > 0 && (
                    <div className="player-badges-wrap">
                      {sonicPassport.regionalTitles.map((title) => (
                        <span key={title} className="badge-chip is-unlocked">
                          <Crown size={10} aria-hidden="true" />
                          <span>{title}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  {sonicPassport.illuminatedRegions.length > 0 && (
                    <div className="player-badges-wrap">
                      {sonicPassport.illuminatedRegions.map((reg) => (
                        <span key={reg.regionKey} className="passport-country-pill">
                          {reg.regionLabel}
                          {reg.isComplete5of5 ? ' ★ 5/5' : ''}
                        </span>
                      ))}
                    </div>
                  )}
                </section>
              )}

              {/* RECENT CONTRIBUTIONS */}
              <section className="player-popover-section" aria-label="Contribuições realizadas">
                <div className="player-section-head">
                  <span>Contribuições realizadas</span>
                  <span className="contrib-green-count">{contributionsCount} vozes</span>
                </div>
                {contributionHistory.length > 0 ? (
                  <div className="player-mini-list">
                    {contributionHistory.slice(0, 3).map((item) => (
                      <div key={`${item.regionKey}-${item.stemId}`} className="player-mini-row">
                        <span
                          className="player-mini-dot"
                          style={{ background: STEM_METAS[item.stemId].accentHex }}
                          aria-hidden="true"
                        />
                        <span className="player-mini-label">
                          {item.regionLabel} · {STEM_METAS[item.stemId].labelPt}
                        </span>
                        <span className="player-mini-tag">
                          {item.isRegionComplete5of5 ? '5/5 ★' : '+1 voz'}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="player-empty-note">
                    Nenhuma frequência acesa ainda. Selecione um país no globo para contribuir.
                  </p>
                )}
              </section>

              {/* ACHIEVEMENTS */}
              <section className="player-popover-section" aria-label="Conquistas do explorador">
                <div className="player-section-head">
                  <span>Conquistas</span>
                  <span className="xp-gold-text">
                    {unlockedBadges.length}/{badges.length}
                  </span>
                </div>
                <div className="player-badges-wrap">
                  {badges.map((b) => (
                    <span
                      key={b.id}
                      className={`badge-chip ${b.unlocked ? 'is-unlocked' : ''}`}
                      title={b.descriptionPt}
                    >
                      <Award size={11} aria-hidden="true" />
                      <span>{b.titlePt}</span>
                    </span>
                  ))}
                </div>
              </section>
            </>
          )}

          {/* QUICK NAVIGATION: COLLECTION & GLOBAL RANKING */}
          <div className="player-nav-shortcuts">
            <button
              type="button"
              className="hud-shortcut-btn"
              onClick={() => {
                onClose();
                onOpenCollection();
              }}
              data-testid="player-open-collection-btn"
            >
              <FolderHeart size={13} aria-hidden="true" />
              <span>Coleção</span>
            </button>
            <button
              type="button"
              className="hud-shortcut-btn"
              onClick={() => {
                onClose();
                onOpenRanking();
              }}
              data-testid="player-open-ranking-btn"
            >
              <Trophy size={13} aria-hidden="true" />
              <span>Ranking Global</span>
            </button>
            <button
              type="button"
              className={`hud-shortcut-btn ${settingsOpen ? 'is-active' : ''}`}
              onClick={() => setSettingsOpen((v) => !v)}
              aria-expanded={settingsOpen}
              data-testid="player-open-settings-btn"
            >
              <Settings2 size={13} aria-hidden="true" />
              <span>Configurações</span>
            </button>
          </div>

          {/* EXPANDABLE SETTINGS PANEL (ORIGIN COUNTRY + ACCESSIBILITY) */}
          {settingsOpen && (
            <section
              className="player-settings-box"
              aria-label="Configurações de perfil e acessibilidade"
              data-testid="player-settings-panel"
            >
              {!isGuestSession && onChangeOriginCountry && (
                <label className="player-country-select-label">
                  <span>País de origem (bandeira):</span>
                  <select
                    value={originCountryCode || ''}
                    onChange={(e) => onChangeOriginCountry(e.target.value)}
                    className="player-country-select"
                    aria-label="Selecionar país de origem do perfil"
                    data-testid="player-country-select"
                  >
                    <option value="">Órbita Livre</option>
                    {ORIGIN_COUNTRY_OPTIONS.map((opt) => (
                      <option key={opt.code} value={opt.code}>
                        {opt.namePt} ({opt.code})
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <div className="player-a11y-row">
                {onToggleVoice && (
                  <button
                    type="button"
                    className={`copilot-btn ${voiceEnabled ? 'is-on' : ''}`}
                    onClick={onToggleVoice}
                    aria-pressed={voiceEnabled}
                  >
                    {voiceEnabled ? (
                      <Volume2 size={12} aria-hidden="true" />
                    ) : (
                      <VolumeX size={12} aria-hidden="true" />
                    )}
                    <span>Voz</span>
                  </button>
                )}
                {onToggleSonify && (
                  <button
                    type="button"
                    className={`copilot-btn ${sonifyEnabled ? 'is-on' : ''}`}
                    onClick={onToggleSonify}
                    aria-pressed={sonifyEnabled}
                  >
                    <AudioLines size={12} aria-hidden="true" />
                    <span>Som</span>
                  </button>
                )}
                {onToggleHighContrast && (
                  <button
                    type="button"
                    className={`copilot-btn ${highContrast ? 'is-on' : ''}`}
                    onClick={onToggleHighContrast}
                    aria-pressed={highContrast}
                  >
                    <Contrast size={12} aria-hidden="true" />
                    <span>Contraste</span>
                  </button>
                )}
                {onCycleFontScale && (
                  <button
                    type="button"
                    className="copilot-btn"
                    onClick={onCycleFontScale}
                  >
                    <span>Texto {Math.round(fontScale * 100)}%</span>
                  </button>
                )}
              </div>
            </section>
          )}

          {/* SESSION EXIT FOOTER */}
          <div className="player-popover-footer">
            <button
              type="button"
              className="player-logout-btn"
              onClick={() => {
                onClose();
                onLogout();
              }}
              data-testid="logout-btn"
            >
              <LogOut size={13} aria-hidden="true" />
              <span>{isGuestSession ? 'Voltar' : 'Sair da Conta'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
