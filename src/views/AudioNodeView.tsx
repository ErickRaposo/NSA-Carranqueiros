import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Volume2, VolumeX } from 'lucide-react';
import symbollLogo from '../assets/symboll.png';
import { speakerIndexToSlotId } from '../audio/speakerCalibration';
import { useAudioAdmin, useExperience } from '../experience/ExperienceContext';
import { SpeakerNodeIndex } from '../experience/types';
import { AdminSelect } from './admin/AdminSelect';
import { LedRmsMeter } from './admin/LedRmsMeter';
import {
  ADMIN_FOCUS,
  ADMIN_PANEL_CLASS,
  ADMIN_PRIMARY_PILL_CLASS,
  ADMIN_SEGMENT_ACTIVE_CLASS,
  ADMIN_SEGMENT_IDLE_CLASS,
  ADMIN_SEGMENT_WRAP_CLASS,
} from './admin/adminMeta';

interface AudioNodeViewProps {
  spkIndex: SpeakerNodeIndex;
  onChangeSpeakerIndex: (next: SpeakerNodeIndex) => void;
}

/**
 * Nó Receptor de Áudio LAN (`?view=audio-node&spk=1..3`):
 * Permite usar outro computador/celular na mesma rede como saída exclusiva
 * para a Caixa C1, C2 ou C3, seguindo a identidade visual do Painel Técnico.
 */
export const AudioNodeView: React.FC<AudioNodeViewProps> = ({
  spkIndex,
  onChangeSpeakerIndex,
}) => {
  const {
    country,
    playback,
    lanConnected,
    localAudioMuted,
    setLocalAudioMuted,
    speakerLiveLevels,
    audioContextState,
    realAudioRms01,
    lang,
    setLang,
  } = useExperience();

  const {
    speakerCalibration,
    calibTestMode,
    outputDevices,
    outputSupportStatus,
    isSetSinkIdSupported,
    setIsolatedSpeakerSlot,
    unlockAudioContext,
    unlockOutputDevices,
    updateSpeakerConfig,
    refreshOutputDevices,
  } = useAudioAdmin();

  const isPt = lang === 'pt';
  const slotId = speakerIndexToSlotId(spkIndex);
  const spk = speakerCalibration.speakers[slotId];
  const [unlocked, setUnlocked] = useState<boolean>(false);

  useEffect(() => {
    setIsolatedSpeakerSlot(slotId);
    void refreshOutputDevices();
    return () => {
      setIsolatedSpeakerSlot(null);
    };
  }, [refreshOutputDevices, setIsolatedSpeakerSlot, slotId]);

  const handleActivate = () => {
    const ok = unlockAudioContext();
    setLocalAudioMuted(false);
    setUnlocked(ok);
    void unlockOutputDevices();
  };

  const isAudioReady = unlocked || audioContextState === 'running';

  const isReceivingTest =
    calibTestMode.kind === 'pink-all' ||
    calibTestMode.kind === 'delay-click-all' ||
    (calibTestMode.kind === 'pink-single' && calibTestMode.speakerId === slotId) ||
    (calibTestMode.kind === 'pink-ab' && calibTestMode.activeNow === slotId) ||
    (calibTestMode.kind === 'delay-click' &&
      (calibTestMode.targetSpeakerId === slotId ||
        speakerCalibration.referenceSpeakerId === slotId));

  const isMuted = spk.muted || localAudioMuted;
  const meterLevel = isReceivingTest
    ? Math.max(realAudioRms01, 0.72)
    : Math.max(speakerLiveLevels[slotId], realAudioRms01);

  const deviceOptions = useMemo(
    () => [
      {
        value: '',
        label: isPt ? 'Saída Padrão deste Aparelho' : 'Device Default Output',
      },
      ...outputDevices.map((dev) => ({ value: dev.deviceId, label: dev.label })),
    ],
    [isPt, outputDevices]
  );

  const countryName = country ? (isPt ? country.namePt : country.nameEn) : '';

  const onAirLabel = isMuted
    ? isPt
      ? 'Mudo'
      : 'Muted'
    : isReceivingTest
      ? isPt
        ? 'Sinal Teste'
        : 'Test Signal'
      : playback.isPlaying
        ? countryName
          ? `${countryName} · ${Math.round(playback.bpm)} BPM`
          : `${Math.round(playback.bpm)} BPM`
        : countryName || (isPt ? 'Em espera' : 'Idle');

  const onAirClass = isMuted
    ? 'text-rose-200'
    : isReceivingTest || playback.isPlaying
      ? 'text-[#7dd3fc]'
      : 'text-slate-200';

  return (
    <div
      className="flex h-dvh w-screen flex-col overflow-hidden bg-[#060913] text-slate-100"
      data-testid={`audio-node-view-${spkIndex}`}
    >
      <header className="flex min-h-[56px] shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#1e3a66]/55 bg-[#040b1a] px-4 py-2 lg:px-5">
        <div className="flex items-center gap-2.5">
          <img src={symbollLogo} alt="" className="h-7 w-7 object-contain" aria-hidden="true" />
          <h1 className="font-['Orbitron','Poppins',sans-serif] text-sm font-bold tracking-[0.04em] text-slate-50">
            {isPt ? 'Painel Técnico · Receptor de Áudio' : 'Control Desk · Audio Receiver'}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex min-h-[38px] items-center gap-2 rounded-full border border-[#1e3a66] bg-[#060c1a] px-3.5 text-xs font-medium text-slate-200">
            <span
              className={`h-2 w-2 rounded-full ${
                lanConnected ? 'bg-emerald-400' : 'bg-slate-500'
              }`}
              aria-hidden="true"
            />
            <span>{lanConnected ? 'LAN Sync' : 'Local'}</span>
          </span>

          <button
            type="button"
            onClick={() => setLang(isPt ? 'en' : 'pt')}
            className={`inline-flex min-h-[38px] min-w-[64px] items-center justify-center rounded-full border border-[#1e3a66] bg-[#060c1a] px-3 text-xs font-semibold text-slate-200 transition hover:border-[#2563eb] hover:text-white ${ADMIN_FOCUS}`}
          >
            {isPt ? 'PT · BR' : 'EN · US'}
          </button>
        </div>
      </header>

      <main className="admin-scroll flex min-h-0 flex-1 items-center justify-center p-4 lg:p-5">
        <section className={`w-full max-w-md p-5 ${ADMIN_PANEL_CLASS}`}>
          {/* Identidade do Canal + Medidor RMS ao vivo */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-6 w-7 items-center justify-center rounded-md border border-[#1e3a66] bg-[#060c1a] text-xs font-semibold text-slate-100 [font-variant-numeric:tabular-nums]">
                C{spkIndex}
              </span>
              <h2 className="text-sm font-semibold tracking-[-0.01em] text-slate-50">
                {isPt ? spk.labelPt : spk.labelEn}
              </h2>
            </div>

            <LedRmsMeter
              value01={meterLevel}
              segments={8}
              muted={isMuted}
              compact
              label={`C${spkIndex}`}
            />
          </div>

          {/* Seletor de Canal C1 | C2 | C3 */}
          <div className={`mt-4 grid-cols-3 ${ADMIN_SEGMENT_WRAP_CLASS}`}>
            {([1, 2, 3] as SpeakerNodeIndex[]).map((idx) => {
              const s = speakerCalibration.speakers[speakerIndexToSlotId(idx)];
              const active = idx === spkIndex;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onChangeSpeakerIndex(idx)}
                  className={`min-h-[38px] rounded-lg px-2 text-xs transition ${ADMIN_FOCUS} ${
                    active ? ADMIN_SEGMENT_ACTIVE_CLASS : ADMIN_SEGMENT_IDLE_CLASS
                  }`}
                >
                  C{idx} · {isPt ? s.shortLabelPt : s.shortLabelEn}
                </button>
              );
            })}
          </div>

          {/* Ativação Web Audio / Controle de Mute */}
          <div className="mt-4">
            {!isAudioReady ? (
              <button
                type="button"
                onClick={handleActivate}
                className={`flex min-h-[46px] w-full items-center justify-center gap-2 px-4 text-xs ${ADMIN_PRIMARY_PILL_CLASS} ${ADMIN_FOCUS}`}
              >
                <Volume2 size={15} />
                <span>
                  {isPt ? 'Ativar Recepção de Áudio' : 'Enable Audio Output'}
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setLocalAudioMuted(!localAudioMuted)}
                className={`flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl border px-4 text-xs font-semibold transition ${ADMIN_FOCUS} ${
                  localAudioMuted
                    ? 'border-rose-400/55 bg-rose-500/20 text-rose-100'
                    : 'border-[#1e3a66]/55 bg-[#060c1a] text-slate-200 hover:border-rose-400/40 hover:text-rose-200'
                }`}
              >
                {localAudioMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                <span>
                  {localAudioMuted
                    ? isPt
                      ? 'Recepção Muda · Reativar'
                      : 'Output Muted · Unmute'
                    : isPt
                      ? 'Recepção Ativa · Mutar'
                      : 'Output Active · Mute'}
                </span>
              </button>
            )}
          </div>

          {/* Telemetria Recebida da Mesa */}
          <div className="mt-4 grid grid-cols-3 divide-x divide-[#1e3a66]/45 rounded-xl border border-[#1e3a66]/45 bg-[#040b1a] py-2.5 text-center [font-variant-numeric:tabular-nums]">
            <div className="px-2">
              <div className="text-[11px] text-slate-400">{isPt ? 'Ganho' : 'Gain'}</div>
              <div className="mt-0.5 text-xs font-semibold text-slate-100">
                {Math.round(spk.calibrationGain * 100)}%
              </div>
            </div>
            <div className="px-2">
              <div className="text-[11px] text-slate-400">Delay</div>
              <div className="mt-0.5 text-xs font-semibold text-slate-100">{spk.delayMs} ms</div>
            </div>
            <div className="px-2">
              <div className="text-[11px] text-slate-400">{isPt ? 'No Ar' : 'On Air'}</div>
              <div className={`mt-0.5 truncate text-xs font-semibold ${onAirClass}`}>
                {onAirLabel}
              </div>
            </div>
          </div>

          {/* Saída Física neste Aparelho */}
          <div className="mt-4 border-t border-[#1e3a66]/45 pt-4">
            {isSetSinkIdSupported ? (
              <>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-300">
                    {isPt ? 'Saída física neste aparelho' : 'Local output device'}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      outputSupportStatus === 'permission-needed'
                        ? void unlockOutputDevices()
                        : void refreshOutputDevices()
                    }
                    className={`inline-flex min-h-[28px] items-center gap-1 rounded-full border border-[#1e3a66] bg-[#060c1a] px-2.5 text-[11px] font-medium text-slate-300 transition hover:border-[#2563eb] hover:text-white ${ADMIN_FOCUS}`}
                  >
                    <RefreshCw size={11} />
                    <span>
                      {outputSupportStatus === 'permission-needed'
                        ? isPt
                          ? 'Liberar BT/USB'
                          : 'Unlock BT/USB'
                        : isPt
                          ? 'Atualizar'
                          : 'Refresh'}
                    </span>
                  </button>
                </div>
                <AdminSelect
                  ariaLabel={isPt ? 'Saída física neste aparelho' : 'Local output device'}
                  value={spk.sinkDeviceId}
                  options={deviceOptions}
                  onChange={(sinkDeviceId) => updateSpeakerConfig(slotId, { sinkDeviceId })}
                />
              </>
            ) : (
              <p className="text-center text-xs text-slate-400">
                {isPt
                  ? 'Saída física: padrão do sistema neste dispositivo.'
                  : 'Audio output: system default on this device.'}
              </p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
};
