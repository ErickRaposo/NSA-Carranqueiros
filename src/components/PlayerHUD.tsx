import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  FolderHeart,
  KeyRound,
  LogIn,
  LogOut,
  RotateCcw,
  Trophy,
  User,
  UserPlus,
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

export type ParticipantTabId = 'overview' | 'data';

export interface PlayerHUDProps {
  userName: string;
  username: string;
  userEmail?: string;
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
  userEmail = '',
  originCountryCode,
  isGuestSession,
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
  onUpdateProfile,
  onUpdatePassword,
  onExportParticipantData,
  onResetProgression,
  onOpenCollection,
  onOpenRanking,
  onOpenAuth,
  onOpenRegister,
  onLogout,
  isOpen,
  onToggleOpen,
  onClose,
}) => {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const [activeTab, setActiveTab] = useState<ParticipantTabId>('overview');

  // Editable Participant Data state
  const [draftName, setDraftName] = useState(userName);
  const [draftUsername, setDraftUsername] = useState(username);
  const [draftEmail, setDraftEmail] = useState(userEmail);
  const [draftCountry, setDraftCountry] = useState(originCountryCode ?? '');
  const [profileNotice, setProfileNotice] = useState<{
    tone: 'ok' | 'err';
    text: string;
  } | null>(null);

  // Password accordion state
  const [passwordExpanded, setPasswordExpanded] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordNotice, setPasswordNotice] = useState<{
    tone: 'ok' | 'err';
    text: string;
  } | null>(null);

  // Two-step inline local reset confirmation
  const [confirmingReset, setConfirmingReset] = useState(false);

  // Sync draft inputs whenever session identity changes
  useEffect(() => {
    setDraftName(userName);
    setDraftUsername(username);
    setDraftEmail(userEmail);
    setDraftCountry(originCountryCode ?? '');
  }, [originCountryCode, userEmail, userName, username]);

  useEffect(() => {
    if (!isOpen) {
      setProfileNotice(null);
      setPasswordNotice(null);
      setConfirmingReset(false);
      return;
    }
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

  const rankTitle = rank?.title ?? 'Ouvinte Orbital';
  const countryNamePt = getOriginCountryNamePt(originCountryCode);
  const unlockedBadgesCount = badges.filter((b) => b.unlocked).length;
  const missionRatio01 = Math.min(
    1,
    completedMissionsCount / Math.max(1, totalMissionsCount || 5)
  );

  const isProfileDirty =
    draftName.trim() !== userName.trim() ||
    draftUsername.trim().replace(/^@+/, '').toLowerCase() !== username.toLowerCase() ||
    draftEmail.trim().toLowerCase() !== userEmail.trim().toLowerCase() ||
    (draftCountry || '') !== (originCountryCode || '');

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setProfileNotice(null);
    if (!onUpdateProfile) {
      if (onChangeOriginCountry && (draftCountry || '') !== (originCountryCode || '')) {
        onChangeOriginCountry(draftCountry);
        setProfileNotice({ tone: 'ok', text: 'País de origem atualizado.' });
      }
      return;
    }
    const res = onUpdateProfile({
      name: draftName,
      username: draftUsername,
      email: draftEmail,
      originCountryCode: draftCountry || undefined,
    });
    if (!res.ok) {
      setProfileNotice({
        tone: 'err',
        text: res.errorPt ?? 'Não foi possível salvar os dados.',
      });
      return;
    }
    setProfileNotice({ tone: 'ok', text: 'Dados do participante atualizados.' });
  };

  const handleSavePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordNotice(null);
    if (!onUpdatePassword) return;
    const res = onUpdatePassword(currentPassword, newPassword);
    if (!res.ok) {
      setPasswordNotice({
        tone: 'err',
        text: res.errorPt ?? 'Não foi possível alterar a senha.',
      });
      return;
    }
    setCurrentPassword('');
    setNewPassword('');
    setPasswordExpanded(false);
    setPasswordNotice({ tone: 'ok', text: 'Senha atualizada com sucesso.' });
  };

  const ariaLabel = isGuestSession
    ? 'Menu do Participante (Visitante): abrir entrada, cadastro e dados da sessão'
    : `Menu do Participante: ${userName} (@${username}), ${countryNamePt}`;

  return (
    <div className="player-hud-wrap" ref={wrapRef}>
      <button
        ref={triggerRef}
        type="button"
        className={`player-hud-trigger topbar-island ${isOpen ? 'is-open' : ''} ${
          isGuestSession ? 'is-guest' : 'is-authenticated'
        }`}
        onClick={onToggleOpen}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label={ariaLabel}
        title={ariaLabel}
        data-testid="player-hud-trigger"
      >
        <span className="player-avatar-shell" aria-hidden="true">
          {isGuestSession ? (
            <span className="player-avatar-guest">
              <User size={13} />
            </span>
          ) : (
            <span className="player-avatar-auth">{getInitials(userName)}</span>
          )}
        </span>

        <span className="player-identity-inline" data-testid="logged-user-pill">
          {isGuestSession ? (
            <>
              <strong className="player-display-name">Visitante</strong>
              <span className="player-inline-sep" aria-hidden="true">
                ·
              </span>
              <span className="player-subtle-meta">Entrar</span>
            </>
          ) : (
            <>
              <strong className="player-display-name">{userName}</strong>
              <span className="player-username" data-testid="player-hud-username">
                @{username}
              </span>
              {originCountryCode && <CountryFlagBadge code={originCountryCode} compactOnSmall />}
            </>
          )}
        </span>

        <ChevronDown
          size={13}
          className={`player-hud-chevron ${isOpen ? 'is-rotated' : ''}`}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <div
          className="topbar-popover player-hud-popover console-frame"
          role="dialog"
          aria-label="Menu do participante e dados da conta"
          data-testid="player-hud-popover"
        >
          {/* CABEÇALHO SÓBRIO DO PARTICIPANTE */}
          <div className="participant-popover-head">
            <div className="participant-identity-summary">
              <span
                className={`participant-monogram ${isGuestSession ? 'is-guest' : ''}`}
                aria-hidden="true"
              >
                {isGuestSession ? <User size={16} /> : getInitials(userName)}
              </span>
              <div className="participant-identity-text">
                <div className="participant-name-line">
                  <strong>{isGuestSession ? 'Sessão de Visitante' : userName}</strong>
                  {!isGuestSession && <CountryFlagBadge code={originCountryCode} showName />}
                </div>
                <span className="participant-sub-line">
                  {isGuestSession
                    ? 'Acesso livre · sem conta vinculada'
                    : `@${username}${userEmail ? ` · ${userEmail}` : ''}`}
                </span>
              </div>
            </div>

            <button
              type="button"
              className="icon-btn-sm"
              onClick={(e) => {
                const fromKeyboard = e.detail === 0;
                onClose();
                if (fromKeyboard) {
                  requestAnimationFrame(() => triggerRef.current?.focus());
                }
              }}
              aria-label="Fechar menu do participante"
              title="Fechar (Esc)"
              data-testid="close-player-hud-btn"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>

          {/* SELETOR DE ABAS (MESMO VOCABULÁRIO VISUAL DO 3D | 2D) */}
          <div
            className="participant-tabs-bar"
            role="tablist"
            aria-label="Seções do menu do participante"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'overview'}
              className={`participant-tab-btn ${activeTab === 'overview' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('overview')}
              data-testid="participant-tab-overview"
            >
              Resumo
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'data'}
              className={`participant-tab-btn ${activeTab === 'data' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('data')}
              data-testid="participant-tab-data"
            >
              Meus Dados
            </button>
          </div>

          {/* ABA 1 — RESUMO DE TELEMETRIA E ATIVIDADE */}
          {activeTab === 'overview' && (
            <div className="participant-tab-panel" data-testid="participant-panel-overview">
              {isGuestSession && (
                <div className="player-guest-card" data-testid="player-hud-guest-view">
                  <p className="player-card-sub">
                    Entre ou crie sua conta para registrar seu identificador{' '}
                    <strong>@usuário</strong>, país de origem e histórico permanente de camadas
                    colaborativas.
                  </p>
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
                        <LogIn size={13} aria-hidden="true" />
                        <span>Entrar</span>
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
                        <UserPlus size={13} aria-hidden="true" />
                        <span>Criar conta</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* GRADE HAIRLINE DE 3 MÉTRICAS MONOCROMÁTICAS TABULARES */}
              <section
                className="participant-metrics-strip"
                aria-label="Resumo de exploração e contribuições"
              >
                <div className="participant-metric-cell">
                  <strong className="participant-metric-val">{exploredCount}</strong>
                  <span className="participant-metric-lbl">Regiões lidas</span>
                </div>
                <div className="participant-metric-cell">
                  <strong className="participant-metric-val">{contributionsCount}</strong>
                  <span className="participant-metric-lbl">Contribuições</span>
                </div>
                <div className="participant-metric-cell">
                  <strong className="participant-metric-val">{symphoniesCount}</strong>
                  <span className="participant-metric-lbl">Sinfonias 5/5</span>
                </div>
              </section>

              {!isGuestSession && (
                <section className="participant-credential-strip" aria-label="Credencial científica">
                  <div className="participant-credential-row">
                    <span className="participant-credential-title">{rankTitle}</span>
                    <span className="participant-credential-meta">
                      {completedMissionsCount}/{totalMissionsCount || 5} missões ·{' '}
                      {unlockedBadgesCount}/{badges.length || 5} marcos
                    </span>
                  </div>
                  <div className="participant-hairline-track" aria-hidden="true">
                    <div
                      className="participant-hairline-fill"
                      style={{ transform: `scaleX(${missionRatio01})` }}
                    />
                  </div>
                  {sonicPassport?.favoriteStem && (
                    <div className="participant-dominant-row" data-testid="sonic-passport-section">
                      <span
                        className="participant-stem-dot"
                        style={{ background: sonicPassport.favoriteStem.accentHex }}
                        aria-hidden="true"
                      />
                      <span>
                        Camada predominante: <strong>{sonicPassport.favoriteStem.labelPt}</strong>
                      </span>
                    </div>
                  )}
                </section>
              )}

              {/* REGISTROS RECENTES DE CAMADAS */}
              <section className="participant-log-section" aria-label="Contribuições recentes">
                <div className="participant-section-head">
                  <span>Registros no globo</span>
                  <span>{contributionsCount} ativas</span>
                </div>
                {contributionHistory.length > 0 ? (
                  <div className="participant-log-list">
                    {contributionHistory.slice(0, 4).map((item) => (
                      <div key={`${item.regionKey}-${item.stemId}`} className="participant-log-row">
                        <span
                          className="participant-stem-dot"
                          style={{ background: STEM_METAS[item.stemId].accentHex }}
                          aria-hidden="true"
                        />
                        <span className="participant-log-label">
                          {item.regionLabel} · {STEM_METAS[item.stemId].labelPt}
                        </span>
                        <span className="participant-log-status">
                          {item.isRegionComplete5of5 ? '5/5' : 'Ativa'}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="participant-empty-note">
                    Nenhuma camada desbloqueada nesta sessão. Selecione um país no globo para
                    participar.
                  </p>
                )}
              </section>

              {/* DOIS ATALHOS EQUILIBRADOS EM 1 LINHA */}
              <div className="participant-shortcuts-row">
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
                  <span>Diário de Bordo</span>
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
              </div>
            </div>
          )}

          {/* ABA 2 — MEUS DADOS, PERFIL, SEGURANÇA E GOVERNANÇA DE DADOS */}
          {activeTab === 'data' && (
            <div className="participant-tab-panel" data-testid="participant-panel-data">
              {!isGuestSession ? (
                <>
                  <form className="participant-form" onSubmit={handleSaveProfile}>
                    <label className="participant-field">
                      <span className="participant-field-label">Nome de exibição</span>
                      <input
                        type="text"
                        value={draftName}
                        onChange={(e) => {
                          setDraftName(e.target.value);
                          setProfileNotice(null);
                        }}
                        className="participant-input"
                        placeholder="Seu nome"
                        maxLength={48}
                        data-testid="participant-input-name"
                      />
                    </label>

                    <div className="participant-form-grid-2">
                      <label className="participant-field">
                        <span className="participant-field-label">Usuário</span>
                        <div className="participant-input-prefix-wrap">
                          <span aria-hidden="true">@</span>
                          <input
                            type="text"
                            value={draftUsername}
                            onChange={(e) => {
                              setDraftUsername(e.target.value.replace(/^@+/, ''));
                              setProfileNotice(null);
                            }}
                            className="participant-input has-prefix"
                            placeholder="usuario"
                            maxLength={24}
                            data-testid="participant-input-username"
                          />
                        </div>
                      </label>

                      <label className="participant-field">
                        <span className="participant-field-label">País / Região</span>
                        <select
                          value={draftCountry}
                          onChange={(e) => {
                            const nextCode = e.target.value;
                            setDraftCountry(nextCode);
                            setProfileNotice(null);
                          }}
                          className="participant-input participant-select"
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
                    </div>

                    <label className="participant-field">
                      <span className="participant-field-label">E-mail cadastrado</span>
                      <input
                        type="email"
                        value={draftEmail}
                        onChange={(e) => {
                          setDraftEmail(e.target.value);
                          setProfileNotice(null);
                        }}
                        className="participant-input"
                        placeholder="voce@exemplo.com"
                        maxLength={80}
                        data-testid="participant-input-email"
                      />
                    </label>

                    {profileNotice && (
                      <p
                        className={`participant-inline-notice ${
                          profileNotice.tone === 'ok' ? 'is-ok' : 'is-err'
                        }`}
                        role="status"
                        data-testid="participant-profile-notice"
                      >
                        {profileNotice.tone === 'ok' && <Check size={12} aria-hidden="true" />}
                        <span>{profileNotice.text}</span>
                      </p>
                    )}

                    <button
                      type="submit"
                      className="participant-save-btn"
                      disabled={!isProfileDirty}
                      data-testid="participant-save-profile-btn"
                    >
                      Salvar alterações
                    </button>
                  </form>

                  {/* ACORDEÃO DISCRETO DE ALTERAÇÃO DE SENHA */}
                  {onUpdatePassword && (
                    <div className="participant-security-block">
                      <button
                        type="button"
                        className="participant-accordion-trigger"
                        onClick={() => {
                          setPasswordExpanded((v) => !v);
                          setPasswordNotice(null);
                        }}
                        aria-expanded={passwordExpanded}
                        data-testid="participant-password-toggle"
                      >
                        <span className="participant-accordion-left">
                          <KeyRound size={13} aria-hidden="true" />
                          <span>Alterar senha de acesso</span>
                        </span>
                        <ChevronRight
                          size={13}
                          className={`participant-accordion-chevron ${
                            passwordExpanded ? 'is-open' : ''
                          }`}
                          aria-hidden="true"
                        />
                      </button>

                      {passwordExpanded && (
                        <form className="participant-password-form" onSubmit={handleSavePassword}>
                          <input
                            type="password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            className="participant-input"
                            placeholder="Senha atual"
                            autoComplete="current-password"
                            data-testid="participant-current-password"
                          />
                          <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="participant-input"
                            placeholder="Nova senha (mín. 5 caracteres)"
                            autoComplete="new-password"
                            data-testid="participant-new-password"
                          />
                          <button
                            type="submit"
                            className="participant-save-btn"
                            disabled={!currentPassword || newPassword.trim().length < 5}
                            data-testid="participant-save-password-btn"
                          >
                            Atualizar senha
                          </button>
                        </form>
                      )}

                      {passwordNotice && (
                        <p
                          className={`participant-inline-notice ${
                            passwordNotice.tone === 'ok' ? 'is-ok' : 'is-err'
                          }`}
                          role="status"
                        >
                          {passwordNotice.tone === 'ok' && <Check size={12} aria-hidden="true" />}
                          <span>{passwordNotice.text}</span>
                        </p>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="participant-guest-data-note">
                  <p className="player-card-sub">
                    Você está navegando como <strong>Visitante</strong>. Seus dados de leitura ficam
                    armazenados apenas neste navegador e são transferidos automaticamente caso você
                    crie uma conta.
                  </p>
                </div>
              )}

              {/* GOVERNANÇA E PORTABILIDADE DOS DADOS DE EXPLORAÇÃO */}
              <section
                className="participant-governance-section"
                aria-label="Portabilidade e controle dos dados locais"
              >
                <div className="participant-section-head">
                  <span>Portabilidade &amp; Histórico Local</span>
                </div>

                <div className="participant-governance-actions">
                  {onExportParticipantData && (
                    <button
                      type="button"
                      className="participant-utility-btn"
                      onClick={onExportParticipantData}
                      data-testid="participant-export-json-btn"
                    >
                      <Download size={13} aria-hidden="true" />
                      <span>Exportar dados (.json)</span>
                    </button>
                  )}

                  {onResetProgression &&
                    (!confirmingReset ? (
                      <button
                        type="button"
                        className="participant-utility-btn is-subtle-danger"
                        onClick={() => setConfirmingReset(true)}
                        data-testid="participant-reset-trigger-btn"
                      >
                        <RotateCcw size={13} aria-hidden="true" />
                        <span>Limpar leituras locais</span>
                      </button>
                    ) : (
                      <div className="participant-confirm-inline">
                        <button
                          type="button"
                          className="participant-utility-btn is-confirm-danger"
                          onClick={() => {
                            onResetProgression();
                            setConfirmingReset(false);
                          }}
                          data-testid="participant-reset-confirm-btn"
                        >
                          Confirmar limpeza
                        </button>
                        <button
                          type="button"
                          className="participant-utility-btn"
                          onClick={() => setConfirmingReset(false)}
                        >
                          Cancelar
                        </button>
                      </div>
                    ))}
                </div>
              </section>
            </div>
          )}

          {/* RODAPÉ SÓBRIO DE ENCERRAMENTO DE SESSÃO */}
          <div className="participant-popover-footer">
            <button
              type="button"
              className="participant-signout-btn"
              onClick={() => {
                onClose();
                onLogout();
              }}
              data-testid="topbar-logout-btn"
            >
              <LogOut size={13} aria-hidden="true" />
              <span>{isGuestSession ? 'Voltar ao Portal' : 'Encerrar sessão'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
