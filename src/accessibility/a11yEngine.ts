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
    const preferMale = Boolean(options?.maleVoice);
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
