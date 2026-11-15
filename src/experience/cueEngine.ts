import {
  AudioCalibrationState,
  computeVbap3Gains,
  SPEAKER_IDS,
  SpeakerSlotId,
} from '../audio/speakerCalibration';
import {
  AudioLevelsMap,
  BeatTimelineSlot,
  CompareCountriesState,
  LiveNoteEvent,
} from './types';

export interface RawMetaBeatEvent {
  beat: number;
  layer: LiveNoteEvent['layer'];
  source_x: number;
  source_y: number;
  pitch: number;
  velocity: number;
  isAnchor: boolean;
}

/**
 * Constrói a matriz sequencial de 32 batidas (8 compassos × 4 tempos) usando EXCLUSIVAMENTE
 * os eventos reais de `meta.json` do país. Se não houver dados reais, retorna lista vazia (zero mock).
 */
export function buildBeatTimeline(
  beatEvents?: ReadonlyArray<RawMetaBeatEvent> | null
): BeatTimelineSlot[] {
  if (!beatEvents || beatEvents.length === 0) {
    return [];
  }

  const slots: BeatTimelineSlot[] = [];

  for (let beat = 0; beat < 32; beat += 1) {
    const bar = Math.floor(beat / 4);
    const beatInBar = beat % 4;
    let hasMelody = false;
    let hasSparkle = false;
    let hasChords = false;
    let hasBass = false;
    let primaryX: number | null = null;
    let primaryY: number | null = null;

    for (const ev of beatEvents) {
      if (ev.beat !== beat) continue;
      if (ev.layer === 'melody') {
        hasMelody = true;
        primaryX = ev.source_x;
        primaryY = ev.source_y;
      } else if (ev.layer === 'sparkle') {
        hasSparkle = true;
        if (primaryX === null) {
          primaryX = ev.source_x;
          primaryY = ev.source_y;
        }
      } else if (ev.layer === 'chords') {
        hasChords = true;
        if (primaryX === null) {
          primaryX = ev.source_x;
          primaryY = ev.source_y;
        }
      } else if (ev.layer === 'bass') {
        hasBass = true;
        if (primaryX === null) {
          primaryX = ev.source_x;
          primaryY = ev.source_y;
        }
      }
    }

    slots.push({
      beat,
      bar,
      beatInBar,
      hasMelody,
      hasSparkle,
      hasChords,
      hasBass,
      primaryX,
      primaryY,
    });
  }

  return slots;
}

/**
 * Avança `progress01` respeitando opcionalmente o congelamento/loop de 1 único compasso (`loopSingleBar`).
 */
export function advanceLoopProgress(
  currentProgress01: number,
  dtSec: number,
  durationSeconds: number,
  loopSingleBar: number | null,
  totalBars = 8
): number {
  const safeDur = Math.max(1, durationSeconds);
  const delta = Math.max(0, dtSec) / safeDur;

  if (loopSingleBar === null) {
    return (currentProgress01 + delta) % 1;
  }

  const barIdx = Math.max(0, Math.min(totalBars - 1, loopSingleBar));
  const barSpan = 1 / totalBars;
  const start = barIdx * barSpan;
  const end = start + barSpan;

  if (currentProgress01 < start || currentProgress01 >= end) {
    return start + (delta % barSpan);
  }

  const offset = (currentProgress01 - start + delta) % barSpan;
  return start + offset;
}

/**
 * Resolve qual país deve entrar ao acionar `Alternar País A ⇄ País B na Mesma Batida`.
 */
export function resolveCompareSwapTarget(
  activeCountryId: string | null,
  compare: CompareCountriesState
): string {
  if (activeCountryId === compare.slotA) {
    return compare.slotB;
  }
  return compare.slotA;
}

/**
 * Calcula o nível acústico real enviado para cada uma das 3 caixas físicas (`C1`, `C2`, `C3`)
 * somando a energia VBAP dos eventos georreferenciados (`source_x`, `source_y`) e a órbita 360° do Vento 8D.
 */
export function computeSpeakerLiveLevels(params: {
  events: ReadonlyArray<LiveNoteEvent>;
  audioLevels: AudioLevelsMap;
  masterGain: number;
  progress01: number;
  speakerCalibration: AudioCalibrationState;
}): Record<SpeakerSlotId, number> {
  const { events, audioLevels, masterGain, progress01, speakerCalibration } = params;
  const accum: Record<SpeakerSlotId, number> = {
    speaker1: 0,
    speaker2: 0,
    speaker3: 0,
  };

  if (masterGain <= 0.001) {
    return accum;
  }

  // 1. Contribuição espacial direta de cada nota/raio ativo na batida
  for (const ev of events) {
    const targetX = ev.source_x * 2 - 1;
    const targetY = ev.source_y * 2 - 1;
    const vbap = computeVbap3Gains(targetX, targetY, speakerCalibration.speakers);
    const layerVu =
      ev.layer === 'melody'
        ? audioLevels.melody
        : ev.layer === 'sparkle'
          ? audioLevels.sparkle
          : ev.layer === 'chords'
            ? audioLevels.chords
            : audioLevels.bass;

    const eventEnergy = Math.max(0.22, layerVu) * ev.velocity;
    for (const id of SPEAKER_IDS) {
      accum[id] += vbap[id] * eventEnergy * 0.62;
    }
  }

  // 2. Contribuição orbital 360° do Bus de Vento 8D (2 voltas por ciclo de 8 compassos)
  if (audioLevels.wind > 0.01) {
    const angle = progress01 * Math.PI * 4;
    const windVbap = computeVbap3Gains(
      Math.cos(angle) * 0.9,
      Math.sin(angle) * 0.9,
      speakerCalibration.speakers
    );
    for (const id of SPEAKER_IDS) {
      accum[id] += windVbap[id] * audioLevels.wind * 0.55;
    }
  }

  // 3. Aplica ganho de calibração individual (0..200%), mute e Master Bus
  const out: Record<SpeakerSlotId, number> = {
    speaker1: 0,
    speaker2: 0,
    speaker3: 0,
  };

  for (const id of SPEAKER_IDS) {
    const spk = speakerCalibration.speakers[id];
    if (spk.muted) {
      out[id] = 0;
      continue;
    }
    const scaled = accum[id] * Math.min(1.5, spk.calibrationGain) * masterGain;
    out[id] = Number(Math.min(1, Math.max(0, scaled)).toFixed(3));
  }

  return out;
}
