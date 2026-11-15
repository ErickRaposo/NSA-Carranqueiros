/**
 * Motor leve de música espacial ambiente (Web Audio API) para tocar desde o início
 * da demonstração sem depender de arquivos externos de áudio.
 * Respeita políticas de autoplay dos navegadores: inicia imediatamente se permitido
 * ou desbloqueia automaticamente no primeiro toque/clique do usuário.
 */

let ambientCtx: AudioContext | null = null;
let ambientMaster: GainNode | null = null;
let ambientNodes: AudioNode[] = [];
let activeSfxNodes = new Set<AudioNode>();
let ambientStarted = false;
let ambientSessionActive = false;
let stopAmbientTimerId: number | null = null;
let unlockHandler: (() => void) | null = null;

function detachUnlockListeners(): void {
  if (typeof window === 'undefined' || !unlockHandler) return;
  window.removeEventListener('pointerdown', unlockHandler, true);
  window.removeEventListener('keydown', unlockHandler, true);
  unlockHandler = null;
}

function registerSfxSource(node: AudioScheduledSourceNode, extraNodes: AudioNode[] = []): void {
  activeSfxNodes.add(node);
  for (const extra of extraNodes) {
    activeSfxNodes.add(extra);
  }
  node.onended = () => {
    activeSfxNodes.delete(node);
    for (const extra of extraNodes) {
      activeSfxNodes.delete(extra);
      try {
        extra.disconnect();
      } catch {
        // ignore
      }
    }
    try {
      node.disconnect();
    } catch {
      // ignore
    }
  };
}

function stopAndDisconnectNodes(nodes: Iterable<AudioNode>): void {
  for (const node of nodes) {
    if ('stop' in node && typeof (node as OscillatorNode).stop === 'function') {
      try {
        (node as OscillatorNode).stop();
      } catch {
        // ignore
      }
    }
    try {
      node.disconnect();
    } catch {
      // ignore
    }
  }
}

function buildSpacePad(ctx: AudioContext): void {
  if (ambientMaster) return;

  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, ctx.currentTime);
  master.gain.exponentialRampToValueAtTime(0.075, ctx.currentTime + 2.8);

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(520, ctx.currentTime);
  filter.Q.setValueAtTime(0.7, ctx.currentTime);

  filter.connect(master);
  master.connect(ctx.destination);

  // LFO lento para respiração orgânica do filtro espacial
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.type = 'sine';
  lfo.frequency.value = 0.07;
  lfoGain.gain.value = 190;
  lfo.connect(lfoGain);
  lfoGain.connect(filter.frequency);
  lfo.start();

  // Acorde cósmico suave em Lá menor suspenso (A1, E2, A2, B2, E3, C#4 sutil)
  const voices: Array<{ freq: number; type: OscillatorType; gain: number; detune: number }> = [
    { freq: 55.0, type: 'sine', gain: 0.34, detune: 0 },
    { freq: 82.41, type: 'sine', gain: 0.24, detune: -4 },
    { freq: 110.0, type: 'triangle', gain: 0.14, detune: 5 },
    { freq: 123.47, type: 'sine', gain: 0.12, detune: -6 },
    { freq: 164.81, type: 'sine', gain: 0.11, detune: 7 },
    { freq: 246.94, type: 'sine', gain: 0.06, detune: -3 },
  ];

  const created: AudioNode[] = [master, filter, lfo, lfoGain];

  for (const v of voices) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = v.type;
    osc.frequency.value = v.freq;
    osc.detune.value = v.detune;
    g.gain.value = v.gain;
    osc.connect(g);
    g.connect(filter);
    osc.start();
    created.push(osc, g);
  }

  ambientMaster = master;
  ambientNodes = created;
  ambientStarted = true;
}

export function startSpaceAmbient(): void {
  if (typeof window === 'undefined') return;
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
  const AudioCtor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtor) return;

  if (stopAmbientTimerId !== null) {
    window.clearTimeout(stopAmbientTimerId);
    stopAmbientTimerId = null;
  }
  ambientSessionActive = true;

  try {
    if (!ambientCtx || ambientCtx.state === 'closed') {
      ambientCtx = new AudioCtor();
    }
    if (!ambientStarted) {
      buildSpacePad(ambientCtx);
    }
    if (ambientCtx.state === 'suspended') {
      void ambientCtx.resume().catch(() => {});
    }

    if (!unlockHandler && ambientCtx.state === 'suspended') {
      const unlock = () => {
        if (!ambientSessionActive || !ambientCtx || ambientCtx.state === 'closed') {
          detachUnlockListeners();
          return;
        }
        void ambientCtx
          .resume()
          .then(() => {
            if (!ambientSessionActive || !ambientCtx || ambientCtx.state === 'closed') {
              detachUnlockListeners();
              return;
            }
            if (!ambientStarted) {
              buildSpacePad(ambientCtx);
            }
            if (ambientCtx.state === 'running') {
              detachUnlockListeners();
            }
          })
          .catch(() => {});
      };
      unlockHandler = unlock;
      window.addEventListener('pointerdown', unlock, { capture: true, passive: true });
      window.addEventListener('keydown', unlock, { capture: true, passive: true });
    }
  } catch {
    // ignore browser audio restriction errors
  }
}

/**
 * Interrompe imediatamente música espacial ambiente, todos os efeitos sonoros ativos/agendados
 * e listeners globais de desbloqueio (ex.: ao sair da página, fechar/ocultar a aba ou trocar de rota).
 */
export function stopAllSpaceAudio(): void {
  ambientSessionActive = false;
  detachUnlockListeners();
  if (stopAmbientTimerId !== null && typeof window !== 'undefined') {
    window.clearTimeout(stopAmbientTimerId);
    stopAmbientTimerId = null;
  }

  stopAndDisconnectNodes(activeSfxNodes);
  activeSfxNodes.clear();
  stopAndDisconnectNodes(ambientNodes);
  ambientNodes = [];
  ambientMaster = null;
  ambientStarted = false;

  if (ambientCtx) {
    const ctxToClose = ambientCtx;
    ambientCtx = null;
    try {
      if (ctxToClose.state !== 'closed') {
        void ctxToClose.close().catch(() => {});
      }
    } catch {
      // ignore
    }
  }
}

export function stopSpaceAmbient(): void {
  ambientSessionActive = false;
  detachUnlockListeners();
  if (!ambientCtx || !ambientMaster) {
    stopAllSpaceAudio();
    return;
  }
  try {
    const now = ambientCtx.currentTime;
    ambientMaster.gain.cancelScheduledValues(now);
    ambientMaster.gain.setValueAtTime(Math.max(ambientMaster.gain.value, 0.0001), now);
    ambientMaster.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
    if (stopAmbientTimerId !== null) {
      window.clearTimeout(stopAmbientTimerId);
    }
    stopAmbientTimerId = window.setTimeout(() => {
      stopAmbientTimerId = null;
      if (!ambientSessionActive) {
        stopAllSpaceAudio();
      }
    }, 380);
  } catch {
    stopAllSpaceAudio();
  }
}

function ensureAmbientContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return null;
  const AudioCtor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtor) return null;
  if (!ambientCtx || ambientCtx.state === 'closed') {
    ambientCtx = new AudioCtor();
  }
  if (ambientCtx.state === 'suspended') {
    void ambientCtx.resume().catch(() => {});
  }
  return ambientCtx;
}

/**
 * Abaixa suavemente a música espacial enquanto o robô fala e restaura depois.
 */
export function setSpaceAmbientDucked(ducked: boolean): void {
  if (!ambientCtx || !ambientMaster) return;
  try {
    const now = ambientCtx.currentTime;
    const target = ducked ? 0.028 : 0.085;
    ambientMaster.gain.cancelScheduledValues(now);
    ambientMaster.gain.setValueAtTime(Math.max(ambientMaster.gain.value, 0.0001), now);
    ambientMaster.gain.exponentialRampToValueAtTime(target, now + 0.55);
  } catch {
    // ignore
  }
}

/**
 * Efeito sonoro 8D dos motores de propulsão durante a contagem e decolagem (5, 4, 3, 2, 1 -> espaço):
 * ruído filtrado espacial varrendo o panorama estéreo/8D + sub-grave crescente.
 */
export function playLaunchThrust8D(durationSec = 10.0): void {
  try {
    const ctx = ensureAmbientContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Buffer de ruído branco para o som dos propulsores
    const bufferSize = Math.floor(ctx.sampleRate * durationSec);
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(110, now);
    filter.frequency.exponentialRampToValueAtTime(520, now + durationSec * 0.65);
    filter.frequency.exponentialRampToValueAtTime(220, now + durationSec);
    filter.Q.value = 0.85;

    const panner = ctx.createStereoPanner();
    panner.pan.setValueAtTime(-0.85, now);
    panner.pan.linearRampToValueAtTime(0.85, now + durationSec * 0.35);
    panner.pan.linearRampToValueAtTime(-0.75, now + durationSec * 0.7);
    panner.pan.linearRampToValueAtTime(0, now + durationSec);

    const thrustGain = ctx.createGain();
    thrustGain.gain.setValueAtTime(0.001, now);
    thrustGain.gain.exponentialRampToValueAtTime(0.16, now + 0.8);
    thrustGain.gain.setValueAtTime(0.18, now + durationSec * 0.68);
    thrustGain.gain.exponentialRampToValueAtTime(0.001, now + durationSec);

    // Sub-grave dos motores
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'sawtooth';
    subOsc.frequency.setValueAtTime(42, now);
    subOsc.frequency.exponentialRampToValueAtTime(92, now + durationSec * 0.75);
    subGain.gain.setValueAtTime(0.001, now);
    subGain.gain.exponentialRampToValueAtTime(0.07, now + 0.9);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + durationSec);

    noise.connect(filter);
    filter.connect(thrustGain);
    thrustGain.connect(panner);
    panner.connect(ctx.destination);

    subOsc.connect(subGain);
    subGain.connect(panner);

    registerSfxSource(noise, [filter, thrustGain, panner]);
    registerSfxSource(subOsc, [subGain]);
    noise.start(now);
    noise.stop(now + durationSec + 0.05);
    subOsc.start(now);
    subOsc.stop(now + durationSec + 0.05);
  } catch {
    // ignore browser audio errors
  }
}

/**
 * Efeito espacial 3 pontos (L/C/R) de portas blindadas fechando + vapor pneumático suave.
 */
export function playBlastDoorSlamSfx(): void {
  try {
    const ctx = ensureAmbientContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Vapor pneumático varrendo da esquerda para a direita da sala
    const steamLen = Math.floor(ctx.sampleRate * 1.5);
    const steamBuf = ctx.createBuffer(1, steamLen, ctx.sampleRate);
    const data = steamBuf.getChannelData(0);
    for (let i = 0; i < steamLen; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }
    const steam = ctx.createBufferSource();
    steam.buffer = steamBuf;
    const steamFilter = ctx.createBiquadFilter();
    steamFilter.type = 'bandpass';
    steamFilter.frequency.setValueAtTime(980, now);
    steamFilter.frequency.exponentialRampToValueAtTime(280, now + 1.4);
    steamFilter.Q.value = 1.1;

    const steamPan = ctx.createStereoPanner();
    steamPan.pan.setValueAtTime(-0.75, now);
    steamPan.pan.linearRampToValueAtTime(0.75, now + 1.35);

    const steamGain = ctx.createGain();
    steamGain.gain.setValueAtTime(0.001, now);
    steamGain.gain.exponentialRampToValueAtTime(0.085, now + 0.18);
    steamGain.gain.exponentialRampToValueAtTime(0.001, now + 1.45);
    steam.connect(steamFilter);
    steamFilter.connect(steamGain);
    steamGain.connect(steamPan);
    steamPan.connect(ctx.destination);
    registerSfxSource(steam, [steamFilter, steamGain, steamPan]);
    steam.start(now);
    steam.stop(now + 1.5);

    // Travamento metálico em dois pontos (Parede Esquerda -0.55 e Direita +0.55)
    [-0.55, 0.55].forEach((panVal, idx) => {
      const impactAt = now + 0.92 + idx * 0.08;
      const clang = ctx.createOscillator();
      const clangGain = ctx.createGain();
      const clangPan = ctx.createStereoPanner();
      clangPan.pan.value = panVal;
      clang.type = 'triangle';
      clang.frequency.setValueAtTime(105, impactAt);
      clang.frequency.exponentialRampToValueAtTime(34, impactAt + 0.45);
      clangGain.gain.setValueAtTime(0.001, impactAt);
      clangGain.gain.exponentialRampToValueAtTime(0.14, impactAt + 0.025);
      clangGain.gain.exponentialRampToValueAtTime(0.001, impactAt + 0.55);
      clang.connect(clangGain);
      clangGain.connect(clangPan);
      clangPan.connect(ctx.destination);
      registerSfxSource(clang, [clangGain, clangPan]);
      clang.start(impactAt);
      clang.stop(impactAt + 0.6);
    });
  } catch {
    // ignore
  }
}

/**
 * Efeito suave e sensorial de abertura/ejeção do teto ao entrar em gravidade zero (3 pontos L -> C -> R).
 */
export function playHatchEjectSfx(): void {
  try {
    const ctx = ensureAmbientContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Tom espacial suave de destravamento (sem estalo agressivo)
    const latch = ctx.createOscillator();
    const latchGain = ctx.createGain();
    const latchPan = ctx.createStereoPanner();
    latchPan.pan.setValueAtTime(-0.4, now);
    latchPan.pan.linearRampToValueAtTime(0.4, now + 0.8);
    latch.type = 'sine';
    latch.frequency.setValueAtTime(196, now);
    latch.frequency.exponentialRampToValueAtTime(98, now + 0.85);
    latchGain.gain.setValueAtTime(0.001, now);
    latchGain.gain.exponentialRampToValueAtTime(0.065, now + 0.12);
    latchGain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
    latch.connect(latchGain);
    latchGain.connect(latchPan);
    latchPan.connect(ctx.destination);
    registerSfxSource(latch, [latchGain, latchPan]);
    latch.start(now);
    latch.stop(now + 0.95);

    // Brisa pneumática bem suave (lowpass) circulando pelos 3 pontos da sala
    const len = Math.floor(ctx.sampleRate * 1.4);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    const hiss = ctx.createBufferSource();
    hiss.buffer = buf;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(520, now);
    lp.frequency.exponentialRampToValueAtTime(180, now + 1.35);
    const pan = ctx.createStereoPanner();
    pan.pan.setValueAtTime(-0.75, now);
    pan.pan.linearRampToValueAtTime(0.75, now + 1.35);
    const hg = ctx.createGain();
    hg.gain.setValueAtTime(0.001, now + 0.05);
    hg.gain.exponentialRampToValueAtTime(0.045, now + 0.3);
    hg.gain.exponentialRampToValueAtTime(0.001, now + 1.35);
    hiss.connect(lp);
    lp.connect(hg);
    hg.connect(pan);
    pan.connect(ctx.destination);
    registerSfxSource(hiss, [lp, hg, pan]);
    hiss.start(now);
    hiss.stop(now + 1.4);
  } catch {
    // ignore
  }
}

/**
 * Efeito espacial 3 pontos suave quando toda a cabine espacial abre/se desfaz revelando a Terra e as bandeiras.
 */
export function playCabinDissolveSfx(): void {
  try {
    const ctx = ensureAmbientContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    [-0.75, 0.75].forEach((startPan, idx) => {
      const sweep = ctx.createOscillator();
      const gain = ctx.createGain();
      const pan = ctx.createStereoPanner();
      pan.pan.setValueAtTime(startPan, now);
      pan.pan.linearRampToValueAtTime(0, now + 1.4);
      sweep.type = 'sine';
      sweep.frequency.setValueAtTime(idx === 0 ? 174.61 : 220, now);
      sweep.frequency.exponentialRampToValueAtTime(82.41, now + 1.45);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.055, now + 0.2);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
      sweep.connect(gain);
      gain.connect(pan);
      pan.connect(ctx.destination);
      registerSfxSource(sweep, [gain, pan]);
      sweep.start(now);
      sweep.stop(now + 1.55);
    });
  } catch {
    // ignore
  }
}

/**
 * Efeito físico de tranco/pouso da nave ao tocar o solo terrestre no final da missão (`ended`).
 */
export function playLandingThudSfx(): void {
  try {
    const ctx = ensureAmbientContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Impacto sub-grave (tranco de pouso)
    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'triangle';
    sub.frequency.setValueAtTime(118, now);
    sub.frequency.exponentialRampToValueAtTime(34, now + 0.38);
    subGain.gain.setValueAtTime(0.001, now);
    subGain.gain.exponentialRampToValueAtTime(0.32, now + 0.018);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    sub.connect(subGain);
    subGain.connect(ctx.destination);
    registerSfxSource(sub, [subGain]);
    sub.start(now);
    sub.stop(now + 0.5);

    // Choque metálico curto nos trens de pouso
    const len = Math.floor(ctx.sampleRate * 0.25);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(420, now);
    lp.frequency.exponentialRampToValueAtTime(90, now + 0.22);
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.16, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    noise.connect(lp);
    lp.connect(ng);
    ng.connect(ctx.destination);
    registerSfxSource(noise, [lp, ng]);
    noise.start(now);
    noise.stop(now + 0.25);
  } catch {
    // ignore
  }
}
