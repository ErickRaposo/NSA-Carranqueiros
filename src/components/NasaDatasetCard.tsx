import React, { useEffect } from 'react';
import { ExternalLink, Layers, X } from 'lucide-react';
import { DatasetId, NASA_DATASETS, resolveAssetUrl } from '../datasets/nasaDatasets';
import {
  DATASET_TO_LAYER,
  LAYER_METAS,
  Lang,
  VISUAL_LAYER_ORDER,
} from '../experience/types';

interface NasaDatasetCardProps {
  open: boolean;
  datasetId: DatasetId;
  enabledDatasetIds: DatasetId[];
  lang?: Lang;
  onSelectDataset: (id: DatasetId) => void;
  onCloseOnce: () => void;
}

export const NasaDatasetCard: React.FC<NasaDatasetCardProps> = ({
  open,
  datasetId,
  enabledDatasetIds,
  lang = 'pt',
  onSelectDataset,
  onCloseOnce,
}) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseOnce();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCloseOnce]);

  if (!open) return null;

  const isPt = lang === 'pt';
  const ds = NASA_DATASETS[datasetId];
  const layerMeta = LAYER_METAS[DATASET_TO_LAYER[datasetId]];
  const isSolo = enabledDatasetIds.length === 1 && enabledDatasetIds[0] === datasetId;
  const isCurrentlyActive = enabledDatasetIds.includes(datasetId);

  const shortName = isPt ? ds.shortName : ds.shortNameEn;
  const sensorLabel = isPt ? ds.sensorLabel : ds.sensorLabelEn;
  const colorbarCaption = isPt ? ds.colorbarCaption : ds.colorbarCaptionEn;
  const scaleMin = isPt ? ds.scaleMinLabel : ds.scaleMinLabelEn;
  const scaleMax = isPt ? ds.scaleMaxLabel : ds.scaleMaxLabelEn;
  const unitLabel = isPt ? ds.unitLabel : ds.unitLabelEn;
  const howToRead = isPt ? ds.howToReadPt : ds.howToReadEn;
  const description = isPt ? ds.descriptionPt : ds.descriptionEn;

  return (
    <aside
      className="nasa-dataset-card console-frame"
      role="dialog"
      aria-modal="false"
      aria-label={
        isPt
          ? `Dados científicos e escala oficial da NASA: ${shortName}`
          : `Official NASA scientific dataset and scale: ${shortName}`
      }
      data-testid="nasa-dataset-card"
    >
      <div
        className="nasa-card-tabs"
        role="tablist"
        aria-label={isPt ? 'Selecionar base científica da NASA' : 'Select NASA scientific dataset'}
      >
        {VISUAL_LAYER_ORDER.map((layerId) => {
          const meta = LAYER_METAS[layerId];
          const itemDs = NASA_DATASETS[meta.datasetId];
          const isSelected = meta.datasetId === datasetId;
          const isEnabledOnGlobe = enabledDatasetIds.includes(meta.datasetId);
          const tabLabel = isPt ? meta.labelPt : meta.labelEn;
          const itemTitle = isPt ? itemDs.shortName : itemDs.shortNameEn;
          return (
            <button
              key={layerId}
              type="button"
              role="tab"
              aria-selected={isSelected}
              className={`nasa-card-tab ${isSelected ? 'is-selected' : ''} ${
                isEnabledOnGlobe ? 'is-globe-active' : ''
              }`}
              style={{ '--tab-accent': meta.accentHex, minHeight: '44px' } as React.CSSProperties}
              onClick={() => onSelectDataset(meta.datasetId)}
              title={`${tabLabel} — ${itemTitle} (${itemDs.svsId})`}
              data-testid={`nasa-card-tab-${meta.datasetId}`}
            >
              <span
                className="nasa-card-tab-dot"
                style={{
                  background: isEnabledOnGlobe ? meta.accentHex : 'rgba(148, 163, 184, 0.35)',
                }}
                aria-hidden="true"
              />
              <span>{tabLabel}</span>
            </button>
          );
        })}
      </div>

      <div className="nasa-card-head">
        <div className="nasa-card-title-group">
          <h3 className="nasa-card-title">{shortName}</h3>
          <div className="nasa-card-meta-pills">
            <span className="nasa-svs-badge">{ds.svsId}</span>
            <span className="nasa-sensor-badge">{sensorLabel}</span>
            <span
              className="nasa-stem-link-badge"
              style={{
                color: layerMeta.accentHex,
                borderColor: `color-mix(in srgb, ${layerMeta.accentHex} 45%, transparent)`,
                background: `color-mix(in srgb, ${layerMeta.accentHex} 12%, rgba(8, 15, 30, 0.8))`,
              }}
            >
              {isPt
                ? `${layerMeta.labelPt} · ${layerMeta.musicalRolePt}`
                : `${layerMeta.labelEn} · ${layerMeta.musicalRoleEn}`}
            </span>
          </div>
        </div>

        <button
          type="button"
          className="icon-btn-sm"
          style={{ minWidth: '44px', minHeight: '44px' }}
          onClick={onCloseOnce}
          title={isPt ? 'Fechar card da base NASA' : 'Close NASA dataset card'}
          aria-label={isPt ? 'Fechar card da base NASA' : 'Close NASA dataset card'}
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      <div className="nasa-scale-box" data-testid="nasa-scale-box">
        <div className="nasa-scale-header">
          <strong className="nasa-scale-title">
            {ds.representationType === 'colorbar'
              ? isPt
                ? 'Escala oficial de cores · NASA SVS'
                : 'Official colorbar scale · NASA SVS'
              : isPt
                ? 'Representação por eventos ópticos · sem escala contínua'
                : 'Discrete optical flash representation · no continuous scale'}
          </strong>
          <span className="nasa-scale-unit">{unitLabel}</span>
        </div>

        {ds.representationType === 'colorbar' && ds.colorbarUrl ? (
          <>
            <div className="nasa-colorbar-frame">
              <img
                src={resolveAssetUrl(ds.colorbarUrl)}
                alt={colorbarCaption}
                className="nasa-colorbar-img"
                loading="eager"
              />
            </div>
            <div className="nasa-scale-endpoints">
              <span>{scaleMin}</span>
              <span>{scaleMax}</span>
            </div>
          </>
        ) : (
          <div
            className="nasa-discrete-events-box"
            role="group"
            aria-label={colorbarCaption}
            data-testid="nasa-svs5011-discrete-legend"
          >
            <div className="nasa-discrete-item">
              <span className="nasa-discrete-swatch is-base-earth" aria-hidden="true" />
              <div className="nasa-discrete-copy">
                <strong>{isPt ? 'Base Terrestre / Oceânica' : 'Land / Ocean Base'}</strong>
                <span>
                  {isPt
                    ? 'Ausência de relâmpagos registrados na janela de 10 dias'
                    : 'No lightning flashes recorded within the 10-day window'}
                </span>
              </div>
            </div>
            <div className="nasa-discrete-item">
              <span className="nasa-discrete-swatch is-lightning-flash" aria-hidden="true" />
              <div className="nasa-discrete-copy">
                <strong>
                  {isPt ? 'Pontos Amarelos · Flashes ISS-LIS' : 'Yellow Dots · ISS-LIS Flashes'}
                </strong>
                <span>
                  {isPt
                    ? 'Ocorrência pontual de descarga elétrica detectada da órbita'
                    : 'Discrete optical lightning discharge detected from orbit'}
                </span>
              </div>
            </div>
          </div>
        )}

        <p className="nasa-how-to-read">{howToRead}</p>
      </div>

      <p className="nasa-card-desc">{description}</p>

      <div className="nasa-card-fidelity-row">
        <span className="nasa-fidelity-pill" data-testid="nasa-fidelity-status">
          <Layers size={12} aria-hidden="true" />
          <span>
            {isSolo
              ? isPt
                ? '100% opacidade original NASA ativa'
                : '100% original NASA layer opacity active'
              : isCurrentlyActive
                ? isPt
                  ? `Mesclando ${enabledDatasetIds.length} camadas NASA ativas`
                  : `Blending ${enabledDatasetIds.length} active NASA layers`
                : isPt
                  ? 'Camada atualmente oculta no mixer'
                  : 'Layer currently hidden in mixer'}
          </span>
        </span>

        <a
          href={ds.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="nasa-source-link"
          title={
            isPt
              ? `Abrir página oficial ${ds.svsId} no NASA Scientific Visualization Studio`
              : `Open official ${ds.svsId} page on NASA Scientific Visualization Studio`
          }
        >
          <span>{isPt ? 'Fonte NASA SVS' : 'NASA SVS Source'}</span>
          <ExternalLink size={11} aria-hidden="true" />
        </a>
      </div>

      <div className="nasa-card-actions">
        <button
          type="button"
          className="nasa-btn-primary"
          style={{ minHeight: '44px' }}
          onClick={onCloseOnce}
          data-testid="nasa-card-close-btn"
        >
          {isPt ? 'Fechar' : 'Close'}
        </button>
      </div>
    </aside>
  );
};
