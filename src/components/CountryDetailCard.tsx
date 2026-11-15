import React from 'react';
import { ChevronDown, FlaskConical, Share2, Sparkles, Volume2, X } from 'lucide-react';
import { OrbitalReticleIcon } from './CartographicIcons';
import { CountryEntry } from '../geo/countries';
import { formatLatLon } from '../geo/projection';
import { SampledReading } from '../accessibility/a11yEngine';
import { DATASET_TO_STEM, STEM_METAS } from '../community/unlockStore';
import {
  SoundscapeRadiusTarget,
  SoundscapeVisualTelemetry,
} from '../audio/soundscapeEngine';

interface CountryDetailCardProps {
  country: CountryEntry | null;
  radiusTarget: SoundscapeRadiusTarget | null;
  liveReadings: SampledReading[];
  telemetry?: SoundscapeVisualTelemetry | null;
  jukeboxSlot?: React.ReactNode;
  onClose: () => void;
  onZoomIntoCountry: () => void;
  onSpeakSummary: () => void;
  onShareMix?: () => void;
}

export const CountryDetailCard: React.FC<CountryDetailCardProps> = ({
  country,
  radiusTarget,
  liveReadings,
  jukeboxSlot,
  onClose,
  onZoomIntoCountry,
  onSpeakSummary,
  onShareMix,
}) => {
  if (!country && !radiusTarget) return null;

  const isRadius = Boolean(radiusTarget && !country);

  return (
    <aside
      className="country-detail-card is-discovery-card console-frame"
      aria-label={
        country
          ? `Card de descoberta planetária de ${country.namePt}`
          : `Card de descoberta regional ${radiusTarget?.label}`
      }
      data-testid="country-detail-card"
    >
      {/* BLOCO A: IDENTIDADE ATMOSFÉRICA DO TERRITÓRIO */}
      <header className="detail-card-header">
        <div className="detail-identity-col">
          <div className="detail-context-row">
            <span className="detail-region-pill">
              {isRadius ? 'Região Orbital' : country?.regionPt ?? 'Território'}
            </span>
            {country && (
              <span className="detail-hemisphere-tag">{country.hemispherePt}</span>
            )}
          </div>
          <h2 className="detail-title font-display">
            {country ? country.namePt : radiusTarget?.label}
          </h2>
          <p className="detail-subtitle">
            {country
              ? `Coordenadas orbitais ${formatLatLon(country.lat, country.lon)}`
              : radiusTarget
                ? `Centro ${formatLatLon(radiusTarget.centerLat, radiusTarget.centerLon)}`
                : ''}
          </p>
        </div>

        <button
          type="button"
          className="icon-btn"
          onClick={onClose}
          title="Fechar card do país e restaurar menus (Esc)"
          aria-label="Fechar painel da região"
          data-testid="close-detail-card-btn"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </header>

      <div className="detail-quick-actions">
        <button
          type="button"
          className="detail-mini-action"
          onClick={onSpeakSummary}
          aria-label="Ouvir leitura em voz alta dos fenômenos deste país"
          data-testid="speak-country-btn"
        >
          <Volume2 size={13} aria-hidden="true" />
          <span>Ouvir leitura</span>
        </button>

        {country && (
          <button
            type="button"
            className="detail-mini-action"
            onClick={onZoomIntoCountry}
            title="Mergulhar câmera sobre o território"
            data-testid="zoom-country-btn"
          >
            <OrbitalReticleIcon size={13} />
            <span>Aproximar</span>
          </button>
        )}

        {onShareMix && (
          <button
            type="button"
            className="detail-mini-action"
            onClick={onShareMix}
            title="Copiar link desta composição visual e país para compartilhar"
            data-testid="share-country-mix-btn"
          >
            <Share2 size={13} aria-hidden="true" />
            <span>Compartilhar</span>
          </button>
        )}
      </div>

      <div className="detail-scroll-body">
        {/* PULSO VISUAL AO VIVO DOS SATÉLITES NASA (FUNCIONA MESMO EM SILÊNCIO) */}
        {liveReadings.length > 0 && (
          <section
            className="discovery-live-phenomena"
            aria-label="Fenômenos atmosféricos captados agora pelos satélites da NASA"
          >
            <div className="discovery-phenomena-head">
              <Sparkles size={12} aria-hidden="true" />
              <span>O que a NASA vê aqui agora</span>
            </div>
            <div className="discovery-phenomena-chips">
              {liveReadings.slice(0, 3).map((reading) => {
                const stem = STEM_METAS[DATASET_TO_STEM[reading.datasetId]];
                return (
                  <div
                    key={reading.datasetId}
                    className="discovery-phenomenon-pill"
                    style={{
                      borderColor: `color-mix(in srgb, ${stem.accentHex} 48%, transparent)`,
                      background: `color-mix(in srgb, ${stem.accentHex} 11%, rgba(8, 15, 32, 0.72))`,
                    }}
                  >
                    <span
                      className="discovery-phenomenon-dot"
                      style={{ background: stem.accentHex }}
                      aria-hidden="true"
                    />
                    <span className="discovery-phenomenon-text">
                      <strong style={{ color: stem.accentHex }}>{stem.labelPt}:</strong>{' '}
                      {reading.labelPt}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* BLOCO B: CONSTELAÇÃO COLETIVA 5/5 & CAMADAS */}
        {jukeboxSlot}

        {/* BLOCO C: RAIO-X CIENTÍFICO LEVE SOB DEMANDA */}
        <details className="scientific-details-drawer" data-testid="scientific-info-details">
          <summary className="scientific-details-summary">
            <span className="scientific-summary-left">
              <FlaskConical size={13} aria-hidden="true" />
              <span>Raio-X Científico NASA (SVS)</span>
            </span>
            <ChevronDown size={14} className="scientific-chevron" aria-hidden="true" />
          </summary>

          <div className="scientific-details-content">
            {country && (
              <div className="detail-metrics-grid">
                <div className="metric-box">
                  <span className="metric-label">Código ISO</span>
                  <strong className="metric-value">{country.id}</strong>
                </div>
                <div className="metric-box">
                  <span className="metric-label">Área aproximada</span>
                  <strong className="metric-value">
                    {country.areaApproxKm2.toLocaleString('pt-BR')} km²
                  </strong>
                </div>
                <div className="metric-box">
                  <span className="metric-label">Fuso referencial</span>
                  <strong className="metric-value">{country.timezoneApprox}</strong>
                </div>
                <div className="metric-box">
                  <span className="metric-label">Vizinhos terrestres</span>
                  <strong className="metric-value">
                    {country.neighborsPt.length > 0
                      ? country.neighborsPt.slice(0, 3).join(', ')
                      : 'Insular / Oceânico'}
                  </strong>
                </div>
              </div>
            )}

            {liveReadings.length > 0 && (
              <ul className="live-readings-list" aria-label="Fontes de satélite SVS da NASA">
                {liveReadings.map((reading) => (
                  <li key={reading.datasetId} className="live-reading-item">
                    <span className="reading-badge">{reading.svsId}</span>
                    <span className="reading-desc">{reading.labelPt}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </details>
      </div>
    </aside>
  );
};
