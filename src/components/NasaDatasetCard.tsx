import React, { useEffect } from 'react';
import { ExternalLink, EyeOff, Layers, X } from 'lucide-react';
import { DatasetId, NASA_DATASETS } from '../datasets/nasaDatasets';
import { DATASET_TO_STEM, STEM_METAS, STEM_ORDER } from '../community/unlockStore';

interface NasaDatasetCardProps {
  open: boolean;
  datasetId: DatasetId;
  enabledDatasetIds: DatasetId[];
  autoOpenEnabled: boolean;
  onSelectDataset: (id: DatasetId) => void;
  onCloseOnce: () => void;
  onCloseAndDisableAuto: () => void;
  onRestoreAutoOpen: () => void;
}

export const NasaDatasetCard: React.FC<NasaDatasetCardProps> = ({
  open,
  datasetId,
  enabledDatasetIds,
  autoOpenEnabled,
  onSelectDataset,
  onCloseOnce,
  onCloseAndDisableAuto,
  onRestoreAutoOpen,
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

  const ds = NASA_DATASETS[datasetId];
  const stem = STEM_METAS[DATASET_TO_STEM[datasetId]];
  const isSolo = enabledDatasetIds.length === 1 && enabledDatasetIds[0] === datasetId;
  const isCurrentlyActive = enabledDatasetIds.includes(datasetId);

  return (
    <aside
      className="nasa-dataset-card console-frame"
      role="region"
      aria-label={`Dados científicos e escala oficial da NASA: ${ds.shortName}`}
      data-testid="nasa-dataset-card"
    >
      {/* BARRA DE BASES NASA (TROCA RÁPIDA PARA VISUALIZAR CADA MAPA A 100% OU INSPECIONAR ESCALAS) */}
      <div className="nasa-card-tabs" role="tablist" aria-label="Selecionar base científica da NASA">
        {STEM_ORDER.map((stemId) => {
          const meta = STEM_METAS[stemId];
          const itemDs = NASA_DATASETS[meta.datasetId];
          const isSelected = meta.datasetId === datasetId;
          const isEnabledOnGlobe = enabledDatasetIds.includes(meta.datasetId);
          return (
            <button
              key={stemId}
              type="button"
              role="tab"
              aria-selected={isSelected}
              className={`nasa-card-tab ${isSelected ? 'is-selected' : ''} ${
                isEnabledOnGlobe ? 'is-globe-active' : ''
              }`}
              style={{ '--tab-accent': meta.accentHex } as React.CSSProperties}
              onClick={() => onSelectDataset(meta.datasetId)}
              title={`${meta.labelPt} — ${itemDs.shortName} (${itemDs.svsId})`}
              data-testid={`nasa-card-tab-${meta.datasetId}`}
            >
              <span
                className="nasa-card-tab-dot"
                style={{
                  background: isEnabledOnGlobe ? meta.accentHex : 'rgba(148, 163, 184, 0.35)',
                }}
                aria-hidden="true"
              />
              <span>{meta.labelPt}</span>
            </button>
          );
        })}
      </div>

      {/* TÍTULO PRINCIPAL DIRETO (SEM KICKER/EYEBROW ACIMA DO HEADING) */}
      <div className="nasa-card-head">
        <div className="nasa-card-title-group">
          <h3 className="nasa-card-title font-display">{ds.shortName}</h3>
          <div className="nasa-card-meta-pills">
            <span className="nasa-svs-badge">{ds.svsId}</span>
            <span className="nasa-sensor-badge">{ds.sensorLabel}</span>
            <span
              className="nasa-stem-link-badge"
              style={{
                color: stem.accentHex,
                borderColor: `color-mix(in srgb, ${stem.accentHex} 45%, transparent)`,
                background: `color-mix(in srgb, ${stem.accentHex} 12%, rgba(8, 15, 30, 0.8))`,
              }}
            >
              {stem.labelPt} · {stem.instrumentPt}
            </span>
          </div>
        </div>

        <button
          type="button"
          className="icon-btn-sm"
          onClick={onCloseOnce}
          title="Fechar card da base NASA (Esc)"
          aria-label="Fechar card da base NASA"
        >
          <X size={14} aria-hidden="true" />
        </button>
      </div>

      {/* BLOCO PROTAGONISTA DE ESCALA OFICIAL NASA OU LEGENDA DE EVENTOS DISCRETOS */}
      <div className="nasa-scale-box" data-testid="nasa-scale-box">
        <div className="nasa-scale-header">
          <strong className="nasa-scale-title">
            {ds.representationType === 'colorbar'
              ? 'Escala oficial de cores (NASA SVS)'
              : 'Representação por eventos ópticos (sem escala contínua)'}
          </strong>
          <span className="nasa-scale-unit">{ds.unitLabel}</span>
        </div>

        {ds.representationType === 'colorbar' && ds.colorbarUrl ? (
          <>
            <div className="nasa-colorbar-frame">
              <img
                src={ds.colorbarUrl}
                alt={ds.colorbarCaption}
                className="nasa-colorbar-img"
                loading="eager"
              />
            </div>
            <div className="nasa-scale-endpoints">
              <span>{ds.scaleMinLabel}</span>
              <span>{ds.scaleMaxLabel}</span>
            </div>
          </>
        ) : (
          <div
            className="nasa-discrete-events-box"
            role="group"
            aria-label={ds.colorbarCaption}
            data-testid="nasa-svs5011-discrete-legend"
          >
            <div className="nasa-discrete-item">
              <span className="nasa-discrete-swatch is-base-earth" aria-hidden="true" />
              <div className="nasa-discrete-copy">
                <strong>Base Terrestre / Oceânica</strong>
                <span>Ausência de relâmpagos registrados na janela de 10 dias</span>
              </div>
            </div>
            <div className="nasa-discrete-item">
              <span className="nasa-discrete-swatch is-lightning-flash" aria-hidden="true" />
              <div className="nasa-discrete-copy">
                <strong>Pontos Amarelos (Flashes ISS-LIS)</strong>
                <span>Ocorrência pontual de descarga elétrica detectada da órbita</span>
              </div>
            </div>
          </div>
        )}

        <p className="nasa-how-to-read">{ds.howToReadPt}</p>
      </div>

      <p className="nasa-card-desc">{ds.descriptionPt}</p>

      {/* STATUS DE OPACIDADE 100% VS MESCLAGEM + FONTE OFICIAL */}
      <div className="nasa-card-fidelity-row">
        <span className="nasa-fidelity-pill" data-testid="nasa-fidelity-status">
          <Layers size={12} aria-hidden="true" />
          <span>
            {isSolo
              ? '100% opacidade original NASA no globo'
              : isCurrentlyActive
                ? `Mesclando ${enabledDatasetIds.length} bases NASA ativas`
                : 'Clique na aba acima para exibir esta base a 100%'}
          </span>
        </span>

        <a
          href={ds.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="nasa-source-link"
          title={`Abrir página oficial ${ds.svsId} no NASA Scientific Visualization Studio`}
        >
          <span>Fonte NASA SVS</span>
          <ExternalLink size={11} aria-hidden="true" />
        </a>
      </div>

      {/* DOIS BOTÕES DE FECHAMENTO: FECHAR AGORA vs NÃO MOSTRAR AO ENTRAR */}
      <div className="nasa-card-actions">
        <button
          type="button"
          className="nasa-btn-primary"
          onClick={onCloseOnce}
          data-testid="nasa-card-close-btn"
        >
          Fechar
        </button>

        {autoOpenEnabled ? (
          <button
            type="button"
            className="nasa-btn-secondary"
            onClick={onCloseAndDisableAuto}
            title="Fecha agora e não abre mais sozinho ao entrar no mapa (você ainda pode abrir pelo botão Dados NASA)"
            data-testid="nasa-card-disable-auto-btn"
          >
            <EyeOff size={13} aria-hidden="true" />
            <span>Não mostrar ao entrar</span>
          </button>
        ) : (
          <button
            type="button"
            className="nasa-btn-secondary is-muted-restore"
            onClick={onRestoreAutoOpen}
            data-testid="nasa-card-restore-auto-btn"
          >
            <span>Mostrar ao entrar novamente</span>
          </button>
        )}
      </div>
    </aside>
  );
};
