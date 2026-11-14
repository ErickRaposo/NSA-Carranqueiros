import { DatasetId } from '../datasets/nasaDatasets';
import { CountryEntry } from '../geo/countries';
import { lonLatToUV } from '../geo/projection';
import { StemId, STEM_METAS } from '../community/unlockStore';
import { RegionUnlockSummary } from '../community/unlockStore';

export interface SoundscapeRadiusTarget {
  type: 'radius';
  centerLon: number;
  centerLat: number;
  radiusKm: number;
  label: string;
}

export interface SoundscapeCountryTarget {
  type: 'country';
  country: CountryEntry;
  label: string;
}

export type SoundscapeTarget = SoundscapeCountryTarget | SoundscapeRadiusTarget;

export interface GeoBounds {
  minLon: number;
  maxLon: number;
  minLat: number;
  maxLat: number;
  centerLon: number;
  centerLat: number;
}

export interface LightningPeakMarker {
  lon: number;
  lat: number;
  pan: number; // -1 left .. +1 right
  intensity: number;
  noteName: string;
  freqHz: number;
  bornAtMs: number;
}

export interface ContourSpotMarker {
  lon: number;
  lat: number;
  weight: number;
}

export interface WindCorridorMarker {
  lon: number;
  lat: number;
  dx: number;
  dy: number;
  speed01: number;
}

export interface SoundscapeMusicalStats {
  lightningMean: number;
  lightningPeaks: { lon: number; lat: number; xFrac: number; yFrac: number; intensity: number }[];
  coMean: number;
  coContrast: number;
  coSpots: ContourSpotMarker[];
  tempIndex: number; // 0..1
  tempHotSpot: ContourSpotMarker;
  noxMean: number;
  noxHotSpot: ContourSpotMarker;
  windMean: number;
  windTurbulence: number;
  windCorridors: WindCorridorMarker[];
  sourceMode: 'live-pixels' | 'synthetic-fallback';
}

export interface SoundscapeVisualTelemetry {
  targetLabel: string;
  bounds: GeoBounds;
  timestampMs: number;
  // Harmony / CO
  keyName: string;
  modeName: 'Lídio' | 'Jônio' | 'Dórico' | 'Eólio';
  chordName: string;
  chordFreqsHz: number[];
  coSpots: ContourSpotMarker[];
  // Melody / Lightning
  melodyNoteName: string;
  melodyFreqHz: number;
  melodyPan: number;
  lightningMarkers: LightningPeakMarker[];
  // Rhythm / Temp
  bpm: number;
  beatPhase01: number;
  beatIndex: number;
  tempIndex: number;
  tempHotSpot: ContourSpotMarker;
  // Bass / NO2
  bassStyle: 'Sub-Drone' | 'Pulsante' | 'Urbano em oitavas';
  bassNoteName: string;
  bassFreqHz: number;
  bassCutoffHz: number;
  noxHotSpot: ContourSpotMarker;
  // FX / Wind
  windWetPct: number;
  windSpeedMsApprox: number;
  windCorridors: WindCorridorMarker[];
  // Stem instantaneous activity meters (0..1)
  stemActivity: Record<StemId, number>;
  sourceMode: 'live-pixels' | 'synthetic-fallback';
}

const MODES: { name: 'Lídio' | 'Jônio' | 'Dórico' | 'Eólio'; intervals: number[] }[] = [
  { name: 'Lídio', intervals: [0, 2, 4, 6, 7, 9, 11] },
  { name: 'Jônio', intervals: [0, 2, 4, 5, 7, 9, 11] },
  { name: 'Dórico', intervals: [0, 2, 3, 5, 7, 9, 10] },
  { name: 'Eólio', intervals: [0, 2, 3, 5, 7, 8, 10] },
];

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const ROOT_KEYS = [
  { name: 'D', midi: 50 },
  { name: 'E', midi: 52 },
  { name: 'F#', midi: 54 },
  { name: 'G', midi: 55 },
  { name: 'A', midi: 57 },
  { name: 'B', midi: 59 },
  { name: 'C', midi: 48 },
];

const PENTATONIC_OFFSETS = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function midiToNoteName(midi: number): string {
  const note = NOTE_NAMES[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${note}${octave}`;
}

export function getTargetBounds(target: SoundscapeTarget): GeoBounds {
  if (target.type === 'radius') {
    const latDelta = target.radiusKm / 111.32;
    const cosLat = Math.max(0.25, Math.cos((target.centerLat * Math.PI) / 180));
    const lonDelta = Math.min(70, target.radiusKm / (111.32 * cosLat));
    return {
      minLon: Math.max(-180, target.centerLon - lonDelta),
      maxLon: Math.min(180, target.centerLon + lonDelta),
      minLat: Math.max(-85, target.centerLat - latDelta),
      maxLat: Math.min(85, target.centerLat + latDelta),
      centerLon: target.centerLon,
      centerLat: target.centerLat,
    };
  }

  const c = target.country;
  const halfLon = Math.max(3, c.lonSpan * 0.5);
  const halfLat = Math.max(2.5, c.latSpan * 0.5);
  return {
    minLon: Math.max(-180, c.lon - halfLon),
    maxLon: Math.min(180, c.lon + halfLon),
    minLat: Math.max(-85, c.lat - halfLat),
    maxLat: Math.min(85, c.lat + halfLat),
    centerLon: c.lon,
    centerLat: c.lat,
  };
}

function seededNoise01(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Computes deterministic atmospheric statistics across the target bounding box
 * directly from live HTMLVideoElement pixels, falling back cleanly to geography-seeded
 * metrics if videos are still loading or headless.
 */
export function sampleSoundscapeStats(
  videoElements: Partial<Record<DatasetId, HTMLVideoElement | null>>,
  bounds: GeoBounds,
  stepIndex: number
): SoundscapeMusicalStats {
  const cols = 10;
  const rows = 7;

  const canUseCanvas = typeof document !== 'undefined';
  const gridCanvas = canUseCanvas ? getRegionCanvas(cols, rows) : null;

  const sampleGrid = (datasetId: DatasetId): Uint8ClampedArray | null => {
    const video = videoElements[datasetId] ?? null;
    if (!gridCanvas || !video || video.readyState < 2 || video.videoWidth <= 0 || video.videoHeight <= 0) {
      return null;
    }
    const { u: uMin, v: vMax } = lonLatToUV(bounds.minLon, bounds.maxLat);
    const { u: uMax, v: vMin } = lonLatToUV(bounds.maxLon, bounds.minLat);

    const sx = Math.max(0, Math.floor(uMin * video.videoWidth));
    const sy = Math.max(0, Math.floor((1 - vMax) * video.videoHeight));
    const sw = Math.max(4, Math.floor((uMax - uMin) * video.videoWidth));
    const sh = Math.max(4, Math.floor((vMax - vMin) * video.videoHeight));

    try {
      gridCanvas.ctx.clearRect(0, 0, cols, rows);
      gridCanvas.ctx.drawImage(video, sx, sy, sw, sh, 0, 0, cols, rows);
      return gridCanvas.ctx.getImageData(0, 0, cols, rows).data;
    } catch {
      return null;
    }
  };

  const lonCell = (c: number) => bounds.minLon + ((c + 0.5) / cols) * (bounds.maxLon - bounds.minLon);
  const latCell = (r: number) => bounds.maxLat - ((r + 0.5) / rows) * (bounds.maxLat - bounds.minLat);

  const d5011 = sampleGrid('svs5011');
  const d5153 = sampleGrid('svs5153');
  const d5147 = sampleGrid('svs5147');
  const d5154 = sampleGrid('svs5154');
  const d5148 = sampleGrid('svs5148');

  const anyLive = Boolean(d5011 || d5153 || d5147 || d5154 || d5148);

  // 1. Lightning (SVS 5011)
  let lightningSum = 0;
  const lightningCandidates: { lon: number; lat: number; xFrac: number; yFrac: number; intensity: number }[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = (r * cols + c) * 4;
      let val = 0;
      if (d5011) {
        const rn = d5011[idx] / 255;
        const gn = d5011[idx + 1] / 255;
        const bn = d5011[idx + 2] / 255;
        const lum = 0.299 * rn + 0.587 * gn + 0.114 * bn;
        val = Math.min(1, Math.max(lum, rn + gn * 0.8 - bn * 1.1));
      } else {
        const latBias = Math.max(0.1, 1 - Math.abs(latCell(r)) / 55);
        val = seededNoise01(lonCell(c) * 1.7 + latCell(r) * 2.3 + stepIndex * 0.9) * latBias;
      }
      lightningSum += val;
      if (val > 0.22) {
        lightningCandidates.push({
          lon: lonCell(c),
          lat: latCell(r),
          xFrac: (c + 0.5) / cols,
          yFrac: 1 - (r + 0.5) / rows,
          intensity: val,
        });
      }
    }
  }
  lightningCandidates.sort((a, b) => b.intensity - a.intensity);
  const lightningPeaks = lightningCandidates.slice(0, 4);
  if (lightningPeaks.length === 0) {
    lightningPeaks.push({
      lon: bounds.centerLon,
      lat: bounds.centerLat,
      xFrac: 0.5,
      yFrac: 0.5,
      intensity: 0.35,
    });
  }

  // 2. CO (SVS 5153)
  let coSum = 0;
  let coMin = 1;
  let coMax = 0;
  const coSpots: ContourSpotMarker[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = (r * cols + c) * 4;
      let val = 0;
      if (d5153) {
        const rn = d5153[idx] / 255;
        const gn = d5153[idx + 1] / 255;
        const bn = d5153[idx + 2] / 255;
        val = Math.min(1, Math.max(0, (rn - bn) * 0.8 + (1 - gn) * 0.4));
      } else {
        val = 0.25 + 0.55 * seededNoise01(lonCell(c) * 0.7 + latCell(r) * 1.1 + stepIndex * 0.25);
      }
      coSum += val;
      if (val < coMin) coMin = val;
      if (val > coMax) coMax = val;
      if (val > 0.38) {
        coSpots.push({ lon: lonCell(c), lat: latCell(r), weight: val });
      }
    }
  }
  coSpots.sort((a, b) => b.weight - a.weight);

  // 3. Temperature (SVS 5147)
  let tempSum = 0;
  let tempHotSpot: ContourSpotMarker = { lon: bounds.centerLon, lat: bounds.centerLat, weight: 0 };
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = (r * cols + c) * 4;
      let heat = 0;
      if (d5147) {
        const rn = d5147[idx] / 255;
        const bn = d5147[idx + 2] / 255;
        heat = Math.min(1, Math.max(0, (rn - bn + 0.55) * 0.72));
      } else {
        const eqWarm = Math.max(0.15, 1 - Math.abs(latCell(r)) / 75);
        heat = eqWarm * (0.65 + 0.35 * seededNoise01(lonCell(c) * 0.4 + stepIndex * 0.1));
      }
      tempSum += heat;
      if (heat >= tempHotSpot.weight) {
        tempHotSpot = { lon: lonCell(c), lat: latCell(r), weight: heat };
      }
    }
  }

  // 4. NO2 (SVS 5154)
  let noxSum = 0;
  let noxHotSpot: ContourSpotMarker = { lon: bounds.centerLon, lat: bounds.centerLat, weight: 0 };
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = (r * cols + c) * 4;
      let nox = 0;
      if (d5154) {
        const rn = d5154[idx] / 255;
        const gn = d5154[idx + 1] / 255;
        const bn = d5154[idx + 2] / 255;
        const lum = 0.299 * rn + 0.587 * gn + 0.114 * bn;
        nox = gn >= rn ? Math.min(1, lum * 1.15) : Math.min(1, lum * 0.6);
      } else {
        nox = 0.2 + 0.65 * seededNoise01(lonCell(c) * 1.9 + latCell(r) * 1.3 + 4.1);
      }
      noxSum += nox;
      if (nox >= noxHotSpot.weight) {
        noxHotSpot = { lon: lonCell(c), lat: latCell(r), weight: nox };
      }
    }
  }

  // 5. Wind (SVS 5148)
  let windSum = 0;
  let windVarSum = 0;
  const windCorridors: WindCorridorMarker[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = (r * cols + c) * 4;
      let spd = 0;
      if (d5148) {
        const rn = d5148[idx] / 255;
        const gn = d5148[idx + 1] / 255;
        const bn = d5148[idx + 2] / 255;
        spd = rn > 0.5 && bn < 0.4 ? 0.86 : gn > 0.42 ? 0.56 : 0.25;
      } else {
        spd = 0.25 + 0.65 * seededNoise01(lonCell(c) * 0.6 + latCell(r) * 2.1 + stepIndex * 0.35);
      }
      windSum += spd;
      windVarSum += Math.abs(spd - 0.45);
      if (spd > 0.46 && windCorridors.length < 6) {
        const angle = ((lonCell(c) + stepIndex * 18) * Math.PI) / 180;
        windCorridors.push({
          lon: lonCell(c),
          lat: latCell(r),
          dx: Math.cos(angle) * (0.6 + spd),
          dy: Math.sin(angle) * 0.35,
          speed01: spd,
        });
      }
    }
  }

  const totalCells = cols * rows;
  return {
    lightningMean: lightningSum / totalCells,
    lightningPeaks,
    coMean: coSum / totalCells,
    coContrast: Math.min(1, coMax - coMin),
    coSpots: coSpots.slice(0, 6),
    tempIndex: tempSum / totalCells,
    tempHotSpot,
    noxMean: noxSum / totalCells,
    noxHotSpot,
    windMean: windSum / totalCells,
    windTurbulence: Math.min(1, (windVarSum / totalCells) * 1.9),
    windCorridors,
    sourceMode: anyLive ? 'live-pixels' : 'synthetic-fallback',
  };
}

let sharedRegionCanvas: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null = null;
function getRegionCanvas(width: number, height: number) {
  if (typeof document === 'undefined') return null;
  if (!sharedRegionCanvas) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    sharedRegionCanvas = { canvas, ctx };
  }
  return sharedRegionCanvas;
}

/**
 * Deterministically derives 100% explainable musical parameters from regional pixel stats
 * matching the NASA Soundscape Pipeline mapping.
 */
export function deriveMusicalParameters(
  target: SoundscapeTarget,
  bounds: GeoBounds,
  stats: SoundscapeMusicalStats,
  stepIndex: number,
  beatIndex: number
): SoundscapeVisualTelemetry {
  // 1. Key & Mode from longitude + CO contrast/concentration
  const lonNorm = (bounds.centerLon + 180) / 360;
  const keyIdx = Math.floor(lonNorm * ROOT_KEYS.length) % ROOT_KEYS.length;
  const rootKey = ROOT_KEYS[keyIdx];
  const modeIdx = Math.min(3, Math.floor((stats.coContrast * 0.65 + stats.coMean * 0.35) * 4));
  const mode = MODES[modeIdx];

  // Chord progression step (4-bar harmonic cycle every 8 steps)
  const chordBar = Math.floor(stepIndex / 4) % 4;
  const degreeSteps = [0, 3, 4, 2]; // I -> IV -> V -> iii
  const scaleDeg = degreeSteps[chordBar];
  const rootOffset = mode.intervals[scaleDeg % mode.intervals.length];
  const chordRootMidi = rootKey.midi + rootOffset;

  const isMinorQuality =
    mode.name === 'Dórico' || mode.name === 'Eólio' || scaleDeg === 2 || scaleDeg === 4;
  const thirdOffset = isMinorQuality ? 3 : 4;
  const fifthOffset = 7;
  const seventhOffset = isMinorQuality ? 10 : 11;
  const ninthOffset = 14;

  const chordMidis = [
    chordRootMidi,
    chordRootMidi + thirdOffset,
    chordRootMidi + fifthOffset,
    chordRootMidi + seventhOffset,
    chordRootMidi + ninthOffset,
  ];
  const chordSuffix = isMinorQuality ? 'm9' : 'maj7';
  const chordName = `${NOTE_NAMES[((chordRootMidi % 12) + 12) % 12]}${chordSuffix}`;

  // 2. Melody note & stereo pan from top Lightning peak
  const peak = stats.lightningPeaks[stepIndex % stats.lightningPeaks.length];
  const pentaIdx = Math.min(
    PENTATONIC_OFFSETS.length - 1,
    Math.max(0, Math.round(peak.yFrac * (PENTATONIC_OFFSETS.length - 1)))
  );
  const melodyMidi = chordRootMidi + 12 + PENTATONIC_OFFSETS[pentaIdx];
  const melodyNoteName = midiToNoteName(melodyMidi);
  const melodyFreqHz = midiToFreq(melodyMidi);
  const melodyPan = Number(((peak.xFrac - 0.5) * 1.7).toFixed(2));

  // 3. Tempo / Rhythm from Temperature (68..108 BPM)
  const bpm = Math.round(68 + Math.min(1, Math.max(0, stats.tempIndex)) * 40);

  // 4. Bass style & filter from NO2
  const bassStyle: SoundscapeVisualTelemetry['bassStyle'] =
    stats.noxMean > 0.62 ? 'Urbano em oitavas' : stats.noxMean > 0.36 ? 'Pulsante' : 'Sub-Drone';
  const bassMidi = chordRootMidi - 12;
  const bassNoteName = midiToNoteName(bassMidi);
  const bassFreqHz = midiToFreq(bassMidi);
  const bassCutoffHz = Math.round(95 + stats.noxMean * 245);

  // 5. Wind spatial Wet %
  const windWetPct = Math.round(18 + Math.min(1, stats.windMean * 0.7 + stats.windTurbulence * 0.3) * 64);
  const windSpeedMsApprox = Number((4 + stats.windMean * 22).toFixed(1));

  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const lightningMarkers: LightningPeakMarker[] = stats.lightningPeaks.slice(0, 3).map((pk, idx) => {
    const pIdx = Math.min(
      PENTATONIC_OFFSETS.length - 1,
      Math.max(0, Math.round(pk.yFrac * (PENTATONIC_OFFSETS.length - 1)))
    );
    const m = chordRootMidi + 12 + PENTATONIC_OFFSETS[pIdx];
    return {
      lon: pk.lon,
      lat: pk.lat,
      pan: (pk.xFrac - 0.5) * 1.7,
      intensity: pk.intensity,
      noteName: idx === 0 ? melodyNoteName : midiToNoteName(m),
      freqHz: midiToFreq(m),
      bornAtMs: now - idx * 90,
    };
  });

  return {
    targetLabel: target.label,
    bounds,
    timestampMs: now,
    keyName: `${rootKey.name} ${mode.name}`,
    modeName: mode.name,
    chordName,
    chordFreqsHz: chordMidis.map(midiToFreq),
    coSpots: stats.coSpots,
    melodyNoteName,
    melodyFreqHz,
    melodyPan,
    lightningMarkers,
    bpm,
    beatPhase01: (beatIndex % 4) / 4,
    beatIndex,
    tempIndex: stats.tempIndex,
    tempHotSpot: stats.tempHotSpot,
    bassStyle,
    bassNoteName,
    bassFreqHz,
    bassCutoffHz,
    noxHotSpot: stats.noxHotSpot,
    windWetPct,
    windSpeedMsApprox,
    windCorridors: stats.windCorridors,
    stemActivity: {
      melody: Math.min(1, peak.intensity),
      harmony: Math.min(1, 0.35 + stats.coMean * 0.65),
      rhythm: Math.min(1, 0.3 + stats.tempIndex * 0.7),
      bass: Math.min(1, 0.25 + stats.noxMean * 0.75),
      fx: windWetPct / 100,
    },
    sourceMode: stats.sourceMode,
  };
}

/**
 * Generates an accessible PT-BR audio explanation describing exactly which map element
 * produced each musical stem + community unlock progress.
 */
export function buildExplainMusicPt(
  telemetry: SoundscapeVisualTelemetry,
  unlockSummary: RegionUnlockSummary,
  activeStems: Record<StemId, boolean>
): string {
  const unlockedNames = (Object.keys(activeStems) as StemId[])
    .filter((id) => unlockSummary.unlockedStems[id] && activeStems[id])
    .map((id) => STEM_METAS[id].labelPt);

  const lockedNames = (Object.keys(activeStems) as StemId[])
    .filter((id) => !unlockSummary.unlockedStems[id])
    .map((id) => STEM_METAS[id].labelPt);

  const unlockPhrase =
    unlockSummary.unlockedCount >= 5
      ? 'Todas as 5 camadas desta região estão iluminadas pelo coletivo.'
      : `Estão liberadas ${unlockSummary.unlockedCount} de 5 camadas (${unlockedNames.join(', ') || 'nenhuma ativa'}). Aguardando contribuição comunitária para: ${lockedNames.join(', ')}.`;

  const lightningPos =
    telemetry.lightningMarkers[0]?.pan < -0.25
      ? 'no lado esquerdo (oeste)'
      : telemetry.lightningMarkers[0]?.pan > 0.25
        ? 'no lado direito (leste)'
        : 'no centro da região';

  return (
    `Explicação musical 1 para 1 de ${telemetry.targetLabel}. ` +
    `${unlockPhrase} ` +
    `Melodia: clarões de raios ISS ${lightningPos} disparam a nota ${telemetry.melodyNoteName} na escala pentatônica. ` +
    `Harmonia: a pluma de monóxido de carbono e a longitude selecionaram o modo ${telemetry.keyName}, acorde ${telemetry.chordName}. ` +
    `Ritmo: o índice térmico médio marcou ${telemetry.bpm} batidas por minuto. ` +
    `Baixo: a concentração de NO2 escolheu o estilo ${telemetry.bassStyle} na nota ${telemetry.bassNoteName} com filtro em ${telemetry.bassCutoffHz} Hertz. ` +
    `Efeitos: ventos médios de ${telemetry.windSpeedMsApprox} metros por segundo ajustaram o reverb e delay espacial em ${telemetry.windWetPct} por cento.`
  );
}

/**
 * Real-time Web Audio 5-Stem Ambient/Downtempo Synthesizer with independent Stem buses,
 * stereo panning, Chorus/Ping-Pong Delay/Reverb FX bus, and step scheduler.
 */
export class SoundscapeSynthPlayer {
  private ctx: AudioContext | null = null;
  private stemBuses: Partial<Record<StemId, GainNode>> = {};
  private fxDelayL: DelayNode | null = null;
  private fxDelayR: DelayNode | null = null;
  private fxWetGain: GainNode | null = null;
  private padOscs: OscillatorNode[] = [];
  private padGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;

    if (!this.ctx) {
      const ctx = new AudioCtx();
      this.ctx = ctx;

      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.ratio.value = 3.5;

      const master = ctx.createGain();
      master.gain.value = 0.72;
      comp.connect(master);
      master.connect(ctx.destination);

      const stemIds: StemId[] = ['melody', 'harmony', 'rhythm', 'bass', 'fx'];
      for (const id of stemIds) {
        const g = ctx.createGain();
        g.gain.value = 1;
        g.connect(comp);
        this.stemBuses[id] = g;
      }

      // Spatial Ping-Pong + Hall Reverb connected into fx stem bus
      const fxBus = this.stemBuses.fx!;
      const wetGain = ctx.createGain();
      wetGain.gain.value = 0.38;

      const delayL = ctx.createDelay(1.0);
      delayL.delayTime.value = 0.34;
      const delayR = ctx.createDelay(1.0);
      delayR.delayTime.value = 0.51;
      const fbL = ctx.createGain();
      fbL.gain.value = 0.32;
      const fbR = ctx.createGain();
      fbR.gain.value = 0.32;
      const panL = ctx.createStereoPanner();
      panL.pan.value = -0.65;
      const panR = ctx.createStereoPanner();
      panR.pan.value = 0.65;

      wetGain.connect(delayL);
      delayL.connect(panL);
      panL.connect(fxBus);
      delayL.connect(fbL);
      fbL.connect(delayR);
      delayR.connect(panR);
      panR.connect(fxBus);
      delayR.connect(fbR);
      fbR.connect(delayL);

      // Lightweight algorithmic Hall impulse
      const rev = ctx.createConvolver();
      const len = Math.floor(ctx.sampleRate * 1.4);
      const imp = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = imp.getChannelData(ch);
        for (let i = 0; i < len; i++) {
          d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.4) * 0.35;
        }
      }
      rev.buffer = imp;
      wetGain.connect(rev);
      rev.connect(fxBus);

      this.fxDelayL = delayL;
      this.fxDelayR = delayR;
      this.fxWetGain = wetGain;

      // Noise buffer for soft organic shaker
      const nLen = Math.floor(ctx.sampleRate * 0.25);
      const nBuf = ctx.createBuffer(1, nLen, ctx.sampleRate);
      const nData = nBuf.getChannelData(0);
      for (let i = 0; i < nLen; i++) nData[i] = Math.random() * 2 - 1;
      this.noiseBuffer = nBuf;
    }

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setStemMix(enabled: Record<StemId, boolean>): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    (Object.keys(enabled) as StemId[]).forEach((id) => {
      const bus = this.stemBuses[id];
      if (bus) {
        bus.gain.setTargetAtTime(enabled[id] ? 1 : 0, now, 0.04);
      }
    });
  }

  public triggerStep(
    telemetry: SoundscapeVisualTelemetry,
    stepIndex: number,
    enabled: Record<StemId, boolean>
  ): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    this.setStemMix(enabled);

    const now = ctx.currentTime;
    const wetSend = this.fxWetGain;

    // Tune FX delay subtly to BPM
    if (this.fxDelayL && this.fxDelayR) {
      const eighth = 60 / telemetry.bpm / 2;
      this.fxDelayL.delayTime.setTargetAtTime(Math.min(0.85, eighth), now, 0.08);
      this.fxDelayR.delayTime.setTargetAtTime(Math.min(0.95, eighth * 1.5), now, 0.08);
    }
    if (wetSend) {
      wetSend.gain.setTargetAtTime(0.14 + (telemetry.windWetPct / 100) * 0.45, now, 0.08);
    }

    // 1. MELODY (Lightning peaks -> Bell chime with X->L/R pan)
    if (enabled.melody) {
      const osc = ctx.createOscillator();
      const mod = ctx.createOscillator();
      const modGain = ctx.createGain();
      const env = ctx.createGain();
      const pan = ctx.createStereoPanner();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(telemetry.melodyFreqHz, now);
      mod.type = 'triangle';
      mod.frequency.setValueAtTime(telemetry.melodyFreqHz * 2, now);
      modGain.gain.setValueAtTime(telemetry.melodyFreqHz * 0.28, now);
      modGain.gain.exponentialRampToValueAtTime(1, now + 0.35);

      pan.pan.setValueAtTime(Math.max(-0.85, Math.min(0.85, telemetry.melodyPan)), now);

      const peakAmp = 0.08 + telemetry.stemActivity.melody * 0.12;
      env.gain.setValueAtTime(0.001, now);
      env.gain.linearRampToValueAtTime(peakAmp, now + 0.015);
      env.gain.exponentialRampToValueAtTime(0.0008, now + 0.72);

      mod.connect(modGain);
      modGain.connect(osc.frequency);
      osc.connect(env);
      env.connect(pan);
      pan.connect(this.stemBuses.melody!);
      if (wetSend && enabled.fx) pan.connect(wetSend);

      osc.start(now);
      mod.start(now);
      osc.stop(now + 0.75);
      mod.stop(now + 0.75);
    }

    // 2. HARMONY (Warm CO pad updated smoothly on every 4-step bar boundary)
    if (enabled.harmony) {
      if (stepIndex % 4 === 0 || this.padOscs.length === 0) {
        this.updateHarmonyPad(ctx, telemetry.chordFreqsHz, wetSend && enabled.fx ? wetSend : null);
      }
    } else if (this.padGain) {
      this.padGain.gain.setTargetAtTime(0, now, 0.06);
    }

    // 3. RHYTHM (Soft kick on beat 0/2, warm rim/shaker on off-beats)
    if (enabled.rhythm) {
      const subBeat = stepIndex % 4;
      if (subBeat === 0 || subBeat === 2) {
        const kick = ctx.createOscillator();
        const kEnv = ctx.createGain();
        kick.type = 'sine';
        kick.frequency.setValueAtTime(102, now);
        kick.frequency.exponentialRampToValueAtTime(44, now + 0.14);
        kEnv.gain.setValueAtTime(0.24, now);
        kEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        kick.connect(kEnv);
        kEnv.connect(this.stemBuses.rhythm!);
        kick.start(now);
        kick.stop(now + 0.24);
      } else if (this.noiseBuffer) {
        const src = ctx.createBufferSource();
        src.buffer = this.noiseBuffer;
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 4800;
        const sEnv = ctx.createGain();
        sEnv.gain.setValueAtTime(0.045, now);
        sEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
        src.connect(hp);
        hp.connect(sEnv);
        sEnv.connect(this.stemBuses.rhythm!);
        src.start(now);
        src.stop(now + 0.07);
      }
    }

    // 4. BASS (NO2 density -> Sub-Drone / Pulsante / Urbano em oitavas + cutoff Hz)
    if (enabled.bass) {
      const shouldPluck =
        telemetry.bassStyle === 'Urbano em oitavas' ||
        (telemetry.bassStyle === 'Pulsante' && stepIndex % 2 === 0) ||
        stepIndex % 4 === 0;
      if (shouldPluck) {
        const bOsc = ctx.createOscillator();
        const lp = ctx.createBiquadFilter();
        const bEnv = ctx.createGain();
        const octaveJump = telemetry.bassStyle === 'Urbano em oitavas' && stepIndex % 2 === 1 ? 2 : 1;
        bOsc.type = telemetry.bassStyle === 'Sub-Drone' ? 'sine' : 'triangle';
        bOsc.frequency.setValueAtTime(telemetry.bassFreqHz * octaveJump, now);
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(telemetry.bassCutoffHz, now);

        const sustain = telemetry.bassStyle === 'Sub-Drone' ? 1.15 : 0.38;
        bEnv.gain.setValueAtTime(0.001, now);
        bEnv.gain.linearRampToValueAtTime(0.2, now + 0.02);
        bEnv.gain.exponentialRampToValueAtTime(0.001, now + sustain);

        bOsc.connect(lp);
        lp.connect(bEnv);
        bEnv.connect(this.stemBuses.bass!);
        bOsc.start(now);
        bOsc.stop(now + sustain + 0.04);
      }
    }

    // 5. FX WIND BREATH (Tuned airy breath shimmer every 4 steps)
    if (enabled.fx && stepIndex % 4 === 0) {
      const air = ctx.createOscillator();
      const aEnv = ctx.createGain();
      air.type = 'sine';
      air.frequency.setValueAtTime(telemetry.chordFreqsHz[4] ?? telemetry.melodyFreqHz, now);
      aEnv.gain.setValueAtTime(0.0005, now);
      aEnv.gain.linearRampToValueAtTime(0.038 * (telemetry.windWetPct / 100), now + 0.4);
      aEnv.gain.exponentialRampToValueAtTime(0.0005, now + 1.5);
      air.connect(aEnv);
      aEnv.connect(this.stemBuses.fx!);
      if (wetSend) aEnv.connect(wetSend);
      air.start(now);
      air.stop(now + 1.55);
    }
  }

  private updateHarmonyPad(ctx: AudioContext, freqs: number[], wetSend: AudioNode | null): void {
    const now = ctx.currentTime;
    this.stopPad();

    const padBus = ctx.createGain();
    padBus.gain.setValueAtTime(0.0005, now);
    padBus.gain.linearRampToValueAtTime(0.09, now + 0.45);
    padBus.connect(this.stemBuses.harmony!);
    if (wetSend) padBus.connect(wetSend);

    const oscs: OscillatorNode[] = [];
    freqs.slice(0, 4).forEach((f, idx) => {
      const osc = ctx.createOscillator();
      osc.type = idx % 2 === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(f, now);
      osc.detune.setValueAtTime(idx % 2 === 0 ? -4 : 4, now);
      osc.connect(padBus);
      osc.start(now);
      oscs.push(osc);
    });

    this.padOscs = oscs;
    this.padGain = padBus;
  }

  private stopPad(): void {
    if (this.padGain && this.ctx) {
      try {
        this.padGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.05);
      } catch {
        // Ignore
      }
    }
    for (const o of this.padOscs) {
      try {
        o.stop(this.ctx ? this.ctx.currentTime + 0.12 : 0);
      } catch {
        // Ignore
      }
    }
    this.padOscs = [];
    this.padGain = null;
  }

  public stop(): void {
    this.stopPad();
  }

  public dispose(): void {
    this.stopPad();
    if (this.ctx) {
      void this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}
