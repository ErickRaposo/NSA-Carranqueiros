import React from 'react';
import { Lock, Pause, Play, Sparkles, Unlock, Volume2 } from 'lucide-react';
import {
  IsothermIcon,
  LightningBoltIcon,
  No2MoleculeIcon,
  SpectralBandIcon,
  WindBarbIcon,
} from './CartographicIcons';
import {
  RegionUnlockSummary,
  STEM_METAS,
  STEM_ORDER,
  StemId,
} from '../community/unlockStore';
import { SoundscapeVisualTelemetry } from '../audio/soundscapeEngine';

interface JukeboxPanelProps {
  regionLabel: string;
  isRadiusMode: boolean;
  radiusKm: number;
  onChangeRadiusKm: (km: number) => void;
  jukeboxPlaying: boolean;
  onToggleJukeboxPlay: () => void;
  onExplainMusic: () => void;
  telemetry: SoundscapeVisualTelemetry | null;
  unlockSummary: RegionUnlockSummary;
  juryUnlockAll: boolean;
  onToggleJuryUnlockAll: () => void;
  onContributeStem: (stemId: StemId) => void;
  onSimulateCollectiveNext: () => void;
  stemUserMuted: Record<StemId, boolean>;
  onToggleStemMute: (stemId: StemId) => void;
  onSoloStem: (stemId: StemId) => void;
  unlockFeedback: string | null;
}

function StemIcon({ id }: { id: StemId }) {
  switch (id) {
    case 'melody':
      return <LightningBoltIcon size={14} className="accent-amber" />;
    case 'harmony':
      return <SpectralBandIcon size={14} className="accent-orange" />;
    case 'rhythm':
      return <IsothermIcon size={14} className="accent-rose" />;
    case 'bass':
      return <No2MoleculeIcon size={14} className="accent-emerald" />;
    case 'fx':
      return <WindBarbIcon size={14} className="accent-cyan" />;
  }
}

function formatStemReadout(id: StemId, t: SoundscapeVisualTelemetry | null): string {
  if (!t) return 'Analisando mapa...';
  switch (id) {
    case 'melody': {
      const panTag =
        t.melodyPan < -0.2 ? 'Oeste L' : t.melodyPan > 0.2 ? 'Leste R' : 'Centro';
      return `${t.melodyNoteName} · ${panTag}`;
    }
    case 'harmony':
      return `${t.chordName} (${t.keyName})`;
    case 'rhythm':
      return `${t.bpm} BPM`;
    case 'bass':
      return `${t.bassNoteName} | ${t.bassCutoffHz}Hz (${t.bassStyle})`;
    case 'fx':
      return `Wet ${t.windWetPct}% · ${t.windSpeedMsApprox} m/s`;
  }
}

export const JukeboxPanel: React.FC<JukeboxPanelProps> = ({
  regionLabel,
  isRadiusMode,
  radiusKm,
  onChangeRadiusKm,
  jukeboxPlaying,
  onToggleJukeboxPlay,
  onExplainMusic,
  telemetry,
  unlockSummary,
  juryUnlockAll,
  onToggleJuryUnlockAll,
  onContributeStem,
  onSimulateCollectiveNext,
  stemUserMuted,
  onToggleStemMute,
  onSoloStem,
  unlockFeedback,
}) => {
  const { unlockedCount, totalCount, unlockedStems, userAlreadyContributedStem, record } =
    unlockSummary;

  return (
    <div className="jukebox-panel" data-testid="jukebox-panel">
      {/* RADIUS SLIDER WHEN IN CUSTOM RADIUS MODE */}
      {isRadiusMode && (
        <div className="jukebox-radius-box">
          <div className="jukebox-radius-header">
            <span>Raio de captura sonora</span>
            <strong>{radiusKm.toLocaleString('pt-BR')} km</strong>
          </div>
          <input
            type="range"
            min={300}
            max={2500}
            step={100}
            value={radiusKm}
            onChange={(e) => onChangeRadiusKm(Number(e.target.value))}
            className="blend-slider"
            aria-label="Definir raio geográfico em quilômetros"
            data-testid="radius-km-slider"
          />
          <p className="jukebox-micro-note">
            Clique em qualquer ponto do globo/mapa para reposicionar o círculo de leitura musical.
          </p>
        </div>
      )}

      {/* COLLECTIVE UNLOCK PROGRESS & JURY DEMO BAR */}
      <section className="collective-box" aria-label="Progresso de desbloqueio coletivo da região">
        <div className="collective-header">
          <span className="collective-title">
            Mapa Coletivo: {unlockedCount}/{totalCount} camadas iluminadas
          </span>
          <span className={`collective-state-tag ${unlockedCount >= 5 ? 'is-full' : ''}`}>
            {unlockedCount >= 5 ? 'Sinfonia Completa' : 'Aguardando Coletivo'}
          </span>
        </div>

        <div className="collective-segments" aria-hidden="true">
          {STEM_ORDER.map((id) => (
            <span
              key={id}
              className={`collective-seg ${unlockedStems[id] ? 'is-lit' : ''}`}
              style={
                unlockedStems[id] ? { borderColor: STEM_METAS[id].accentHex } : undefined
              }
            />
          ))}
        </div>

        <div className="collective-jury-row">
          <button
            type="button"
            className={`jukebox-chip-btn ${juryUnlockAll ? 'is-active' : ''}`}
            onClick={onToggleJuryUnlockAll}
            aria-pressed={juryUnlockAll}
            data-testid="jury-unlock-all-btn"
            title="Alternar modo demonstração para o júri liberando todas as 5 camadas"
          >
            <Unlock size={12} aria-hidden="true" />
            <span>{juryUnlockAll ? 'Modo Júri: Tudo Liberado' : 'Liberar Tudo (Júri)'}</span>
          </button>

          {!juryUnlockAll && unlockedCount < 5 && (
            <button
              type="button"
              className="jukebox-chip-btn"
              onClick={onSimulateCollectiveNext}
              data-testid="simulate-collective-btn"
              title="Simular a contribuição de outro membro da comunidade (+1 camada)"
            >
              <Sparkles size={12} aria-hidden="true" />
              <span>+1 Coletivo</span>
            </button>
          )}
        </div>

        {unlockFeedback && (
          <p className="collective-feedback" role="status">
            {unlockFeedback}
          </p>
        )}
      </section>

      {/* JUKEBOX PLAYBACK & VOICE EXPLANATION CONTROLS */}
      <div className="jukebox-transport-row">
        <button
          type="button"
          className={`action-btn-primary ${jukeboxPlaying ? 'is-playing' : ''}`}
          onClick={onToggleJukeboxPlay}
          aria-pressed={jukeboxPlaying}
          data-testid="jukebox-play-btn"
        >
          {jukeboxPlaying ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
          <span>{jukeboxPlaying ? 'Pausar Jukebox (J)' : 'Tocar Região (J)'}</span>
        </button>

        <button
          type="button"
          className="action-btn-secondary"
          onClick={onExplainMusic}
          data-testid="jukebox-explain-btn"
          title="Ouvir explicação em áudio de quais elementos do mapa geraram esta música (Tecla E)"
        >
          <Volume2 size={14} aria-hidden="true" />
          <span>Explicar Som (E)</span>
        </button>
      </div>

      {/* 5-STEM 1:1 BREAKDOWN LIST */}
      <div className="stems-list" role="list" aria-label={`Instrumentos 1 para 1 de ${regionLabel}`}>
        {STEM_ORDER.map((id) => {
          const meta = STEM_METAS[id];
          const isUnlocked = unlockedStems[id];
          const isMutedByUser = stemUserMuted[id];
          const isAudible = isUnlocked && !isMutedByUser;
          const contributor = record?.contributions[id];
          const activity01 = isAudible ? telemetry?.stemActivity[id] ?? 0.35 : 0;

          return (
            <div
              key={id}
              role="listitem"
              className={`stem-row ${isUnlocked ? 'is-unlocked' : 'is-locked'} ${isAudible ? 'is-audible' : ''}`}
              data-testid={`stem-row-${id}`}
            >
              <div className="stem-row-top">
                <div className="stem-identity">
                  <span className="stem-key-cap" title={`Atalho teclado ${meta.keyShortcut}`}>
                    {meta.keyShortcut}
                  </span>
                  <StemIcon id={id} />
                  <div className="stem-titles">
                    <span className="stem-name">
                      {meta.labelPt} · <small>{meta.layerNamePt}</small>
                    </span>
                    <span className="stem-instrument">{meta.instrumentPt}</span>
                  </div>
                </div>

                {isUnlocked ? (
                  <div className="stem-actions">
                    <button
                      type="button"
                      className="tiny-btn"
                      onClick={() => onSoloStem(id)}
                      title={`Ouvir somente ${meta.labelPt}`}
                      data-testid={`stem-solo-${id}`}
                    >
                      Solo
                    </button>
                    <button
                      type="button"
                      className={`tiny-btn ${isMutedByUser ? '' : 'is-on'}`}
                      onClick={() => onToggleStemMute(id)}
                      aria-pressed={!isMutedByUser}
                      data-testid={`stem-mute-${id}`}
                    >
                      {isMutedByUser ? 'Mudo' : 'Ativo'}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="stem-unlock-btn"
                    onClick={() => onContributeStem(id)}
                    data-testid={`stem-unlock-${id}`}
                    title={
                      userAlreadyContributedStem
                        ? `Você já contribuiu com ${STEM_METAS[userAlreadyContributedStem].labelPt} nesta região`
                        : `Contribuir desbloqueando ${meta.labelPt} nesta região`
                    }
                  >
                    <Lock size={11} aria-hidden="true" />
                    <span>Liberar</span>
                  </button>
                )}
              </div>

              <div className="stem-readout-row">
                <span className="stem-live-badge" style={{ color: isUnlocked ? meta.accentHex : undefined }}>
                  {isUnlocked ? formatStemReadout(id, telemetry) : 'Camada bloqueada — contribua com o coletivo'}
                </span>
                {contributor && !juryUnlockAll && (
                  <span className="stem-contributor">por {contributor.contributorName}</span>
                )}
              </div>

              <div className="stem-meter-track" aria-hidden="true">
                <div
                  className="stem-meter-fill"
                  style={{
                    width: `${Math.round(activity01 * 100)}%`,
                    background: meta.accentHex,
                  }}
                />
              </div>

              <p className="stem-visual-rule">{meta.visualRulePt}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
