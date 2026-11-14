import React, { useState } from 'react';
import { Disc3, Radar, Volume2, X } from 'lucide-react';
import { OrbitalReticleIcon } from './CartographicIcons';
import { CountryEntry } from '../geo/countries';
import { getCountryLogistics } from '../geo/countryLogistics';
import { formatLatLon } from '../geo/projection';
import { SampledReading } from '../accessibility/a11yEngine';
import { SoundscapeRadiusTarget } from '../audio/soundscapeEngine';

interface CountryDetailCardProps {
  country: CountryEntry | null;
  radiusTarget: SoundscapeRadiusTarget | null;
  liveReadings: SampledReading[];
  jukeboxSlot?: React.ReactNode;
  onClose: () => void;
  onZoomIntoCountry: () => void;
  onSpeakSummary: () => void;
}

export const CountryDetailCard: React.FC<CountryDetailCardProps> = ({
  country,
  radiusTarget,
  liveReadings,
  jukeboxSlot,
  onClose,
  onZoomIntoCountry,
  onSpeakSummary,
}) => {
  const [activeTab, setActiveTab] = useState<'jukebox' | 'logistics'>('jukebox');

  if (!country && !radiusTarget) return null;

  const isRadius = Boolean(radiusTarget && !country);
  const logistics = country ? getCountryLogistics(country) : null;
  const effectiveTab = isRadius ? 'jukebox' : activeTab;

  return (
    <aside
      className="country-detail-card console-frame"
      aria-label={
        country
          ? `Jukebox 1 para 1 e logística de ${country.namePt}`
          : `Jukebox 1 para 1 do raio em ${radiusTarget?.label}`
      }
      data-testid="country-detail-card"
    >
      <div className="detail-card-header">
        <div>
          <div className="detail-kicker">
            <OrbitalReticleIcon size={12} />
            <span>{isRadius ? 'Alvo por Raio Geográfico' : 'Dossiê & Jukebox 1:1'}</span>
            <span className="detail-iso-tag">
              {country ? `ISO ${country.id}` : `${radiusTarget?.radiusKm} km`}
            </span>
          </div>
          <h2 className="detail-title font-display">
            {country ? country.namePt : radiusTarget?.label}
          </h2>
          <div className="detail-subtitle">
            {country && logistics
              ? `${country.nameEn} / ${logistics.subregionPt.replace(/\s*•\s*/g, ' / ')}`
              : radiusTarget
                ? `Centro ${formatLatLon(radiusTarget.centerLat, radiusTarget.centerLon)}`
                : ''}
          </div>
        </div>

        <button
          type="button"
          className="icon-btn"
          onClick={onClose}
          title="Fechar destaque (Esc)"
          aria-label="Fechar painel do país ou raio"
          data-testid="close-detail-card-btn"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      {/* SWITCH TABS BETWEEN JUKEBOX 1:1 AND COUNTRY LOGISTICS */}
      <div className="detail-tabs" role="tablist" aria-label="Alternar entre Jukebox Musical e Logística">
        <button
          type="button"
          role="tab"
          aria-selected={effectiveTab === 'jukebox'}
          className={`detail-tab-btn ${effectiveTab === 'jukebox' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('jukebox')}
          data-testid="tab-jukebox-btn"
        >
          <Disc3 size={13} aria-hidden="true" />
          <span>Jukebox 1:1 &amp; Coletivo</span>
        </button>

        {country && (
          <button
            type="button"
            role="tab"
            aria-selected={effectiveTab === 'logistics'}
            className={`detail-tab-btn ${effectiveTab === 'logistics' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('logistics')}
            data-testid="tab-logistics-btn"
          >
            <Radar size={13} aria-hidden="true" />
            <span>Logística &amp; NASA</span>
          </button>
        )}
      </div>

      {effectiveTab === 'jukebox' && jukeboxSlot}

      {effectiveTab === 'logistics' && country && logistics && (
        <>
          <div className="detail-actions-row">
            <button
              type="button"
              className="action-btn-primary"
              onClick={onSpeakSummary}
              aria-label="Ouvir resumo completo do país em áudio"
              data-testid="speak-country-btn"
            >
              <Volume2 size={14} aria-hidden="true" />
              <span>Ouvir resumo</span>
            </button>
            <button
              type="button"
              className="action-btn-secondary"
              onClick={onZoomIntoCountry}
              title="Aproximar ainda mais dentro do país"
            >
              <OrbitalReticleIcon size={14} />
              <span>Entrar no país</span>
            </button>
          </div>

          <div className="detail-metrics-grid">
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
              <span className="metric-label">Hemisfério</span>
              <strong className="metric-value">{country.hemispherePt}</strong>
            </div>
            <div className="metric-box">
              <span className="metric-label">Fuso estimado</span>
              <strong className="metric-value">{country.timezoneApprox}</strong>
            </div>
          </div>

          <section className="detail-section">
            <h3 className="detail-section-title">
              <span className="detail-section-index">01</span>
              <span>Panorama Regional</span>
            </h3>
            <p className="detail-text">{logistics.summaryPt}</p>
            {country.neighborsPt.length > 0 && (
              <p className="detail-neighbors">
                <strong>Fronteiras terrestres:</strong> {country.neighborsPt.join(', ')}
              </p>
            )}
          </section>

          <section className="detail-section">
            <h3 className="detail-section-title">
              <span className="detail-section-index">02</span>
              <span>Logística Marítima e Portuária</span>
            </h3>
            <p className="detail-text">{logistics.maritimePortsPt}</p>
          </section>

          <section className="detail-section">
            <h3 className="detail-section-title">
              <span className="detail-section-index">03</span>
              <span>Corredores Aéreos e Terrestres</span>
            </h3>
            <p className="detail-text">{logistics.airAndLandCorridorsPt}</p>
          </section>

          <section className="detail-section">
            <h3 className="detail-section-title">
              <Radar size={13} aria-hidden="true" />
              <span>Leitura NASA &amp; Impacto Logístico</span>
            </h3>
            <p className="detail-text">{logistics.climateAndRiskImpactPt}</p>

            {liveReadings.length > 0 && (
              <ul className="live-readings-list" aria-label="Leitura ao vivo das camadas NASA no país">
                {liveReadings.map((reading) => (
                  <li key={reading.datasetId} className="live-reading-item">
                    <span className="reading-badge">{reading.svsId}</span>
                    <span className="reading-desc">{reading.labelPt}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </aside>
  );
};
