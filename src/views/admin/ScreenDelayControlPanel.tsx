import React, { useEffect, useMemo, useState } from 'react';
import { RotateCcw, Zap } from 'lucide-react';
import { PROJECTOR_OUT_IDS, ProjectorOutId } from '../../experience/types';
import { ProjectionCalibrationState } from '../../projection/homography';
import {
  clampScreenDelayMs,
  computeEffectiveScreenDelays,
  MAX_SCREEN_DELAY_MS,
  MIN_SCREEN_DELAY_MS,
  SCREEN_DELAY_STEP_MS,
} from '../../projection/screenDelay';
import {
  ADMIN_FOCUS,
  ADMIN_PANEL_CLASS,
  ADMIN_WELL_CLASS,
  SURFACE_UI_META,
} from './adminMeta';

interface ScreenDelayControlPanelProps {
  isPt: boolean;
  projectionState: ProjectionCalibrationState;
  screenSyncPulseActive: boolean;
  calibBeatSeq: number;
  stepLabelPt?: string;
  stepLabelEn?: string;
  onUpdateOutputDelay: (outId: ProjectorOutId, delayMs: number) => void;
  onResetScreenDelays: () => void;
  onToggleScreenSyncPulse: () => void;
}

function formatSignedMs(val: number): string {
  if (val > 0) return `+${val} ms`;
  return `${val} ms`;
}

export const ScreenDelayControlPanel: React.FC<ScreenDelayControlPanelProps> = ({
  isPt,
  projectionState,
  screenSyncPulseActive,
  calibBeatSeq,
  stepLabelPt,
  stepLabelEn,
  onUpdateOutputDelay,
  onResetScreenDelays,
  onToggleScreenSyncPulse,
}) => {
  const [beatFlashOn, setBeatFlashOn] = useState(false);

  useEffect(() => {
    if (!screenSyncPulseActive || calibBeatSeq <= 0) {
      setBeatFlashOn(false);
      return;
    }
    setBeatFlashOn(true);
    const timer = window.setTimeout(() => setBeatFlashOn(false), 115);
    return () => window.clearTimeout(timer);
  }, [calibBeatSeq, screenSyncPulseActive]);

  const activeOutputs = useMemo(() => {
    const assigned = PROJECTOR_OUT_IDS.filter(
      (id) => (projectionState.outputs[id]?.surfaces?.length ?? 0) > 0
    );
    return assigned.length > 0 ? assigned : ([1, 2] as ProjectorOutId[]);
  }, [projectionState.outputs]);

  const effectiveDelays = useMemo(
    () => computeEffectiveScreenDelays(projectionState.outputs),
    [projectionState.outputs]
  );

  const hasNonZeroDelay = PROJECTOR_OUT_IDS.some(
    (id) => clampScreenDelayMs(projectionState.outputs[id]?.delayMs ?? 0) !== 0
  );

  return (
    <section className={`p-5 ${ADMIN_PANEL_CLASS}`} data-testid="screen-delay-control-panel">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          {(stepLabelPt || stepLabelEn) && (
            <span className="text-xs font-semibold tracking-wide text-[#7dd3fc] uppercase">
              {isPt ? stepLabelPt : stepLabelEn}
            </span>
          )}
          <h2 className="mt-1 text-base font-semibold text-slate-50">
            {isPt
              ? 'Controlador de Delay entre as Telas'
              : 'Screen-to-Screen Delay Controller'}
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-300">
            {isPt
              ? 'Compense diferenças de latência entre projetores, cabos ou outros computadores na rede. Use valores positivos (+ms) para atrasar uma tela rápida, ou negativos (-ms) quando uma tela estiver chegando atrás e precisar que as outras esperem por ela.'
              : 'Compensate latency differences across projectors, adapters, or networked PCs. Use positive (+ms) to delay a fast display, or negative (-ms) when a display lags so the others wait for it.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onToggleScreenSyncPulse}
            aria-pressed={screenSyncPulseActive}
            data-testid="btn-screen-sync-pulse"
            className={`inline-flex min-h-[42px] items-center gap-2 rounded-full border px-4 text-xs font-semibold transition ${ADMIN_FOCUS} ${
              screenSyncPulseActive
                ? 'border-white bg-white text-[#060913]'
                : 'border-[#2563eb]/65 bg-[#0c1a36] text-white hover:bg-[#152a55]'
            }`}
          >
            <Zap size={14} className={screenSyncPulseActive ? 'text-[#060913]' : 'text-[#7dd3fc]'} />
            <span>
              {screenSyncPulseActive
                ? isPt
                  ? 'Parar Pulso Visual'
                  : 'Stop Visual Pulse'
                : isPt
                  ? 'Pulso Visual nas Telas'
                  : 'Visual Screen Pulse'}
            </span>
          </button>

          <div
            data-testid="screen-delay-beat-flash"
            style={{ transition: beatFlashOn ? 'none' : 'all 140ms ease-out' }}
            className={`flex min-h-[42px] items-center gap-2 rounded-full border px-3.5 text-xs font-semibold [font-variant-numeric:tabular-nums] ${
              beatFlashOn && screenSyncPulseActive
                ? 'border-white bg-white text-[#060913] shadow-[0_0_20px_rgba(125,211,252,0.75)]'
                : 'border-[#1e3a66]/65 bg-[#040b1a] text-slate-400'
            }`}
          >
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                beatFlashOn && screenSyncPulseActive
                  ? 'bg-[#060913]'
                  : screenSyncPulseActive
                    ? 'bg-[#38bdf8]'
                    : 'bg-slate-600'
              }`}
            />
            <span>
              {screenSyncPulseActive
                ? isPt
                  ? 'Piscando'
                  : 'Flashing'
                : isPt
                  ? 'Luz Parada'
                  : 'Flash Idle'}
            </span>
          </div>

          <button
            type="button"
            disabled={!hasNonZeroDelay}
            onClick={onResetScreenDelays}
            data-testid="btn-reset-screen-delays"
            className={`inline-flex min-h-[42px] items-center gap-1.5 rounded-full border border-[#1e3a66] bg-[#060c1a] px-3.5 text-xs font-medium text-slate-200 transition hover:border-[#2563eb] hover:text-white disabled:cursor-not-allowed disabled:opacity-45 ${ADMIN_FOCUS}`}
          >
            <RotateCcw size={13} />
            <span>{isPt ? 'Zerar Delays' : 'Reset Delays'}</span>
          </button>
        </div>
      </div>

      <div
        className={`mt-4 grid grid-cols-1 gap-3 ${
          activeOutputs.length === 1
            ? 'md:grid-cols-1'
            : activeOutputs.length === 2
              ? 'md:grid-cols-2'
              : 'lg:grid-cols-3'
        }`}
      >
        {activeOutputs.map((outId) => {
          const cfg = projectionState.outputs[outId];
          const signedDelay = clampScreenDelayMs(cfg?.delayMs ?? 0);
          const effectiveDelay = effectiveDelays[outId] ?? 0;
          const surfaces = cfg?.surfaces ?? [];

          return (
            <div
              key={outId}
              data-testid={`screen-delay-card-${outId}`}
              className={`flex flex-col justify-between p-4 ${ADMIN_WELL_CLASS}`}
            >
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded-lg border border-[#1e3a66] bg-[#0c1a36] px-2.5 py-1 text-xs font-semibold text-white [font-variant-numeric:tabular-nums]">
                      {isPt ? `Tela OUT ${outId}` : `Screen OUT ${outId}`}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {surfaces.map((sId) => (
                        <span
                          key={sId}
                          className="inline-flex items-center gap-1 text-xs font-medium text-slate-200"
                        >
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: SURFACE_UI_META[sId].accentHex }}
                          />
                          <span>
                            {isPt ? SURFACE_UI_META[sId].shortPt : SURFACE_UI_META[sId].shortEn}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>

                  <span
                    className={`text-xs font-semibold [font-variant-numeric:tabular-nums] ${
                      signedDelay === 0 ? 'text-slate-400' : 'text-[#7dd3fc]'
                    }`}
                    data-testid={`screen-delay-value-${outId}`}
                  >
                    {formatSignedMs(signedDelay)}
                  </span>
                </div>

                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 [font-variant-numeric:tabular-nums]">
                  <span>
                    {effectiveDelay > 0
                      ? isPt
                        ? `Atraso real aplicado nesta tela: +${effectiveDelay} ms`
                        : `Effective output delay: +${effectiveDelay} ms`
                      : isPt
                        ? 'Referência de tempo (0 ms de atraso)'
                        : 'Timing reference (0 ms delay)'}
                  </span>
                </div>
              </div>

              <div className="mt-3">
                <input
                  type="range"
                  min={MIN_SCREEN_DELAY_MS}
                  max={MAX_SCREEN_DELAY_MS}
                  step={SCREEN_DELAY_STEP_MS}
                  value={signedDelay}
                  aria-label={
                    isPt ? `Delay da tela OUT ${outId}` : `Delay for screen OUT ${outId}`
                  }
                  data-testid={`screen-delay-slider-${outId}`}
                  onChange={(e) => onUpdateOutputDelay(outId, Number(e.target.value))}
                  className="h-2 w-full cursor-pointer accent-[#38bdf8]"
                />
                <div className="mt-1 flex justify-between text-[10px] text-slate-400 [font-variant-numeric:tabular-nums]">
                  <span>{MIN_SCREEN_DELAY_MS} ms</span>
                  <span>0 ms</span>
                  <span>+{MAX_SCREEN_DELAY_MS} ms</span>
                </div>

                <div className="mt-2.5 flex items-center justify-between gap-1.5 [font-variant-numeric:tabular-nums]">
                  {[-10, -5, 0, 5, 10].map((delta) => (
                    <button
                      key={delta}
                      type="button"
                      onClick={() =>
                        onUpdateOutputDelay(
                          outId,
                          delta === 0 ? 0 : clampScreenDelayMs(signedDelay + delta)
                        )
                      }
                      className={`min-h-[34px] flex-1 rounded-lg border border-[#1e3a66]/55 bg-[#060c1a] px-2 text-[11px] font-medium text-slate-200 transition hover:border-[#2563eb] hover:text-white ${ADMIN_FOCUS}`}
                    >
                      {delta === 0 ? '0 ms' : delta > 0 ? `+${delta}` : `${delta}`}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {activeOutputs.length === 1 && (
        <p className="mt-3 text-xs text-slate-400">
          {isPt
            ? 'Como o sistema está usando apenas 1 projetor para tudo, todas as superfícies já saem na mesma imagem. Adicione 2 ou 3 projetores acima quando quiser atrasar uma tela em relação às outras.'
            : 'Since only 1 projector output is active, all walls render in one frame. Enable 2 or 3 outputs when balancing separate displays.'}
        </p>
      )}
    </section>
  );
};
