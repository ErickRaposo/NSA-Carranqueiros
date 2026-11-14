import { DatasetId, NASA_DATASETS } from '../datasets/nasaDatasets';
import { lonLatToUV } from '../geo/projection';

export interface SampledReading {
  datasetId: DatasetId;
  svsId: string;
  intensity01: number;
  labelPt: string;
  rgb: [number, number, number];
}

let sampleCanvas: HTMLCanvasElement | null = null;
let sampleCtx: CanvasRenderingContext2D | null = null;

function getSampleContext(): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null;
  if (!sampleCanvas) {
    sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = 1;
    sampleCanvas.height = 1;
    sampleCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });
  }
  return sampleCtx;
}

/**
 * Classifies RGB color sampled from a NASA SVS visualization into an accessible PT-BR reading.
 */
export function interpretDatasetRgb(
  datasetId: DatasetId,
  r: number,
  g: number,
  b: number
): { intensity01: number; labelPt: string } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const lum = 0.299 * rn + 0.587 * gn + 0.114 * bn;

  switch (datasetId) {
    case 'svs5011': {
      // Bright yellow/gold/white dots on dark background indicate lightning density
      const warm = Math.max(0, rn + gn * 0.8 - bn * 1.1);
      const intensity = Math.min(1, Math.max(lum, warm * 0.9));
      if (intensity > 0.55) {
        return { intensity01: intensity, labelPt: 'Alta atividade elétrica (raios frequentes)' };
      }
      if (intensity > 0.24) {
        return { intensity01: intensity, labelPt: 'Atividade moderada de raios' };
      }
      return { intensity01: intensity, labelPt: 'Baixa ou nenhuma atividade de raios' };
    }
    case 'svs5147': {
      // Cold blue/purple vs warm orange/red/dark-red
      const heat = Math.min(1, Math.max(0, (rn - bn + 0.55) * 0.72));
      if (bn > rn + 0.12) {
        return { intensity01: 0.18, labelPt: 'Temperatura baixa / ar frio' };
      }
      if (rn > 0.65 && gn < 0.38) {
        return { intensity01: 0.86, labelPt: 'Temperatura elevada (calor intenso)' };
      }
      if (rn > 0.48 && gn >= 0.38) {
        return { intensity01: Math.max(0.5, heat), labelPt: 'Temperatura amena a quente' };
      }
      return { intensity01: heat, labelPt: 'Temperatura moderada' };
    }
    case 'svs5148': {
      // Near-surface wind: white/grey land (~calm), deep blue (low), cyan/yellow/red (strong)
      const isNeutralLand = Math.abs(rn - gn) < 0.09 && Math.abs(gn - bn) < 0.09 && lum > 0.45;
      if (isNeutralLand) {
        return { intensity01: 0.22, labelPt: 'Ventos leves sobre continente (atrito do relevo)' };
      }
      if (rn > 0.55 && bn < 0.35) {
        return { intensity01: 0.88, labelPt: 'Ventos fortes a muito fortes (>20 m/s)' };
      }
      if (gn > 0.45 || (bn > 0.45 && gn > 0.3)) {
        return { intensity01: 0.58, labelPt: 'Ventos moderados (10 a 18 m/s)' };
      }
      return { intensity01: 0.28, labelPt: 'Ventos fracos (0 a 8 m/s)' };
    }
    case 'svs5153': {
      // CO: pale yellow (low) -> orange -> deep crimson/red (high)
      const redness = Math.min(1, Math.max(0, (rn - bn) * 0.9 + (1 - gn) * 0.45));
      if (rn > 0.55 && gn < 0.32 && bn < 0.25) {
        return { intensity01: 0.88, labelPt: 'Pluma elevada de CO (queimadas ou emissões)' };
      }
      if (rn > 0.65 && gn < 0.62) {
        return { intensity01: Math.max(0.55, redness), labelPt: 'Concentração moderada de CO' };
      }
      return { intensity01: 0.22, labelPt: 'Baixa concentração de CO' };
    }
    case 'svs5154': {
      // NOx: dark green (low) -> bright green -> pale green/white (high)
      if (lum > 0.62 && gn >= rn) {
        return { intensity01: 0.88, labelPt: 'Concentração elevada de NOx (polo urbano/industrial)' };
      }
      if (gn > 0.45 && lum > 0.34) {
        return { intensity01: 0.54, labelPt: 'Concentração moderada de NOx' };
      }
      return { intensity01: 0.2, labelPt: 'Baixa concentração de NOx' };
    }
  }
}

export function sampleVideoAtLonLat(
  video: HTMLVideoElement | null,
  lon: number,
  lat: number,
  datasetId: DatasetId
): SampledReading | null {
  if (!video || video.readyState < 2 || video.videoWidth <= 0 || video.videoHeight <= 0) {
    return null;
  }
  const ctx = getSampleContext();
  if (!ctx) return null;

  const { u, v } = lonLatToUV(lon, lat);
  const px = Math.min(video.videoWidth - 1, Math.max(0, Math.floor(u * video.videoWidth)));
  const py = Math.min(video.videoHeight - 1, Math.max(0, Math.floor((1 - v) * video.videoHeight)));

  try {
    ctx.drawImage(video, px, py, 1, 1, 0, 0, 1, 1);
    const data = ctx.getImageData(0, 0, 1, 1).data;
    const interpreted = interpretDatasetRgb(datasetId, data[0], data[1], data[2]);
    return {
      datasetId,
      svsId: NASA_DATASETS[datasetId].svsId,
      intensity01: interpreted.intensity01,
      labelPt: interpreted.labelPt,
      rgb: [data[0], data[1], data[2]],
    };
  } catch {
    return null;
  }
}

export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function stopSpeech(): void {
  if (!isSpeechSupported()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    // ignore speech engine errors
  }
}

const MALE_VOICE_HINTS = [
  'daniel',
  'antonio',
  'antônio',
  'helio',
  'hélio',
  'felipe',
  'miguel',
  'rafael',
  'ricardo',
  'paulo',
  'tiago',
  'pedro',
  'lucas',
  'male',
  'masculin',
];

function pickPortugueseVoice(preferMale: boolean): SpeechSynthesisVoice | null {
  if (!isSpeechSupported()) return null;
  const voices = window.speechSynthesis.getVoices();
  const ptVoices = voices.filter((v) => v.lang.toLowerCase().startsWith('pt'));
  const pool = ptVoices.length > 0 ? ptVoices : voices;
  if (pool.length === 0) return null;

  if (preferMale) {
    const maleMatch = pool.find((v) =>
      MALE_VOICE_HINTS.some((hint) => v.name.toLowerCase().includes(hint))
    );
    if (maleMatch) return maleMatch;
  }

  return pool.find((v) => v.lang.toLowerCase().includes('pt-br')) ?? pool[0];
}

export function speakTextPt(
  text: string,
  interrupt = true,
  options?: { maleVoice?: boolean; onStart?: () => void; onEnd?: () => void }
): void {
  if (!isSpeechSupported() || !text.trim()) return;
  try {
    if (interrupt) window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';
    utterance.rate = 1.02;
    const preferMale = options?.maleVoice ?? true;
    utterance.pitch = preferMale ? 0.82 : 1.0;

    const selectedVoice = pickPortugueseVoice(preferMale);
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    if (options?.onStart) utterance.onstart = options.onStart;
    if (options?.onEnd) {
      utterance.onend = options.onEnd;
      utterance.onerror = options.onEnd;
    }

    window.speechSynthesis.speak(utterance);
  } catch {
    // ignore speech engine errors
  }
}

let audioCtx: AudioContext | null = null;
let lastToneTimestamp = 0;

/**
 * Plays a short, gentle Web Audio API tone whose pitch corresponds to sampled intensity [0..1].
 * Rate-limited to prevent audio clutter during continuous keyboard or mouse movement.
 */
export function playSonificationTone(intensity01: number): void {
  if (typeof window === 'undefined') return;
  const nowMs = performance.now();
  if (nowMs - lastToneTimestamp < 160) return;
  lastToneTimestamp = nowMs;

  const AudioCtor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtor) return;

  try {
    if (!audioCtx) audioCtx = new AudioCtor();
    if (audioCtx.state === 'suspended') {
      void audioCtx.resume().catch(() => {});
    }

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const clamped = Math.min(1, Math.max(0, intensity01));

    osc.type = 'sine';
    osc.frequency.value = 220 + clamped * 520; // 220 Hz (low) -> 740 Hz (high)

    const t = audioCtx.currentTime;
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.exponentialRampToValueAtTime(0.06, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.15);
  } catch {
    // ignore audio restrictions
  }
}

/**
 * Plays a recognizable, musical Web Audio motif for any of the 5 NASA frequencies
 * ("Ouvir Amostra" in Frequency Discovery Cards & Dormant Stem Previews).
 * Distinct from real collective unlock — pure sensory preview.
 */
export function playStemPreviewSample(
  stemId: 'melody' | 'harmony' | 'rhythm' | 'bass' | 'fx'
): void {
  if (typeof window === 'undefined') return;
  const AudioCtor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtor) return;

  try {
    if (!audioCtx) audioCtx = new AudioCtor();
    if (audioCtx.state === 'suspended') {
      void audioCtx.resume().catch(() => {});
    }
    const ctx = audioCtx;
    const now = ctx.currentTime;

    if (stemId === 'melody') {
      // Crystalline pentatonic lightning chimes (D5 -> F#5 -> A5)
      const notes = [587.33, 739.99, 880.0];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.11);
        g.gain.setValueAtTime(0.001, now + i * 0.11);
        g.gain.exponentialRampToValueAtTime(0.085, now + i * 0.11 + 0.018);
        g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.11 + 0.34);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(now + i * 0.11);
        osc.stop(now + i * 0.11 + 0.36);
      });
    } else if (stemId === 'harmony') {
      // Warm atmospheric chord pad (D4 + F#4 + A4 + C#5)
      const chord = [293.66, 369.99, 440.0, 554.37];
      chord.forEach((freq) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);
        g.gain.setValueAtTime(0.001, now);
        g.gain.exponentialRampToValueAtTime(0.042, now + 0.09);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.68);
      });
    } else if (stemId === 'rhythm') {
      // Thermal double heartbeat pulse
      [0, 0.22].forEach((offset, idx) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(idx === 0 ? 148 : 118, now + offset);
        osc.frequency.exponentialRampToValueAtTime(52, now + offset + 0.14);
        g.gain.setValueAtTime(0.001, now + offset);
        g.gain.exponentialRampToValueAtTime(0.12, now + offset + 0.012);
        g.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.16);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + 0.18);
      });
    } else if (stemId === 'bass') {
      // Deep urban sub-harmonic groove (D2 -> A2)
      [73.42, 110.0].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const g = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now + idx * 0.24);
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(280, now + idx * 0.24);
        g.gain.setValueAtTime(0.001, now + idx * 0.24);
        g.gain.exponentialRampToValueAtTime(0.085, now + idx * 0.24 + 0.03);
        g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.24 + 0.26);
        osc.connect(filter);
        filter.connect(g);
        g.connect(ctx.destination);
        osc.start(now + idx * 0.24);
        osc.stop(now + idx * 0.24 + 0.28);
      });
    } else {
      // Planetary wind shimmer sweep
      const osc = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc2.type = 'triangle';
      osc.frequency.setValueAtTime(392.0, now);
      osc.frequency.exponentialRampToValueAtTime(587.33, now + 0.58);
      osc2.frequency.setValueAtTime(587.33, now);
      osc2.frequency.exponentialRampToValueAtTime(783.99, now + 0.58);
      g.gain.setValueAtTime(0.001, now);
      g.gain.exponentialRampToValueAtTime(0.05, now + 0.14);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.62);
      osc.connect(g);
      osc2.connect(g);
      g.connect(ctx.destination);
      osc.start(now);
      osc2.start(now);
      osc.stop(now + 0.64);
      osc2.stop(now + 0.64);
    }
  } catch {
    // ignore audio restrictions
  }
}
