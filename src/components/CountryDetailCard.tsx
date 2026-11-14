import React from 'react';
import { ChevronDown, FlaskConical, Radar, Volume2, X } from 'lucide-react';
import { OrbitalReticleIcon } from './CartographicIcons';
import { CountryEntry } from '../geo/countries';
import { getCountryLogistics } from '../geo/countryLogistics';
import { formatLatLon } from '../geo/projection';
import { SampledReading } from '../accessibility/a11yEngine';
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
}

export const CountryDetailCard: React.FC<CountryDetailCardProps> = ({
  country,
  radiusTarget,
  liveReadings,
  telemetry,
  jukeboxSlot,
  onClose,
  onZoomIntoCountry,
  onSpeakSummary,
}) => {
  if (!country && !radiusTarget) return null;

  const isRadius = Boolean(radiusTarget && !country);
  const logistics = country ? getCountryLogistics(country) : null;

  return (
    <aside
      className="country-detail-card console-frame"
      aria-label={
        country
          ? `Exploração regional de ${country.namePt}`
          : `Exploração regional do raio ${radiusTarget?.label}`
      }
      data-testid="country-detail-card"
    >
      {/* SEÇÃO A: IDENTIDADE REGIONAL */}
      <header className="detail-card-header">
        <div className="detail-identity-col">
          <div className="detail-context-row">
            <span className="detail-region-pill">
              {isRadius ? 'Raio Geográfico' : country?.regionPt ?? 'Região Ativa'}
            </span>
            {country && (
              <span className="detail-hemisphere-tag">{country.hemispherePt}</span>
            )}
          </div>
          <h2 className="detail-title font-display">
            {country ? country.namePt : radiusTarget?.label}
          </h2>
          <p className="detail-subtitle">
            {country && logistics
              ? `${logistics.subregionPt.replace(/\s*•\s*/g, ' · ')}`
              : radiusTarget
                ? `Centro ${formatLatLon(radiusTarget.centerLat, radiusTarget.centerLon)}`
                : ''}
          </p>
        </div>

        <button
          type="button"
          className="icon-btn"
          onClick={onClose}
          title="Fechar painel da região (Esc)"
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
          aria-label="Ouvir resumo da região em áudio"
          data-testid="speak-country-btn"
        >
          <Volume2 size={13} aria-hidden="true" />
          <span>Ouvir resumo</span>
        </button>
        {country && (
          <button
            type="button"
            className="detail-mini-action"
            onClick={onZoomIntoCountry}
            title="Aproximar câmera dentro do país"
            data-testid="zoom-country-btn"
          >
            <OrbitalReticleIcon size={13} />
            <span>Aproximar</span>
          </button>
        )}
      </div>

      {/* SEÇÕES B, C e D: PROGRESSO DA SINFONIA, FREQUÊNCIAS ADORMECIDAS E PRÓXIMA MISSÃO */}
      <div className="detail-scroll-body">
        {jukeboxSlot}

        {/* INFORMAÇÕES CIENTÍFICAS EXPANSÍVEIS (METADADOS TÉCNICOS, ISO, LOGÍSTICA & SVS) */}
        <details className="scientific-details-drawer" data-testid="scientific-info-details">
          <summary className="scientific-details-summary">
            <span className="scientific-summary-left">
              <FlaskConical size={13} aria-hidden="true" />
              <span>Informações científicas</span>
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
                  <span className="metric-label">Coordenadas</span>
                  <strong className="metric-value">{formatLatLon(country.lat, country.lon)}</strong>
                </div>
                <div className="metric-box">
                  <span className="metric-label">Área estimada</span>
                  <strong className="metric-value">
                    {country.areaApproxKm2.toLocaleString('pt-BR')} km²
                  </strong>
                </div>
                <div className="metric-box">
                  <span className="metric-label">Fuso estimado</span>
                  <strong className="metric-value">{country.timezoneApprox}</strong>
                </div>
              </div>
            )}

            {telemetry && (
              <div className="detail-metrics-grid">
                <div className="metric-box">
                  <span className="metric-label">Sintetizador &amp; Escala</span>
                  <strong className="metric-value">
                    {telemetry.chordName} ({telemetry.modeName})
                  </strong>
                </div>
                <div className="metric-box">
                  <span className="metric-label">Filtro NO₂ / Brisa</span>
                  <strong className="metric-value">
                    {telemetry.bassCutoffHz} Hz · {telemetry.windWetPct}% eco
                  </strong>
                </div>
              </div>
            )}

            {logistics && country && (
              <>
                <section className="detail-section">
                  <h3 className="detail-section-title">Panorama &amp; Logística Regional</h3>
                  <p className="detail-text">{logistics.summaryPt}</p>
                  {country.neighborsPt.length > 0 && (
                    <p className="detail-neighbors">
                      <strong>Fronteiras terrestres:</strong> {country.neighborsPt.join(', ')}
                    </p>
                  )}
                </section>

                <section className="detail-section">
                  <h3 className="detail-section-title">Portos e Corredores</h3>
                  <p className="detail-text">{logistics.maritimePortsPt}</p>
                  <p className="detail-text">{logistics.airAndLandCorridorsPt}</p>
                </section>

                <section className="detail-section">
                  <h3 className="detail-section-title">
                    <Radar size={12} aria-hidden="true" />
                    <span>Datasets NASA &amp; Clima</span>
                  </h3>
                  <p className="detail-text">{logistics.climateAndRiskImpactPt}</p>
                </section>
              </>
            )}

            {liveReadings.length > 0 && (
              <ul className="live-readings-list" aria-label="Leitura ao vivo dos datasets NASA">
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
