import React, { useState } from 'react';
import {
  AudioLines,
  Contrast,
  PanelRightClose,
  PanelRightOpen,
  User,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { CountryEntry } from '../geo/countries';
import { formatLatLon } from '../geo/projection';
import { HoverInfo } from './EarthCanvas';

interface AstronautCopilotProps {
  selectedCountry: CountryEntry | null;
  userName: string;
  approxAltKm: number;
  hoverInfo: HoverInfo | null;
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
  approxAltKm,
  hoverInfo,
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
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`right-side-panel console-frame ${collapsed ? 'is-collapsed' : ''}`}
      aria-label="Painel lateral de guia e acessibilidade"
      data-testid="astronaut-copilot"
    >
      <div className="panel-header">
        <div className="panel-title-row">
          <span>Guia</span>
        </div>
        <button
          type="button"
          className="icon-btn"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? 'Expandir painel lateral' : 'Recolher painel lateral'}
          aria-expanded={!collapsed}
          title={collapsed ? 'Expandir painel lateral' : 'Recolher painel lateral'}
        >
          {collapsed ? <PanelRightOpen size={14} aria-hidden="true" /> : <PanelRightClose size={14} aria-hidden="true" />}
        </button>
      </div>

      {!collapsed && (
        <div className="panel-body">
          <div className="copilot-user-row">
            <span
              className="copilot-user-tag"
              title={`Sessão ativa: ${userName}`}
              data-testid="logged-user-pill"
            >
              <User size={12} aria-hidden="true" />
              <span>{userName}</span>
            </span>
          </div>

          <div className="copilot-info-box">
            <p className="copilot-title font-display">
              {selectedCountry
                ? `Explorando ${selectedCountry.namePt}`
                : 'Mapa global'}
            </p>
            <p className="copilot-speech" title={liveAnnouncement}>
              {liveAnnouncement}
            </p>
          </div>

          <div className="copilot-meta-row">
            <div className="copilot-meta-cell">
              <span className="copilot-meta-label">Altitude</span>
              <strong className="copilot-meta-value">
                {approxAltKm.toLocaleString('pt-BR')} km
              </strong>
            </div>
            <div className="copilot-meta-cell">
              <span className="copilot-meta-label">Posição</span>
              <strong className="copilot-meta-value">
                {hoverInfo ? formatLatLon(hoverInfo.lat, hoverInfo.lon) : 'Mova o cursor'}
              </strong>
            </div>
          </div>

          <div className="copilot-controls-grid" role="group" aria-label="Acessibilidade e guia">
            <button
              type="button"
              className={`copilot-btn ${voiceEnabled ? 'is-on' : ''}`}
              onClick={onToggleVoice}
              aria-pressed={voiceEnabled}
              title="Ativar ou desativar narração por voz em PT-BR (Tecla V / R)"
              data-testid="a11y-voice-btn"
            >
              {voiceEnabled ? <Volume2 size={12} aria-hidden="true" /> : <VolumeX size={12} aria-hidden="true" />}
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
