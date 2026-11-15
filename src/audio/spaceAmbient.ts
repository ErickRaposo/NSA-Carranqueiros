import { getActiveUnmutedAudioEngine, SpatialSfxTarget } from './spatialAudioEngine';

/**
 * Motor espacial de ambientação e efeitos mecânicos da nave (Web Audio API).
 * Roteia integralmente pelos 3 barramentos físicos (C1 Esquerda, C2 Direita, C3 Teto/Fundo)
 * do `SpatialAudioEngine` (incluindo `setSinkId`, calibração de ganho/delay e nós `?view=audio-node`),
 * mantendo abas mutadas (Projetor / Celular Controle) 100% silenciosas.
 */

let ambientTarget: SpatialSfxTarget | null = null;
let ambientMaster: GainNode | null = null;
let ambientNodes: AudioNode[] = [];
let ambientStarted = false;
let unlockBound = false;

function acquireSfxTarget(
  panX = 0,
  panY = 0,
  options?: { duckWithVoice?: boolean }
): SpatialSfxTarget | null {
  const engine = getActiveUnmutedAudioEngine();
  if (!engine) return null;
  return engine.createSpatialSfxTarget(panX, panY, options);
}

function scheduleSweepPan(
  target: SpatialSfxTarget,
  durationSec: number,
  sampleAt01: (t01: number) => [number, number]
): void {
  if (typeof window === 'undefined') return;
  const startMs = performance.now();
  const totalMs = Math.max(100, durationSec * 1000);
  const intervalId = window.setInterval(() => {
    const elapsed = performance.now() - startMs;
    const t01 = Math.min(1, Math.max(0, elapsed / totalMs));
    const [px, py] = sampleAt01(t01);
    target.setPan(px, py);
    if (t01 >= 1) {
      window.clearInterval(intervalId);
    }
  }, 45);

  window.setTimeout(() => {
    window.clearInterval(intervalId);
    target.disconnect();
  }, totalMs + 260);
}

function buildSpacePad(): void {
  if (ambientMaster) return;
  const target = acquireSfxTarget(0, -0.15, { duckWithVoice: true });
  if (!target) return;

  const { ctx, destination } = target;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, ctx.currentTime);
  master.gain.exponentialRampToValueAtTime(0.075, ctx.currentTime + 2.8);

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(520, ctx.currentTime);
  filter.Q.setValueAtTime(0.7, ctx.currentTime);

  filter.connect(master);
  master.connect(destination);

  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.type = 'sine';
  lfo.frequency.value = 0.07;
  lfoGain.gain.value = 190;
  lfo.connect(lfoGain);
  lfoGain.connect(filter.frequency);
  lfo.start();

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

  ambientTarget = target;
  ambientMaster = master;
  ambientNodes = created;
  ambientStarted = true;
}

export function startSpaceAmbient(): void {
  if (typeof window === 'undefined') return;
  try {
    if (!ambientStarted) {
      buildSpacePad();
    }
    const ctx = ambientTarget?.ctx;
    if (ctx && ctx.state === 'suspended') {
      void ctx.resume().catch(() => {});
    }

    if (!unlockBound && (!ctx || ctx.state === 'suspended')) {
      unlockBound = true;
      const unlock = () => {
        if (!ambientStarted) {
          buildSpacePad();
        }
        const activeCtx = ambientTarget?.ctx;
        if (activeCtx) {
          void activeCtx.resume().catch(() => {});
          if (activeCtx.state === 'running') {
            window.removeEventListener('pointerdown', unlock, true);
            window.removeEventListener('keydown', unlock, true);
          }
        }
      };
      window.addEventListener('pointerdown', unlock, { capture: true, passive: true });
      window.addEventListener('keydown', unlock, { capture: true, passive: true });
    }
  } catch {
    // ignore browser audio restriction errors
  }
}

export function stopSpaceAmbient(): void {
  if (!ambientTarget || !ambientMaster) return;
  const targetRef = ambientTarget;
  const masterRef = ambientMaster;
  const nodesRef = ambientNodes;
  ambientTarget = null;
  ambientMaster = null;
  ambientNodes = [];
  ambientStarted = false;

  try {
    const now = targetRef.ctx.currentTime;
    masterRef.gain.cancelScheduledValues(now);
    masterRef.gain.setValueAtTime(Math.max(masterRef.gain.value, 0.0001), now);
    masterRef.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
    window.setTimeout(() => {
      for (const node of nodesRef) {
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
      targetRef.disconnect();
    }, 500);
  } catch {
    targetRef.disconnect();
  }
}

export function setSpaceAmbientDucked(ducked: boolean): void {
  if (!ambientTarget || !ambientMaster) return;
  try {
    const now = ambientTarget.ctx.currentTime;
    const target = ducked ? 0.028 : 0.075;
    ambientMaster.gain.cancelScheduledValues(now);
    ambientMaster.gain.setValueAtTime(Math.max(ambientMaster.gain.value, 0.0001), now);
    ambientMaster.gain.exponentialRampToValueAtTime(target, now + 0.45);
  } catch {
    // ignore
  }
}

/**
 * Efeito sonoro 8D dos motores de propulsão durante a contagem e decolagem (5..1 -> espaço):
 * circula pelas 3 caixas (C1 Parede Esq -> C2 Parede Dir -> C3 Teto/Fundo -> centro).
 */
export function playLaunchThrust8D(durationSec = 10.0): void {
  try {
    const target = acquireSfxTarget(-0.85, 0.35);
    if (!target) return;
    const { ctx, destination } = target;
    const now = ctx.currentTime;

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

    const thrustGain = ctx.createGain();
    thrustGain.gain.setValueAtTime(0.001, now);
    thrustGain.gain.exponentialRampToValueAtTime(0.22, now + 0.8);
    thrustGain.gain.setValueAtTime(0.24, now + durationSec * 0.68);
    thrustGain.gain.exponentialRampToValueAtTime(0.001, now + durationSec);

    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'sawtooth';
    subOsc.frequency.setValueAtTime(42, now);
    subOsc.frequency.exponentialRampToValueAtTime(92, now + durationSec * 0.75);
    subGain.gain.setValueAtTime(0.001, now);
    subGain.gain.exponentialRampToValueAtTime(0.11, now + 0.9);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + durationSec);

    noise.connect(filter);
    filter.connect(thrustGain);
    thrustGain.connect(destination);

    subOsc.connect(subGain);
    subGain.connect(destination);

    noise.start(now);
    noise.stop(now + durationSec + 0.05);
    subOsc.start(now);
    subOsc.stop(now + durationSec + 0.05);

    scheduleSweepPan(target, durationSec, (t01) => {
      const angle = t01 * Math.PI * 3;
      const radius = 1 - t01 * 0.45;
      return [Math.cos(angle) * 0.9 * radius, Math.sin(angle) * 0.85 * radius];
    });
  } catch {
    // ignore browser audio errors
  }
}

/**
 * Efeito espacial 3 pontos (C1 -> C3 -> C2) de portas blindadas fechando + vapor pneumático.
 */
export function playBlastDoorSlamSfx(): void {
  try {
    const steamTarget = acquireSfxTarget(-0.8, 0.45);
    if (!steamTarget) return;
    const { ctx } = steamTarget;
    const now = ctx.currentTime;

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

    const steamGain = ctx.createGain();
    steamGain.gain.setValueAtTime(0.001, now);
    steamGain.gain.exponentialRampToValueAtTime(0.12, now + 0.18);
    steamGain.gain.exponentialRampToValueAtTime(0.001, now + 1.45);
    steam.connect(steamFilter);
    steamFilter.connect(steamGain);
    steamGain.connect(steamTarget.destination);
    steam.start(now);
    steam.stop(now + 1.5);

    scheduleSweepPan(steamTarget, 1.45, (t01) => [
      -0.85 + t01 * 1.7,
      0.45 - Math.sin(t01 * Math.PI) * 1.1,
    ]);

    // Travamento metálico nas 3 zonas (C1 Esquerda, C2 Direita e C3 Teto/Fundo)
    const points: Array<[number, number]> = [
      [-0.8, 0.45],
      [0.8, 0.45],
      [0.0, -0.8],
    ];
    points.forEach(([px, py], idx) => {
      const clangTarget = acquireSfxTarget(px, py);
      if (!clangTarget) return;
      const impactAt = now + 0.88 + idx * 0.07;
      const clang = clangTarget.ctx.createOscillator();
      const clangGain = clangTarget.ctx.createGain();
      clang.type = 'triangle';
      clang.frequency.setValueAtTime(108, impactAt);
      clang.frequency.exponentialRampToValueAtTime(34, impactAt + 0.45);
      clangGain.gain.setValueAtTime(0.001, impactAt);
      clangGain.gain.exponentialRampToValueAtTime(0.18, impactAt + 0.025);
      clangGain.gain.exponentialRampToValueAtTime(0.001, impactAt + 0.55);
      clang.connect(clangGain);
      clangGain.connect(clangTarget.destination);
      clang.start(impactAt);
      clang.stop(impactAt + 0.6);
      if (typeof window !== 'undefined') {
        window.setTimeout(() => clangTarget.disconnect(), 1800);
      }
    });
  } catch {
    // ignore
  }
}

/**
 * Efeito espacial de abertura/ejeção da escotilha em gravidade zero subindo das paredes para o teto (C1/C2 -> C3).
 */
export function playHatchEjectSfx(): void {
  try {
    const target = acquireSfxTarget(-0.6, 0.45);
    if (!target) return;
    const { ctx, destination } = target;
    const now = ctx.currentTime;

    const latch = ctx.createOscillator();
    const latchGain = ctx.createGain();
    latch.type = 'sine';
    latch.frequency.setValueAtTime(196, now);
    latch.frequency.exponentialRampToValueAtTime(98, now + 0.85);
    latchGain.gain.setValueAtTime(0.001, now);
    latchGain.gain.exponentialRampToValueAtTime(0.09, now + 0.12);
    latchGain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
    latch.connect(latchGain);
    latchGain.connect(destination);
    latch.start(now);
    latch.stop(now + 0.95);

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
    const hg = ctx.createGain();
    hg.gain.setValueAtTime(0.001, now + 0.05);
    hg.gain.exponentialRampToValueAtTime(0.075, now + 0.3);
    hg.gain.exponentialRampToValueAtTime(0.001, now + 1.35);
    hiss.connect(lp);
    lp.connect(hg);
    hg.connect(destination);
    hiss.start(now);
    hiss.stop(now + 1.4);

    scheduleSweepPan(target, 1.4, (t01) => [-0.65 + t01 * 1.3, 0.45 - t01 * 1.3]);
  } catch {
    // ignore
  }
}

/**
 * Efeito espacial 3 pontos quando a cabine se desfaz revelando a Terra (C1, C2 e C3 simultâneos).
 */
export function playCabinDissolveSfx(): void {
  try {
    const zones: Array<{ pan: [number, number]; freq: number }> = [
      { pan: [-0.8, 0.45], freq: 174.61 },
      { pan: [0.8, 0.45], freq: 220.0 },
      { pan: [0.0, -0.85], freq: 196.0 },
    ];

    zones.forEach(({ pan: [sx, sy], freq }) => {
      const target = acquireSfxTarget(sx, sy);
      if (!target) return;
      const now = target.ctx.currentTime;
      const sweep = target.ctx.createOscillator();
      const gain = target.ctx.createGain();
      sweep.type = 'sine';
      sweep.frequency.setValueAtTime(freq, now);
      sweep.frequency.exponentialRampToValueAtTime(82.41, now + 1.45);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.075, now + 0.2);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
      sweep.connect(gain);
      gain.connect(target.destination);
      sweep.start(now);
      sweep.stop(now + 1.55);
      scheduleSweepPan(target, 1.5, (t01) => [sx * (1 - t01), sy * (1 - t01)]);
    });
  } catch {
    // ignore
  }
}

/**
 * Efeito físico de tranco/pouso da nave distribuído nas 3 caixas (`C1 + C2 + C3`).
 */
export function playLandingThudSfx(): void {
  try {
    const target = acquireSfxTarget(0, 0);
    if (!target) return;
    const { ctx, destination } = target;
    const now = ctx.currentTime;

    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = 'triangle';
    sub.frequency.setValueAtTime(118, now);
    sub.frequency.exponentialRampToValueAtTime(34, now + 0.38);
    subGain.gain.setValueAtTime(0.001, now);
    subGain.gain.exponentialRampToValueAtTime(0.36, now + 0.018);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    sub.connect(subGain);
    subGain.connect(destination);
    sub.start(now);
    sub.stop(now + 0.5);

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
    ng.gain.setValueAtTime(0.18, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    noise.connect(lp);
    lp.connect(ng);
    ng.connect(destination);
    noise.start(now);
    noise.stop(now + 0.25);

    if (typeof window !== 'undefined') {
      window.setTimeout(() => target.disconnect(), 700);
    }
  } catch {
    // ignore
  }
}
