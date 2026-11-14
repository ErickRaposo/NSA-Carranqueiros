import React from 'react';
import { Award, CloudOff, LogIn, Sparkles, Trophy, X } from 'lucide-react';
import { CountryFlagBadge } from './CountryFlag';

export interface GlobalRankingEntry {
  position: number;
  explorerName: string;
  username: string;
  originCountryCode?: string;
  xp: number;
  contributionsCount: number;
  achievementsCount: number;
}

interface RankingPopoverProps {
  onClose: () => void;
  isGuestSession: boolean;
  userName: string;
  username: string;
  originCountryCode?: string;
  realXp: number;
  contributionsCount: number;
  achievementsCount: number;
  onOpenAuth?: () => void;
  /** Optional remote backend entries when connected in future releases */
  remoteEntries?: GlobalRankingEntry[] | null;
}

export const RankingPopover: React.FC<RankingPopoverProps> = ({
  onClose,
  isGuestSession,
  userName,
  username,
  originCountryCode,
  realXp,
  contributionsCount,
  achievementsCount,
  onOpenAuth,
  remoteEntries = null,
}) => {
  const isBackendConnected = Array.isArray(remoteEntries) && remoteEntries.length > 0;

  return (
    <div
      className="topbar-popover ranking-global-popover console-frame"
      role="dialog"
      aria-label="Ranking global de exploradores"
      data-testid="ranking-global-popover"
    >
      <div className="topbar-popover-header">
        <div className="topbar-popover-title-group">
          <Trophy size={15} className="ranking-gold-icon" aria-hidden="true" />
          <strong>Ranking Global</strong>
        </div>
        <button
          type="button"
          className="icon-btn-sm"
          onClick={onClose}
          aria-label="Fechar ranking global"
          title="Fechar (Esc)"
          data-testid="close-ranking-popover-btn"
        >
          <X size={14} aria-hidden="true" />
        </button>
      </div>

      <div
        className={`ranking-status-banner ${isBackendConnected ? 'is-online' : 'is-unavailable'}`}
        role="status"
        data-testid="ranking-availability-banner"
      >
        <CloudOff size={14} aria-hidden="true" />
        <div>
          <strong>
            {isBackendConnected
              ? 'Sincronizado com servidor global'
              : 'Ranking Global indisponível no modo local'}
          </strong>
          <p>
            {isBackendConnected
              ? 'Classificação atualizada em tempo real.'
              : 'Nenhum servidor remoto de classificação está conectado nesta sessão. Nenhum dado ou explorador fictício é exibido.'}
          </p>
        </div>
      </div>

      {/* STRUCTURED 5-COLUMN SCHEMA READY FOR REMOTE LEADERBOARD */}
      <div
        className="ranking-table-shell"
        role="table"
        aria-label="Tabela de classificação global"
      >
        <div className="ranking-table-head" role="row">
          <span role="columnheader">Pos.</span>
          <span role="columnheader">Explorador</span>
          <span role="columnheader">XP</span>
          <span role="columnheader" title="Contribuições coletivas realizadas">
            Contrib.
          </span>
          <span role="columnheader" title="Conquistas desbloqueadas">
            Conq.
          </span>
        </div>

        {isBackendConnected ? (
          <div className="ranking-table-body" role="rowgroup">
            {remoteEntries!.map((entry) => (
              <div key={entry.username} className="ranking-table-row" role="row">
                <span role="cell" className="ranking-col-pos">
                  #{entry.position}
                </span>
                <span role="cell" className="ranking-col-user">
                  <CountryFlagBadge code={entry.originCountryCode} showName={false} />
                  <span className="ranking-user-text">
                    <strong>{entry.explorerName}</strong>
                    <small>@{entry.username}</small>
                  </span>
                </span>
                <span role="cell" className="ranking-col-xp">
                  {entry.xp.toLocaleString('pt-BR')}
                </span>
                <span role="cell" className="ranking-col-contrib">
                  {entry.contributionsCount}
                </span>
                <span role="cell" className="ranking-col-ach">
                  {entry.achievementsCount}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="ranking-empty-state" role="rowgroup" data-testid="ranking-empty-state">
            <div role="row" className="ranking-empty-row">
              <span role="cell" className="ranking-empty-copy">
                Aguardando conexão com API global de ranking para listar posições, exploradores, XP, contribuições e conquistas verificadas.
              </span>
            </div>
          </div>
        )}
      </div>

      {/* HONEST LOCAL SUMMARY (NEVER RANKED AS GLOBAL POSITION) */}
      {!isGuestSession ? (
        <div className="ranking-local-self-card" data-testid="ranking-local-self">
          <div className="ranking-local-top">
            <span className="ranking-unranked-tag">Posição global: — (dados locais)</span>
            <CountryFlagBadge code={originCountryCode} showName />
          </div>
          <div className="ranking-local-identity">
            <strong>{userName}</strong>
            <span>@{username}</span>
          </div>
          <div className="ranking-local-metrics">
            <span className="metric-pill is-gold">
              <Sparkles size={11} aria-hidden="true" />
              {realXp.toLocaleString('pt-BR')} XP
            </span>
            <span className="metric-pill is-green">
              {contributionsCount} contrib.
            </span>
            <span className="metric-pill is-cyan">
              <Award size={11} aria-hidden="true" />
              {achievementsCount} conquistas
            </span>
          </div>
        </div>
      ) : (
        <div className="ranking-guest-cta-box">
          <p>
            Visitantes não participam do ranking. Entre ou crie sua conta para registrar sua identidade de explorador.
          </p>
          {onOpenAuth && (
            <button
              type="button"
              className="hud-auth-cta-btn"
              onClick={() => {
                onClose();
                onOpenAuth();
              }}
            >
              <LogIn size={13} aria-hidden="true" />
              <span>Entrar ou Criar Conta</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
