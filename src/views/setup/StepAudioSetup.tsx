import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  Headphones,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Speaker,
  Square,
  Volume2,
  Zap,
} from 'lucide-react';
import {
  AudioCalibrationState,
  SPEAKER_IDS,
  SpeakerSlotConfig,
  SpeakerSlotId,
} from '../../audio/speakerCalibration';
import {
  isDelayClickSpeakerActive,
  isPinkNoiseSpeakerActive,
  SpeakerSinkRouteInfo,
} from '../../audio/spatialAudioEngine';
import { AudioAdminContextValue } from '../../experience/ExperienceContext';
import {
  AudioOutputMode,
  AudioOwnerRole,
  LanPeerInfo,
  LiveNoteEvent,
  SurfaceId,
  SyncNetworkMode,
} from '../../experience/types';
import { buildViewUrl } from '../../lan/roomCode';
import { AcousticStage2D } from '../admin/AcousticStage2D';
import { AdminSelect } from '../admin/AdminSelect';
import {
  ADMIN_CARD_CLASS,
  ADMIN_FOCUS,
  ADMIN_PANEL_CLASS,
  ADMIN_PRIMARY_PILL_CLASS,
  ADMIN_SEGMENT_ACTIVE_CLASS,
  ADMIN_SEGMENT_IDLE_CLASS,
  ADMIN_SEGMENT_WRAP_CLASS,
  ADMIN_WELL_CLASS,
} from '../admin/adminMeta';
import { ConfirmedRackBar } from './ConfirmedRackBar';
import { NextBlockTeaser } from './NextBlockTeaser';

interface StepAudioSetupProps {
  isPt: boolean;
  audioMode: AudioOutputMode;
  audioOwner: AudioOwnerRole;
  masterGain: number;
  isPlaying: boolean;
  surfaceToOutLabels: Record<SurfaceId, string[]>;
  liveEvents: LiveNoteEvent[];
  speakerCalibration: AudioCalibrationState;
  calibTestMode: AudioAdminContextValue['calibTestMode'];
  calibBeatSeq?: number;
  visualDelayMs?: number;
  outputDevices: AudioAdminContextValue['outputDevices'];
  outputSupportStatus: AudioAdminContextValue['outputSupportStatus'];
  isSetSinkIdSupported: boolean;
  speakerSinkStatuses?: Partial<Record<SpeakerSlotId, SpeakerSinkRouteInfo>>;
  baseOrigin: string;
  roomCode: string | null;
  syncNetworkMode: SyncNetworkMode;
  lanClients: LanPeerInfo[];
  copiedKey: string | null;
  onSetAudioMode: (mode: AudioOutputMode) => void;
  onSetAudioOwner: (owner: AudioOwnerRole) => void;
  onSetMasterGain: (gain: number) => void;
  onSetLocalAudioMuted: (muted: boolean) => void;
  onPlayPreview: () => void;
  onTogglePlay: () => void;
  onUnlockOutputDevices: () => Promise<unknown> | void;
  onUpdateSpeakerConfig: (id: SpeakerSlotId, patch: Partial<SpeakerSlotConfig>) => void;
  onRetrySpeakerSink?: (id: SpeakerSlotId, toggleEngine?: boolean) => void;
  onUpdateAvOffsetMs: (avOffsetMs: number) => void;
  onTogglePinkNoiseSpeaker: (id: SpeakerSlotId) => void;
  onToggleDelayClickSpeaker: (id: SpeakerSlotId) => void;
  onToggleHeadphoneDelayClick: () => void;
  onStopCalibrationSignal: () => void;
  onCopyText: (key: string, text: string) => void;
}

const SPEAKER_META: Record<
  SpeakerSlotId,
  { zonePt: string; zoneEn: string; shortCode: string }
> = {
  speaker1: {
    zonePt: 'C1 · Parede Esquerda',
    zoneEn: 'C1 · Left Wall',
    shortCode: 'C1',
  },
  speaker2: {
    zonePt: 'C2 · Parede Direita',
    zoneEn: 'C2 · Right Wall',
    shortCode: 'C2',
  },
  speaker3: {
    zonePt: 'C3 · Teto / Fundo',
    zoneEn: 'C3 · Ceiling / Rear',
    shortCode: 'C3',
  },
};

const PRESS_TRANSITION =
  'transition-[transform,background-color,border-color,color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97]';

function formatSignedMs(ms: number): string {
  if (ms > 0) return `+${ms} ms`;
  return `${ms} ms`;
}

export const StepAudioSetup: React.FC<StepAudioSetupProps> = ({
  isPt,
  audioMode,
  audioOwner,
  masterGain,
  isPlaying,
  surfaceToOutLabels,
  liveEvents,
  speakerCalibration,
  calibTestMode,
  calibBeatSeq = 0,
  outputDevices,
  outputSupportStatus,
  isSetSinkIdSupported,
  speakerSinkStatuses,
  baseOrigin,
  roomCode,
  syncNetworkMode,
  lanClients,
  copiedKey,
  onSetAudioMode,
  onSetAudioOwner,
  onSetMasterGain,
  onSetLocalAudioMuted,
  onPlayPreview,
  onTogglePlay,
  onUnlockOutputDevices,
  onUpdateSpeakerConfig,
  onRetrySpeakerSink,
  onUpdateAvOffsetMs,
  onTogglePinkNoiseSpeaker,
  onToggleDelayClickSpeaker,
  onToggleHeadphoneDelayClick,
  onStopCalibrationSignal,
  onCopyText,
}) => {
  // Fixed rule: the Tablet never emits audio — sound always plays from the PC / room speakers
  useEffect(() => {
    if (audioOwner !== 'pc') {
      onSetAudioOwner('pc');
    }
    onSetLocalAudioMuted(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [beatFlashOn, setBeatFlashOn] = useState<boolean>(false);
  useEffect(() => {
    if (calibBeatSeq <= 0) {
      setBeatFlashOn(false);
      return;
    }
    setBeatFlashOn(true);
    const timer = window.setTimeout(() => setBeatFlashOn(false), 115);
    return () => window.clearTimeout(timer);
  }, [calibBeatSeq]);

  const [audioModeConfirmed, setAudioModeConfirmed] = useState<boolean>(false);
  const [delayPanelOpen, setDelayPanelOpen] = useState<boolean>(false);

  const isHeadphones = audioMode === 'hrtf';
  const avOffsetMs = speakerCalibration.avOffsetMs ?? 0;
  const isAnyClickModeActive =
    calibTestMode.kind === 'delay-click-multi' ||
    calibTestMode.kind === 'delay-click-all' ||
    calibTestMode.kind === 'delay-click';

  const deviceOptions = useMemo(
    () => [
      {
        value: '',
        label: isPt ? 'Saída Padrão deste Computador' : 'Computer Default Output',
      },
      ...outputDevices.map((dev) => ({ value: dev.deviceId, label: dev.label })),
    ],
    [isPt, outputDevices]
  );

  const handleChooseMode = (nextMode: AudioOutputMode) => {
    onStopCalibrationSignal();
    onSetAudioMode(nextMode);
    setAudioModeConfirmed(true);
  };

  const renderGlobalAvSyncBox = (showHeadphoneClickButton: boolean) => (
    <div
      data-testid="av-offset-sync-card"
      className={`p-4 ${ADMIN_CARD_CLASS}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="max-w-lg">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-semibold text-slate-100">
              {isPt ? 'Atraso Vídeo × Som (Global)' : 'Video × Audio Offset (Global)'}
            </span>
            <span className="rounded-full border border-[#2563eb]/50 bg-[#0c1a36] px-2.5 py-0.5 text-xs font-semibold text-[#7dd3fc] [font-variant-numeric:tabular-nums]">
              {formatSignedMs(avOffsetMs)}
            </span>
            {avOffsetMs !== 0 && (
              <button
                type="button"
                onClick={() => onUpdateAvOffsetMs(0)}
                className={`inline-flex min-h-[28px] items-center gap-1 rounded-full border border-[#1e3a66] bg-[#040b1a] px-2.5 text-[11px] font-medium text-slate-300 hover:border-[#2563eb] hover:text-white ${PRESS_TRANSITION} ${ADMIN_FOCUS}`}
              >
                <RotateCcw size={10} />
                <span>0 ms</span>
              </button>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-400">
            {isPt
              ? 'Negativo atrasa imagem (Bluetooth); positivo atrasa o som (projetor).'
              : 'Negative delays visuals (Bluetooth lag); positive delays audio.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {showHeadphoneClickButton && (
            <button
              type="button"
              onClick={onToggleHeadphoneDelayClick}
              aria-pressed={isAnyClickModeActive}
              data-testid="btn-headphone-sync-click"
              className={`inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border px-3.5 text-xs font-semibold ${PRESS_TRANSITION} ${ADMIN_FOCUS} ${
                isAnyClickModeActive
                  ? 'border-white bg-white text-[#060913]'
                  : 'border-[#1e3a66] bg-[#040b1a] text-slate-200 hover:border-[#2563eb] hover:text-white'
              }`}
            >
              <Zap size={13} />
              <span>
                {isAnyClickModeActive
                  ? isPt
                    ? 'Parar Pulso'
                    : 'Stop Pulse'
                  : isPt
                    ? 'Testar Pulso'
                    : 'Test Pulse'}
              </span>
            </button>
          )}

          <div
            data-testid="calib-visual-beat-flash"
            style={{
              transition: beatFlashOn ? 'none' : 'all 140ms ease-out',
            }}
            className={`flex min-h-[42px] min-w-[128px] items-center justify-center gap-2 rounded-xl border px-3 text-xs font-semibold select-none [font-variant-numeric:tabular-nums] ${
              beatFlashOn && isAnyClickModeActive
                ? 'scale-[1.03] border-white bg-white text-[#060913] shadow-[0_0_24px_rgba(125,211,252,0.85)]'
                : 'border-[#1e3a66]/65 bg-[#040b1a] text-slate-400'
            }`}
          >
            <span
              style={{ transition: beatFlashOn ? 'none' : 'all 140ms ease-out' }}
              className={`h-2.5 w-2.5 rounded-full ${
                beatFlashOn && isAnyClickModeActive
                  ? 'bg-[#060913]'
                  : isAnyClickModeActive
                    ? 'bg-[#38bdf8]/50'
                    : 'bg-slate-600'
              }`}
            />
            <span>
              {isAnyClickModeActive
                ? isPt
                  ? 'Batida ativa'
                  : 'Beat flash'
                : isPt
                  ? 'Luz de sincronia'
                  : 'Sync flash'}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-3">
        <input
          type="range"
          min={-400}
          max={400}
          step={5}
          aria-label={isPt ? 'Atraso Vídeo × Som' : 'Video Audio Offset'}
          value={avOffsetMs}
          onChange={(e) => onUpdateAvOffsetMs(Number(e.target.value))}
          className="h-2 w-full cursor-pointer accent-[#38bdf8]"
        />
        <div className="mt-1 flex justify-between text-[11px] text-slate-500 [font-variant-numeric:tabular-nums]">
          <span>-400 ms</span>
          <span>0 ms</span>
          <span>+400 ms</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-4 sm:gap-5" data-testid="setup-step-audio">
      {/* Sub-block: Output Mode */}
      {!audioModeConfirmed ? (
        <section
          className={`setup-block-enter p-5 sm:p-6 ${ADMIN_PANEL_CLASS}`}
          data-testid="substep-audio-mode"
        >
          <div className="flex flex-wrap items-start justify-between gap-3 pb-4">
            <div className="max-w-[64ch]">
              <h2 className="text-base font-semibold tracking-[-0.015em] text-slate-50 sm:text-lg">
                {isPt ? 'Por onde o áudio espacial será reproduzido?' : 'Where will spatial audio play?'}
              </h2>
              <p className="mt-1 text-xs leading-[1.55] text-slate-400 sm:text-[13px]">
                {isPt
                  ? 'Escolha entre escuta direta em fones ou distribuição em 3 caixas pela sala.'
                  : 'Choose between direct headphones or 3 speakers placed around the room.'}
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#1e3a66] bg-[#060c1a] px-3 py-1.5 text-xs font-medium text-slate-300">
              <span className="h-2 w-2 rounded-full bg-[#7dd3fc]" aria-hidden="true" />
              <span>{isPt ? 'Som no PC · Controle silencioso' : 'Audio on PC · Silent remote'}</span>
            </span>
          </div>

          <div className="space-y-2.5">
            <button
              type="button"
              onClick={() => handleChooseMode('hrtf')}
              aria-pressed={isHeadphones}
              data-testid="audio-choice-headphones"
              className={`flex min-h-[68px] w-full flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition ${PRESS_TRANSITION} ${ADMIN_FOCUS} ${
                isHeadphones
                  ? 'border-[#2563eb]/65 bg-[#0c1a36]/60 text-slate-50'
                  : 'border-[#1e3a66]/45 bg-white/[0.02] text-slate-300 hover:border-[#1e3a66] hover:bg-white/[0.04]'
              }`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#1e3a66] bg-[#040b1a] text-[#7dd3fc]">
                  <Headphones size={16} />
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-50">
                      {isPt ? 'Fone de Ouvido (8D Direto)' : 'Headphones (Direct 8D)'}
                    </span>
                    <span className="rounded-md bg-[#0c1a36] px-1.5 py-0.5 text-[11px] font-medium text-slate-300">
                      Binaural 8D
                    </span>
                    {isHeadphones && (
                      <span className="rounded-md bg-[#1d4ed8]/35 px-1.5 py-0.5 text-[11px] font-semibold text-[#7dd3fc]">
                        {isPt ? 'Editando' : 'Editing'}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {isPt
                      ? 'Espacialização 3D direta nos fones sem caixas externas.'
                      : 'Direct binaural 3D audio with no external speaker setup.'}
                  </p>
                </div>
              </div>

              <span
                className={`inline-flex min-h-[38px] min-w-[120px] items-center justify-center gap-2 rounded-xl border px-3 text-xs font-medium ${
                  isHeadphones
                    ? 'border-[#2563eb]/55 bg-[#0c1a36] font-semibold text-slate-50'
                    : 'border-[#1e3a66]/45 bg-[#040b1a] text-slate-400'
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full bg-[#7dd3fc] ${isHeadphones ? '' : 'opacity-25'}`}
                  aria-hidden="true"
                />
                <span>{isHeadphones ? (isPt ? 'Ativa' : 'On') : isPt ? 'Escolher' : 'Pick'}</span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleChooseMode('room3')}
              aria-pressed={!isHeadphones}
              data-testid="audio-choice-room3"
              className={`flex min-h-[68px] w-full flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition ${PRESS_TRANSITION} ${ADMIN_FOCUS} ${
                !isHeadphones
                  ? 'border-[#2563eb]/65 bg-[#0c1a36]/60 text-slate-50'
                  : 'border-[#1e3a66]/45 bg-white/[0.02] text-slate-300 hover:border-[#1e3a66] hover:bg-white/[0.04]'
              }`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#1e3a66] bg-[#040b1a] text-[#7dd3fc]">
                  <Speaker size={16} />
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-50">
                      {isPt ? '3 Caixas na Sala (8D Simulado)' : '3 Room Speakers (Simulated 8D)'}
                    </span>
                    <span className="rounded-md bg-[#0c1a36] px-1.5 py-0.5 text-[11px] font-medium text-slate-300">
                      C1 · C2 · C3
                    </span>
                    {!isHeadphones && (
                      <span className="rounded-md bg-[#1d4ed8]/35 px-1.5 py-0.5 text-[11px] font-semibold text-[#7dd3fc]">
                        {isPt ? 'Editando' : 'Editing'}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {isPt
                      ? 'Separa canais entre Parede Esq (C1), Parede Dir (C2) e Teto (C3).'
                      : 'Distributes sound across Left Wall (C1), Right Wall (C2), Ceiling (C3).'}
                  </p>
                </div>
              </div>

              <span
                className={`inline-flex min-h-[38px] min-w-[120px] items-center justify-center gap-2 rounded-xl border px-3 text-xs font-medium ${
                  !isHeadphones
                    ? 'border-[#2563eb]/55 bg-[#0c1a36] font-semibold text-slate-50'
                    : 'border-[#1e3a66]/45 bg-[#040b1a] text-slate-400'
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full bg-[#7dd3fc] ${!isHeadphones ? '' : 'opacity-25'}`}
                  aria-hidden="true"
                />
                <span>{!isHeadphones ? (isPt ? 'Ativa' : 'On') : isPt ? 'Escolher' : 'Pick'}</span>
              </span>
            </button>
          </div>
        </section>
      ) : (
        <ConfirmedRackBar
          label={isPt ? 'Saída de Áudio' : 'Audio Mode'}
          summary={
            isHeadphones
              ? isPt
                ? 'Fone de Ouvido (8D Direto)'
                : 'Headphones (Direct 8D)'
              : isPt
                ? '3 Caixas na Sala (C1, C2 e C3)'
                : '3 Room Speakers (C1, C2, C3)'
          }
          editLabel={isPt ? 'Alterar' : 'Edit'}
          testId="rack-bar-audio-mode"
          onEdit={() => setAudioModeConfirmed(false)}
        />
      )}

      {/* Calibration according to mode */}
      {isHeadphones ? (
        <section
          className={`flex flex-col gap-4 p-5 sm:p-6 ${ADMIN_PANEL_CLASS}`}
          data-testid="headphones-panel"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="max-w-lg">
              <h3 className="text-base font-semibold tracking-[-0.015em] text-slate-50">
                {isPt ? 'Volume geral e sincronia vídeo × som' : 'Master volume and A/V sync'}
              </h3>
              <p className="mt-1 text-[13px] leading-[1.55] text-slate-400">
                {isPt
                  ? 'Teste a movimentação do vento e compense o atraso caso use Bluetooth.'
                  : 'Test wind panning and compensate Bluetooth latency if needed.'}
              </p>
            </div>

            <button
              type="button"
              onClick={isPlaying ? onTogglePlay : onPlayPreview}
              className={`inline-flex min-h-[44px] items-center gap-2 px-5 text-[13px] ${PRESS_TRANSITION} ${ADMIN_PRIMARY_PILL_CLASS} ${ADMIN_FOCUS}`}
            >
              {isPlaying ? <Pause size={14} /> : <Play size={14} />}
              <span>
                {isPlaying
                  ? isPt
                    ? 'Pausar Teste'
                    : 'Pause Check'
                  : isPt
                    ? 'Ouvir Teste 8D'
                    : 'Play 8D Check'}
              </span>
            </button>
          </div>

          <div className="max-w-md">
            <div className="flex items-center justify-between text-xs text-slate-300 [font-variant-numeric:tabular-nums]">
              <span className="inline-flex items-center gap-1.5 font-medium">
                <Volume2 size={14} className="text-[#7dd3fc]" />
                <span>{isPt ? 'Volume Geral' : 'Master Volume'}</span>
              </span>
              <span className="font-semibold text-white">{Math.round(masterGain * 100)}%</span>
            </div>
            <input
              type="range"
              min={10}
              max={100}
              value={Math.round(masterGain * 100)}
              onChange={(e) => onSetMasterGain(Number(e.target.value) / 100)}
              className="mt-2 h-2 w-full cursor-pointer accent-[#38bdf8]"
            />
          </div>

          {renderGlobalAvSyncBox(true)}
        </section>
      ) : (
        <div className="flex flex-col gap-3.5" data-testid="room-speakers-panel">
          {/* Compact 2D Acoustic Map */}
          <section className={`p-5 sm:p-6 ${ADMIN_PANEL_CLASS}`}>
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
              <div>
                <h3 className="text-base font-semibold tracking-[-0.015em] text-slate-50">
                  {isPt ? 'Mapa acústico das 3 caixas' : '2D Acoustic Speaker Map'}
                </h3>
                <p className="mt-0.5 text-[13px] text-slate-400">
                  {isPt
                    ? 'Posicione C1 (Parede Esq), C2 (Parede Dir) e C3 (Teto/Fundo) formando triângulo.'
                    : 'Place C1 (Left Wall), C2 (Right Wall), and C3 (Ceiling/Rear) in a triangle.'}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5 text-xs font-medium text-slate-300">
                {SPEAKER_IDS.map((spkId) => (
                  <span
                    key={spkId}
                    className="rounded-lg border border-[#1e3a66]/55 bg-[#040b1a] px-2.5 py-1"
                  >
                    {isPt ? SPEAKER_META[spkId].zonePt : SPEAKER_META[spkId].zoneEn}
                  </span>
                ))}
              </div>
            </div>

            <AcousticStage2D
              isPt={isPt}
              surfaceToOutLabels={surfaceToOutLabels}
              liveEvents={liveEvents}
              speakerCalibration={speakerCalibration}
              calibTestMode={calibTestMode}
            />
          </section>

          {/* Routing & Level Equalization */}
          <section className={`p-5 sm:p-6 ${ADMIN_PANEL_CLASS}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold tracking-[-0.015em] text-slate-50">
                  {isPt ? 'Conecte cada caixa e iguale os volumes' : 'Route speakers and match levels'}
                </h3>
                <p className="mt-0.5 text-[13px] text-slate-400">
                  {isPt
                    ? 'Ative o ruído rosa em C1, C2 e/ou C3 simultaneamente para nivelar o ganho.'
                    : 'Toggle pink noise on any combination of C1, C2, C3 to balance volumes.'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {calibTestMode.kind !== 'off' && (
                  <button
                    type="button"
                    onClick={onStopCalibrationSignal}
                    data-testid="btn-stop-all-calib"
                    className={`inline-flex min-h-[42px] items-center gap-1.5 rounded-full bg-rose-500 px-3.5 text-xs font-semibold text-white hover:bg-rose-400 ${PRESS_TRANSITION} ${ADMIN_FOCUS}`}
                  >
                    <Square size={12} />
                    <span>{isPt ? 'Silenciar Todas' : 'Stop All Tests'}</span>
                  </button>
                )}

                {isSetSinkIdSupported && (
                  <button
                    type="button"
                    onClick={() => void onUnlockOutputDevices()}
                    className={`inline-flex min-h-[42px] items-center gap-1.5 rounded-full border border-[#2563eb]/65 bg-[#0c1a36] px-3.5 text-xs font-semibold text-white hover:bg-[#142850] ${PRESS_TRANSITION} ${ADMIN_FOCUS}`}
                  >
                    <RefreshCw size={12} className="text-[#7dd3fc]" />
                    <span className="[font-variant-numeric:tabular-nums]">
                      {outputSupportStatus === 'permission-needed'
                        ? isPt
                          ? 'Liberar Caixas USB / BT'
                          : 'Unlock USB / BT List'
                        : isPt
                          ? `Atualizar Caixas (${outputDevices.length})`
                          : `Refresh Speakers (${outputDevices.length})`}
                    </span>
                  </button>
                )}
              </div>
            </div>

            {syncNetworkMode === 'cloud-room' && (
              <div className={`mt-3 px-3.5 py-2 text-xs text-slate-400 ${ADMIN_WELL_CLASS}`}>
                {isPt
                  ? 'Em modo nuvem, prefira caixas ligadas direto neste PC (cabo, USB ou Bluetooth).'
                  : 'In cloud mode, direct PC outputs (cable, USB, Bluetooth) tighten timing.'}
              </div>
            )}

            <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
              {SPEAKER_IDS.map((spkId, idx) => {
                const spkNum = (idx + 1) as 1 | 2 | 3;
                const spk = speakerCalibration.speakers[spkId];
                const info = SPEAKER_META[spkId];
                const isPinkActive = isPinkNoiseSpeakerActive(calibTestMode, spkId);
                const nodeUrl = buildViewUrl(baseOrigin, 'audio-node', {
                  spk: spkNum,
                  roomCode,
                });
                const nodeHref = buildViewUrl(null, 'audio-node', {
                  spk: spkNum,
                  roomCode,
                });
                const nodeOnline = lanClients.some((p) => p.role === `audio-node-C${spkNum}`);
                const copyKey = `wiz-spk-${spkId}`;

                return (
                  <div
                    key={spkId}
                    className={`flex flex-col justify-between rounded-xl border p-4 transition-colors duration-150 ${
                      isPinkActive
                        ? 'border-[#2563eb] bg-[#0c1a36]/70'
                        : 'border-[#1e3a66]/55 bg-[#060c1a]/90'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-semibold text-slate-50">
                          {isPt ? info.zonePt : info.zoneEn}
                        </div>
                        {isPinkActive && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />
                            <span>Ativo</span>
                          </span>
                        )}
                      </div>

                      <div className={`mt-3 grid-cols-2 ${ADMIN_SEGMENT_WRAP_CLASS}`}>
                        <button
                          type="button"
                          onClick={() => onUpdateSpeakerConfig(spkId, { routeTarget: 'local' })}
                          className={`min-h-[38px] rounded-lg px-2 text-xs ${PRESS_TRANSITION} ${ADMIN_FOCUS} ${
                            spk.routeTarget === 'local'
                              ? ADMIN_SEGMENT_ACTIVE_CLASS
                              : ADMIN_SEGMENT_IDLE_CLASS
                          }`}
                        >
                          {isPt ? 'Neste PC' : 'On this PC'}
                        </button>
                        <button
                          type="button"
                          onClick={() => onUpdateSpeakerConfig(spkId, { routeTarget: 'lan-node' })}
                          className={`min-h-[38px] rounded-lg px-2 text-xs ${PRESS_TRANSITION} ${ADMIN_FOCUS} ${
                            spk.routeTarget === 'lan-node'
                              ? ADMIN_SEGMENT_ACTIVE_CLASS
                              : ADMIN_SEGMENT_IDLE_CLASS
                          }`}
                        >
                          {isPt ? 'Outro Aparelho' : 'Other Device'}
                        </button>
                      </div>

                      <div className="mt-2.5">
                        {spk.routeTarget === 'local' ? (
                          <div>
                            <AdminSelect
                              ariaLabel={isPt ? info.zonePt : info.zoneEn}
                              value={spk.sinkDeviceId}
                              options={deviceOptions}
                              disabled={!isSetSinkIdSupported}
                              onChange={(sinkDeviceId) =>
                                onUpdateSpeakerConfig(spkId, { sinkDeviceId })
                              }
                            />
                            {Boolean(spk.sinkDeviceId) &&
                            spk.sinkDeviceId !== 'default' &&
                            outputDevices.length > 0 &&
                            !outputDevices.some((d) => d.deviceId === spk.sinkDeviceId) ? (
                              <div className="mt-2 rounded-lg border border-amber-400/35 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-200">
                                {isPt
                                  ? 'Saída desconectada — selecione outra.'
                                  : 'Output disconnected — pick another.'}
                              </div>
                            ) : speakerSinkStatuses?.[spkId]?.status === 'error' ? (
                              <div
                                data-testid={`sink-status-${spkId}`}
                                className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-rose-400/35 bg-rose-500/10 px-2.5 py-1.5 text-[11px] text-rose-200"
                              >
                                <span className="min-w-0 flex-1 truncate">
                                  {isPt ? 'Falha ao enviar áudio.' : 'Failed to route audio.'}
                                </span>
                                {onRetrySpeakerSink && (
                                  <button
                                    type="button"
                                    onClick={() => onRetrySpeakerSink(spkId, true)}
                                    className="shrink-0 rounded-md border border-rose-300/40 bg-[#040b1a] px-2 py-1 font-semibold text-white hover:border-white"
                                  >
                                    {isPt ? 'Tentar outro motor' : 'Try other engine'}
                                  </button>
                                )}
                              </div>
                            ) : speakerSinkStatuses?.[spkId]?.status === 'pending-gesture' ? (
                              <div
                                data-testid={`sink-status-${spkId}`}
                                className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-400/35 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-200"
                              >
                                <span className="min-w-0 flex-1">
                                  {isPt ? 'Aguardando ativação.' : 'Waiting audio unlock.'}
                                </span>
                                {onRetrySpeakerSink && (
                                  <button
                                    type="button"
                                    onClick={() => onRetrySpeakerSink(spkId, false)}
                                    className="shrink-0 rounded-md border border-amber-300/40 bg-[#040b1a] px-2 py-1 font-semibold text-white hover:border-white"
                                  >
                                    {isPt ? 'Liberar saída' : 'Unlock output'}
                                  </button>
                                )}
                              </div>
                            ) : speakerSinkStatuses?.[spkId]?.status === 'routed' ? (
                              <div
                                data-testid={`sink-status-${spkId}`}
                                className="mt-2 flex items-center justify-between gap-2 text-[11px] text-slate-400"
                              >
                                <span>
                                  {speakerSinkStatuses[spkId]?.engine === 'audiocontext'
                                    ? isPt
                                      ? 'Ativo · Motor WebAudio'
                                      : 'Active · WebAudio engine'
                                    : isPt
                                      ? 'Ativo · Motor Media'
                                      : 'Active · Media engine'}
                                </span>
                                {onRetrySpeakerSink && (
                                  <button
                                    type="button"
                                    onClick={() => onRetrySpeakerSink(spkId, true)}
                                    className="rounded border border-[#1e3a66] bg-[#040b1a] px-2 py-0.5 text-[10px] font-medium text-slate-300 hover:border-[#2563eb] hover:text-white"
                                  >
                                    {isPt ? 'Trocar motor' : 'Switch engine'}
                                  </button>
                                )}
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <div className="rounded-xl border border-[#1e3a66]/55 bg-[#040b1a] p-2.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="inline-flex items-center gap-1.5 font-medium text-slate-200">
                                <span
                                  className={`h-2 w-2 rounded-full ${
                                    nodeOnline ? 'bg-emerald-400' : 'bg-slate-500'
                                  }`}
                                />
                                <span>
                                  {nodeOnline
                                    ? isPt
                                      ? 'Conectada'
                                      : 'Connected'
                                    : isPt
                                      ? 'Abrir nó remoto'
                                      : 'Open remote node'}
                                </span>
                              </span>
                            </div>
                            <div className="mt-2 flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => onCopyText(copyKey, nodeUrl)}
                                className={`inline-flex min-h-[38px] flex-1 items-center justify-center gap-1 rounded-lg border border-[#1e3a66] bg-[#060c1a] px-2.5 text-xs font-medium text-slate-200 hover:border-[#2563eb] hover:text-white ${PRESS_TRANSITION} ${ADMIN_FOCUS}`}
                              >
                                {copiedKey === copyKey ? (
                                  <Check size={12} className="text-[#7dd3fc]" />
                                ) : (
                                  <Copy size={12} />
                                )}
                                <span>
                                  {copiedKey === copyKey ? 'OK' : isPt ? 'Copiar' : 'Copy'}
                                </span>
                              </button>
                              <a
                                href={nodeHref}
                                target="_blank"
                                rel="noreferrer"
                                className={`inline-flex min-h-[38px] items-center justify-center gap-1 rounded-lg border border-[#1e3a66] bg-[#060c1a] px-2.5 text-xs font-medium text-slate-200 hover:border-[#2563eb] hover:text-white ${PRESS_TRANSITION} ${ADMIN_FOCUS}`}
                              >
                                <span>{isPt ? 'Abrir' : 'Open'}</span>
                                <ExternalLink size={12} />
                              </a>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 border-t border-[#1e3a66]/45 pt-3">
                      <div className="flex items-center justify-between text-xs text-slate-300 [font-variant-numeric:tabular-nums]">
                        <span>{isPt ? 'Ganho' : 'Gain'}</span>
                        <span className="font-semibold text-white">
                          {Math.round(spk.calibrationGain * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={25}
                        max={200}
                        value={Math.round(spk.calibrationGain * 100)}
                        onChange={(e) =>
                          onUpdateSpeakerConfig(spkId, {
                            calibrationGain: Number(e.target.value) / 100,
                          })
                        }
                        className="mt-1.5 h-2 w-full cursor-pointer accent-[#38bdf8]"
                      />

                      <div className="mt-2.5">
                        <button
                          type="button"
                          aria-pressed={isPinkActive}
                          data-testid={`toggle-pink-${spkId}`}
                          onClick={() => onTogglePinkNoiseSpeaker(spkId)}
                          className={`inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-semibold ${PRESS_TRANSITION} ${ADMIN_FOCUS} ${
                            isPinkActive
                              ? 'border-white bg-white text-[#060913]'
                              : 'border-[#1e3a66] bg-[#040b1a] text-slate-200 hover:border-[#2563eb] hover:text-white'
                          }`}
                        >
                          <Volume2 size={13} />
                          <span>
                            {isPinkActive
                              ? isPt
                                ? `Tocando ${info.shortCode} · Desligar`
                                : `Playing ${info.shortCode} · Stop`
                              : isPt
                                ? `Ativar Som (${info.shortCode})`
                                : `Toggle Sound (${info.shortCode})`}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Speaker delay + A/V Offset accordion */}
            <div className={`mt-4 ${ADMIN_WELL_CLASS}`}>
              <button
                type="button"
                aria-expanded={delayPanelOpen}
                data-testid="delay-panel-toggle"
                onClick={() => setDelayPanelOpen((prev) => !prev)}
                className={`flex min-h-[46px] w-full items-center justify-between gap-3 rounded-xl px-4 py-2.5 text-left text-xs font-semibold text-slate-200 hover:text-white ${ADMIN_FOCUS}`}
              >
                <span className="[font-variant-numeric:tabular-nums]">
                  {isPt
                    ? 'Sincronizar atraso Bluetooth (-400 a +400 ms) e Vídeo × Som'
                    : 'Sync Bluetooth speaker delay (-400 to +400 ms) & Video × Audio'}
                </span>
                <ChevronDown
                  size={15}
                  className={`shrink-0 text-slate-400 transition-transform duration-150 ${
                    delayPanelOpen ? 'rotate-180 text-[#7dd3fc]' : ''
                  }`}
                />
              </button>

              <div
                data-testid="delay-panel-body"
                hidden={!delayPanelOpen}
                className={delayPanelOpen ? 'border-t border-[#1e3a66]/45 p-4 pt-3' : 'hidden'}
              >
                <p className="text-xs text-slate-400">
                  {isPt
                    ? 'Ligue o pulso rítmico nas caixas que deseja comparar e alinhe até ouvir uma única batida.'
                    : 'Enable the rhythmic pulse on speakers to align until beats land as one click.'}
                </p>

                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {SPEAKER_IDS.map((spkId) => {
                    const spk = speakerCalibration.speakers[spkId];
                    const info = SPEAKER_META[spkId];
                    const isClickActive = isDelayClickSpeakerActive(
                      calibTestMode,
                      spkId,
                      speakerCalibration.referenceSpeakerId
                    );
                    return (
                      <div
                        key={`${spkId}-delay`}
                        className={`rounded-xl border p-3 transition-colors duration-150 ${
                          isClickActive
                            ? 'border-[#2563eb] bg-[#0c1a36]/70'
                            : 'border-[#1e3a66]/45 bg-[#060c1a]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 text-xs [font-variant-numeric:tabular-nums]">
                          <span className="font-semibold text-slate-200">
                            {isPt ? info.zonePt : info.zoneEn}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {spk.delayMs !== 0 && (
                              <button
                                type="button"
                                onClick={() => onUpdateSpeakerConfig(spkId, { delayMs: 0 })}
                                className="rounded border border-[#1e3a66] bg-[#040b1a] px-1.5 py-0.5 text-[10px] text-slate-300 hover:text-white"
                              >
                                0
                              </button>
                            )}
                            <span className="font-semibold text-[#7dd3fc]">
                              {formatSignedMs(spk.delayMs)}
                            </span>
                          </div>
                        </div>
                        <input
                          type="range"
                          min={-400}
                          max={400}
                          step={5}
                          value={spk.delayMs}
                          onChange={(e) =>
                            onUpdateSpeakerConfig(spkId, { delayMs: Number(e.target.value) })
                          }
                          className="mt-2 h-2 w-full cursor-pointer accent-[#38bdf8]"
                        />
                        <div className="mt-0.5 flex justify-between text-[10px] text-slate-500 [font-variant-numeric:tabular-nums]">
                          <span>-400 ms</span>
                          <span>0</span>
                          <span>+400 ms</span>
                        </div>
                        <button
                          type="button"
                          aria-pressed={isClickActive}
                          data-testid={`toggle-click-${spkId}`}
                          onClick={() => onToggleDelayClickSpeaker(spkId)}
                          className={`mt-2 inline-flex min-h-[42px] w-full items-center justify-center gap-1.5 rounded-lg border text-xs font-semibold ${PRESS_TRANSITION} ${ADMIN_FOCUS} ${
                            isClickActive
                              ? 'border-white bg-white text-[#060913]'
                              : 'border-[#1e3a66] bg-[#040b1a] text-slate-200 hover:border-[#2563eb]'
                          }`}
                        >
                          <Zap size={13} />
                          <span>
                            {isClickActive
                              ? isPt
                                ? `Pulso ${info.shortCode} · Parar`
                                : `Pulse ${info.shortCode} · Stop`
                              : isPt
                                ? `Ativar Pulso (${info.shortCode})`
                                : `Toggle Pulse (${info.shortCode})`}
                          </span>
                        </button>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4">{renderGlobalAvSyncBox(false)}</div>
              </div>
            </div>
          </section>
        </div>
      )}

      <NextBlockTeaser
        title={isPt ? 'Parear celular ou tablet de controle' : 'Pair remote phone or tablet'}
        subtitle={
          isPt
            ? 'Leia o QR Code com o celular ou pule quando estiver explorando em tela única.'
            : 'Scan the QR Code with a phone or skip when exploring on one screen.'
        }
        slotCount={2}
      />
    </div>
  );
};
