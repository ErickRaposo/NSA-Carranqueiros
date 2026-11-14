import React from 'react';
import {
  Pause,
  Play,
  Repeat,
  RotateCcw,
  SkipBack,
  SkipForward,
} from 'lucide-react';
import { formatVideoTime } from '../utils/playerMath';
import { DatasetId, NASA_DATASETS } from '../datasets/nasaDatasets';

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
}) => {
  const safeDuration = duration > 0 ? duration : 1;
  const progressPct = Math.min(100, Math.max(0, (currentTime / safeDuration) * 100));

  return (
    <div
      className="player-bar console-frame"
      data-testid="player-bar"
      role="region"
      aria-label="Controles do reprodutor de animação científica"
    >
      <div className="player-controls-row">
        <div className="player-left-controls">
          <button
            type="button"
            className="icon-btn primary-play-btn"
            onClick={onTogglePlay}
            title={isPlaying ? 'Pausar (Espaço)' : 'Reproduzir (Espaço)'}
            aria-label={isPlaying ? 'Pausar animação' : 'Reproduzir animação'}
            aria-pressed={isPlaying}
            data-testid="play-pause-btn"
          >
            {isPlaying ? <Pause size={18} /> : <Play size={18} />}
          </button>

          <button
            type="button"
            className="icon-btn"
            onClick={() => onStepFrame(-1)}
            title="Voltar 1 quadro"
            aria-label="Voltar 1 quadro"
          >
            <SkipBack size={15} />
          </button>

          <button
            type="button"
            className="icon-btn"
            onClick={() => onStepFrame(1)}
            title="Avançar 1 quadro"
            aria-label="Avançar 1 quadro"
          >
            <SkipForward size={15} />
          </button>

          <button
            type="button"
            className="icon-btn"
            onClick={onRestart}
            title="Reiniciar animação"
            aria-label="Reiniciar animação"
          >
            <RotateCcw size={15} />
          </button>

          <span className="time-readout" data-testid="time-readout" aria-live="off">
            {formatVideoTime(currentTime)}{' '}
            <span className="muted">/ {formatVideoTime(duration)}</span>
          </span>

          <span className={`telemetry-status ${isReady ? 'ready' : 'loading'}`}>
            <span className="status-dot" aria-hidden="true" />
            <span>{isReady ? 'Sincronizado' : 'Carregando vídeo...'}</span>
          </span>
        </div>

        <div className="player-right-controls">
          {enabledDatasetIds.length > 1 && (
            <div className="track-switch" role="group" aria-label="Trilha principal da timeline">
              <span className="track-label">Timeline:</span>
              {enabledDatasetIds.map((id) => (
                <button
                  key={id}
                  type="button"
                  className={`mini-chip ${primaryTrackId === id ? 'active' : ''}`}
                  onClick={() => onChangePrimaryTrack(id)}
                  aria-pressed={primaryTrackId === id}
                >
                  {NASA_DATASETS[id].svsId.replace('SVS ', '')}
                </button>
              ))}
            </div>
          )}

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

          <button
            type="button"
            className={`icon-btn ${isLoop ? 'is-active' : ''}`}
            onClick={onToggleLoop}
            title="Alternar repetição em loop"
            aria-label="Repetição contínua em loop"
            aria-pressed={isLoop}
          >
            <Repeat size={15} />
          </button>
        </div>
      </div>

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
            background: `linear-gradient(to right, #38bdf8 ${progressPct}%, rgba(148,163,184,0.25) ${progressPct}%)`,
          }}
        />
      </div>
    </div>
  );
};
