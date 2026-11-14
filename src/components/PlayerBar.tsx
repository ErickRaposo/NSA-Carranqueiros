import React, { useEffect, useRef, useState } from 'react';
import {
  Disc3,
  Pause,
  Play,
  Repeat,
  RotateCcw,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { formatVideoTime } from '../utils/playerMath';
import { DatasetId } from '../datasets/nasaDatasets';
import {
  AudioReactiveFrame,
  EMPTY_AUDIO_FRAME,
  SoundscapeVisualTelemetry,
} from '../audio/soundscapeEngine';
import { DATASET_TO_STEM, STEM_METAS, STEM_ORDER, StemId } from '../community/unlockStore';

interface PlayerBarProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  isLoop: boolean;
  isReady: boolean;
  enabledDatasetIds: DatasetId[];
  primaryTrackId: DatasetId;
  onChangePrimaryTrack: (id: DatasetId) => void;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onStepFrame: (direction: 1 | -1) => void;
  onChangeRate: (rate: number) => void;
  onToggleLoop: () => void;
  onRestart: () => void;
  jukeboxPlaying?: boolean;
  activeRegionLabel?: string | null;
  soundscapeTelemetry?: SoundscapeVisualTelemetry | null;
  audibleStems?: Record<StemId, boolean>;
  onToggleStemMute?: (stemId: StemId) => void;
  onToggleLayer?: (datasetId: DatasetId) => void;
  masterVolume?: number;
  onChangeMasterVolume?: (vol: number) => void;
  motionPaused?: boolean;
  isCelebrating5of5?: boolean;
  onToggleMotionPaused?: () => void;
  getAudioReactiveBands?: () => AudioReactiveFrame;
}

const RATES = [0.25, 0.5, 1, 2, 4];

export const PlayerBar: React.FC<PlayerBarProps> = ({
  isPlaying,
  currentTime,
  duration,
  playbackRate,
  isLoop,
  isReady,
  enabledDatasetIds,
  primaryTrackId,
  onChangePrimaryTrack,
  onTogglePlay,
  onSeek,
  onStepFrame,
  onChangeRate,
  onToggleLoop,
  onRestart,
  jukeboxPlaying = false,
  activeRegionLabel = null,
  soundscapeTelemetry = null,
  audibleStems,
  onToggleStemMute,
  onToggleLayer,
  masterVolume = 0.72,
  onChangeMasterVolume,
  motionPaused = false,
  isCelebrating5of5 = false,
  onToggleMotionPaused,
  getAudioReactiveBands,
}) => {
  const safeDuration = duration > 0 ? duration : 1;
  const progressPct = Math.min(100, Math.max(0, (currentTime / safeDuration) * 100));
  const anyStemsAudible =
    audibleStems && STEM_ORDER.some((s) => audibleStems[s]);
  const [liveAudio, setLiveAudio] = useState<AudioReactiveFrame>(EMPTY_AUDIO_FRAME);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const optionsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!optionsOpen) return;
    const onDown = (e: MouseEvent) => {
      if (optionsRef.current && !optionsRef.current.contains(e.target as Node)) {
        setOptionsOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOptionsOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [optionsOpen]);

  useEffect(() => {
    if (!jukeboxPlaying || !getAudioReactiveBands) {
      setLiveAudio(EMPTY_AUDIO_FRAME);
      return;
    }
    const id = window.setInterval(() => {
      setLiveAudio(getAudioReactiveBands());
    }, 110);
    return () => window.clearInterval(id);
  }, [getAudioReactiveBands, jukeboxPlaying]);

  const liveCaption =
    activeRegionLabel && soundscapeTelemetry
      ? `Legenda sonora: ${soundscapeTelemetry.melodyNoteName} (Raios) · Acorde ${soundscapeTelemetry.chordName} ${soundscapeTelemetry.modeName} · Pulso ${soundscapeTelemetry.bpm} BPM · Grave ${soundscapeTelemetry.bassCutoffHz} Hz · Brisa ${soundscapeTelemetry.windWetPct}%`
      : null;

  return (
    <div
      className="player-bar player-capsule console-frame"
      data-testid="player-bar"
      role="region"
      aria-label="Barra musical viva e controles do globo"
    >
      {/* COMPACT FLOATING MUSICAL CAPSULE */}
      <div className="player-controls-row">
        <div className="player-left-controls">
          <button
            type="button"
            className="icon-btn primary-play-btn"
            onClick={onTogglePlay}
            title={isPlaying ? 'Pausar camadas (Espaço)' : 'Reproduzir camadas (Espaço)'}
            aria-label={isPlaying ? 'Pausar animação' : 'Reproduzir animação'}
            aria-pressed={isPlaying}
            data-testid="play-pause-btn"
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
          </button>

          <div className="capsule-identity" aria-live="off">
            <Disc3
              size={14}
              className={`ribbon-disc ${jukeboxPlaying ? 'is-spinning' : ''}`}
              aria-hidden="true"
            />
            {activeRegionLabel && soundscapeTelemetry ? (
              <div className="capsule-telemetry">
                <strong className="capsule-region-name">{activeRegionLabel}</strong>
                <span className="capsule-chip" style={{ color: STEM_METAS.harmony.accentHex }}>
                  {soundscapeTelemetry.chordName}
                </span>
                <span className="capsule-chip" style={{ color: STEM_METAS.rhythm.accentHex }}>
                  {soundscapeTelemetry.bpm} BPM
                </span>
                {isCelebrating5of5 && (
                  <span className="ribbon-symphony-pill" data-testid="player-celebrating-5of5">
                    5/5 Sinfonia
                  </span>
                )}
              </div>
            ) : (
              <div className="capsule-telemetry is-idle">
                <span className="capsule-idle-msg">Selecione um país ou acenda camadas</span>
              </div>
            )}
          </div>
        </div>

        <div className="ribbon-spectrum" role="group" aria-label="Alternar as 5 vozes musicais e camadas do globo">
          {STEM_ORDER.map((id, idx) => {
            const meta = STEM_METAS[id];
            const stemLit = activeRegionLabel
              ? Boolean(audibleStems?.[id])
              : enabledDatasetIds.some((dId) => DATASET_TO_STEM[dId] === id);
            const activeAnim = Boolean(
              stemLit && (jukeboxPlaying || (!activeRegionLabel && isPlaying))
            );
            const analyserBoost = jukeboxPlaying ? (liveAudio.bars[idx] ?? 0) * 0.45 : 0;
            const level =
              stemLit && soundscapeTelemetry
                ? Math.min(1, Math.max(0.32, soundscapeTelemetry.stemActivity[id] + analyserBoost))
                : stemLit
                  ? 0.6
                  : 0.16;

            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  if (activeRegionLabel && onToggleStemMute) {
                    onToggleStemMute(id);
                  } else if (onToggleLayer) {
                    onToggleLayer(meta.datasetId);
                  }
                }}
                aria-pressed={stemLit}
                aria-label={`${meta.labelPt} (${meta.instrumentPt}): ${
                  stemLit ? 'Ativa — clique para silenciar ou ocultar' : 'Inativa — clique para ativar'
                }`}
                className={`spectrum-pill ${stemLit ? 'is-lit' : 'is-off'} ${
                  activeAnim ? 'is-dancing' : ''
                }`}
                style={
                  {
                    '--spec-color': meta.accentHex,
                    '--spec-scale': level.toFixed(2),
                    '--spec-delay': `${idx * 90}ms`,
                  } as React.CSSProperties
                }
                title={
                  activeRegionLabel
                    ? `Alternar voz ${meta.labelPt} na região (Tecla ${meta.keyShortcut})`
                    : `Alternar camada ${meta.labelPt} no globo`
                }
                data-testid={`player-stem-btn-${id}`}
              >
                <span className="spectrum-bar" aria-hidden="true" />
                <span className="spectrum-label">{meta.labelPt}</span>
              </button>
            );
          })}
        </div>

        <div className="player-right-controls">
          <span className="time-readout" data-testid="time-readout" aria-live="off">
            {formatVideoTime(currentTime)}
            <span className="muted">/{formatVideoTime(duration)}</span>
          </span>

          {onChangeMasterVolume && (
            <div className="master-volume-group" role="group" aria-label="Controle de volume da música">
              <button
                type="button"
                className="icon-btn"
                onClick={() => onChangeMasterVolume(masterVolume > 0 ? 0 : 0.72)}
                aria-label={masterVolume === 0 ? 'Ativar som da Jukebox' : 'Silenciar som da Jukebox'}
                title={masterVolume === 0 ? 'Ativar áudio' : 'Silenciar áudio'}
              >
                {masterVolume === 0 ? <VolumeX size={14} /> : <Volume2 size={14} />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.02}
                value={masterVolume}
                onChange={(e) => onChangeMasterVolume(Number(e.target.value))}
                className="volume-slider"
                aria-label="Volume principal da Jukebox em porcentagem"
                aria-valuetext={`${Math.round(masterVolume * 100)} por cento`}
                data-testid="master-volume-slider"
              />
            </div>
          )}

          {onToggleMotionPaused && (
            <button
              type="button"
              className={`motion-pause-btn ${motionPaused ? 'is-paused' : ''}`}
              onClick={onToggleMotionPaused}
              aria-pressed={motionPaused}
              title="Pausar órbita automática e animações visuais"
              data-testid="motion-pause-btn"
            >
              <Sparkles size={13} aria-hidden="true" />
              <span>{motionPaused ? 'Retomar' : 'Órbita'}</span>
            </button>
          )}

          <div className="player-options-wrap" ref={optionsRef}>
            <button
              type="button"
              className={`icon-btn ${optionsOpen ? 'is-active' : ''}`}
              onClick={() => setOptionsOpen((v) => !v)}
              aria-expanded={optionsOpen}
              aria-haspopup="true"
              title="Ajustes de velocidade, loop e quadros"
              aria-label="Ajustes de reprodução"
              data-testid="player-options-btn"
            >
              <SlidersHorizontal size={14} aria-hidden="true" />
            </button>

            {optionsOpen && (
              <div
                className="player-options-popover console-frame"
                role="dialog"
                aria-label="Controles avançados de reprodução"
              >
                <div className="popover-section-row">
                  <span className={`telemetry-status ${isReady ? 'ready' : 'loading'}`}>
                    <span className="status-dot" aria-hidden="true" />
                    <span>
                      {jukeboxPlaying && anyStemsAudible
                        ? 'Sinfonia ao vivo'
                        : isReady
                          ? 'NASA Sincronizado'
                          : 'Carregando...'}
                    </span>
                  </span>
                  <div className="popover-transport-btns">
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => onStepFrame(-1)}
                      title="Voltar 1 quadro"
                      aria-label="Voltar 1 quadro"
                    >
                      <SkipBack size={14} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => onStepFrame(1)}
                      title="Avançar 1 quadro"
                      aria-label="Avançar 1 quadro"
                    >
                      <SkipForward size={14} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={onRestart}
                      title="Reiniciar ciclo"
                      aria-label="Reiniciar animação"
                    >
                      <RotateCcw size={14} />
                    </button>
                    <button
                      type="button"
                      className={`icon-btn ${isLoop ? 'is-active' : ''}`}
                      onClick={onToggleLoop}
                      title="Alternar repetição em loop"
                      aria-label="Repetição contínua em loop"
                      aria-pressed={isLoop}
                    >
                      <Repeat size={14} />
                    </button>
                  </div>
                </div>

                <div className="popover-section-row">
                  <span className="track-label">Velocidade</span>
                  <div className="speed-pills" role="group" aria-label="Velocidade de reprodução">
                    {RATES.map((rate) => (
                      <button
                        key={rate}
                        type="button"
                        className={`mini-chip ${playbackRate === rate ? 'active' : ''}`}
                        onClick={() => onChangeRate(rate)}
                        aria-pressed={playbackRate === rate}
                      >
                        {rate}x
                      </button>
                    ))}
                  </div>
                </div>

                {enabledDatasetIds.length > 1 && (
                  <div className="popover-section-row is-wrap">
                    <span className="track-label">Trilha</span>
                    <div className="track-switch" role="group" aria-label="Trilha principal da timeline">
                      {enabledDatasetIds.map((id) => {
                        const stem = STEM_METAS[DATASET_TO_STEM[id]];
                        return (
                          <button
                            key={id}
                            type="button"
                            className={`mini-chip ${primaryTrackId === id ? 'active' : ''}`}
                            style={
                              primaryTrackId === id
                                ? { background: stem.accentHex, color: 'var(--bg-void)' }
                                : undefined
                            }
                            onClick={() => onChangePrimaryTrack(id)}
                            aria-pressed={primaryTrackId === id}
                          >
                            {stem.labelPt}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {liveCaption && (
        <div
          className="sound-caption-bar"
          role="note"
          aria-label="Legenda visual em tempo real do som"
          data-testid="live-sound-caption"
        >
          <span>{liveCaption}</span>
        </div>
      )}

      <div className="timeline-row">
        <input
          type="range"
          min={0}
          max={safeDuration}
          step={0.03}
          value={Math.min(currentTime, safeDuration)}
          onChange={(e) => onSeek(Number(e.target.value))}
          className="timeline-slider"
          aria-label="Posição da linha do tempo em segundos"
          aria-valuetext={`${formatVideoTime(currentTime)} de ${formatVideoTime(duration)}`}
          data-testid="timeline-slider"
          style={{
            background: `linear-gradient(to right, #38bdf8 ${progressPct}%, rgba(161,161,170,0.22) ${progressPct}%)`,
          }}
        />
      </div>
    </div>
  );
};
