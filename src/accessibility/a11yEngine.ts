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

const SAMPLE_PATCH_SIZE = 3;

function getSampleContext(): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null;
  if (!sampleCanvas) {
    sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = SAMPLE_PATCH_SIZE;
    sampleCanvas.height = SAMPLE_PATCH_SIZE;
    sampleCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });
  }
  return sampleCtx;
}

/**
 * Classifies RGB color sampled from an official NASA SVS visualization into an accurate PT-BR scientific reading.
 * Calibrated directly against NASA SVS colorbars:
 * - SVS 5011 (ISS-LIS Lightning): discrete yellow optical flash points over dark natural Earth base (no continuous scale)
 * - SVS 5147 (GEOS-FP T2M): -40 °C (slate/ice/violet/blue) -> 0 °C (cyan) -> +10..20 °C (yellow/orange) -> +30..40 °C (dark red/grey)
 * - SVS 5148 (GEOS-FP Wind 10m): 0 m/s (black ocean / light grey land) -> 5..15 m/s (blue/cyan/yellow) -> 20..40 m/s (red/maroon/grey)
 * - SVS 5153 (GEOS-CF CO): 40 ppbv (pale cream-yellow, LOW) -> 100 ppbv (orange) -> 130..200 ppbv (red) -> 500 ppbv (dark maroon, HIGH)
 * - SVS 5154 (GEOS-CF NOx): 10⁻³ ppbv (white / pale mint, LOW) -> 10⁻¹ ppbv (medium green) -> 10¹+ ppbv (deep dark forest green, HIGH)
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
      // Discrete yellow/amber optical flash events over darkened natural Earth base
      const yellowFlash = Math.max(0, rn + gn * 0.82 - bn * 1.25);
      if ((rn > 0.55 && gn > 0.42 && rn - bn > 0.22) || yellowFlash > 0.58) {
        const intensity = Math.min(1, Math.max(0.75, yellowFlash * 0.85));
        return {
          intensity01: intensity,
          labelPt: 'Descarga elétrica registrada (evento ISS-LIS · janela 10 dias)',
        };
      }
      if (rn > 0.28 && gn > 0.2 && rn - bn > 0.12) {
        return {
          intensity01: 0.48,
          labelPt: 'Rastro recente de relâmpago na janela de 10 dias',
        };
      }
      return {
        intensity01: Math.min(0.16, lum * 0.5),
        labelPt: 'Sem eventos de raios registrados neste ponto',
      };
    }
    case 'svs5147': {
      // T2M (-40 °C to +40 °C): blue/violet/cyan <= 0 °C; green/yellow +8..18 °C; orange/red/dark-red +20..40 °C
      if (bn > rn + 0.08 || (bn > gn + 0.14 && rn < 0.78)) {
        return { intensity01: 0.18, labelPt: 'Temperatura baixa / frio (≤ 0 °C)' };
      }
      if (rn > 0.2 && rn > bn * 1.65 && gn < rn * 0.62) {
        return {
          intensity01: 0.86,
          labelPt: 'Temperatura elevada (+22 a +40 °C · calor intenso)',
        };
      }
      const mildScore = Math.min(0.72, Math.max(0.42, (rn - bn + 0.55) * 0.68));
      return {
        intensity01: mildScore,
        labelPt: 'Temperatura amena a moderada (+5 a +20 °C)',
      };
    }
    case 'svs5148': {
      // Near-surface wind (0 to 40 m/s): light neutral grey over calm land, dark black over calm ocean
      const maxCh = Math.max(rn, gn, bn);
      const minCh = Math.min(rn, gn, bn);
      const isNeutralCalmLand = maxCh - minCh < 0.09 && lum > 0.55;
      if (isNeutralCalmLand) {
        return {
          intensity01: 0.16,
          labelPt: 'Ventos fracos sobre continente (0 a 5 m/s)',
        };
      }
      if (lum < 0.22 && rn < 0.26 && bn < 0.34) {
        return {
          intensity01: 0.16,
          labelPt: 'Calmaria / ventos fracos (0 a 5 m/s)',
        };
      }
      if (rn > 0.24 && bn < 0.22 && rn > gn * 1.45) {
        return {
          intensity01: 0.88,
          labelPt: 'Ventos fortes a tempestade (18 a 40 m/s)',
        };
      }
      return {
        intensity01: 0.56,
        labelPt: 'Ventos moderados (6 a 17 m/s)',
      };
    }
    case 'svs5153': {
      // CO (40 to 500 ppbv): pale cream-yellow (40, LOW) -> orange (100) -> red (130-200) -> dark maroon (500, HIGH)
      if (rn > 0.22 && gn < 0.22 && bn < 0.18 && rn > gn * 2.4) {
        const plumeScore = Math.min(0.96, 0.78 + (1 - gn) * 0.16);
        return {
          intensity01: plumeScore,
          labelPt: 'Concentração elevada de CO (180 a 500 ppbv · pluma densa)',
        };
      }
      if (rn > 0.65 && gn < 0.78 && bn < 0.42) {
        return {
          intensity01: 0.54,
          labelPt: 'Concentração moderada de CO (90 a 170 ppbv)',
        };
      }
      return {
        intensity01: 0.18,
        labelPt: 'Baixa concentração de CO (40 a 85 ppbv · ar limpo)',
      };
    }
    case 'svs5154': {
      // NOx log scale (10⁻³ to 10¹+ ppbv):
      // White / pale mint green (lum > 0.60) = LOW (10⁻³..10⁻² ppbv, clean ocean/polar air)
      // Medium / vivid green (0.24 < lum <= 0.60) = MODERATE (10⁻²..10⁰ ppbv)
      // Deep dark forest green (lum <= 0.24) = HIGH (1 to 10+ ppbv, urban/industrial corridors)
      const noxScore = Math.min(1, Math.max(0, (1 - lum - 0.04) / 0.88));
      if (lum <= 0.24) {
        return {
          intensity01: Math.max(0.82, noxScore),
          labelPt: 'Concentração elevada de NOx (~1 a 10+ ppbv · polo urbano/industrial)',
        };
      }
      if (lum <= 0.6) {
        return {
          intensity01: Math.max(0.44, Math.min(0.76, noxScore)),
          labelPt: 'Concentração moderada de NOx (~0,05 a 1 ppbv)',
        };
      }
      return {
        intensity01: Math.min(0.3, noxScore),
        labelPt: 'Baixa concentração de NOx (~0,001 a 0,03 ppbv · ar limpo)',
      };
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
  const cx = Math.min(video.videoWidth - 1, Math.max(0, Math.floor(u * video.videoWidth)));
  const cy = Math.min(video.videoHeight - 1, Math.max(0, Math.floor((1 - v) * video.videoHeight)));
  const sx = Math.min(Math.max(0, cx - 1), Math.max(0, video.videoWidth - SAMPLE_PATCH_SIZE));
  const sy = Math.min(Math.max(0, cy - 1), Math.max(0, video.videoHeight - SAMPLE_PATCH_SIZE));

  try {
    ctx.drawImage(
      video,
      sx,
      sy,
      SAMPLE_PATCH_SIZE,
      SAMPLE_PATCH_SIZE,
      0,
      0,
      SAMPLE_PATCH_SIZE,
      SAMPLE_PATCH_SIZE
    );
    const data = ctx.getImageData(0, 0, SAMPLE_PATCH_SIZE, SAMPLE_PATCH_SIZE).data;

    // Average 3x3 neighborhood while ignoring 1px baked neutral-black coastline strokes in GEOS-CF videos
    let rSum = 0;
    let gSum = 0;
    let bSum = 0;
    let count = 0;
    const isGeosCf = datasetId === 'svs5154' || datasetId === 'svs5153';
    for (let i = 0; i < data.length; i += 4) {
      const pr = data[i];
      const pg = data[i + 1];
      const pb = data[i + 2];
      const isBakedBorderStroke =
        isGeosCf && pr < 12 && pg < 12 && pb < 12 && Math.abs(pg - pr) <= 3 && Math.abs(pr - pb) <= 3;
      if (!isBakedBorderStroke) {
        rSum += pr;
        gSum += pg;
        bSum += pb;
        count += 1;
      }
    }
    const rAvg = count > 0 ? Math.round(rSum / count) : data[16];
    const gAvg = count > 0 ? Math.round(gSum / count) : data[17];
    const bAvg = count > 0 ? Math.round(bSum / count) : data[18];

    const interpreted = interpretDatasetRgb(datasetId, rAvg, gAvg, bAvg);
    return {
      datasetId,
      svsId: NASA_DATASETS[datasetId].svsId,
      intensity01: interpreted.intensity01,
      labelPt: interpreted.labelPt,
      rgb: [rAvg, gAvg, bAvg],
    };
  } catch {
    return null;
  }
}

export const PIPER_VOICE_IDS = {
  en: 'en_US-bryce-medium',
  pt: 'pt_BR-faber-medium',
} as const;

let activePiperAudio: HTMLAudioElement | null = null;
let activeSpeechOnEnd: (() => void) | null = null;
let activeFallbackTimerId: number | null = null;
let speechRequestNonce = 0;
let speechVolume01 = 1.0;
let activeSpeechMode: 'piper' | 'webspeech' | null = null;
let pausedSpeechMode: 'piper' | 'webspeech' | null = null;
let speechGateOpen = true;
const piperAudioCache = new Map<string, string>();

export function setSpeechGateOpen(open: boolean): void {
  speechGateOpen = open;
}

export function isSpeechGateOpen(): boolean {
  return speechGateOpen;
}

export function isSpeechUsingPiper(): boolean {
  return activeSpeechMode === 'piper' || pausedSpeechMode === 'piper';
}

export function setSpeechVolume(volume: number): void {
  const clamped = Math.min(1, Math.max(0, Number.isFinite(volume) ? volume : 1));
  speechVolume01 = clamped;
  if (activePiperAudio) {
    activePiperAudio.volume = clamped;
  }
}

export function getSpeechVolume(): number {
  return speechVolume01;
}
const piperPreloadStarted = new Set<'pt' | 'en'>();
const piperReadyVoices = new Set<string>();

export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && ('speechSynthesis' in window || 'Audio' in window);
}

export function pauseSpeech(): 'piper' | 'webspeech' | 'none' {
  if (activeFallbackTimerId !== null && typeof window !== 'undefined') {
    window.clearTimeout(activeFallbackTimerId);
    activeFallbackTimerId = null;
  }

  if (activePiperAudio && !activePiperAudio.ended) {
    try {
      activePiperAudio.pause();
    } catch {
      // ignore pause errors
    }
    activeSpeechMode = null;
    pausedSpeechMode = 'piper';
    return 'piper';
  }

  const webSpeechBusy =
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    Boolean(window.speechSynthesis.speaking || window.speechSynthesis.pending);

  if (activeSpeechMode === 'webspeech' || webSpeechBusy) {
    speechRequestNonce += 1;
    activeSpeechOnEnd = null;
    activeSpeechMode = null;
    pausedSpeechMode = 'webspeech';
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore cancel errors
      }
    }
    return 'webspeech';
  }

  speechRequestNonce += 1;
  activeSpeechMode = null;
  pausedSpeechMode = null;
  return 'none';
}

export function resumeSpeech(): 'resumed-piper' | 'needs-replay' | 'none' {
  speechGateOpen = true;
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
    return 'none';
  }

  if (pausedSpeechMode === 'piper' && activePiperAudio) {
    pausedSpeechMode = null;
    activeSpeechMode = 'piper';
    activePiperAudio.volume = speechVolume01;
    try {
      void activePiperAudio.play().catch(() => {
        if (activePiperAudio) {
          activePiperAudio = null;
        }
        activeSpeechMode = null;
      });
    } catch {
      activePiperAudio = null;
      activeSpeechMode = null;
      return 'needs-replay';
    }
    return 'resumed-piper';
  }

  if (pausedSpeechMode === 'webspeech') {
    pausedSpeechMode = null;
    return 'needs-replay';
  }

  return 'none';
}

export function stopSpeech(): void {
  speechRequestNonce += 1;
  activeSpeechMode = null;
  pausedSpeechMode = null;
  if (activeFallbackTimerId !== null && typeof window !== 'undefined') {
    window.clearTimeout(activeFallbackTimerId);
    activeFallbackTimerId = null;
  }
  if (activePiperAudio) {
    try {
      activePiperAudio.onplay = null;
      activePiperAudio.onended = null;
      activePiperAudio.onerror = null;
      activePiperAudio.pause();
      activePiperAudio.currentTime = 0;
      activePiperAudio.removeAttribute('src');
      activePiperAudio.load();
    } catch {
      // ignore audio stop errors
    }
    activePiperAudio = null;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
      if (window.speechSynthesis.paused || window.speechSynthesis.pending || window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
      }
    } catch {
      // ignore speech engine errors
    }
  }
  if (activeSpeechOnEnd) {
    const finishCb = activeSpeechOnEnd;
    activeSpeechOnEnd = null;
    try {
      finishCb();
    } catch {
      // ignore callback errors
    }
  }
}

const MALE_VOICE_HINTS = [
  'bryce',
  'andrew',
  'guy',
  'brian',
  'faber',
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

function pickVoiceForLang(lang: 'pt' | 'en', preferMale: boolean): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  const prefix = lang === 'en' ? 'en' : 'pt';
  const langVoices = voices.filter((v) => v.lang.toLowerCase().startsWith(prefix));
  const pool = langVoices.length > 0 ? langVoices : voices;
  if (pool.length === 0) return null;

  if (preferMale) {
    const maleMatch = pool.find((v) =>
      MALE_VOICE_HINTS.some((hint) => v.name.toLowerCase().includes(hint))
    );
    if (maleMatch) return maleMatch;
  }

  const exactLocale = lang === 'en' ? 'en-us' : 'pt-br';
  return pool.find((v) => v.lang.toLowerCase().includes(exactLocale)) ?? pool[0];
}

function speakWithWebSpeechFallback(
  text: string,
  lang: 'pt' | 'en',
  interrupt: boolean,
  requestNonce: number,
  options?: { maleVoice?: boolean; onStart?: () => void; onEnd?: () => void }
): void {
  if (!speechGateOpen || typeof window === 'undefined' || !('speechSynthesis' in window) || !text.trim()) return;
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
  if (requestNonce !== speechRequestNonce) return;
  try {
    if (interrupt) window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang === 'en' ? 'en-US' : 'pt-BR';
    utterance.rate = 1.0;
    utterance.volume = speechVolume01;
    const preferMale = options?.maleVoice ?? true;
    utterance.pitch = preferMale ? 0.85 : 1.0;

    const selectedVoice = pickVoiceForLang(lang, preferMale);
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    activeSpeechMode = 'webspeech';
    pausedSpeechMode = null;
    activeSpeechOnEnd = options?.onEnd ?? null;
    utterance.onstart = () => {
      if (!speechGateOpen || requestNonce !== speechRequestNonce) {
        window.speechSynthesis.cancel();
        return;
      }
      options?.onStart?.();
    };
    const handleFinish = () => {
      if (requestNonce !== speechRequestNonce) return;
      if (activeSpeechMode === 'webspeech') activeSpeechMode = null;
      if (activeSpeechOnEnd === options?.onEnd) {
        activeSpeechOnEnd = null;
      }
      options?.onEnd?.();
    };
    utterance.onend = handleFinish;
    utterance.onerror = handleFinish;

    window.speechSynthesis.speak(utterance);
  } catch {
    // ignore speech engine errors
  }
}

/**
 * Pré-carrega e armazena em cache OPFS a voz neural Piper (`en_US-bryce-medium` ou `pt_BR-faber-medium`).
 */
export function preloadPiperVoice(lang: 'pt' | 'en'): void {
  if (typeof window === 'undefined' || piperPreloadStarted.has(lang)) return;
  piperPreloadStarted.add(lang);
  const voiceId = PIPER_VOICE_IDS[lang];
  void import('@mintplex-labs/piper-tts-web')
    .then(async (tts) => {
      const storedVoices = await tts.stored();
      if (!storedVoices.includes(voiceId)) {
        await tts.download(voiceId);
      }
      piperReadyVoices.add(voiceId);
    })
    .catch(() => {
      // Fallback silencioso para Web Speech API caso offline ou sem suporte OPFS
    });
}

export function speakTextPt(
  text: string,
  interrupt = true,
  options?: { maleVoice?: boolean; lang?: 'pt' | 'en'; onStart?: () => void; onEnd?: () => void }
): void {
  if (!speechGateOpen || !text.trim() || typeof window === 'undefined') return;
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
  const lang = options?.lang ?? 'pt';
  const voiceId = PIPER_VOICE_IDS[lang];
  const cacheKey = `${voiceId}:${text}`;

  if (interrupt) {
    stopSpeech();
  }
  const currentNonce = ++speechRequestNonce;

  const playUrl = (url: string): void => {
    if (!speechGateOpen || currentNonce !== speechRequestNonce) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    try {
      const audio = new Audio(url);
      audio.volume = speechVolume01;
      activePiperAudio = audio;
      activeSpeechMode = 'piper';
      pausedSpeechMode = null;
      activeSpeechOnEnd = options?.onEnd ?? null;
      audio.onplay = () => {
        if (!speechGateOpen || currentNonce !== speechRequestNonce) {
          audio.pause();
          return;
        }
        options?.onStart?.();
      };
      audio.onended = () => {
        if (activePiperAudio === audio) activePiperAudio = null;
        if (activeSpeechMode === 'piper') activeSpeechMode = null;
        pausedSpeechMode = null;
        if (activeSpeechOnEnd === options?.onEnd) activeSpeechOnEnd = null;
        options?.onEnd?.();
      };
      audio.onerror = () => {
        if (activePiperAudio === audio) activePiperAudio = null;
        if (activeSpeechMode === 'piper') activeSpeechMode = null;
        speakWithWebSpeechFallback(text, lang, interrupt, currentNonce, options);
      };
      void audio.play().catch(() => {
        if (activePiperAudio === audio) activePiperAudio = null;
        if (activeSpeechMode === 'piper') activeSpeechMode = null;
        speakWithWebSpeechFallback(text, lang, interrupt, currentNonce, options);
      });
    } catch {
      speakWithWebSpeechFallback(text, lang, interrupt, currentNonce, options);
    }
  };

  const cachedUrl = piperAudioCache.get(cacheKey);
  if (cachedUrl) {
    playUrl(cachedUrl);
    return;
  }

  // Se o modelo Piper (~60MB) ainda estiver baixando em segundo plano, fala imediatamente
  // via Web Speech API para nunca deixar a animação muda.
  if (!piperReadyVoices.has(voiceId)) {
    preloadPiperVoice(lang);
    speakWithWebSpeechFallback(text, lang, interrupt, currentNonce, options);
    return;
  }

  let settled = false;
  if (activeFallbackTimerId !== null) {
    window.clearTimeout(activeFallbackTimerId);
    activeFallbackTimerId = null;
  }
  const fallbackTimer = window.setTimeout(() => {
    if (activeFallbackTimerId === fallbackTimer) activeFallbackTimerId = null;
    if (!speechGateOpen || settled || currentNonce !== speechRequestNonce) return;
    settled = true;
    speakWithWebSpeechFallback(text, lang, interrupt, currentNonce, options);
  }, 2500);
  activeFallbackTimerId = fallbackTimer;

  void import('@mintplex-labs/piper-tts-web')
    .then(async (tts) => {
      const wavBlob = await tts.predict({ text, voiceId });
      if (!speechGateOpen || settled || currentNonce !== speechRequestNonce) return;
      settled = true;
      window.clearTimeout(fallbackTimer);
      if (activeFallbackTimerId === fallbackTimer) activeFallbackTimerId = null;
      const url = URL.createObjectURL(wavBlob);
      piperAudioCache.set(cacheKey, url);
      playUrl(url);
    })
    .catch(() => {
      if (!speechGateOpen || settled || currentNonce !== speechRequestNonce) return;
      settled = true;
      window.clearTimeout(fallbackTimer);
      if (activeFallbackTimerId === fallbackTimer) activeFallbackTimerId = null;
      speakWithWebSpeechFallback(text, lang, interrupt, currentNonce, options);
    });
}

export function speakText(
  text: string,
  lang: 'pt' | 'en',
  interrupt = true,
  options?: { maleVoice?: boolean; onStart?: () => void; onEnd?: () => void }
): void {
  speakTextPt(text, interrupt, { ...options, lang });
}

let audioCtx: AudioContext | null = null;
let lastToneTimestamp = 0;

export function stopUiAudioTones(): void {
  if (!audioCtx) return;
  const ctxToClose = audioCtx;
  audioCtx = null;
  try {
    if (ctxToClose.state !== 'closed') {
      void ctxToClose.close().catch(() => {});
    }
  } catch {
    // ignore
  }
}

/**
 * Plays a short, gentle Web Audio API tone whose pitch corresponds to sampled intensity [0..1].
 * Rate-limited to prevent audio clutter during continuous keyboard or mouse movement.
 */
export function playSonificationTone(intensity01: number): void {
  if (typeof window === 'undefined') return;
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
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
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
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
