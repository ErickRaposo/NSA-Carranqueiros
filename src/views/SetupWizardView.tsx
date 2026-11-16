import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Radio,
  Sliders,
  Square,
} from 'lucide-react';
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
  Lang,
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
  loadWelcomeConfirmedState,
  saveScreenScenario,
  saveWelcomeConfirmedState,
  ScreenScenario,
  SetupStepId,
  WelcomeConfirmedState,
  WelcomeSubStep,
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

const PRESS_TRANSITION =
  'transition-[transform,background-color,border-color,color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97]';

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
  const [welcomeConfirmed, setWelcomeConfirmed] = useState<WelcomeConfirmedState>(() =>
    loadWelcomeConfirmedState()
  );
  const [activeWelcomeSubStep, setActiveWelcomeSubStep] = useState<WelcomeSubStep>(() => {
    const initial = loadWelcomeConfirmedState();
    if (!initial.lang) return 'lang';
    if (!initial.room) return 'room';
    return 'scenario';
  });

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

  const updateWelcomeConfirmed = (patch: Partial<WelcomeConfirmedState>) => {
    setWelcomeConfirmed((prev) => {
      const next = { ...prev, ...patch };
      saveWelcomeConfirmedState(next);
      return next;
    });
  };

  const handleConfirmLang = (nextLang: Lang) => {
    setLang(nextLang);
    updateWelcomeConfirmed({ lang: true });
    setActiveWelcomeSubStep((prev) => {
      if (prev === 'lang') {
        return welcomeConfirmed.room ? 'scenario' : 'room';
      }
      return prev;
    });
  };

  const handleConfirmRoom = () => {
    updateWelcomeConfirmed({ room: true });
    setActiveWelcomeSubStep('scenario');
  };

  const handleSelectScenario = (next: ScreenScenario) => {
    setScenario(next);
    saveScreenScenario(next);
    updateWelcomeConfirmed({ scenario: true });
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
  const hasActiveTestsOrGrids = calibTestMode.kind !== 'off' || projectionState.showGrid;

  const canGoBack =
    activeStep === 'welcome' ? activeWelcomeSubStep !== 'lang' : currentStepIndex > 0;
  const canGoNext =
    activeStep === 'welcome'
      ? true
      : currentStepIndex < steps.length - 1 &&
        (activeStep !== 'controller' || scenario === 0 || controllerConnected || manualBypassConfirmed);

  const handleBackClick = () => {
    if (activeStep === 'welcome') {
      if (activeWelcomeSubStep === 'scenario') {
        setActiveWelcomeSubStep('room');
      } else if (activeWelcomeSubStep === 'room') {
        setActiveWelcomeSubStep('lang');
      }
      return;
    }
    if (currentStepIndex > 0) {
      goToStep(steps[currentStepIndex - 1]);
    }
  };

  const handleNextClick = () => {
    if (activeStep === 'welcome') {
      if (activeWelcomeSubStep === 'lang') {
        handleConfirmLang(lang);
        return;
      }
      if (activeWelcomeSubStep === 'room') {
        handleConfirmRoom();
        return;
      }
      updateWelcomeConfirmed({ lang: true, room: true, scenario: true });
    }
    if (currentStepIndex < steps.length - 1) {
      goToStep(steps[currentStepIndex + 1]);
    }
  };

  const handleCutTests = () => {
    stopCalibrationSignal();
    if (projectionState.showGrid) toggleGlobalShowGrid();
  };

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
      className="flex h-dvh w-screen flex-col overflow-hidden bg-[#060913] font-['Poppins',system-ui,sans-serif] text-slate-100"
      data-testid="setup-wizard-view"
    >
      {/* Cabeçalho superior alinhado ao Painel (100% Poppins) */}
      <header className="flex min-h-[58px] shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#1e3a66]/55 bg-[#040b1a] px-4 py-2 lg:px-6">
        <div className="flex items-center gap-2.5">
          <img src={symbollLogo} alt="" className="h-7 w-7 object-contain" aria-hidden="true" />
          <h1 className="text-[15px] font-semibold tracking-[-0.01em] text-slate-50">
            {isPt ? 'Setup Guiado' : 'Guided Setup'}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex min-h-[38px] items-center gap-2 rounded-full border border-[#1e3a66] bg-[#060c1a] px-3.5 text-xs">
            <Radio
              size={13}
              className={lanConnected ? 'text-emerald-400' : 'text-[#7dd3fc]'}
              aria-hidden="true"
            />
            <span className="hidden text-slate-400 sm:inline">
              {isPt ? 'Sala' : 'Room'}
            </span>
            <span className="font-mono font-semibold tracking-wider text-[#7dd3fc] [font-variant-numeric:tabular-nums]">
              {roomCode ?? 'LOCAL'}
            </span>
          </div>

          {hasActiveTestsOrGrids && (
            <button
              type="button"
              onClick={handleCutTests}
              className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-full bg-rose-500 px-3.5 text-xs font-semibold text-white hover:bg-rose-400 ${PRESS_TRANSITION} ${ADMIN_FOCUS}`}
            >
              <Square size={12} />
              <span>{isPt ? 'Cortar Testes' : 'Stop Tests'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenAdmin}
            data-testid="header-open-admin"
            className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-full border border-[#1e3a66] bg-[#060c1a] px-3.5 text-xs font-medium text-slate-200 hover:border-[#2563eb] hover:text-white ${PRESS_TRANSITION} ${ADMIN_FOCUS}`}
            title={
              isPt
                ? 'Abrir Painel Técnico completo (?view=admin)'
                : 'Open full Control Desk (?view=admin)'
            }
          >
            <Sliders size={13} className="text-[#7dd3fc]" />
            <span>{isPt ? 'Painel Técnico' : 'Control Desk'}</span>
          </button>

          <button
            type="button"
            onClick={() => setLang(isPt ? 'en' : 'pt')}
            className={`inline-flex min-h-[38px] min-w-[78px] items-center justify-center rounded-full border border-[#1e3a66] bg-[#060c1a] px-3.5 text-xs font-medium text-slate-200 hover:border-[#2563eb] hover:text-white ${PRESS_TRANSITION} ${ADMIN_FOCUS}`}
          >
            {isPt ? 'Português' : 'English'}
          </button>
        </div>
      </header>

      {/* Trilho Horizontal Limpo de Etapas */}
      <nav
        aria-label={isPt ? 'Etapas da configuração' : 'Setup steps'}
        className="shrink-0 border-b border-[#1e3a66]/45 bg-[#040b1a]/80 px-4 py-3 sm:px-8"
      >
        <ol className="mx-auto flex max-w-5xl items-center justify-between gap-2 overflow-x-auto [font-variant-numeric:tabular-nums]">
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
              <li key={stepId} className="flex shrink-0 items-center gap-2 sm:flex-1 sm:last:flex-none">
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => goToStep(stepId)}
                  aria-current={isCurrent ? 'step' : undefined}
                  className={`inline-flex min-h-[36px] shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-45 ${PRESS_TRANSITION} ${ADMIN_FOCUS} ${
                    isCurrent
                      ? 'border-[#2563eb]/65 bg-[#0c1a36] font-semibold text-slate-50'
                      : isCompleted
                        ? 'border-[#1e3a66]/55 bg-[#040b1a] text-slate-200 hover:border-[#2563eb]/60 hover:text-white'
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {isCompleted ? (
                    <Check size={12} className="shrink-0 text-emerald-400" />
                  ) : (
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${
                        isCurrent ? 'bg-[#7dd3fc]' : 'bg-slate-400 opacity-25'
                      }`}
                      aria-hidden="true"
                    />
                  )}
                  <span>{isPt ? stepLabels[stepId].pt : stepLabels[stepId].en}</span>
                </button>

                {idx < steps.length - 1 && (
                  <span
                    className={`hidden h-px flex-1 sm:block ${
                      isCompleted ? 'bg-[#2563eb]/60' : 'bg-[#1e3a66]/50'
                    }`}
                    aria-hidden="true"
                  />
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Conteúdo Principal Ampliado (max-w-5xl) */}
      <main className="admin-scroll min-h-0 flex-1 px-4 py-6 sm:px-8 lg:py-9">
        <div className="mx-auto w-full max-w-5xl">
          {activeStep === 'welcome' && (
            <StepLanguageAndRoom
              lang={lang}
              roomCode={roomCode}
              syncNetworkMode={syncNetworkMode}
              lanConnected={lanConnected}
              scenario={scenario}
              welcomeConfirmed={welcomeConfirmed}
              activeWelcomeSubStep={activeWelcomeSubStep}
              onConfirmLang={handleConfirmLang}
              onRegenerateRoomCode={() => {
                regenerateRoomCode();
              }}
              onConfirmRoom={handleConfirmRoom}
              onSelectScenario={handleSelectScenario}
              onEditSubStep={(sub) => setActiveWelcomeSubStep(sub)}
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

      {/* Rodapé Fixo de Transporte Voltar / Continuar */}
      <footer className="shrink-0 border-t border-[#1e3a66]/55 bg-[#040b1a] px-4 py-3.5 sm:px-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <button
            type="button"
            disabled={!canGoBack}
            onClick={handleBackClick}
            data-testid="setup-btn-back"
            className={`inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap rounded-full border border-[#1e3a66] bg-[#060c1a] px-5 text-xs font-semibold text-slate-200 hover:border-[#2563eb] hover:text-white disabled:cursor-not-allowed disabled:opacity-35 ${PRESS_TRANSITION} ${ADMIN_FOCUS}`}
          >
            <ArrowLeft size={13} />
            <span>{isPt ? 'Voltar' : 'Back'}</span>
          </button>

          <div className="whitespace-nowrap text-xs font-medium text-slate-400 [font-variant-numeric:tabular-nums]">
            {isPt
              ? `Etapa ${currentStepIndex + 1} de ${steps.length}`
              : `Step ${currentStepIndex + 1} of ${steps.length}`}
          </div>

          {currentStepIndex < steps.length - 1 ? (
            <button
              type="button"
              disabled={!canGoNext}
              onClick={handleNextClick}
              data-testid="setup-btn-next"
              className={`inline-flex min-h-[44px] items-center gap-2 whitespace-nowrap px-6 text-[13px] disabled:cursor-not-allowed disabled:opacity-40 ${PRESS_TRANSITION} ${ADMIN_PRIMARY_PILL_CLASS} ${ADMIN_FOCUS}`}
            >
              <span>{isPt ? 'Continuar' : 'Continue'}</span>
              <ArrowRight size={13} />
            </button>
          ) : (
            <div className="w-[108px]" aria-hidden="true" />
          )}
        </div>
      </footer>
    </div>
  );
};
