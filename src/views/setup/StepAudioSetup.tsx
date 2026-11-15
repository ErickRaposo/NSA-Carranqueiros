import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  Headphones,
  Info,
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
  ADMIN_FOCUS,
  ADMIN_PANEL_CLASS,
  ADMIN_PRIMARY_PILL_CLASS,
  ADMIN_SEGMENT_ACTIVE_CLASS,
  ADMIN_SEGMENT_IDLE_CLASS,
  ADMIN_SEGMENT_WRAP_CLASS,
  ADMIN_WELL_CLASS,
} from '../admin/adminMeta';

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

const SPEAKER_POSITION_HELP: Record<
  SpeakerSlotId,
  { zonePt: string; zoneEn: string; shortCode: string; tipPt: string; tipEn: string }
> = {
  speaker1: {
    zonePt: 'C1 · Parede Esquerda',
    zoneEn: 'C1 · Left Wall',
    shortCode: 'C1',
    tipPt: 'Posicione próxima à parede esquerda apontando para o centro da sala.',
    tipEn: 'Place near the left wall aimed toward the center of the room.',
  },
  speaker2: {
    zonePt: 'C2 · Parede Direita',
    zoneEn: 'C2 · Right Wall',
    shortCode: 'C2',
    tipPt: 'Posicione próxima à parede direita apontando para o centro da sala.',
    tipEn: 'Place near the right wall aimed toward the center of the room.',
  },
  speaker3: {
    zonePt: 'C3 · Teto ou Fundo',
    zoneEn: 'C3 · Ceiling or Rear',
    shortCode: 'C3',
    tipPt: 'Posicione elevada ou atrás do visitante para fechar o campo 8D.',
    tipEn: 'Place elevated or behind the listener to complete the 3D soundstage.',
  },
};

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
  // Regra confirmada: o Tablet nunca emite áudio — o som sempre sai pelo PC / caixas da sala
  useEffect(() => {
    if (audioOwner !== 'pc') {
      onSetAudioOwner('pc');
    }
    onSetLocalAudioMuted(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Flash visual instantâneo (0 ms de ataque CSS) sincronizado com cada batida do pulso rítmico
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

  // Estado manual do acordeão da Seção 3: nunca fecha sozinho ao desligar pulsos
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

  const renderGlobalAvSyncBox = (showHeadphoneClickButton: boolean) => (
    <div
      data-testid="av-offset-sync-card"
      className="rounded-2xl border border-[#1e3a66]/55 bg-[#060c1a]/95 p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="max-w-xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-100">
              {isPt ? 'Atraso Vídeo × Som (Global)' : 'Video × Audio Offset (Global)'}
            </span>
            <span className="rounded-full border border-[#2563eb]/50 bg-[#0c1a36] px-2.5 py-0.5 text-[11px] font-semibold text-[#7dd3fc] [font-variant-numeric:tabular-nums]">
              {formatSignedMs(avOffsetMs)}
            </span>
            {avOffsetMs !== 0 && (
              <button
                type="button"
                onClick={() => onUpdateAvOffsetMs(0)}
                className={`inline-flex min-h-[28px] items-center gap-1 rounded-full border border-[#1e3a66] bg-[#040b1a] px-2.5 text-[11px] text-slate-300 hover:border-[#2563eb] hover:text-white ${ADMIN_FOCUS}`}
              >
                <RotateCcw size={11} />
                <span>0 ms</span>
              </button>
            )}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            {isPt
              ? 'Valores negativos (-400 a 0 ms) atrasam a imagem para acompanhar fones ou caixas Bluetooth. Valores positivos (0 a +400 ms) atrasam o som caso o projetor tenha atraso de imagem.'
              : 'Negative values (-400 to 0 ms) delay visuals to match Bluetooth audio lag. Positive values (0 to +400 ms) delay audio if your projector lags.'}
          </p>
        </div>

        {/* Indicador Visual de Batida (pisca junto com os projetores abertos!) */}
        <div className="flex items-center gap-2.5">
          {showHeadphoneClickButton && (
            <button
              type="button"
              onClick={onToggleHeadphoneDelayClick}
              aria-pressed={isAnyClickModeActive}
              data-testid="btn-headphone-sync-click"
              className={`inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border px-3.5 text-xs font-semibold transition ${ADMIN_FOCUS} ${
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
                    ? 'Testar Pulso (Som + Luz)'
                    : 'Test Sync Pulse'}
              </span>
            </button>
          )}

          <div
            data-testid="calib-visual-beat-flash"
            style={{
              transition: beatFlashOn ? 'none' : 'all 140ms ease-out',
            }}
            className={`flex min-h-[42px] min-w-[132px] items-center justify-center gap-2 rounded-xl border px-3 text-xs font-semibold select-none [font-variant-numeric:tabular-nums] ${
              beatFlashOn && isAnyClickModeActive
                ? 'scale-[1.03] border-white bg-white text-[#060913] shadow-[0_0_24px_rgba(125,211,252,0.85)]'
                : 'border-[#1e3a66]/65 bg-[#040b1a] text-slate-400'
            }`}
          >
            <span
              style={{ transition: beatFlashOn ? 'none' : 'all 140ms ease-out' }}
              className={`h-3 w-3 rounded-full ${
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
                  ? 'FLASH DE BATIDA'
                  : 'SYNC BEAT FLASH'
                : isPt
                  ? 'Luz de Sincronia'
                  : 'Sync Flash Idle'}
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
        <div className="mt-1 flex justify-between text-[11px] text-slate-400 [font-variant-numeric:tabular-nums]">
          <span>-400 ms ({isPt ? 'atrasa vídeo' : 'delay video'})</span>
          <span>0 ms</span>
          <span>+400 ms ({isPt ? 'atrasa som' : 'delay audio'})</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-5" data-testid="setup-step-audio">
      {/* Escolha Principal: Fone de Ouvido vs 3 Caixas na Sala */}
      <section className={`p-5 ${ADMIN_PANEL_CLASS}`}>
        <div className="max-w-2xl">
          <span className="text-xs font-semibold tracking-wide text-[#7dd3fc] uppercase">
            {isPt ? 'Passo 3 · Som Espacial 8D' : 'Step 3 · 8D Spatial Sound'}
          </span>
          <h2 className="mt-1 text-lg font-semibold text-slate-50">
            {isPt ? 'Por onde o som vai sair?' : 'How will people listen to the audio?'}
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-300">
            {isPt
              ? 'Na Earth Jukebox, a direção real do vento move o som de um lado para o outro ao redor de você. Escolha abaixo entre fone de ouvido ou caixas de som na sala.'
              : 'In Earth Jukebox, real NASA wind telemetry moves the sound from side to side around you. Choose between headphones or room speakers below.'}
          </p>
        </div>

        {/* Nota clara sobre o Tablet silencioso */}
        <div className={`mt-3.5 flex items-start gap-2.5 p-3 text-xs text-slate-200 ${ADMIN_WELL_CLASS}`}>
          <Info size={15} className="mt-0.5 shrink-0 text-[#7dd3fc]" />
          <span>
            {isPt
              ? 'Importante: o som sai sempre por este computador (ou pelas caixas conectadas). O celular/tablet funciona apenas como controle remoto silencioso.'
              : 'Note: audio always plays from this computer (or connected speakers). Your phone/tablet acts strictly as a silent remote control.'}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <button
            type="button"
            onClick={() => {
              onStopCalibrationSignal();
              onSetAudioMode('hrtf');
            }}
            aria-pressed={isHeadphones}
            data-testid="audio-choice-headphones"
            className={`flex flex-col justify-between rounded-2xl border p-4 text-left transition ${ADMIN_FOCUS} ${
              isHeadphones
                ? 'border-[#2563eb] bg-[#0c1a36] text-white'
                : 'border-[#1e3a66]/55 bg-[#060c1a]/90 text-slate-200 hover:border-[#2563eb]/55'
            }`}
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#1e3a66] bg-[#040b1a] text-[#7dd3fc]">
                  <Headphones size={19} />
                </span>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    isHeadphones
                      ? 'bg-[#2563eb]/35 text-[#7dd3fc]'
                      : 'bg-white/[0.04] text-slate-400'
                  }`}
                >
                  {isPt ? 'Configuração Instantânea' : 'Zero Setup'}
                </span>
              </div>
              <h3 className="mt-3 text-base font-semibold text-slate-50">
                {isPt ? 'Fone de Ouvido (8D Direto)' : 'Headphones (Direct 8D)'}
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-300">
                {isPt
                  ? 'Cria a sensação 3D diretamente nos dois lados do fone, sem precisar configurar caixas externas.'
                  : 'Creates full 3D movement directly in your headphones — no external speaker routing needed.'}
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              onStopCalibrationSignal();
              onSetAudioMode('room3');
            }}
            aria-pressed={!isHeadphones}
            data-testid="audio-choice-room3"
            className={`flex flex-col justify-between rounded-2xl border p-4 text-left transition ${ADMIN_FOCUS} ${
              !isHeadphones
                ? 'border-[#2563eb] bg-[#0c1a36] text-white'
                : 'border-[#1e3a66]/55 bg-[#060c1a]/90 text-slate-200 hover:border-[#2563eb]/55'
            }`}
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#1e3a66] bg-[#040b1a] text-[#7dd3fc]">
                  <Speaker size={19} />
                </span>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    !isHeadphones
                      ? 'bg-[#2563eb]/35 text-[#7dd3fc]'
                      : 'bg-white/[0.04] text-slate-400'
                  }`}
                >
                  {isPt ? 'Quarto Imersivo' : 'Immersive Room'}
                </span>
              </div>
              <h3 className="mt-3 text-base font-semibold text-slate-50">
                {isPt
                  ? 'Caixas de Som na Sala (3 Caixas — 8D Simulado)'
                  : 'Room Speakers (3 Speakers — Simulated 8D)'}
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-300">
                {isPt
                  ? 'Distribui raios, acordes, nave e narração entre Parede Esquerda (C1), Parede Direita (C2) e Teto/Fundo (C3).'
                  : 'Distributes lightning, chords, spaceship, and narration across Left Wall (C1), Right Wall (C2), and Ceiling/Rear (C3).'}
              </p>
            </div>
          </button>
        </div>
      </section>

      {/* Caminho A: Fone de Ouvido */}
      {isHeadphones ? (
        <section className={`flex flex-col gap-5 p-5 ${ADMIN_PANEL_CLASS}`} data-testid="headphones-panel">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="max-w-xl">
              <h3 className="text-base font-semibold text-slate-50">
                {isPt ? 'Teste Rápido no Fone de Ouvido' : 'Quick Headphone Sound Check'}
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-300">
                {isPt
                  ? 'Coloque os dois lados do fone (L e R) e clique no botão ao lado para testar o volume e sentir o vento movendo o som.'
                  : 'Put on both earcups (L and R) and click the button to check the volume and feel the wind moving the audio.'}
              </p>
            </div>

            <button
              type="button"
              onClick={isPlaying ? onTogglePlay : onPlayPreview}
              className={`inline-flex min-h-[44px] items-center gap-2 px-5 text-xs ${ADMIN_PRIMARY_PILL_CLASS} ${ADMIN_FOCUS}`}
            >
              {isPlaying ? <Pause size={14} /> : <Play size={14} />}
              <span>
                {isPlaying
                  ? isPt
                    ? 'Pausar Teste'
                    : 'Pause Sound Check'
                  : isPt
                    ? 'Ouvir Teste 8D Agora'
                    : 'Play 8D Sound Check'}
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
        /* Caminho B: 3 Caixas de Som na Sala */
        <div className="flex flex-col gap-5" data-testid="room-speakers-panel">
          {/* 1. Onde posicionar cada caixa */}
          <section className={`p-5 ${ADMIN_PANEL_CLASS}`}>
            <div className="grid grid-cols-1 items-center gap-5 lg:grid-cols-12">
              <div className="lg:col-span-5">
                <AcousticStage2D
                  isPt={isPt}
                  surfaceToOutLabels={surfaceToOutLabels}
                  liveEvents={liveEvents}
                  speakerCalibration={speakerCalibration}
                  calibTestMode={calibTestMode}
                />
              </div>

              <div className="flex flex-col gap-3 lg:col-span-7">
                <h3 className="text-base font-semibold text-slate-50">
                  {isPt
                    ? '1. Onde posicionar as 3 caixas na sala'
                    : '1. Where to place the 3 speakers'}
                </h3>
                <p className="text-xs leading-relaxed text-slate-300">
                  {isPt
                    ? 'Posicione as caixas formando um triângulo ao redor de quem vai assistir. Não precisa ser milimétrico:'
                    : 'Place the speakers forming a triangle around the listener. Exact measurements are not required:'}
                </p>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {SPEAKER_IDS.map((spkId) => {
                    const info = SPEAKER_POSITION_HELP[spkId];
                    return (
                      <div key={spkId} className={`p-3 ${ADMIN_WELL_CLASS}`}>
                        <div className="text-xs font-semibold text-[#7dd3fc]">
                          {isPt ? info.zonePt : info.zoneEn}
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-slate-300">
                          {isPt ? info.tipPt : info.tipEn}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          {/* 2. Conectar cada caixa + Igualar Volume com Toggles Independentes */}
          <section className={`p-5 ${ADMIN_PANEL_CLASS}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="max-w-2xl">
                <h3 className="text-base font-semibold text-slate-50">
                  {isPt
                    ? '2. Conecte cada caixa e iguale os volumes'
                    : '2. Connect each speaker and match volumes'}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-300">
                  {isPt
                    ? 'Ative o som de teste em quantas caixas quiser ao mesmo tempo (C1, C2 e/ou C3) para comparar e igualar o volume livremente. Para caixas neste PC, clique em "Liberar Seleção de Caixas".'
                    : 'Toggle test sound on any combination of speakers (C1, C2, and/or C3) simultaneously to match volumes freely. For speakers on this PC, click "Unlock Speaker List".'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {calibTestMode.kind !== 'off' && (
                  <button
                    type="button"
                    onClick={onStopCalibrationSignal}
                    data-testid="btn-stop-all-calib"
                    className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-rose-500 px-4 text-xs font-semibold text-white transition hover:bg-rose-400 ${ADMIN_FOCUS}`}
                  >
                    <Square size={12} />
                    <span>{isPt ? 'Silenciar Todas' : 'Stop All Tests'}</span>
                  </button>
                )}

                {isSetSinkIdSupported && (
                  <button
                    type="button"
                    onClick={() => void onUnlockOutputDevices()}
                    className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-[#2563eb]/65 bg-[#0c1a36] px-4 text-xs font-semibold text-white transition hover:bg-[#142850] ${ADMIN_FOCUS}`}
                  >
                    <RefreshCw size={13} className="text-[#7dd3fc]" />
                    <span>
                      {outputSupportStatus === 'permission-needed'
                        ? isPt
                          ? 'Liberar Seleção de Caixas USB / BT'
                          : 'Unlock USB / BT Speaker List'
                        : isPt
                          ? `Atualizar Caixas (${outputDevices.length})`
                          : `Refresh Speakers (${outputDevices.length})`}
                    </span>
                  </button>
                )}
              </div>
            </div>

            {syncNetworkMode === 'cloud-room' && (
              <div className={`mt-3 p-3 text-xs text-slate-300 ${ADMIN_WELL_CLASS}`}>
                {isPt
                  ? 'Dica de sincronia: usando o domínio online pela internet, prefira ligar as caixas direto neste computador (cabo/USB/Bluetooth) para evitar diferença de tempo entre aparelhos.'
                  : 'Sync tip: when running over the internet, prefer connecting speakers directly to this computer (cable/USB/Bluetooth) for tightest acoustic timing.'}
              </div>
            )}

            <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
              {SPEAKER_IDS.map((spkId, idx) => {
                const spkNum = (idx + 1) as 1 | 2 | 3;
                const spk = speakerCalibration.speakers[spkId];
                const info = SPEAKER_POSITION_HELP[spkId];
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
                    className={`flex flex-col justify-between rounded-2xl border p-4 transition ${
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
                            <span>ON</span>
                          </span>
                        )}
                      </div>

                      {/* Onde esta caixa está ligada */}
                      <div className={`mt-3 grid-cols-2 ${ADMIN_SEGMENT_WRAP_CLASS}`}>
                        <button
                          type="button"
                          onClick={() => onUpdateSpeakerConfig(spkId, { routeTarget: 'local' })}
                          className={`min-h-[38px] rounded-lg px-2 text-xs transition ${ADMIN_FOCUS} ${
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
                          className={`min-h-[38px] rounded-lg px-2 text-xs transition ${ADMIN_FOCUS} ${
                            spk.routeTarget === 'lan-node'
                              ? ADMIN_SEGMENT_ACTIVE_CLASS
                              : ADMIN_SEGMENT_IDLE_CLASS
                          }`}
                        >
                          {isPt ? 'Outro PC/Celular' : 'Other Device'}
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
                                  ? 'Saída salva desconectada — escolha outro dispositivo.'
                                  : 'Saved output disconnected — pick another device.'}
                              </div>
                            ) : speakerSinkStatuses?.[spkId]?.status === 'error' ? (
                              <div
                                data-testid={`sink-status-${spkId}`}
                                className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-rose-400/35 bg-rose-500/10 px-2.5 py-1.5 text-[11px] text-rose-200"
                              >
                                <span className="min-w-0 flex-1 truncate">
                                  {isPt
                                    ? 'Falha ao enviar para este aparelho.'
                                    : 'Failed to route to this device.'}
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
                                  {isPt
                                    ? 'Aguardando ativação de som para esta saída.'
                                    : 'Waiting for audio unlock on this output.'}
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
                                      ? 'Conectada na sala'
                                      : 'Connected in room'
                                    : isPt
                                      ? 'Abra este link no outro aparelho'
                                      : 'Open link on other device'}
                                </span>
                              </span>
                            </div>
                            <div className="mt-2 flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => onCopyText(copyKey, nodeUrl)}
                                className={`inline-flex min-h-[38px] flex-1 items-center justify-center gap-1 rounded-lg border border-[#1e3a66] bg-[#060c1a] px-2.5 text-xs font-medium text-slate-200 hover:border-[#2563eb] hover:text-white ${ADMIN_FOCUS}`}
                              >
                                {copiedKey === copyKey ? (
                                  <Check size={12} className="text-[#7dd3fc]" />
                                ) : (
                                  <Copy size={12} />
                                )}
                                <span>
                                  {copiedKey === copyKey
                                    ? 'OK'
                                    : isPt
                                      ? 'Copiar Link'
                                      : 'Copy Link'}
                                </span>
                              </button>
                              <a
                                href={nodeHref}
                                target="_blank"
                                rel="noreferrer"
                                className={`inline-flex min-h-[38px] items-center justify-center gap-1 rounded-lg border border-[#1e3a66] bg-[#060c1a] px-2.5 text-xs font-medium text-slate-200 hover:border-[#2563eb] hover:text-white ${ADMIN_FOCUS}`}
                              >
                                <span>{isPt ? 'Abrir' : 'Open'}</span>
                                <ExternalLink size={12} />
                              </a>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Toggle Independente de Ruído Rosa + Volume */}
                    <div className="mt-4 border-t border-[#1e3a66]/45 pt-3">
                      <div className="flex items-center justify-between text-xs text-slate-300 [font-variant-numeric:tabular-nums]">
                        <span>{isPt ? 'Volume desta caixa' : 'Speaker volume'}</span>
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
                          className={`inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition ${ADMIN_FOCUS} ${
                            isPinkActive
                              ? 'border-white bg-white text-[#060913]'
                              : 'border-[#1e3a66] bg-[#040b1a] text-slate-200 hover:border-[#2563eb] hover:text-white'
                          }`}
                        >
                          <Volume2 size={14} />
                          <span>
                            {isPinkActive
                              ? isPt
                                ? `Tocando ${info.shortCode} · Desligar`
                                : `Playing ${info.shortCode} · Turn Off`
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

            {/* 3. Sincronização de Atraso por Caixa (-400..+400 ms) + Atraso Vídeo × Som + Luz de Batida */}
            <div className={`mt-4 ${ADMIN_WELL_CLASS}`}>
              <button
                type="button"
                aria-expanded={delayPanelOpen}
                data-testid="delay-panel-toggle"
                onClick={() => setDelayPanelOpen((prev) => !prev)}
                className={`flex min-h-[46px] w-full items-center justify-between gap-3 rounded-xl px-4 py-3 text-left text-xs font-semibold text-slate-200 transition hover:text-white ${ADMIN_FOCUS}`}
              >
                <span>
                  {isPt
                    ? '3. Sincronizar atraso Bluetooth entre caixas (-400 a +400 ms) e Vídeo × Som'
                    : '3. Sync Bluetooth speaker delay (-400 to +400 ms) and Video × Audio offset'}
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
                <p className="text-xs leading-relaxed text-slate-300">
                    {isPt
                      ? 'Ative o pulso rítmico nas caixas que quiser comparar ao mesmo tempo. Ajuste o atraso de cada caixa até ouvir uma batida única e seca, e use o controle global abaixo para cravar o flash visual na parede projetada com o som.'
                      : 'Enable the rhythmic click on any combination of speakers simultaneously. Adjust per-speaker delay until beats land together cleanly, then use the global slider below to align the projected wall flash with the sound.'}
                  </p>

                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {SPEAKER_IDS.map((spkId) => {
                      const spk = speakerCalibration.speakers[spkId];
                      const info = SPEAKER_POSITION_HELP[spkId];
                      const isClickActive = isDelayClickSpeakerActive(
                        calibTestMode,
                        spkId,
                        speakerCalibration.referenceSpeakerId
                      );
                      return (
                        <div
                          key={`${spkId}-delay`}
                          className={`rounded-xl border p-3 transition ${
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
                            className={`mt-2 inline-flex min-h-[42px] w-full items-center justify-center gap-1.5 rounded-lg border text-xs font-semibold transition ${ADMIN_FOCUS} ${
                              isClickActive
                                ? 'border-white bg-white text-[#060913]'
                                : 'border-[#1e3a66] bg-[#040b1a] text-slate-200 hover:border-[#2563eb]'
                            }`}
                          >
                            <Zap size={13} />
                            <span>
                              {isClickActive
                                ? isPt
                                  ? `Pulso ${info.shortCode} Ligado · Desligar`
                                  : `Pulse ${info.shortCode} On · Turn Off`
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
    </div>
  );
};
