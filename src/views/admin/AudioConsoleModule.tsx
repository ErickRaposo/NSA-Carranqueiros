import React, { useMemo } from 'react';
import {
  Check,
  Copy,
  ExternalLink,
  Headphones,
  Radio,
  RefreshCw,
  RotateCcw,
  Speaker,
  Star,
} from 'lucide-react';
import {
  AudioCalibrationState,
  SPEAKER_IDS,
  SpeakerSlotConfig,
  SpeakerSlotId,
} from '../../audio/speakerCalibration';
import { AudioAdminContextValue } from '../../experience/ExperienceContext';
import {
  AudioOutputMode,
  AudioOwnerRole,
  LanPeerInfo,
  LiveNoteEvent,
  SurfaceId,
} from '../../experience/types';
import { AcousticStage2D } from './AcousticStage2D';
import { AdminSelect } from './AdminSelect';
import { FaderControl } from './FaderControl';
import { LedRmsMeter } from './LedRmsMeter';
import {
  ADMIN_FOCUS,
  ADMIN_PANEL_CLASS,
  ADMIN_PRIMARY_PILL_CLASS,
  ADMIN_SEGMENT_ACTIVE_CLASS,
  ADMIN_SEGMENT_IDLE_CLASS,
  ADMIN_SEGMENT_WRAP_CLASS,
  ADMIN_WELL_CLASS,
} from './adminMeta';

interface AudioConsoleModuleProps {
  isPt: boolean;
  surfaceToOutLabels: Record<SurfaceId, string[]>;
  liveEvents: LiveNoteEvent[];
  speakerCalibration: AudioCalibrationState;
  speakerLiveLevels: Record<SpeakerSlotId, number>;
  calibTestMode: AudioAdminContextValue['calibTestMode'];
  audioMode: AudioOutputMode;
  audioOwner: AudioOwnerRole;
  realAudioRms01: number;
  audioSourceKind: 'stems' | 'meta-synth';
  localAudioMuted: boolean;
  audioLevels: { melody: number; chords: number; bass: number; wind: number };
  outputSupportStatus: AudioAdminContextValue['outputSupportStatus'];
  outputDevices: AudioAdminContextValue['outputDevices'];
  isSetSinkIdSupported: boolean;
  lanPort: number;
  baseOrigin: string;
  lanClients: LanPeerInfo[];
  copiedKey: string | null;
  onUnlockOutputDevices: () => Promise<unknown> | void;
  onResetSpeakerCalibration: () => void;
  onSetAudioMode: (mode: AudioOutputMode) => void;
  onSetAudioOwner: (owner: AudioOwnerRole) => void;
  onStopCalibrationSignal: () => void;
  onSetReferenceSpeaker: (id: SpeakerSlotId) => void;
  onUpdateSpeakerConfig: (id: SpeakerSlotId, patch: Partial<SpeakerSlotConfig>) => void;
  onStartPinkNoiseSingle: (id: SpeakerSlotId) => void;
  onStartPinkNoiseAB: (id: SpeakerSlotId) => void;
  onStartDelayClickTest: (id: SpeakerSlotId) => void;
  onStartPinkNoiseAll: () => void;
  onStartDelayClickAll: () => void;
  onCopyText: (key: string, text: string) => void;
  onToggleLocalMute: () => void;
}

export const AudioConsoleModule: React.FC<AudioConsoleModuleProps> = ({
  isPt,
  surfaceToOutLabels,
  liveEvents,
  speakerCalibration,
  speakerLiveLevels,
  calibTestMode,
  audioMode,
  audioOwner,
  realAudioRms01,
  audioSourceKind,
  localAudioMuted,
  audioLevels,
  outputSupportStatus,
  outputDevices,
  isSetSinkIdSupported,
  lanPort,
  baseOrigin,
  lanClients,
  copiedKey,
  onUnlockOutputDevices,
  onResetSpeakerCalibration,
  onSetAudioMode,
  onSetAudioOwner,
  onStopCalibrationSignal,
  onSetReferenceSpeaker,
  onUpdateSpeakerConfig,
  onStartPinkNoiseSingle,
  onStartPinkNoiseAB,
  onStartDelayClickTest,
  onStartPinkNoiseAll,
  onStartDelayClickAll,
  onCopyText,
  onToggleLocalMute,
}) => {
  const deviceOptions = useMemo(
    () => [
      { value: '', label: isPt ? 'Saída Padrão' : 'Default Output' },
      ...outputDevices.map((dev) => ({ value: dev.deviceId, label: dev.label })),
    ],
    [isPt, outputDevices]
  );

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
      {/* Planta Acústica 2D + Motor + Origem da Sala (4 cols) */}
      <section className={`flex flex-col justify-between p-4 xl:col-span-4 ${ADMIN_PANEL_CLASS}`}>
        <div>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold tracking-[-0.01em] text-slate-50">
              {isPt ? 'Planta Acústica 2D' : '2D Acoustic Stage'}
            </h2>
            <button
              type="button"
              onClick={onResetSpeakerCalibration}
              className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-full border border-[#1e3a66] bg-[#060c1a] px-3 text-xs font-medium text-slate-200 transition hover:border-[#2563eb] hover:text-white ${ADMIN_FOCUS}`}
            >
              <RotateCcw size={12} />
              <span>Reset</span>
            </button>
          </div>

          <AcousticStage2D
            isPt={isPt}
            surfaceToOutLabels={surfaceToOutLabels}
            liveEvents={liveEvents}
            speakerCalibration={speakerCalibration}
            calibTestMode={calibTestMode}
          />
        </div>

        <div className="mt-4 flex flex-col gap-3 border-t border-[#1e3a66]/45 pt-3">
          <div>
            <div className="mb-2 flex items-center justify-between gap-2 text-xs font-medium text-slate-200">
              <span className="inline-flex items-center gap-1.5">
                <Headphones size={14} className="text-[#7dd3fc]" />
                <span>{isPt ? 'Motor de Espacialização' : 'Spatialization Engine'}</span>
              </span>
              <span className="rounded-full border border-[#1e3a66] bg-[#060c1a] px-2.5 py-0.5 text-xs text-slate-300">
                {audioSourceKind === 'stems' ? '8 Stems' : 'meta.json'}
              </span>
            </div>
            <div className={`${ADMIN_SEGMENT_WRAP_CLASS} grid-cols-3`}>
              {(
                [
                  ['room3', isPt ? '3 Caixas' : '3 Speakers'],
                  ['hrtf', '8D HRTF'],
                  ['5.1', '5.1'],
                ] as [AudioOutputMode, string][]
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onSetAudioMode(mode)}
                  className={`min-h-[40px] rounded-lg px-2 text-xs transition ${ADMIN_FOCUS} ${
                    audioMode === mode ? ADMIN_SEGMENT_ACTIVE_CLASS : ADMIN_SEGMENT_IDLE_CLASS
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-slate-200">
              <span>{isPt ? 'Saída de Áudio da Sala' : 'Room Audio Output'}</span>
              <LedRmsMeter
                value01={realAudioRms01}
                segments={8}
                muted={localAudioMuted}
                compact
                label="Master"
              />
            </div>
            <div className={`${ADMIN_SEGMENT_WRAP_CLASS} grid-cols-3`}>
              {(
                [
                  ['pc', 'PC'],
                  ['tablet', 'Tablet'],
                  ['both', isPt ? 'Ambos' : 'Both'],
                ] as [AudioOwnerRole, string][]
              ).map(([owner, label]) => (
                <button
                  key={owner}
                  type="button"
                  onClick={() => onSetAudioOwner(owner)}
                  className={`min-h-[40px] rounded-lg px-2 text-xs transition ${ADMIN_FOCUS} ${
                    audioOwner === owner ? ADMIN_SEGMENT_ACTIVE_CLASS : ADMIN_SEGMENT_IDLE_CLASS
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Mesa de Som Real: C1 | C2 | C3 | Master (8 cols) */}
      <section className={`p-4 xl:col-span-8 ${ADMIN_PANEL_CLASS}`}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 pb-1">
          <div>
            <h2 className="text-sm font-semibold tracking-[-0.01em] text-slate-50">
              {isPt
                ? 'Mesa de Calibração Acústica · C1 · C2 · C3'
                : 'Acoustic Mixing Console · C1 · C2 · C3'}
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              {isPt
                ? 'Faders verticais de ganho 0–200%, Delay Bluetooth 0–400 ms e roteamento USB/BT/LAN.'
                : 'Vertical gain faders 0–200%, Bluetooth delay 0–400 ms, and USB/BT/LAN routing.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <div className="flex items-center gap-1 rounded-full border border-[#1e3a66]/65 bg-[#040b1a] p-1">
              <button
                type="button"
                onClick={() =>
                  calibTestMode.kind === 'pink-all'
                    ? onStopCalibrationSignal()
                    : onStartPinkNoiseAll()
                }
                className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-full px-3 text-xs font-medium transition ${ADMIN_FOCUS} ${
                  calibTestMode.kind === 'pink-all'
                    ? 'bg-[#0c1a36] font-semibold text-[#7dd3fc]'
                    : 'text-slate-200 hover:bg-[#081226] hover:text-white'
                }`}
              >
                <Radio size={12} />
                <span>
                  {calibTestMode.kind === 'pink-all'
                    ? isPt
                      ? 'Parar Rosa · Todas'
                      : 'Stop Pink · All'
                    : isPt
                      ? 'Ruído Rosa · Todas'
                      : 'Pink Noise · All'}
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  calibTestMode.kind === 'delay-click-all'
                    ? onStopCalibrationSignal()
                    : onStartDelayClickAll()
                }
                className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-full px-3 text-xs font-medium transition ${ADMIN_FOCUS} ${
                  calibTestMode.kind === 'delay-click-all'
                    ? 'bg-[#0c1a36] font-semibold text-[#7dd3fc]'
                    : 'text-slate-200 hover:bg-[#081226] hover:text-white'
                }`}
              >
                <Speaker size={12} />
                <span>
                  {calibTestMode.kind === 'delay-click-all'
                    ? isPt
                      ? 'Parar Clique · Todas'
                      : 'Stop Click · All'
                    : isPt
                      ? 'Clique · Todas'
                      : 'Click · All'}
                </span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => void onUnlockOutputDevices()}
              className={`inline-flex min-h-[40px] items-center gap-1.5 px-4 text-xs ${
                outputSupportStatus === 'permission-needed'
                  ? ADMIN_PRIMARY_PILL_CLASS
                  : 'rounded-full border border-[#1e3a66] bg-[#060c1a] font-medium text-slate-200 transition hover:border-[#2563eb] hover:text-white'
              } ${ADMIN_FOCUS}`}
            >
              <RefreshCw size={12} />
              <span>
                {outputSupportStatus === 'permission-needed'
                  ? isPt
                    ? 'Liberar Caixas BT/USB'
                    : 'Unlock BT/USB Speakers'
                  : isPt
                    ? `Atualizar Saídas · ${outputDevices.length}`
                    : `Refresh Outputs · ${outputDevices.length}`}
              </span>
            </button>
          </div>
        </div>

        {/* Diagnósticos de Contexto Inseguro / Não Suportado */}
        {outputSupportStatus === 'insecure-context' && (
          <div className={`mb-3 flex flex-wrap items-center justify-between gap-3 p-3 text-xs text-slate-200 ${ADMIN_WELL_CLASS}`}>
            <div className="max-w-xl font-medium">
              {isPt
                ? 'Use localhost neste Mac para listar e separar as caixas Bluetooth'
                : 'Open localhost on this Mac to list and separate Bluetooth speakers'}
            </div>
            <a
              href={`http://localhost:${lanPort || 5173}/?view=admin`}
              className={`inline-flex min-h-[38px] shrink-0 items-center gap-1.5 px-4 text-xs ${ADMIN_PRIMARY_PILL_CLASS} ${ADMIN_FOCUS}`}
            >
              <span>Abrir em localhost</span>
              <ExternalLink size={12} />
            </a>
          </div>
        )}

        {outputSupportStatus === 'unsupported' && (
          <div className="mb-3 rounded-xl border border-rose-400/35 bg-rose-500/15 p-3 text-xs text-rose-100">
            {isPt
              ? 'Este navegador não suporta seleção individual por caixa via setSinkId. Abra em Chrome, Brave ou Edge.'
              : 'This browser does not support per-speaker routing via setSinkId. Use Chrome, Brave, or Edge.'}
          </div>
        )}

        {/* 4 Channel Strips Verticais Paralelos: C1 | C2 | C3 | Master */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {SPEAKER_IDS.map((spkId, idx) => {
            const spkNum = (idx + 1) as 1 | 2 | 3;
            const spk = speakerCalibration.speakers[spkId];
            const isRef = speakerCalibration.referenceSpeakerId === spkId;
            const isAllSignal =
              calibTestMode.kind === 'pink-all' || calibTestMode.kind === 'delay-click-all';
            const isSinglePink =
              calibTestMode.kind === 'pink-single' && calibTestMode.speakerId === spkId;
            const isAbPink =
              calibTestMode.kind === 'pink-ab' && calibTestMode.targetSpeakerId === spkId;
            const isDelayClick =
              calibTestMode.kind === 'delay-click' && calibTestMode.targetSpeakerId === spkId;
            const signalActive = isAllSignal || isSinglePink || isAbPink || isDelayClick;
            const lanNodeUrl = `${baseOrigin}/?view=audio-node&spk=${spkNum}`;
            const lanNodeOnline = lanClients.some(
              (peer) => peer.role === `audio-node-C${spkNum}`
            );
            const copyKey = `audio-node-${spkId}`;
            const isCopied = copiedKey === copyKey;

            return (
              <div
                key={spkId}
                className={`flex flex-col justify-between rounded-xl border p-3 transition ${
                  signalActive
                    ? 'border-[#2563eb]/65 bg-[#0c1a36]/75'
                    : 'border-[#1e3a66]/45 bg-white/[0.025]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex h-6 w-7 items-center justify-center rounded-md border border-[#1e3a66] bg-[#060c1a] text-xs font-semibold text-slate-100 [font-variant-numeric:tabular-nums]">
                        C{spkNum}
                      </span>
                      <span className="text-xs font-semibold text-slate-100">
                        {isPt ? spk.shortLabelPt : spk.shortLabelEn}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onSetReferenceSpeaker(spkId)}
                      className={`inline-flex min-h-[30px] items-center gap-1 rounded-full border px-2.5 text-xs font-medium transition ${ADMIN_FOCUS} ${
                        isRef
                          ? 'border-[#2563eb]/65 bg-[#0c1a36] text-[#7dd3fc]'
                          : 'border-[#1e3a66]/55 bg-[#060c1a] text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Star size={11} />
                      <span>{isRef ? (isPt ? 'Ref.' : 'Ref') : 'Ref'}</span>
                    </button>
                  </div>

                  {/* Seletor PC Local vs Nó LAN */}
                  <div className={`mt-2.5 grid-cols-2 ${ADMIN_SEGMENT_WRAP_CLASS}`}>
                    <button
                      type="button"
                      onClick={() => onUpdateSpeakerConfig(spkId, { routeTarget: 'local' })}
                      className={`min-h-[34px] rounded-lg text-xs transition ${ADMIN_FOCUS} ${
                        spk.routeTarget === 'local'
                          ? ADMIN_SEGMENT_ACTIVE_CLASS
                          : ADMIN_SEGMENT_IDLE_CLASS
                      }`}
                    >
                      PC Local
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdateSpeakerConfig(spkId, { routeTarget: 'lan-node' })}
                      className={`min-h-[34px] rounded-lg text-xs transition ${ADMIN_FOCUS} ${
                        spk.routeTarget === 'lan-node'
                          ? ADMIN_SEGMENT_ACTIVE_CLASS
                          : ADMIN_SEGMENT_IDLE_CLASS
                      }`}
                    >
                      {isPt ? 'Nó LAN' : 'LAN Node'}
                    </button>
                  </div>

                  {/* Seletor de Saída Customizado (Zero native <select>) */}
                  <div className="mt-2">
                    {spk.routeTarget === 'local' ? (
                      outputSupportStatus === 'permission-needed' ? (
                        <div className="flex min-h-[40px] items-center justify-center rounded-xl border border-[#1e3a66]/45 bg-[#040b1a] px-2.5 text-center text-xs text-slate-400">
                          {isPt ? 'Libere BT/USB no topo da mesa' : 'Unlock BT/USB above'}
                        </div>
                      ) : (
                        <AdminSelect
                          ariaLabel={`Saída C${spkNum}`}
                          value={spk.sinkDeviceId}
                          options={deviceOptions}
                          disabled={!isSetSinkIdSupported}
                          onChange={(sinkDeviceId) => onUpdateSpeakerConfig(spkId, { sinkDeviceId })}
                        />
                      )
                    ) : (
                      <div className="rounded-xl border border-[#1e3a66]/55 bg-[#040b1a] p-2">
                        <div className="flex items-center justify-between gap-1.5 pb-1.5 text-xs">
                          <span className="inline-flex items-center gap-1.5 font-medium text-slate-200">
                            <span
                              className={`h-2 w-2 rounded-full ${
                                lanNodeOnline ? 'bg-emerald-400' : 'bg-slate-500'
                              }`}
                            />
                            <span>
                              {lanNodeOnline
                                ? isPt
                                  ? 'Ativa'
                                  : 'Online'
                                : isPt
                                  ? 'Offline'
                                  : 'Offline'}
                            </span>
                          </span>
                          <span className="text-[11px] font-medium text-slate-400">
                            ?spk={spkNum}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onCopyText(copyKey, lanNodeUrl)}
                            title={lanNodeUrl}
                            className={`inline-flex min-h-[36px] flex-1 items-center justify-center gap-1 rounded-lg border px-2 text-xs font-medium transition ${ADMIN_FOCUS} ${
                              isCopied
                                ? 'border-[#2563eb]/65 bg-[#0c1a36] font-semibold text-[#7dd3fc]'
                                : 'border-[#1e3a66]/65 bg-[#060c1a] text-slate-200 hover:border-[#2563eb] hover:text-white'
                            }`}
                          >
                            {isCopied ? <Check size={12} /> : <Copy size={12} />}
                            <span>{isCopied ? 'OK' : isPt ? 'Copiar' : 'Copy'}</span>
                          </button>
                          <a
                            href={`?view=audio-node&spk=${spkNum}`}
                            target="_blank"
                            rel="noreferrer"
                            className={`inline-flex min-h-[36px] flex-1 items-center justify-center gap-1 rounded-lg border border-[#1e3a66]/65 bg-[#060c1a] px-2 text-xs font-medium text-slate-200 transition hover:border-[#2563eb] hover:text-white ${ADMIN_FOCUS}`}
                          >
                            <span>{isPt ? 'Abrir' : 'Open'}</span>
                            <ExternalLink size={12} />
                          </a>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Geradores de Teste Acústico */}
                  <div className="mt-2.5 flex flex-col gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        isSinglePink ? onStopCalibrationSignal() : onStartPinkNoiseSingle(spkId)
                      }
                      className={`min-h-[40px] w-full rounded-xl border text-xs font-medium transition ${ADMIN_FOCUS} ${
                        isSinglePink
                          ? 'border-[#2563eb]/65 bg-[#0c1a36] font-semibold text-[#7dd3fc]'
                          : 'border-[#1e3a66]/55 bg-[#060c1a] text-slate-200 hover:border-[#2563eb]'
                      }`}
                    >
                      {isSinglePink
                        ? isPt
                          ? 'Parar Ruído Rosa'
                          : 'Stop Pink Noise'
                        : isPt
                          ? 'Ruído Rosa Solo'
                          : 'Solo Pink Noise'}
                    </button>

                    {!isRef && (
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            isAbPink ? onStopCalibrationSignal() : onStartPinkNoiseAB(spkId)
                          }
                          className={`min-h-[40px] rounded-xl border px-1.5 text-xs font-medium transition ${ADMIN_FOCUS} ${
                            isAbPink
                              ? 'border-[#2563eb]/65 bg-[#0c1a36] font-semibold text-[#7dd3fc]'
                              : 'border-[#1e3a66]/55 bg-[#060c1a] text-slate-300 hover:border-[#2563eb] hover:text-white'
                          }`}
                        >
                          {isAbPink ? 'A⇄B On' : 'Rosa A⇄B'}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            isDelayClick ? onStopCalibrationSignal() : onStartDelayClickTest(spkId)
                          }
                          className={`min-h-[40px] rounded-xl border px-1.5 text-xs font-medium transition ${ADMIN_FOCUS} ${
                            isDelayClick
                              ? 'border-[#2563eb]/65 bg-[#0c1a36] font-semibold text-[#7dd3fc]'
                              : 'border-[#1e3a66]/55 bg-[#060c1a] text-slate-300 hover:border-[#2563eb] hover:text-white'
                          }`}
                        >
                          {isDelayClick ? 'Click On' : 'Click BT'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Fader Vertical de Ganho + Delay BT (divisor plano sem 3º nível) + Mute */}
                <div className="mt-3 flex flex-col gap-3 border-t border-[#1e3a66]/45 pt-3">
                  <FaderControl
                    orientation="vertical"
                    label={isPt ? 'Ganho' : 'Gain'}
                    value={spk.calibrationGain}
                    min={0}
                    max={2}
                    step={0.02}
                    valueText={`${Math.round(spk.calibrationGain * 100)}%`}
                    onChange={(calibrationGain) =>
                      onUpdateSpeakerConfig(spkId, { calibrationGain })
                    }
                    onReset={() => onUpdateSpeakerConfig(spkId, { calibrationGain: 1.0 })}
                    resetTitle={isPt ? 'Voltar para 100%' : 'Reset to 100%'}
                  />

                  <div className="border-t border-[#1e3a66]/40 pt-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Delay BT</span>
                      <span className="font-semibold text-slate-100 [font-variant-numeric:tabular-nums]">
                        {spk.delayMs} ms
                      </span>
                    </div>
                    <div className="mt-1.5 grid grid-cols-4 gap-1">
                      {([-5, -1, +1, +5] as const).map((delta) => (
                        <button
                          key={delta}
                          type="button"
                          onClick={() =>
                            onUpdateSpeakerConfig(spkId, {
                              delayMs: Math.max(0, Math.min(400, spk.delayMs + delta)),
                            })
                          }
                          className={`min-h-[36px] rounded-lg border border-[#1e3a66]/55 bg-[#060c1a] text-xs font-medium text-slate-200 transition hover:border-[#2563eb] hover:text-white [font-variant-numeric:tabular-nums] ${ADMIN_FOCUS}`}
                        >
                          {delta > 0 ? `+${delta}` : delta}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <LedRmsMeter
                      value01={signalActive ? 0.72 : speakerLiveLevels[spkId]}
                      segments={6}
                      muted={spk.muted}
                      compact
                    />
                    <button
                      type="button"
                      onClick={() => onUpdateSpeakerConfig(spkId, { muted: !spk.muted })}
                      className={`min-h-[40px] flex-1 rounded-xl border text-xs font-semibold transition ${ADMIN_FOCUS} ${
                        spk.muted
                          ? 'border-rose-400/55 bg-rose-500/20 text-rose-100'
                          : 'border-[#1e3a66]/55 bg-[#060c1a] text-slate-300 hover:border-rose-400/40 hover:text-rose-200'
                      }`}
                    >
                      {spk.muted ? (isPt ? 'Mudo' : 'Muted') : isPt ? 'Mutar' : 'Mute'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {/* 4ª Coluna: Buses NASA Ao Vivo & Saída PC (Master & Voz vivem na Visão Geral para zero duplicação) */}
          <div className={`flex flex-col justify-between p-3 ${ADMIN_WELL_CLASS}`}>
            <div>
              <div className="mb-3 flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-100">
                  <Speaker size={14} className="text-[#7dd3fc]" />
                  <span>{isPt ? 'Buses NASA' : 'NASA Buses'}</span>
                </span>
              </div>

              <div className="flex flex-col gap-2.5">
                {(
                  [
                    ['melody', isPt ? 'Melodia' : 'Melody'],
                    ['chords', isPt ? 'Harmonia' : 'Harmony'],
                    ['bass', isPt ? 'Baixo' : 'Bass'],
                    ['wind', isPt ? 'Ventos' : 'Winds'],
                  ] as const
                ).map(([k, label]) => (
                  <div key={k} className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-slate-300">{label}</span>
                    <LedRmsMeter value01={audioLevels[k]} segments={6} compact label={label} />
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-3 border-t border-[#1e3a66]/45 pt-3">
              <button
                type="button"
                onClick={onToggleLocalMute}
                className={`min-h-[40px] w-full rounded-xl border text-xs font-semibold transition ${ADMIN_FOCUS} ${
                  localAudioMuted
                    ? 'border-rose-400/55 bg-rose-500/20 text-rose-100'
                    : 'border-[#1e3a66]/55 bg-[#060c1a] text-slate-300 hover:border-rose-400/40 hover:text-rose-200'
                }`}
              >
                {localAudioMuted
                  ? isPt
                    ? 'PC Local Mudo'
                    : 'Local PC Muted'
                  : isPt
                    ? 'Mutar Este PC'
                    : 'Mute Local PC'}
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
