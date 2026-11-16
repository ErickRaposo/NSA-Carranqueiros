export type SpeakerSlotId = 'speaker1' | 'speaker2' | 'speaker3';
export type SpeakerRouteTarget = 'local' | 'lan-node';

export interface SpeakerSlotConfig {
  id: SpeakerSlotId;
  labelPt: string;
  labelEn: string;
  shortLabelPt: string;
  shortLabelEn: string;
  /** Normalized room position: x (-1 Left Wall .. +1 Right Wall), y (-1 Back/Visitor .. +1 Corner/Ceiling) */
  posX: number;
  posY: number;
  /** Pink Noise acoustic calibration gain: 0.0 to 2.0 (0% to 200%) */
  calibrationGain: number;
  /** Delay compensation in milliseconds: -400 to +400 ms (negative advances speaker / delays video) */
  delayMs: number;
  /** Physical target: 'local' (this Master PC via setSinkId) or 'lan-node' (another PC/phone on ?view=audio-node&spk=1..3) */
  routeTarget: SpeakerRouteTarget;
  /** Physical output device ID (AudioContext.setSinkId) — '' uses system default output */
  sinkDeviceId: string;
  muted: boolean;
}

export interface AudioCalibrationState {
  referenceSpeakerId: SpeakerSlotId;
  /** Global Image × Sound offset (-400 to +400 ms): negative delays video to wait for BT audio; positive delays audio to wait for projector */
  avOffsetMs: number;
  speakers: Record<SpeakerSlotId, SpeakerSlotConfig>;
}

export const SPEAKER_CALIBRATION_STORAGE_KEY = 'earth-jukebox-speaker-calib-v1';
export const SPEAKER_CALIBRATION_CHANNEL = 'earth-jukebox-speaker-calib-sync-v1';

export const SPEAKER_IDS: SpeakerSlotId[] = ['speaker1', 'speaker2', 'speaker3'];

export function speakerIndexToSlotId(index: 1 | 2 | 3): SpeakerSlotId {
  return index === 2 ? 'speaker2' : index === 3 ? 'speaker3' : 'speaker1';
}

export function speakerSlotIdToIndex(slotId: SpeakerSlotId): 1 | 2 | 3 {
  return slotId === 'speaker2' ? 2 : slotId === 'speaker3' ? 3 : 1;
}

export function clampCalibrationDelayMs(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(-400, Math.min(400, Math.round(value)));
}

export function createDefaultAudioCalibration(): AudioCalibrationState {
  return {
    referenceSpeakerId: 'speaker1',
    avOffsetMs: 0,
    speakers: {
      speaker1: {
        id: 'speaker1',
        labelPt: 'Caixa 1 · Parede Esquerda · Globo',
        labelEn: 'Speaker 1 · Left Wall · Globe',
        shortLabelPt: 'Parede Esq',
        shortLabelEn: 'Left Wall',
        posX: -0.85,
        posY: 0.45,
        calibrationGain: 1.0,
        delayMs: 0,
        routeTarget: 'local',
        sinkDeviceId: '',
        muted: false,
      },
      speaker2: {
        id: 'speaker2',
        labelPt: 'Caixa 2 · Parede Direita · Robô',
        labelEn: 'Speaker 2 · Right Wall · Robot',
        shortLabelPt: 'Parede Dir',
        shortLabelEn: 'Right Wall',
        posX: 0.85,
        posY: 0.45,
        calibrationGain: 1.0,
        delayMs: 0,
        routeTarget: 'local',
        sinkDeviceId: '',
        muted: false,
      },
      speaker3: {
        id: 'speaker3',
        labelPt: 'Caixa 3 · Teto / Traseira Espacial',
        labelEn: 'Speaker 3 · Ceiling / Rear Spatial',
        shortLabelPt: 'Teto / Fundo',
        shortLabelEn: 'Ceiling / Rear',
        posX: 0.0,
        posY: -0.85,
        calibrationGain: 1.0,
        delayMs: 0,
        routeTarget: 'local',
        sinkDeviceId: '',
        muted: false,
      },
    },
  };
}

export function loadAudioCalibration(): AudioCalibrationState {
  const fallback = createDefaultAudioCalibration();
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(SPEAKER_CALIBRATION_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<AudioCalibrationState>;
    if (!parsed?.speakers) return fallback;
    return {
      referenceSpeakerId: parsed.referenceSpeakerId ?? 'speaker1',
      avOffsetMs: clampCalibrationDelayMs(parsed.avOffsetMs ?? 0),
      speakers: {
        speaker1: {
          ...fallback.speakers.speaker1,
          ...parsed.speakers.speaker1,
          delayMs: clampCalibrationDelayMs(parsed.speakers.speaker1?.delayMs ?? 0),
        },
        speaker2: {
          ...fallback.speakers.speaker2,
          ...parsed.speakers.speaker2,
          delayMs: clampCalibrationDelayMs(parsed.speakers.speaker2?.delayMs ?? 0),
        },
        speaker3: {
          ...fallback.speakers.speaker3,
          ...parsed.speakers.speaker3,
          delayMs: clampCalibrationDelayMs(parsed.speakers.speaker3?.delayMs ?? 0),
        },
      },
    };
  } catch {
    return fallback;
  }
}

export function saveAudioCalibration(state: AudioCalibrationState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SPEAKER_CALIBRATION_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota errors
  }
}

/**
 * Simplified, gap-free 2D/3D Vector Base Amplitude / Constant-Power Panning (VBAP)
 * for the 3 physical room speakers.
 *
 * `targetX` ∈ [-1, 1] (West/Left Wall -> East/Right Wall)
 * `targetY` ∈ [-1, 1] (Back/Visitor -> Front Corner/Ceiling)
 *
 * Returns constant-power normalized gains (`g1² + g2² + g3² = 1`).
 */
export function computeVbap3Gains(
  targetX: number,
  targetY: number,
  speakers: Record<SpeakerSlotId, Pick<SpeakerSlotConfig, 'posX' | 'posY' | 'muted'>>
): Record<SpeakerSlotId, number> {
  const tx = Math.max(-1, Math.min(1, targetX));
  const ty = Math.max(-1, Math.min(1, targetY));

  const rawWeights: Record<SpeakerSlotId, number> = {
    speaker1: 0,
    speaker2: 0,
    speaker3: 0,
  };

  let sqSum = 0;
  for (const id of SPEAKER_IDS) {
    const spk = speakers[id];
    if (spk.muted) {
      rawWeights[id] = 0;
      continue;
    }
    const dx = tx - spk.posX;
    const dy = ty - spk.posY;
    const distSq = dx * dx + dy * dy;
    const w = 1 / (0.18 + distSq);
    rawWeights[id] = w;
    sqSum += w * w;
  }

  if (sqSum <= 1e-9) {
    return { speaker1: 0, speaker2: 0, speaker3: 0 };
  }

  const norm = 1 / Math.sqrt(sqSum);
  return {
    speaker1: Number((rawWeights.speaker1 * norm).toFixed(4)),
    speaker2: Number((rawWeights.speaker2 * norm).toFixed(4)),
    speaker3: Number((rawWeights.speaker3 * norm).toFixed(4)),
  };
}

export interface EffectiveAudioVisualDelays {
  speakerDelaySec: Record<SpeakerSlotId, number>;
  masterDirectDelaySec: number;
  visualDelayMs: number;
}

/**
 * Converts signed delays (-400..+400 ms per speaker + global avOffsetMs) into:
 * - actual non-negative delays (`DelayNode`, in seconds) for each speaker and direct output (Headphones);
 * - `visualDelayMs` (>= 0) to delay video and visual pulse on screen/projector when audio has Bluetooth latency.
 */
export function computeEffectiveAudioVisualDelays(
  calibration: AudioCalibrationState,
  audioMode: 'hrtf' | 'room3' | 'stereo' | '5.1',
  isolatedSpeakerSlot: SpeakerSlotId | null = null
): EffectiveAudioVisualDelays {
  const av = clampCalibrationDelayMs(calibration.avOffsetMs ?? 0);
  const useRoom = audioMode === 'room3' || isolatedSpeakerSlot !== null;

  if (useRoom) {
    const s1 = clampCalibrationDelayMs(calibration.speakers.speaker1.delayMs) + av;
    const s2 = clampCalibrationDelayMs(calibration.speakers.speaker2.delayMs) + av;
    const s3 = clampCalibrationDelayMs(calibration.speakers.speaker3.delayMs) + av;
    const minSigned = Math.min(s1, s2, s3);
    const visualDelayMs = minSigned < 0 ? -minSigned : 0;

    return {
      speakerDelaySec: {
        speaker1: Math.min(1.4, Math.max(0, (s1 + visualDelayMs) / 1000)),
        speaker2: Math.min(1.4, Math.max(0, (s2 + visualDelayMs) / 1000)),
        speaker3: Math.min(1.4, Math.max(0, (s3 + visualDelayMs) / 1000)),
      },
      masterDirectDelaySec: Math.min(1.4, Math.max(0, av / 1000)),
      visualDelayMs,
    };
  }

  const visualDelayMs = av < 0 ? -av : 0;
  const masterDirectDelaySec = Math.min(1.4, Math.max(0, (av + visualDelayMs) / 1000));
  return {
    speakerDelaySec: {
      speaker1: masterDirectDelaySec,
      speaker2: masterDirectDelaySec,
      speaker3: masterDirectDelaySec,
    },
    masterDirectDelaySec,
    visualDelayMs,
  };
}
