import React, { useState } from 'react';
import {
  CheckCircle2,
  Compass,
  Eye,
  Lock,
  Pause,
  Play,
  Plus,
  Sparkles,
  Unlock,
  Volume2,
} from 'lucide-react';
import {
  RegionUnlockSummary,
  STEM_METAS,
  STEM_ORDER,
  StemId,
} from '../community/unlockStore';
import { SoundscapeVisualTelemetry } from '../audio/soundscapeEngine';
import { playStemPreviewSample } from '../accessibility/a11yEngine';
import { StemLayerIcon } from './CartographicIcons';

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
  nextIncompleteRegion?: {
    label: string;
    unlockedCount: number;
    onFly: () => void;
  } | null;
}

const STEM_DISCOVERY_INFO: Record<
  StemId,
  {
    friendlyName: string;
    scientificName: string;
    instrumentPt: string;
    addsToSongPt: string;
  }
> = {
  melody: {
    friendlyName: 'Clarões Orbitais',
    scientificName: 'Densidade de Raios (LIS/ISS)',
    instrumentPt: 'Sinos & Piano Cristalino',
    addsToSongPt: 'Acrescenta notas pentatônicas brilhantes a cada relâmpago detectado.',
  },
  harmony: {
    friendlyName: 'Respiração Atmosférica',
    scientificName: 'Monóxido de Carbono (CO)',
    instrumentPt: 'Acordes & Pads Quentes',
    addsToSongPt: 'Preenche a base harmônica traduzindo nuvens de CO em acordes.',
  },
  rhythm: {
    friendlyName: 'Pulso Térmico',
    scientificName: 'Temperatura da Superfície (GEOS-FP)',
    instrumentPt: 'Percussão & Pulso BPM',
    addsToSongPt: 'Define o batimento cardíaco e o andamento (BPM) conforme o calor local.',
  },
  bass: {
    friendlyName: 'Pulso Urbano',
    scientificName: 'Dióxido de Nitrogênio (NO₂)',
    instrumentPt: 'Baixo Sub-Harmônico',
    addsToSongPt: 'Soma profundidade nos graves acompanhando a intensidade urbana.',
  },
  fx: {
    friendlyName: 'Correntes do Planeta',
    scientificName: 'Ventos de Superfície 10m',
    instrumentPt: 'Textura & Brisa Espacial',
    addsToSongPt: 'Envolve a música com ressonância e movimento das massas de ar.',
  },
};

function formatFriendlyMusicalReadout(
  id: StemId,
  t: SoundscapeVisualTelemetry | null
): string {
  if (!t) return 'Sintonizando dados da região...';
  switch (id) {
    case 'melody':
      return `Nota ${t.melodyNoteName} · sinos ao vivo`;
    case 'harmony':
      return `Acorde ${t.chordName} em ${t.keyName}`;
    case 'rhythm':
      return `Pulso em ${t.bpm} BPM`;
    case 'bass':
      return `Fundamental ${t.bassNoteName} (${t.bassStyle})`;
    case 'fx':
      return `Brisa a ${t.windSpeedMsApprox.toFixed(0)} m/s`;
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
  nextIncompleteRegion = null,
}) => {
  const [demoPreviewStem, setDemoPreviewStem] = useState<StemId | null>(null);

  const {
    unlockedCount,
    realUnlockedCount,
    totalCount,
    unlockedStems,
    realUnlockedStems,
    isCompleteReal,
    userAlreadyContributedStem,
    record,
  } = unlockSummary;

  const nextDormantStem = STEM_ORDER.find((id) => !realUnlockedStems[id]) ?? null;

  const handlePlayDormantDemo = (stemId: StemId) => {
    setDemoPreviewStem(stemId);
    playStemPreviewSample(stemId);
    window.setTimeout(() => {
      setDemoPreviewStem((curr) => (curr === stemId ? null : curr));
    }, 950);
  };

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
        </div>
      )}

      {/* PROTAGONIST AUDIO TRANSPORT CTA */}
      <div className="jukebox-transport-row">
        <button
          type="button"
          className={`action-btn-primary jukebox-play-cta ${jukeboxPlaying ? 'is-playing' : ''}`}
          onClick={onToggleJukeboxPlay}
          aria-pressed={jukeboxPlaying}
          data-testid="jukebox-play-btn"
        >
          {jukeboxPlaying ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
          <span>{jukeboxPlaying ? 'Pausar Música (J)' : 'Tocar Região (J)'}</span>
        </button>

        <button
          type="button"
          className="action-btn-secondary"
          onClick={onExplainMusic}
          data-testid="jukebox-explain-btn"
          title="Ouvir explicação em áudio de quais elementos do mapa geraram esta música (Tecla E)"
        >
          <Volume2 size={14} aria-hidden="true" />
          <span>Explicar (E)</span>
        </button>
      </div>

      {/* SEÇÃO B: PROGRESSO DA SINFONIA COLETIVA */}
      <section
        className={`collective-box ${isCompleteReal ? 'is-celebrating' : ''}`}
        aria-label="Progresso da sinfonia coletiva"
      >
        <div className="collective-header">
          <span className="collective-title">
            Sinfonia Coletiva: {realUnlockedCount}/{totalCount} vozes reais
          </span>
          <span
            className={`collective-state-tag ${
              isCompleteReal ? 'is-full' : juryUnlockAll ? 'is-demo' : ''
            }`}
          >
            {isCompleteReal ? (
              <>
                <Sparkles size={11} aria-hidden="true" /> Sinfonia 5/5 ★
              </>
            ) : juryUnlockAll ? (
              'Modo Demo (Júri)'
            ) : (
              `${5 - realUnlockedCount} adormecidas`
            )}
          </span>
        </div>

        <div className="collective-segments" aria-hidden="true">
          {STEM_ORDER.map((id) => {
            const hex = STEM_METAS[id].accentHex;
            const isReal = realUnlockedStems[id];
            const isDemoOnly = juryUnlockAll && !isReal;
            return (
              <span
                key={id}
                className={`collective-seg ${isReal ? 'is-lit' : ''} ${
                  isDemoOnly ? 'is-demo-lit' : ''
                }`}
                style={
                  isReal
                    ? { background: hex, borderColor: hex }
                    : isDemoOnly
                      ? {
                          background: `color-mix(in srgb, ${hex} 28%, transparent)`,
                          borderColor: hex,
                          borderStyle: 'dashed',
                        }
                      : undefined
                }
              />
            );
          })}
        </div>

        {unlockFeedback && (
          <p className="collective-feedback" role="status">
            {unlockFeedback}
          </p>
        )}
      </section>

      {/* SEÇÃO C: FREQUÊNCIAS ADORMECIDAS & DESCOBERTAS */}
      <section className="stems-section" aria-label={`Frequências de ${regionLabel}`}>
        <div className="stems-section-head">
          <span>Frequências e Descobertas</span>
          <small>{unlockedCount}/5 audíveis</small>
        </div>

        <div className="stems-list" role="list">
          {STEM_ORDER.map((id) => {
            const meta = STEM_METAS[id];
            const info = STEM_DISCOVERY_INFO[id];
            const isRealUnlocked = realUnlockedStems[id];
            const isDemoOnly = juryUnlockAll && !isRealUnlocked;
            const isAudioAvailable = unlockedStems[id];
            const isMutedByUser = stemUserMuted[id];
            const isAudible = isAudioAvailable && !isMutedByUser;
            const contributor = record?.contributions[id];
            const activity01 = isAudible ? telemetry?.stemActivity[id] ?? 0.42 : 0;
            const isPreviewingThis = demoPreviewStem === id;

            return (
              <div
                key={id}
                role="listitem"
                className={`stem-row ${
                  isRealUnlocked
                    ? 'is-unlocked'
                    : isDemoOnly
                      ? 'is-demo-preview'
                      : 'is-locked'
                } ${isAudible ? 'is-audible' : ''}`}
                style={{ '--stem-accent': meta.accentHex } as React.CSSProperties}
                data-testid={`stem-row-${id}`}
              >
                <div className="stem-row-top">
                  <div className="stem-identity">
                    <span
                      className="stem-color-badge"
                      style={{
                        background: isRealUnlocked
                          ? meta.accentHex
                          : isDemoOnly
                            ? `color-mix(in srgb, ${meta.accentHex} 24%, transparent)`
                            : 'rgba(255,255,255,0.06)',
                        color: isRealUnlocked ? '#090a0d' : meta.accentHex,
                      }}
                      title={`Atalho teclado ${meta.keyShortcut}`}
                    >
                      <StemLayerIcon stem={id} size={13} />
                    </span>
                    <div className="stem-titles">
                      <span className="stem-name">
                        {meta.labelPt} · <small>{info.friendlyName}</small>
                      </span>
                      <span className="stem-science-sub">
                        {info.scientificName} · {info.instrumentPt}
                      </span>
                    </div>
                  </div>

                  {/* CLEAR 4-STATE CONTROLS */}
                  {isRealUnlocked ? (
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
                        style={
                          !isMutedByUser
                            ? { background: meta.accentHex, color: '#090a0d' }
                            : undefined
                        }
                        onClick={() => onToggleStemMute(id)}
                        aria-pressed={!isMutedByUser}
                        data-testid={`stem-mute-${id}`}
                      >
                        {isMutedByUser ? 'Mudo' : 'Ativa'}
                      </button>
                    </div>
                  ) : isDemoOnly ? (
                    <div className="stem-actions">
                      <span className="stem-demo-pill">Prévia Demo</span>
                      <button
                        type="button"
                        className={`tiny-btn ${isMutedByUser ? '' : 'is-on'}`}
                        onClick={() => onToggleStemMute(id)}
                        aria-pressed={!isMutedByUser}
                        data-testid={`stem-mute-${id}`}
                      >
                        {isMutedByUser ? 'Mudo' : 'Demo'}
                      </button>
                    </div>
                  ) : (
                    <div className="stem-actions">
                      <button
                        type="button"
                        className={`tiny-btn stem-demo-btn ${isPreviewingThis ? 'is-on' : ''}`}
                        onClick={() => handlePlayDormantDemo(id)}
                        data-testid={`stem-demo-${id}`}
                        title="Ouvir demonstração musical desta frequência (não desbloqueia a camada)"
                      >
                        <Eye size={11} aria-hidden="true" />
                        <span>{isPreviewingThis ? 'Ouvindo...' : 'Prévia'}</span>
                      </button>

                      {userAlreadyContributedStem ? (
                        <span
                          className="stem-contributed-lock"
                          title={`Sua contribuição aqui já iluminou ${STEM_METAS[userAlreadyContributedStem].labelPt}`}
                          data-testid={`stem-locked-${id}`}
                        >
                          <Lock size={11} aria-hidden="true" />
                          <span>1 voz/região</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="stem-unlock-btn"
                          style={{ background: meta.accentHex, color: '#090a0d' }}
                          onClick={() => onContributeStem(id)}
                          data-testid={`stem-unlock-${id}`}
                          title={`Acender ${meta.labelPt} nesta região para a comunidade`}
                        >
                          <span>Acender</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* PHENOMENON EXPLANATION OR LIVE READOUT */}
                <p className="stem-phenomenon-copy">
                  {isRealUnlocked
                    ? formatFriendlyMusicalReadout(id, telemetry)
                    : isPreviewingThis
                      ? `Demonstração sonora ativa (não conta como desbloqueio) — ${info.addsToSongPt}`
                      : info.addsToSongPt}
                </p>

                <div className="stem-readout-row">
                  <span
                    className="stem-state-badge"
                    style={{
                      color: isRealUnlocked
                        ? meta.accentHex
                        : isDemoOnly
                          ? '#fcd34d'
                          : 'var(--text-muted)',
                    }}
                  >
                    {isRealUnlocked ? (
                      <>
                        <CheckCircle2 size={11} aria-hidden="true" /> Desbloqueada no coletivo
                      </>
                    ) : isDemoOnly ? (
                      'Demonstração Júri (não é contribuição real)'
                    ) : userAlreadyContributedStem ? (
                      'Adormecida · aguardando outro explorador'
                    ) : (
                      'Frequência adormecida · disponível para acender'
                    )}
                  </span>

                  {contributor && (
                    <span className="stem-contributor" title={`Acendida por ${contributor.contributorName}`}>
                      <span
                        className="stem-contributor-dot"
                        style={{ background: meta.accentHex }}
                        aria-hidden="true"
                      />
                      {contributor.contributorName}
                    </span>
                  )}
                </div>

                <div className="stem-meter-track" aria-hidden="true">
                  <div
                    className="stem-meter-fill"
                    style={{
                      transform: `scaleX(${Math.min(1, Math.max(0, activity01))})`,
                      background: meta.accentHex,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* SEÇÃO D: PRÓXIMA MISSÃO E JORNADA PLANETÁRIA */}
      <section className="next-mission-box" aria-label="Próxima missão nesta região">
        <div className="next-mission-header">
          <span>Próxima missão</span>
          <strong>
            {isCompleteReal ? 'Sinfonia 5/5 Completa' : `${realUnlockedCount}/5 vozes`}
          </strong>
        </div>

        {isCompleteReal ? (
          <div className="next-mission-action-row">
            <p className="next-mission-copy">
              Todas as 5 frequências de {regionLabel} estão iluminadas! Continue a jornada despertando outra região do planeta:
            </p>
            {nextIncompleteRegion && (
              <button
                type="button"
                className="primary-glow-btn launchpad-cta-sm"
                onClick={nextIncompleteRegion.onFly}
                data-testid="jump-next-region-btn"
              >
                <Compass size={13} aria-hidden="true" />
                <span>
                  Viajar para {nextIncompleteRegion.label} ({nextIncompleteRegion.unlockedCount}/5)
                </span>
              </button>
            )}
          </div>
        ) : userAlreadyContributedStem && nextDormantStem ? (
          <div className="next-mission-action-row">
            <p className="next-mission-copy">
              Sua voz já iluminou <strong>{STEM_METAS[userAlreadyContributedStem].labelPt}</strong> aqui! Enquanto a comunidade desperta as demais ({5 - realUnlockedCount} restantes), explore outra região:
            </p>
            {nextIncompleteRegion && (
              <button
                type="button"
                className="primary-glow-btn launchpad-cta-sm"
                onClick={nextIncompleteRegion.onFly}
                data-testid="jump-next-region-btn"
              >
                <Compass size={13} aria-hidden="true" />
                <span>
                  Despertar {nextIncompleteRegion.label} ({nextIncompleteRegion.unlockedCount}/5)
                </span>
              </button>
            )}
          </div>
        ) : nextDormantStem ? (
          <div className="next-mission-action-row">
            <p className="next-mission-copy">
              Faltam {5 - realUnlockedCount} frequências. Acenda{' '}
              <strong>{STEM_METAS[nextDormantStem].labelPt}</strong> ({STEM_DISCOVERY_INFO[nextDormantStem].friendlyName}) para despertar mais uma voz de {regionLabel}.
            </p>
            {!juryUnlockAll && (
              <button
                type="button"
                className="stem-unlock-btn"
                style={{
                  background: STEM_METAS[nextDormantStem].accentHex,
                  color: '#090a0d',
                }}
                onClick={() => onContributeStem(nextDormantStem)}
              >
                <span>Acender {STEM_METAS[nextDormantStem].labelPt}</span>
              </button>
            )}
          </div>
        ) : null}
      </section>

      {/* DISCREET PRESENTATION / JURY SIMULATION FOOTER STRIP */}
      <div className="jury-tools-strip" role="group" aria-label="Modo de apresentação e simulação comunitária">
        <span className="jury-tools-label">Modo Apresentação:</span>
        <div className="jury-tools-btns">
          <button
            type="button"
            className={`jukebox-chip-btn ${juryUnlockAll ? 'is-active' : ''}`}
            onClick={onToggleJuryUnlockAll}
            aria-pressed={juryUnlockAll}
            data-testid="jury-unlock-all-btn"
            title="Alternar prévia demonstrativa com as 5 frequências audíveis para o júri (não altera o desbloqueio real)"
          >
            <Unlock size={11} aria-hidden="true" />
            <span>{juryUnlockAll ? 'Sair Demo 5/5' : 'Prévia 5/5 (Júri)'}</span>
          </button>

          {!juryUnlockAll && realUnlockedCount < 5 && (
            <button
              type="button"
              className="jukebox-chip-btn"
              onClick={onSimulateCollectiveNext}
              data-testid="simulate-collective-btn"
              title="Simular a chegada de outro membro da comunidade (+1 camada)"
            >
              <Plus size={11} aria-hidden="true" />
              <span>+1 Coletivo</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
