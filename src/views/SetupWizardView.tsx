import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Sliders } from 'lucide-react';
import symbollLogo from '../assets/symboll.png';
import {
  useAudioAdmin,
  useExperience,
  useProjectionAdmin,
} from '../experience/ExperienceContext';
import {
  DEFAULT_ROOM_DIMENSIONS,
  updateWallDimension,
} from '../experience/roomDimensions';
import {
  PROJECTOR_OUT_IDS,
  SurfaceId,
  ViewRole,
} from '../experience/types';
import { encodeQrMatrix } from '../lan/qrCodeSvg';
import { buildViewUrl } from '../lan/roomCode';
import {
  ADMIN_FOCUS,
  ADMIN_PRIMARY_PILL_CLASS,
} from './admin/adminMeta';
import {
  loadInitialScreenScenario,
  saveScreenScenario,
  ScreenScenario,
  SetupStepId,
} from './setup/setupTypes';
import { StepAudioSetup } from './setup/StepAudioSetup';
import { StepControllerPairing } from './setup/StepControllerPairing';
import { StepLanguageAndRoom } from './setup/StepLanguageAndRoom';
import { StepProjectionSetup } from './setup/StepProjectionSetup';
import { StepReadySummary } from './setup/StepReadySummary';

interface SetupWizardViewProps {
  onOpenAdmin: () => void;
  onNavigate: (view: ViewRole) => void;
}

export const SetupWizardView: React.FC<SetupWizardViewProps> = ({
  onOpenAdmin,
  onNavigate,
}) => {
  const {
    country,
    lang,
    setLang,
    roomCode,
    syncNetworkMode,
    regenerateRoomCode,
    lanConnected,
    lanClients,
    audioMode,
    setAudioMode,
    audioOwner,
    setAudioOwner,
    masterGain,
    setMasterGain,
    setLocalAudioMuted,
    playback,
    liveEvents,
    roomDimensions,
    setRoomDimensions,
    selectCountry,
    setAllLayersEnabled,
    playWithAudibleLayers,
    togglePlay,
  } = useExperience();

  const {
    speakerCalibration,
    calibTestMode,
    calibBeatSeq,
    screenSyncPulseActive,
    visualDelayMs,
    outputDevices,
    outputSupportStatus,
    isSetSinkIdSupported,
    speakerSinkStatuses,
    unlockOutputDevices,
    updateSpeakerConfig,
    retrySpeakerSink,
    updateAvOffsetMs,
    togglePinkNoiseSpeaker,
    toggleDelayClickSpeaker,
    toggleHeadphoneDelayClick,
    toggleScreenSyncPulse,
    stopCalibrationSignal,
    refreshOutputDevices,
  } = useAudioAdmin();

  const {
    projectionState,
    selectProjectionPreset,
    updateOutputConfig,
    resetScreenDelays,
    updateSurfaceQuad,
    translateOutputMesh,
    resetAllProjectionQuads,
    triggerIdentifyOutputs,
    toggleGlobalBlackout,
    toggleGlobalShowGrid,
  } = useProjectionAdmin();

  const isPt = lang === 'pt';

  const [scenario, setScenario] = useState<ScreenScenario>(() =>
    loadInitialScreenScenario(projectionState.preset)
  );
  const [activeStep, setActiveStep] = useState<SetupStepId>('welcome');
  const [manualBypassConfirmed, setManualBypassConfirmed] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const steps = useMemo<SetupStepId[]>(
    () =>
      scenario === 0
        ? ['welcome', 'audio', 'controller', 'ready']
        : ['welcome', 'projection', 'audio', 'controller', 'ready'],
    [scenario]
  );

  // Se o usuário mudar para 0 projetores e estivesse em 'projection', volta com segurança
  useEffect(() => {
    if (!steps.includes(activeStep)) {
      setActiveStep('welcome');
    }
  }, [activeStep, steps]);

  useEffect(() => {
    void refreshOutputDevices();
  }, [refreshOutputDevices]);

  useEffect(() => {
    return () => {
      stopCalibrationSignal();
    };
  }, [stopCalibrationSignal]);

  const handleSelectScenario = (next: ScreenScenario) => {
    setScenario(next);
    saveScreenScenario(next);
    if (next === 1) {
      selectProjectionPreset('1-projector');
    } else if (next === 2) {
      selectProjectionPreset('2-projectors');
    } else if (next === 3) {
      selectProjectionPreset('3-projectors');
    }
  };

  const goToStep = (nextStep: SetupStepId) => {
    stopCalibrationSignal();
    setActiveStep(nextStep);
  };

  const baseOrigin = useMemo(() => {
    if (typeof window !== 'undefined' && window.location?.origin && window.location.origin !== 'null') {
      return window.location.origin;
    }
    return 'http://localhost:5173';
  }, []);

  const tabletUrl = useMemo(
    () => buildViewUrl(baseOrigin, 'controller', { roomCode }),
    [baseOrigin, roomCode]
  );
  const tabletRelativeHref = useMemo(
    () => buildViewUrl(null, 'controller', { roomCode }),
    [roomCode]
  );
  const qrModules = useMemo(() => encodeQrMatrix(tabletUrl), [tabletUrl]);

  const copyText = (key: string, text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey((prev) => (prev === key ? null : prev)), 1800);
    }
  };

  const surfaceToOutLabels = useMemo(() => {
    const map: Record<SurfaceId, string[]> = {
      leftWall: [],
      rightWall: [],
      ceiling: [],
    };
    for (const outId of PROJECTOR_OUT_IDS) {
      for (const sId of projectionState.outputs[outId].surfaces) {
        map[sId].push(`OUT ${outId}`);
      }
    }
    return map;
  }, [projectionState.outputs]);

  const controllerConnected = lanClients.some((c) => c.role === 'controller');
  const currentStepIndex = Math.max(0, steps.indexOf(activeStep));
  const canGoBack = currentStepIndex > 0;
  const canGoNext =
    currentStepIndex < steps.length - 1 &&
    (activeStep !== 'controller' || scenario === 0 || controllerConnected || manualBypassConfirmed);

  const stepLabels: Record<SetupStepId, { pt: string; en: string }> = {
    welcome: { pt: 'Ambiente', en: 'Space' },
    projection: { pt: 'Projetores', en: 'Projectors' },
    audio: { pt: 'Som 8D', en: '8D Sound' },
    controller: { pt: 'Controle', en: 'Remote' },
    ready: { pt: 'Pronto', en: 'Ready' },
  };

  const prepareCleanLaunch = (targetView: ViewRole) => {
    stopCalibrationSignal();
    if (projectionState.globalBlackout) toggleGlobalBlackout();
    if (projectionState.showGrid) toggleGlobalShowGrid();
    for (const outId of PROJECTOR_OUT_IDS) {
      if (projectionState.outputs[outId].showGrid) {
        updateOutputConfig(outId, { showGrid: false });
      }
    }
    onNavigate(targetView);
  };

  const handleQuickSoundAndVisualTest = () => {
    if (playback.isPlaying) {
      togglePlay();
      return;
    }
    if (projectionState.globalBlackout) toggleGlobalBlackout();
    setAllLayersEnabled(true);
    if (!country) selectCountry('076');
    playWithAudibleLayers();
  };

  return (
    <div
      className="flex h-dvh w-screen flex-col overflow-hidden bg-[#060913] font-sans text-slate-100"
      data-testid="setup-wizard-view"
    >
      {/* Cabeçalho Guiado */}
      <header className="flex min-h-[60px] shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#1e3a66]/55 bg-[#040b1a] px-4 py-2.5 lg:px-6">
        <div className="flex items-center gap-3">
          <img src={symbollLogo} alt="" className="h-7 w-7 object-contain" aria-hidden="true" />
          <div>
            <h1 className="text-sm font-semibold tracking-[-0.01em] text-slate-50">
              {isPt ? 'Configuração Guiada · Earth Jukebox' : 'Guided Setup · Earth Jukebox'}
            </h1>
            <p className="hidden text-xs text-slate-400 sm:block">
              {isPt
                ? 'Passo a passo intuitivo para preparar telas, áudio espacial 8D e controle'
                : 'Step-by-step setup for screens, 8D spatial audio, and remote control'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenAdmin}
            data-testid="header-open-admin"
            className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-full border border-[#1e3a66] bg-[#060c1a] px-3.5 text-xs font-medium text-slate-300 transition hover:border-[#2563eb] hover:text-white ${ADMIN_FOCUS}`}
            title={
              isPt
                ? 'Abrir Painel Técnico completo para desenvolvedores (?view=admin)'
                : 'Open full developer Control Desk (?view=admin)'
            }
          >
            <Sliders size={13} />
            <span>{isPt ? 'Painel Técnico' : 'Control Desk'}</span>
          </button>

          <button
            type="button"
            onClick={() => setLang(isPt ? 'en' : 'pt')}
            className={`inline-flex min-h-[38px] min-w-[68px] items-center justify-center rounded-full border border-[#1e3a66] bg-[#060c1a] px-3 text-xs font-semibold text-slate-200 transition hover:border-[#2563eb] hover:text-white ${ADMIN_FOCUS}`}
          >
            {isPt ? 'PT · BR' : 'EN · US'}
          </button>
        </div>
      </header>

      {/* Barra de Progresso dos Passos */}
      <nav
        aria-label={isPt ? 'Etapas da configuração' : 'Setup steps'}
        className="shrink-0 border-b border-[#1e3a66]/40 bg-[#050916] px-4 py-2.5 lg:px-6"
      >
        <ol className="mx-auto flex max-w-5xl items-center gap-2 overflow-x-auto [font-variant-numeric:tabular-nums]">
          {steps.map((stepId, idx) => {
            const isCurrent = stepId === activeStep;
            const isCompleted = idx < currentStepIndex;
            const locked =
              idx > currentStepIndex &&
              steps.indexOf('controller') >= 0 &&
              idx > steps.indexOf('controller') &&
              scenario > 0 &&
              !controllerConnected &&
              !manualBypassConfirmed;

            return (
              <li key={stepId} className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => goToStep(stepId)}
                  aria-current={isCurrent ? 'step' : undefined}
                  className={`inline-flex min-h-[38px] items-center gap-2 rounded-full border px-3.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-45 ${ADMIN_FOCUS} ${
                    isCurrent
                      ? 'border-[#2563eb] bg-[#0c1a36] font-semibold text-white'
                      : isCompleted
                        ? 'border-[#1e3a66] bg-[#060c1a] text-[#7dd3fc] hover:border-[#2563eb]'
                        : 'border-transparent bg-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold ${
                      isCurrent
                        ? 'bg-[#2563eb] text-white'
                        : isCompleted
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-white/10 text-slate-300'
                    }`}
                  >
                    {isCompleted ? <Check size={11} /> : idx + 1}
                  </span>
                  <span>{isPt ? stepLabels[stepId].pt : stepLabels[stepId].en}</span>
                </button>

                {idx < steps.length - 1 && (
                  <span className="h-px w-4 bg-[#1e3a66]/70" aria-hidden="true" />
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Conteúdo Principal da Etapa */}
      <main className="admin-scroll min-h-0 flex-1 px-4 py-5 lg:px-6">
        <div className="mx-auto w-full max-w-5xl">
          {activeStep === 'welcome' && (
            <StepLanguageAndRoom
              lang={lang}
              roomCode={roomCode}
              syncNetworkMode={syncNetworkMode}
              lanConnected={lanConnected}
              scenario={scenario}
              onSetLang={setLang}
              onRegenerateRoomCode={() => {
                regenerateRoomCode();
              }}
              onSelectScenario={handleSelectScenario}
            />
          )}

          {activeStep === 'projection' && scenario !== 0 && (
            <StepProjectionSetup
              isPt={isPt}
              scenario={scenario}
              projectionState={projectionState}
              roomDimensions={roomDimensions}
              baseOrigin={baseOrigin}
              roomCode={roomCode}
              lanClients={lanClients}
              copiedKey={copiedKey}
              onCopyText={copyText}
              onIdentifyOutputs={() => triggerIdentifyOutputs(7000)}
              onToggleGlobalShowGrid={toggleGlobalShowGrid}
              onResetAllProjectionQuads={resetAllProjectionQuads}
              onUpdateSurfaceQuad={updateSurfaceQuad}
              onTranslateOutputMesh={translateOutputMesh}
              onUpdateWallDimension={(wall, field, rawValue) =>
                setRoomDimensions(updateWallDimension(roomDimensions, wall, field, rawValue))
              }
              onResetRoomDimensions={() => setRoomDimensions(DEFAULT_ROOM_DIMENSIONS)}
              screenSyncPulseActive={screenSyncPulseActive}
              calibBeatSeq={calibBeatSeq}
              onUpdateOutputDelay={(outId, delayMs) => updateOutputConfig(outId, { delayMs })}
              onResetScreenDelays={resetScreenDelays}
              onToggleScreenSyncPulse={toggleScreenSyncPulse}
            />
          )}

          {activeStep === 'audio' && (
            <StepAudioSetup
              isPt={isPt}
              audioMode={audioMode}
              audioOwner={audioOwner}
              masterGain={masterGain}
              isPlaying={playback.isPlaying}
              surfaceToOutLabels={surfaceToOutLabels}
              liveEvents={liveEvents}
              speakerCalibration={speakerCalibration}
              calibTestMode={calibTestMode}
              calibBeatSeq={calibBeatSeq}
              visualDelayMs={visualDelayMs}
              outputDevices={outputDevices}
              outputSupportStatus={outputSupportStatus}
              isSetSinkIdSupported={isSetSinkIdSupported}
              speakerSinkStatuses={speakerSinkStatuses}
              baseOrigin={baseOrigin}
              roomCode={roomCode}
              syncNetworkMode={syncNetworkMode}
              lanClients={lanClients}
              copiedKey={copiedKey}
              onSetAudioMode={setAudioMode}
              onSetAudioOwner={setAudioOwner}
              onSetMasterGain={setMasterGain}
              onSetLocalAudioMuted={setLocalAudioMuted}
              onPlayPreview={() => {
                if (!country) selectCountry('076');
                playWithAudibleLayers();
              }}
              onTogglePlay={togglePlay}
              onUnlockOutputDevices={unlockOutputDevices}
              onUpdateSpeakerConfig={updateSpeakerConfig}
              onRetrySpeakerSink={retrySpeakerSink}
              onUpdateAvOffsetMs={updateAvOffsetMs}
              onTogglePinkNoiseSpeaker={togglePinkNoiseSpeaker}
              onToggleDelayClickSpeaker={toggleDelayClickSpeaker}
              onToggleHeadphoneDelayClick={toggleHeadphoneDelayClick}
              onStopCalibrationSignal={stopCalibrationSignal}
              onCopyText={copyText}
            />
          )}

          {activeStep === 'controller' && (
            <StepControllerPairing
              isPt={isPt}
              scenario={scenario}
              roomCode={roomCode}
              tabletUrl={tabletUrl}
              tabletRelativeHref={tabletRelativeHref}
              qrModules={qrModules}
              syncNetworkMode={syncNetworkMode}
              lanClients={lanClients}
              copiedKey={copiedKey}
              manualBypassConfirmed={manualBypassConfirmed}
              onCopyText={copyText}
              onConfirmManualBypass={() => setManualBypassConfirmed(true)}
              onSkipToReady={() => goToStep('ready')}
            />
          )}

          {activeStep === 'ready' && (
            <StepReadySummary
              lang={lang}
              roomCode={roomCode}
              syncNetworkMode={syncNetworkMode}
              scenario={scenario}
              audioMode={audioMode}
              controllerConnected={controllerConnected}
              isPlaying={playback.isPlaying}
              onQuickSoundAndVisualTest={handleQuickSoundAndVisualTest}
              onNavigate={prepareCleanLaunch}
            />
          )}
        </div>
      </main>

      {/* Rodapé Fixo de Navegação Voltar / Continuar */}
      <footer className="shrink-0 border-t border-[#1e3a66]/55 bg-[#040b1a] px-4 py-3 lg:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <button
            type="button"
            disabled={!canGoBack}
            onClick={() => {
              if (canGoBack) {
                goToStep(steps[currentStepIndex - 1]);
              }
            }}
            data-testid="setup-btn-back"
            className={`inline-flex min-h-[44px] items-center gap-2 rounded-full border border-[#1e3a66] bg-[#060c1a] px-5 text-xs font-semibold text-slate-200 transition hover:border-[#2563eb] hover:text-white disabled:cursor-not-allowed disabled:opacity-35 ${ADMIN_FOCUS}`}
          >
            <ArrowLeft size={14} />
            <span>{isPt ? 'Voltar' : 'Back'}</span>
          </button>

          <div className="text-xs text-slate-400 [font-variant-numeric:tabular-nums]">
            {isPt
              ? `Etapa ${currentStepIndex + 1} de ${steps.length}`
              : `Step ${currentStepIndex + 1} of ${steps.length}`}
          </div>

          {currentStepIndex < steps.length - 1 ? (
            <button
              type="button"
              disabled={!canGoNext}
              onClick={() => {
                if (canGoNext) {
                  goToStep(steps[currentStepIndex + 1]);
                }
              }}
              data-testid="setup-btn-next"
              className={`inline-flex min-h-[44px] items-center gap-2 px-6 text-xs disabled:cursor-not-allowed disabled:opacity-40 ${ADMIN_PRIMARY_PILL_CLASS} ${ADMIN_FOCUS}`}
            >
              <span>{isPt ? 'Continuar' : 'Continue'}</span>
              <ArrowRight size={14} />
            </button>
          ) : (
            <div className="w-[116px]" aria-hidden="true" />
          )}
        </div>
      </footer>
    </div>
  );
};
