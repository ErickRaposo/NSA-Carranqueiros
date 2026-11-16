import {
  AudioCalibrationState,
  computeVbap3Gains,
  SPEAKER_IDS,
  SpeakerSlotId,
} from '../audio/speakerCalibration';
import {
  AudioLevelsMap,
  BarLoopRange,
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
 * Builds the sequential 32-beat matrix (8 bars × 4 beats) using EXCLUSIVELY
 * real events from the country's `meta.json` (no synthetic fallback).
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
 * Advances `progress01` while optionally respecting the single-bar loop (`loopSingleBar`)
 * or bar sub-range (`barLoop = [b0, b1]`).
 */
export function advanceLoopProgress(
  currentProgress01: number,
  dtSec: number,
  durationSeconds: number,
  loopSingleBar: number | null,
  totalBars = 8,
  barLoop?: BarLoopRange
): number {
  const safeDur = Math.max(1, durationSeconds);
  const delta = Math.max(0, dtSec) / safeDur;

  const activeRange: [number, number] | null = barLoop
    ? barLoop
    : loopSingleBar !== null
      ? [loopSingleBar, loopSingleBar]
      : null;

  if (activeRange === null) {
    return (currentProgress01 + delta) % 1;
  }

  const b0 = Math.max(0, Math.min(totalBars - 1, Math.min(activeRange[0], activeRange[1])));
  const b1 = Math.max(b0, Math.min(totalBars - 1, Math.max(activeRange[0], activeRange[1])));
  const barSpan = 1 / totalBars;
  const start = b0 * barSpan;
  const span = (b1 - b0 + 1) * barSpan;
  const end = start + span;

  if (currentProgress01 < start || currentProgress01 >= end) {
    return start + (delta % span);
  }

  const offset = (currentProgress01 - start + delta) % span;
  return start + offset;
}

/**
 * Resolves which country should enter when triggering `Switch Country A ⇄ Country B on Same Beat`.
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
 * Computes the actual acoustic level sent to each of the 3 physical speakers (`C1`, `C2`, `C3`)
 * by summing the VBAP energy of georeferenced events (`source_x`, `source_y`) and the 360° orbit of the 8D Wind.
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

  // 1. Direct spatial contribution of each active note/lightning event on the beat
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

  // 2. 360° orbital contribution from the 8D Wind Bus (2 rotations per 8-bar cycle)
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

  // 3. Apply individual calibration gain (0..200%), mute, and Master Bus
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
