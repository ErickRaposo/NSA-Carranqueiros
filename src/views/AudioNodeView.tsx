import React, { useEffect, useState } from 'react';
import { CheckCircle2, Radio, RefreshCw, Speaker, Volume2, VolumeX, Wifi } from 'lucide-react';
import {
  speakerIndexToSlotId,
  speakerSlotIdToIndex,
} from '../audio/speakerCalibration';
import { useAudioAdmin, useExperience } from '../experience/ExperienceContext';
import { SpeakerNodeIndex } from '../experience/types';

interface AudioNodeViewProps {
  spkIndex: SpeakerNodeIndex;
  onChangeSpeakerIndex: (next: SpeakerNodeIndex) => void;
}

/**
 * Nó Receptor de Áudio LAN (`?view=audio-node&spk=1..3`):
 * Permite usar um 2º ou 3º notebook/celular na mesma rede Wi-Fi como saída exclusiva
 * para a Caixa C1, C2 ou C3 caso 1 único PC não aguente 3 conexões Bluetooth simultâneas.
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
    audioLevels,
    lang,
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

  const isReceivingTest =
    calibTestMode.kind === 'pink-all' ||
    calibTestMode.kind === 'delay-click-all' ||
    (calibTestMode.kind === 'pink-single' && calibTestMode.speakerId === slotId) ||
    (calibTestMode.kind === 'pink-ab' && calibTestMode.activeNow === slotId) ||
    (calibTestMode.kind === 'delay-click' &&
      (calibTestMode.targetSpeakerId === slotId ||
        speakerCalibration.referenceSpeakerId === slotId));

  const levelPct = Math.round(Math.min(100, audioLevels.master * 100));

  return (
    <main
      className="admin-scroll flex h-dvh w-screen flex-col items-center justify-center bg-[#050811] p-5 text-slate-100"
      data-testid={`audio-node-view-${spkIndex}`}
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-400/15 bg-[#080d19] p-6">
        <div className="flex items-center justify-between border-b border-slate-400/15 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-sky-400/30 bg-sky-400/10 text-sky-300">
              <Speaker size={20} />
            </div>
            <div>
              <h1 className="text-base font-semibold text-slate-50">
                {isPt ? `Receptor LAN · Caixa C${spkIndex}` : `LAN Audio Node · Speaker C${spkIndex}`}
              </h1>
              <p className="text-xs text-slate-400">
                {isPt ? spk.labelPt : spk.labelEn}
              </p>
            </div>
          </div>

          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
              lanConnected
                ? 'border-emerald-400/35 bg-emerald-400/10 text-emerald-300'
                : 'border-amber-400/35 bg-amber-400/10 text-amber-200'
            }`}
          >
            <Wifi size={12} />
            {lanConnected ? 'LAN Sync' : 'Local'}
          </span>
        </div>

        {/* Troca rápida C1 / C2 / C3 */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          {([1, 2, 3] as SpeakerNodeIndex[]).map((idx) => {
            const s = speakerCalibration.speakers[speakerIndexToSlotId(idx)];
            const active = idx === spkIndex;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => onChangeSpeakerIndex(idx)}
                className={`min-h-[42px] rounded-xl border px-2 text-xs font-semibold transition ${
                  active
                    ? 'border-sky-400/60 bg-sky-400/15 text-white'
                    : 'border-slate-400/15 bg-[#0b1222] text-slate-300 hover:text-white'
                }`}
              >
                C{idx} · {isPt ? s.shortLabelPt : s.shortLabelEn}
              </button>
            );
          })}
        </div>

        {/* Botão de desbloqueio obrigatório do Web Audio */}
        <div className="mt-5">
          {!unlocked ? (
            <button
              type="button"
              onClick={handleActivate}
              className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 text-sm font-bold text-slate-950 transition hover:bg-emerald-300"
            >
              <Volume2 size={18} />
              <span>
                {isPt
                  ? `Ativar Saída de Áudio da Caixa C${spkIndex}`
                  : `Enable Audio Output for Speaker C${spkIndex}`}
              </span>
            </button>
          ) : (
            <div className="flex items-center justify-between rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-xs text-emerald-200">
              <div className="flex items-center gap-2 font-semibold">
                <CheckCircle2 size={16} className="text-emerald-300" />
                <span>
                  {isPt
                    ? `Motor Web Audio Ativo · Canal C${speakerSlotIdToIndex(slotId)}`
                    : `Web Audio Active · Channel C${speakerSlotIdToIndex(slotId)}`}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setLocalAudioMuted(!localAudioMuted)}
                className="inline-flex min-h-[32px] items-center gap-1 rounded-lg border border-slate-400/25 bg-[#080d19] px-2.5 text-slate-200"
              >
                {localAudioMuted ? <VolumeX size={13} /> : <Volume2 size={13} />}
                <span>{localAudioMuted ? 'Muted' : 'Live'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Telemetria recebida do Console Admin */}
        <div className="mt-5 grid grid-cols-3 divide-x divide-slate-400/15 rounded-xl border border-slate-400/15 bg-[#0b1222] py-3 text-center [font-variant-numeric:tabular-nums]">
          <div className="px-2">
            <div className="text-[11px] text-slate-400">{isPt ? 'Ganho Rosa' : 'Pink Gain'}</div>
            <div className="mt-0.5 text-sm font-semibold text-emerald-300">
              {Math.round(spk.calibrationGain * 100)}%
            </div>
          </div>
          <div className="px-2">
            <div className="text-[11px] text-slate-400">{isPt ? 'Delay BT' : 'BT Delay'}</div>
            <div className="mt-0.5 text-sm font-semibold text-sky-300">{spk.delayMs} ms</div>
          </div>
          <div className="px-2">
            <div className="text-[11px] text-slate-400">{isPt ? 'Status' : 'Status'}</div>
            <div className="mt-0.5 text-sm font-semibold text-slate-100">
              {spk.muted
                ? 'MUTE'
                : isReceivingTest
                  ? 'TEST SIGNAL'
                  : playback.isPlaying
                    ? `${playback.bpm} BPM`
                    : 'IDLE'}
            </div>
          </div>
        </div>

        {/* Barra VU viva */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-slate-400 [font-variant-numeric:tabular-nums]">
            <span className="inline-flex items-center gap-1.5">
              <Radio size={13} className={isReceivingTest ? 'text-amber-300' : 'text-sky-400'} />
              {country ? (isPt ? country.namePt : country.nameEn) : '—'}
            </span>
            <span>{levelPct}%</span>
          </div>
          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-[#0b1222]">
            <div
              className="h-full rounded-full bg-sky-400 transition-all duration-150"
              style={{ width: `${isReceivingTest ? 82 : levelPct}%` }}
            />
          </div>
        </div>

        {/* Seletor de saída local neste notebook/celular */}
        <div className="mt-5 border-t border-slate-400/15 pt-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-300">
              {isPt ? 'Saída física neste aparelho' : 'Local output device'}
            </span>
            <button
              type="button"
              onClick={() =>
                outputSupportStatus === 'permission-needed'
                  ? void unlockOutputDevices()
                  : void refreshOutputDevices()
              }
              className="inline-flex items-center gap-1 text-[11px] text-amber-300 hover:text-amber-100"
            >
              <RefreshCw size={11} />
              <span>
                {outputSupportStatus === 'permission-needed'
                  ? isPt
                    ? 'Liberar Caixas BT/USB'
                    : 'Unlock BT/USB Speakers'
                  : isPt
                    ? 'Atualizar'
                    : 'Refresh'}
              </span>
            </button>
          </div>
          <select
            value={spk.sinkDeviceId}
            onChange={(e) => updateSpeakerConfig(slotId, { sinkDeviceId: e.target.value })}
            disabled={!isSetSinkIdSupported}
            className="mt-1.5 h-10 w-full rounded-xl border border-slate-400/20 bg-[#0c1a36] px-3 text-xs text-slate-100 disabled:opacity-50"
          >
            <option value="">
              {isPt ? 'Saída Padrão deste Aparelho' : 'Device Default Output'}
            </option>
            {outputDevices.map((dev) => (
              <option key={dev.deviceId} value={dev.deviceId}>
                {dev.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </main>
  );
};
