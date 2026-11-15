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
  ExperienceLayersState,
  LiveNoteEvent,
  ShowCueMode,
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
 * Constrói a matriz sequencial de 32 batidas (8 compassos × 4 tempos) para o Cue Player.
 * Usa os eventos reais de `meta.json` quando carregados, ou a grade sintética determinística como fallback.
 */
export function buildBeatTimeline(
  beatEvents?: ReadonlyArray<RawMetaBeatEvent> | null
): BeatTimelineSlot[] {
  const slots: BeatTimelineSlot[] = [];
  const hasRealEvents = Boolean(beatEvents && beatEvents.length > 0);

  for (let beat = 0; beat < 32; beat += 1) {
    const bar = Math.floor(beat / 4);
    const beatInBar = beat % 4;

    if (hasRealEvents && beatEvents) {
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
    } else {
      const phase = (beat / 32) * Math.PI * 2;
      slots.push({
        beat,
        bar,
        beatInBar,
        hasMelody: true,
        hasSparkle: beat % 2 === 1,
        hasChords: beatInBar === 0 || beatInBar === 2,
        hasBass: beatInBar === 0 || beatInBar === 2 || beatInBar === 3,
        primaryX: Number((0.5 + 0.34 * Math.cos(phase * 3)).toFixed(3)),
        primaryY: Number((0.5 + 0.3 * Math.sin(phase * 2)).toFixed(3)),
      });
    }
  }

  return slots;
}

/**
 * Automação de cenas/camadas por compasso para os 2 modos dirigidos do Cue Player:
 * - 'guided-build': Construção Camada a Camada + Final Tempestade 8D
 * - 'climate-clash': Final Choque Climático (Clima Real Regional vs Referência Neutra 90 BPM)
 */
export function computeShowCueStep(
  mode: ShowCueMode,
  bar: number,
  prev: ExperienceLayersState
): { storyStep: number; layers: ExperienceLayersState } | null {
  if (mode === 'free-loop') return null;

  const clampedBar = Math.max(0, Math.min(7, bar));

  if (mode === 'guided-build') {
    if (clampedBar <= 1) {
      // Ato 1 (Compassos 1–2): Apenas Sub-Bass NO₂ emergindo do breu #000000
      return {
        storyStep: 0,
        layers: {
          ...prev,
          melody: { ...prev.melody, enabled: false, solo: false, sparkleEnabled: false },
          chords: { ...prev.chords, enabled: false, solo: false },
          bass: { ...prev.bass, enabled: true, solo: false },
          temperature: { ...prev.temperature, enabled: false, tuningMode: 'base' },
          wind: { ...prev.wind, enabled: false, solo: false },
        },
      };
    }
    if (clampedBar <= 3) {
      // Ato 2 (Compassos 3–4): Entra Pad Harmônico de CO sobre o Baixo NO₂
      return {
        storyStep: 1,
        layers: {
          ...prev,
          melody: { ...prev.melody, enabled: false, solo: false, sparkleEnabled: false },
          chords: { ...prev.chords, enabled: true, solo: false },
          bass: { ...prev.bass, enabled: true, solo: false },
          temperature: { ...prev.temperature, enabled: false, tuningMode: 'base' },
          wind: { ...prev.wind, enabled: false, solo: false },
        },
      };
    }
    if (clampedBar <= 5) {
      // Ato 3 (Compassos 5–6): Temperatura assume regência climática + Melodia de Raios ISS
      return {
        storyStep: 2,
        layers: {
          ...prev,
          melody: { ...prev.melody, enabled: true, solo: false, sparkleEnabled: false },
          chords: { ...prev.chords, enabled: true, solo: false },
          bass: { ...prev.bass, enabled: true, solo: false },
          temperature: { ...prev.temperature, enabled: true, tuningMode: 'region' },
          wind: { ...prev.wind, enabled: false, solo: false },
        },
      };
    }
    // Ato 4 / Final (Compassos 7–8): Tempestade Completa + Vento Espacial 8D 360°
    return {
      storyStep: 3,
      layers: {
        ...prev,
        melody: { ...prev.melody, enabled: true, solo: false, sparkleEnabled: true },
        chords: { ...prev.chords, enabled: true, solo: false },
        bass: { ...prev.bass, enabled: true, solo: false },
        temperature: { ...prev.temperature, enabled: true, tuningMode: 'region' },
        wind: {
          ...prev.wind,
          enabled: true,
          solo: false,
          gain: Math.max(0.82, prev.wind.gain),
          wetMix: Math.max(0.82, prev.wind.wetMix),
        },
      },
    };
  }

  // mode === 'climate-clash'
  if (clampedBar <= 3) {
    // Compassos 1–4: Clima Regional Real do país (BPM e modo reais)
    return {
      storyStep: 1,
      layers: {
        ...prev,
        melody: { ...prev.melody, enabled: true, solo: false, sparkleEnabled: false },
        chords: { ...prev.chords, enabled: true, solo: false },
        bass: { ...prev.bass, enabled: true, solo: false },
        temperature: { ...prev.temperature, enabled: true, tuningMode: 'region' },
        wind: { ...prev.wind, enabled: true, solo: false },
      },
    };
  }
  if (clampedBar <= 5) {
    // Compassos 5–6: Choque Científico — desliga Temperatura p/ cair na Referência Neutra (90 BPM)
    return {
      storyStep: 2,
      layers: {
        ...prev,
        melody: { ...prev.melody, enabled: true, solo: false, sparkleEnabled: false },
        chords: { ...prev.chords, enabled: true, solo: false },
        bass: { ...prev.bass, enabled: true, solo: false },
        temperature: { ...prev.temperature, enabled: false, tuningMode: 'base' },
        wind: { ...prev.wind, enabled: false, solo: false },
      },
    };
  }
  // Compassos 7–8: Retorno explosivo ao Clima Real + Tempestade + Vento 8D
  return {
    storyStep: 3,
    layers: {
      ...prev,
      melody: { ...prev.melody, enabled: true, solo: false, sparkleEnabled: true },
      chords: { ...prev.chords, enabled: true, solo: false },
      bass: { ...prev.bass, enabled: true, solo: false },
      temperature: { ...prev.temperature, enabled: true, tuningMode: 'region' },
      wind: {
        ...prev.wind,
        enabled: true,
        solo: false,
        gain: Math.max(0.85, prev.wind.gain),
        wetMix: Math.max(0.85, prev.wind.wetMix),
      },
    },
  };
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
