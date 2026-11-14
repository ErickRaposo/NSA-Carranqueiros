import React from 'react';
import { AudioLines, Minimize2, Orbit, Volume2 } from 'lucide-react';
import { MineiroOrbIcon } from './CartographicIcons';
import { CountryEntry } from '../geo/countries';
import { Mineiro3D } from './Mineiro3D';

interface AstronautCopilotProps {
  selectedCountry: CountryEntry | null;
  voiceEnabled: boolean;
  sonifyEnabled: boolean;
  liveAnnouncement: string;
  onSpeakNow: () => void;
  onToggleSonify: () => void;
  onReopenTour: () => void;
  onMinimize: () => void;
}

export const AstronautCopilot: React.FC<AstronautCopilotProps> = ({
  selectedCountry,
  voiceEnabled,
  sonifyEnabled,
  liveAnnouncement,
  onSpeakNow,
  onToggleSonify,
  onReopenTour,
  onMinimize,
}) => {
  const stepIndex = selectedCountry ? 2 : 1;

  return (
    <aside
      className="copilot-dock console-frame"
      aria-label="Guia 3D MINEIRØ interativo"
      data-testid="astronaut-copilot"
    >
      <div className="copilot-header">
        <span className="copilot-badge font-display">
          <MineiroOrbIcon size={13} />
          <span>MINEIRØ // Guia</span>
        </span>
        <button
          type="button"
          className="icon-btn-sm"
          onClick={onMinimize}
          aria-label="Minimizar Guia MINEIRØ"
          title="Minimizar Guia MINEIRØ"
        >
          <Minimize2 size={13} aria-hidden="true" />
        </button>
      </div>

      <div className="copilot-body">
        <div className="copilot-stage">
          <Mineiro3D
            stepIndex={stepIndex}
            isExplaining={voiceEnabled || Boolean(selectedCountry)}
            size="compact"
          />
        </div>

        <div className="copilot-info">
          <p className="copilot-title font-display">
            {selectedCountry
              ? `Foco: ${selectedCountry.namePt}`
              : 'Navegando pelo globo'}
          </p>
          <p className="copilot-speech" title={liveAnnouncement}>
            {liveAnnouncement}
          </p>

          <div className="copilot-actions">
            <button
              type="button"
              className="copilot-btn primary"
              onClick={onSpeakNow}
              title="Ouvir posição e leitura atual (R)"
            >
              <Volume2 size={13} aria-hidden="true" />
              <span>Ouvir (R)</span>
            </button>

            <button
              type="button"
              className={`copilot-btn ${sonifyEnabled ? 'is-on' : ''}`}
              onClick={onToggleSonify}
              aria-pressed={sonifyEnabled}
              title="Alternar sonificação de dados (S)"
            >
              <AudioLines size={13} aria-hidden="true" />
              <span>Som (S)</span>
            </button>

            <button
              type="button"
              className="copilot-btn"
              onClick={onReopenTour}
              title="Abrir novamente o tour de introdução com o MINEIRØ"
            >
              <Orbit size={13} aria-hidden="true" />
              <span>Tour</span>
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
