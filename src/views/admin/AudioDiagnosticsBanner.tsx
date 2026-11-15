import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  EyeOff,
  MonitorOff,
  RefreshCw,
  Speaker,
  Unlock,
  Volume2,
  WifiOff,
  X,
} from 'lucide-react';
import { AudioDeviceOption } from '../../audio/spatialAudioEngine';
import {
  AudioCalibrationState,
  SPEAKER_IDS,
  SpeakerSlotId,
} from '../../audio/speakerCalibration';
import {
  AudioOutputMode,
  AudioOwnerRole,
  LanPeerInfo,
  Lang,
} from '../../experience/types';
import { ADMIN_FOCUS, AdminModuleId } from './adminMeta';

interface AudioDiagnosticsBannerProps {
  lang: Lang;
  audioContextState: AudioContextState | 'uninitialized';
  audioMode: AudioOutputMode;
  audioOwner: AudioOwnerRole;
  localAudioMuted: boolean;
  masterGain: number;
  isPlaying: boolean;
  globalBlackout: boolean;
  allSpeakersMuted: boolean;
  speakerCalibration: AudioCalibrationState;
  outputDevices: AudioDeviceOption[];
  lanConnected: boolean;
  lanClients: LanPeerInfo[];
  onUnlockAudio: () => void;
  onUnmutePc: () => void;
  onRestoreMaster: () => void;
  onUnmuteAllSpeakers: () => void;
  onDisableBlackout: () => void;
  onRefreshOutputDevices: () => void;
  onOpenModule: (moduleId: AdminModuleId) => void;
}

function formatPeerRoleLabel(role: string, isPt: boolean): string {
  if (role.startsWith('projector-')) {
    const out = role.replace('projector-', '');
    return isPt ? `PC / Projetor OUT ${out}` : `Projector PC OUT ${out}`;
  }
  if (role === 'controller') {
    return isPt ? 'Tablet · Controle' : 'Tablet · Controller';
  }
  if (role.startsWith('audio-node-')) {
    const spk = role.replace('audio-node-', '');
    return isPt ? `Nó de Áudio ${spk}` : `Audio Node ${spk}`;
  }
  return role;
}

function isMonitoredLanRole(role: string): boolean {
  return (
    role.startsWith('projector-') ||
    role === 'controller' ||
    role.startsWith('audio-node-')
  );
}

/**
 * Faixa de Diagnóstico Físico da Sala (Hardware & Rede):
 * - Ignora estado das 5 Camadas (controlado pelo participante no Tablet).
 * - Usa "latch de sessão" + debounce para só alertar quedas reais (caixa BT/USB, PC/projetor ou Tablet),
 *   evitando falsos positivos ao abrir o Setup antes dos equipamentos ou em deploy Web/Vercel.
 */
export const AudioDiagnosticsBanner: React.FC<AudioDiagnosticsBannerProps> = ({
  lang,
  audioContextState,
  audioMode,
  audioOwner,
  localAudioMuted,
  masterGain,
  isPlaying,
  globalBlackout,
  allSpeakersMuted,
  speakerCalibration,
  outputDevices,
  lanConnected,
  lanClients,
  onUnlockAudio,
  onUnmutePc,
  onRestoreMaster,
  onUnmuteAllSpeakers,
  onDisableBlackout,
  onRefreshOutputDevices,
  onOpenModule,
}) => {
  const isPt = lang === 'pt';

  // Latch de caixas locais configuradas que já foram vistas online nesta sessão
  const seenSinksRef = useRef<Map<SpeakerSlotId, string>>(new Map());
  const sinkTimersRef = useRef<Map<SpeakerSlotId, number>>(new Map());
  const [disconnectedSpeakers, setDisconnectedSpeakers] = useState<SpeakerSlotId[]>([]);

  // Latch de dispositivos LAN (projetores, tablet, audio-nodes) vistos online nesta sessão
  const seenRolesRef = useRef<Set<string>>(new Set());
  const roleTimersRef = useRef<Map<string, number>>(new Map());
  const [droppedRoles, setDroppedRoles] = useState<string[]>([]);

  // Latch do servidor LAN mestre (/ws-earth-sync)
  const wasLanConnectedRef = useRef<boolean>(false);
  const lanDropTimerRef = useRef<number | null>(null);
  const [lanHostDropped, setLanHostDropped] = useState<boolean>(false);

  // Monitoramento de queda física de caixas (C1/C2/C3 locais com setSinkId)
  useEffect(() => {
    const availableIds = new Set(outputDevices.map((d) => d.deviceId));
    const hasEnumerated = outputDevices.length > 0;

    for (const spkId of SPEAKER_IDS) {
      const spk = speakerCalibration.speakers[spkId];
      const shouldCheck =
        audioMode === 'room3' &&
        spk.routeTarget === 'local' &&
        !spk.muted &&
        spk.sinkDeviceId !== '' &&
        hasEnumerated;

      if (!shouldCheck) {
        const pending = sinkTimersRef.current.get(spkId);
        if (pending) {
          window.clearTimeout(pending);
          sinkTimersRef.current.delete(spkId);
        }
        if (spk.sinkDeviceId === '' || spk.muted) {
          seenSinksRef.current.delete(spkId);
        }
        setDisconnectedSpeakers((prev) =>
          prev.includes(spkId) ? prev.filter((id) => id !== spkId) : prev
        );
        continue;
      }

      if (availableIds.has(spk.sinkDeviceId)) {
        seenSinksRef.current.set(spkId, spk.sinkDeviceId);
        const pending = sinkTimersRef.current.get(spkId);
        if (pending) {
          window.clearTimeout(pending);
          sinkTimersRef.current.delete(spkId);
        }
        setDisconnectedSpeakers((prev) =>
          prev.includes(spkId) ? prev.filter((id) => id !== spkId) : prev
        );
      } else {
        const wasSeen = seenSinksRef.current.get(spkId) === spk.sinkDeviceId;
        if (wasSeen && !sinkTimersRef.current.has(spkId)) {
          const timer = window.setTimeout(() => {
            sinkTimersRef.current.delete(spkId);
            setDisconnectedSpeakers((prev) => (prev.includes(spkId) ? prev : [...prev, spkId]));
          }, 600);
          sinkTimersRef.current.set(spkId, timer);
        }
      }
    }
  }, [audioMode, outputDevices, speakerCalibration]);

  // Monitoramento de queda de PCs/Projetores, Tablet e Nós LAN (debounce 3.5s para tolerar F5)
  useEffect(() => {
    if (!lanConnected && seenRolesRef.current.size === 0) return;

    const liveRoles = new Set(
      lanClients.map((peer) => peer.role).filter(isMonitoredLanRole)
    );

    for (const role of liveRoles) {
      seenRolesRef.current.add(role);
      const pending = roleTimersRef.current.get(role);
      if (pending) {
        window.clearTimeout(pending);
        roleTimersRef.current.delete(role);
      }
      setDroppedRoles((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : prev));
    }

    if (lanConnected) {
      for (const seenRole of seenRolesRef.current) {
        if (!liveRoles.has(seenRole) && !roleTimersRef.current.has(seenRole)) {
          const timer = window.setTimeout(() => {
            roleTimersRef.current.delete(seenRole);
            setDroppedRoles((prev) =>
              prev.includes(seenRole) ? prev : [...prev, seenRole]
            );
          }, 3500);
          roleTimersRef.current.set(seenRole, timer);
        }
      }
    }
  }, [lanClients, lanConnected]);

  // Monitoramento de queda do próprio servidor WebSocket LAN
  useEffect(() => {
    if (lanConnected) {
      wasLanConnectedRef.current = true;
      if (lanDropTimerRef.current) {
        window.clearTimeout(lanDropTimerRef.current);
        lanDropTimerRef.current = null;
      }
      setLanHostDropped(false);
      return;
    }

    if (wasLanConnectedRef.current && !lanDropTimerRef.current) {
      lanDropTimerRef.current = window.setTimeout(() => {
        lanDropTimerRef.current = null;
        setLanHostDropped(true);
      }, 2500);
    }
  }, [lanConnected]);

  // Limpeza de timers no unmount
  useEffect(() => {
    const sinkTimers = sinkTimersRef.current;
    const roleTimers = roleTimersRef.current;
    return () => {
      for (const t of sinkTimers.values()) window.clearTimeout(t);
      sinkTimers.clear();
      for (const t of roleTimers.values()) window.clearTimeout(t);
      roleTimers.clear();
      if (lanDropTimerRef.current) {
        window.clearTimeout(lanDropTimerRef.current);
        lanDropTimerRef.current = null;
      }
    };
  }, []);

  const dismissDisconnectedSpeaker = (spkId: SpeakerSlotId) => {
    seenSinksRef.current.delete(spkId);
    const pending = sinkTimersRef.current.get(spkId);
    if (pending) {
      window.clearTimeout(pending);
      sinkTimersRef.current.delete(spkId);
    }
    setDisconnectedSpeakers((prev) => prev.filter((id) => id !== spkId));
  };

  const dismissDroppedRole = (role: string) => {
    seenRolesRef.current.delete(role);
    const pending = roleTimersRef.current.get(role);
    if (pending) {
      window.clearTimeout(pending);
      roleTimersRef.current.delete(role);
    }
    setDroppedRoles((prev) => prev.filter((r) => r !== role));
  };

  // Condições técnicas limpas (sem falso-positivo quando o Tablet controla camadas/áudio)
  const isCtxBlocked = audioOwner !== 'tablet' && isPlaying && audioContextState !== 'running';
  const isPcMutedUnintentionally = audioOwner !== 'tablet' && localAudioMuted;
  const isMasterZero = masterGain <= 0.02;
  const isRoomSpeakersMuted = audioMode === 'room3' && allSpeakersMuted;
  const isBlackoutWhilePlaying = globalBlackout && isPlaying;

  const hasAnyWarning =
    disconnectedSpeakers.length > 0 ||
    droppedRoles.length > 0 ||
    lanHostDropped ||
    isBlackoutWhilePlaying ||
    isCtxBlocked ||
    isPcMutedUnintentionally ||
    isMasterZero ||
    isRoomSpeakersMuted;

  if (!hasAnyWarning) {
    return null;
  }

  return (
    <div
      className="flex flex-wrap items-center gap-2 rounded-xl border border-[#1e3a66]/70 bg-[#080d19] px-3.5 py-2.5 text-slate-100"
      data-testid="admin-audio-diagnostics"
      role="status"
    >
      <span className="flex items-center gap-1.5 text-xs font-medium text-slate-300">
        <AlertTriangle size={13} className="text-amber-300" />
        <span>{isPt ? 'Alertas da Sala:' : 'Room Alerts:'}</span>
      </span>

      {/* 1. Caixa física desconectada (BT / USB) */}
      {disconnectedSpeakers.map((spkId) => {
        const spk = speakerCalibration.speakers[spkId];
        const shortLabel = isPt ? spk.shortLabelPt : spk.shortLabelEn;
        return (
          <div
            key={spkId}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-rose-400/50 bg-rose-500/15 pl-3 pr-1.5 text-xs font-medium text-rose-100"
          >
            <Speaker size={13} />
            <span>
              {isPt ? `Caixa ${shortLabel} desconectou` : `Speaker ${shortLabel} disconnected`}
            </span>
            <button
              type="button"
              onClick={onRefreshOutputDevices}
              className={`rounded-full bg-[#060c1a] px-2.5 py-1 text-xs font-medium text-slate-100 transition hover:bg-[#0c1a36] ${ADMIN_FOCUS}`}
              title={isPt ? 'Buscar saídas de áudio novamente' : 'Rescan audio outputs'}
            >
              <span className="inline-flex items-center gap-1">
                <RefreshCw size={11} />
                {isPt ? 'Reescanear' : 'Rescan'}
              </span>
            </button>
            <button
              type="button"
              onClick={() => onOpenModule('audio')}
              className={`rounded-full bg-[#060c1a] px-2.5 py-1 text-xs font-medium text-slate-200 transition hover:bg-[#0c1a36] ${ADMIN_FOCUS}`}
            >
              {isPt ? 'Áudio' : 'Audio'}
            </button>
            <button
              type="button"
              onClick={() => dismissDisconnectedSpeaker(spkId)}
              aria-label={isPt ? `Dispensar alerta de ${shortLabel}` : `Dismiss ${shortLabel} alert`}
              className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-rose-200 transition hover:bg-rose-500/25 ${ADMIN_FOCUS}`}
            >
              <X size={12} />
            </button>
          </div>
        );
      })}

      {/* 2. PC/Projetor, Tablet ou Nó LAN que caiu após estar conectado */}
      {droppedRoles.map((role) => {
        const roleLabel = formatPeerRoleLabel(role, isPt);
        return (
          <div
            key={role}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-rose-400/50 bg-rose-500/15 pl-3 pr-1.5 text-xs font-medium text-rose-100"
          >
            <MonitorOff size={13} />
            <span>{isPt ? `${roleLabel} caiu da rede` : `${roleLabel} dropped`}</span>
            <button
              type="button"
              onClick={() => onOpenModule('network')}
              className={`rounded-full bg-[#060c1a] px-2.5 py-1 text-xs font-medium text-slate-100 transition hover:bg-[#0c1a36] ${ADMIN_FOCUS}`}
            >
              {isPt ? 'Ver Rede & QR' : 'Network & QR'}
            </button>
            <button
              type="button"
              onClick={() => dismissDroppedRole(role)}
              aria-label={isPt ? `Dispensar alerta de ${roleLabel}` : `Dismiss ${roleLabel} alert`}
              className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-rose-200 transition hover:bg-rose-500/25 ${ADMIN_FOCUS}`}
            >
              <X size={12} />
            </button>
          </div>
        );
      })}

      {/* 3. Servidor WebSocket LAN do PC Mestre caiu */}
      {lanHostDropped && (
        <button
          type="button"
          onClick={() => onOpenModule('network')}
          className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-rose-400/50 bg-rose-500/15 px-3 text-xs font-medium text-rose-100 transition hover:bg-rose-500/25 ${ADMIN_FOCUS}`}
        >
          <WifiOff size={13} />
          <span>{isPt ? 'Servidor LAN caiu' : 'LAN Server disconnected'}</span>
        </button>
      )}

      {/* 4. Blackout ativo enquanto a música toca */}
      {isBlackoutWhilePlaying && (
        <button
          type="button"
          onClick={onDisableBlackout}
          className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-amber-300/45 bg-[#0c1a36] px-3 text-xs font-medium text-amber-200 transition hover:bg-[#1e3a66] ${ADMIN_FOCUS}`}
        >
          <EyeOff size={13} />
          <span>{isPt ? 'Blackout ativo · Sair do Blackout' : 'Blackout on · Exit Blackout'}</span>
        </button>
      )}

      {/* 5. Recuperação real de bloqueio de áudio local (somente se PC é o dono) */}
      {isCtxBlocked && (
        <button
          type="button"
          onClick={onUnlockAudio}
          className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-full bg-white px-3 text-xs font-semibold text-[#060913] transition hover:bg-slate-200 ${ADMIN_FOCUS}`}
        >
          <Unlock size={13} />
          <span>{isPt ? 'Desbloquear Áudio' : 'Unlock Audio'}</span>
        </button>
      )}

      {isPcMutedUnintentionally && (
        <button
          type="button"
          onClick={onUnmutePc}
          className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-rose-400/40 bg-rose-500/15 px-3 text-xs font-medium text-rose-100 transition hover:bg-rose-500/25 ${ADMIN_FOCUS}`}
        >
          <Volume2 size={13} />
          <span>{isPt ? 'Ativar Som neste PC' : 'Unmute This PC'}</span>
        </button>
      )}

      {isMasterZero && (
        <button
          type="button"
          onClick={onRestoreMaster}
          className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-slate-400/25 bg-white/[0.06] px-3 text-xs font-medium text-slate-100 transition hover:bg-white/[0.12] ${ADMIN_FOCUS}`}
        >
          <AlertTriangle size={13} />
          <span>{isPt ? 'Restaurar Música 90%' : 'Restore Music 90%'}</span>
        </button>
      )}

      {isRoomSpeakersMuted && (
        <button
          type="button"
          onClick={onUnmuteAllSpeakers}
          className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-rose-400/40 bg-rose-500/15 px-3 text-xs font-medium text-rose-100 transition hover:bg-rose-500/25 ${ADMIN_FOCUS}`}
        >
          <Speaker size={13} />
          <span>{isPt ? 'Desmutar Caixas C1/C2/C3' : 'Unmute Speakers C1/C2/C3'}</span>
        </button>
      )}
    </div>
  );
};
