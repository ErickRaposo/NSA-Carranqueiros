import { resolveAssetUrl } from '../datasets/nasaDatasets';
import {
  AudioOutputMode,
  ExperienceLayersState,
  LiveNoteEvent,
  TuningMode,
} from '../experience/types';
import {
  AudioCalibrationState,
  computeVbap3Gains,
  SPEAKER_IDS,
  SpeakerSlotId,
} from './speakerCalibration';

export type CalibrationTestMode =
  | { kind: 'off' }
  | { kind: 'pink-single'; speakerId: SpeakerSlotId }
  | { kind: 'pink-ab'; targetSpeakerId: SpeakerSlotId; activeNow: SpeakerSlotId }
  | { kind: 'delay-click'; targetSpeakerId: SpeakerSlotId };

export interface AudioDeviceOption {
  deviceId: string;
  label: string;
  groupId?: string;
}

export type AudioOutputSupportStatus =
  | 'ready'
  | 'permission-needed'
  | 'insecure-context'
  | 'unsupported';

const NOTE_SEMITONES: Record<string, number> = {
  C: 0,
  'C#': 1,
  Db: 1,
  D: 2,
  'D#': 3,
  Eb: 3,
  E: 4,
  F: 5,
  'F#': 6,
  Gb: 6,
  G: 7,
  'G#': 8,
  Ab: 8,
  A: 9,
  'A#': 10,
  Bb: 10,
  B: 11,
};

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Converte cifra (ex.: 'Dadd9', 'Am7', 'F#m9', 'Esus4') em notas MIDI na região central (C3..E4).
 */
export function parseChordToMidiVoicing(chordSymbol: string, fallbackRoot = 'A'): number[] {
  const match = chordSymbol.trim().match(/^([A-G][#b]?)(.*)$/);
  const rootName = match?.[1] ?? fallbackRoot;
  const quality = (match?.[2] ?? '').toLowerCase();
  const rootSemi = NOTE_SEMITONES[rootName] ?? 9;
  const baseMidi = 48 + rootSemi; // C3 = 48 .. B3 = 59

  const isMinor = quality.startsWith('m') && !quality.startsWith('maj');
  const isSus2 = quality.includes('sus2');
  const isSus4 = quality.includes('sus4');

  const third = isSus2 ? 2 : isSus4 ? 5 : isMinor ? 3 : 4;
  const fifth = 7;
  const seventhOrAdd = quality.includes('maj')
    ? 11
    : quality.includes('7') || quality.includes('9')
      ? 10
      : quality.includes('6')
        ? 9
        : 12;
  const ninth = quality.includes('9') ? 14 : null;

  const notes = [baseMidi, baseMidi + third, baseMidi + fifth, baseMidi + seventhOrAdd];
  if (ninth !== null) notes.push(baseMidi + ninth);
  return notes;
}

function createPinkNoiseBuffer(ctx: BaseAudioContext, durationSeconds = 3.0): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = Math.floor(sampleRate * durationSeconds);
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const out = buffer.getChannelData(0);

  // Filtro Paul Kellet (-3 dB/oitava) para Ruído Rosa acústico de referência
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  let b3 = 0;
  let b4 = 0;
  let b5 = 0;
  let b6 = 0;

  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.969 * b2 + white * 0.153852;
    b3 = 0.8665 * b3 + white * 0.3104856;
    b4 = 0.55 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.016898;
    const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
    b6 = white * 0.115926;

    // Crossfade suave nas pontas de 25ms para loop 100% sem clique
    let env = 1;
    const fadeSamples = Math.floor(sampleRate * 0.025);
    if (i < fadeSamples) env = i / fadeSamples;
    else if (i > length - fadeSamples) env = (length - i) / fadeSamples;

    out[i] = pink * 0.09 * env;
  }

  return buffer;
}

function createAtmosphericImpulseResponse(ctx: BaseAudioContext, seconds = 2.4): AudioBuffer {
  const rate = ctx.sampleRate;
  const length = Math.floor(rate * seconds);
  const impulse = ctx.createBuffer(2, length, rate);

  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      const t = i / length;
      const decay = Math.pow(1 - t, 2.6);
      data[i] = (Math.random() * 2 - 1) * decay * 0.38;
    }
  }
  return impulse;
}

interface SpeakerBusChain {
  input: GainNode;
  delay: DelayNode;
  calibGain: GainNode;
  masterMirrorGain: GainNode;
  stereoPan: StereoPannerNode;
  sinkStreamDest: MediaStreamAudioDestinationNode | null;
  sinkAudioEl: HTMLAudioElement | null;
  sinkCtx: AudioContext | null;
}

type StemKey =
  | 'chords_dry'
  | 'chords_wind'
  | 'bass_dry'
  | 'bass_wind'
  | 'melody_main_dry'
  | 'melody_main_wind'
  | 'melody_sparkle_dry'
  | 'melody_sparkle_wind';

const STEM_KEYS: StemKey[] = [
  'chords_dry',
  'chords_wind',
  'bass_dry',
  'bass_wind',
  'melody_main_dry',
  'melody_main_wind',
  'melody_sparkle_dry',
  'melody_sparkle_wind',
];

type AudioContextWithSink = AudioContext & {
  setSinkId?: (sinkId: string) => Promise<void>;
};

type AudioElementWithSink = HTMLAudioElement & {
  setSinkId?: (sinkId: string) => Promise<void>;
};

export class SpatialAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGainNode: GainNode | null = null;
  private windSendNode: GainNode | null = null;
  private windWetGainNode: GainNode | null = null;
  private windOrbitPanner: PannerNode | null = null;
  private windDirectGainNode: GainNode | null = null;
  private windRoomGainNodes: Record<SpeakerSlotId, GainNode> | null = null;
  private pinkBuffer: AudioBuffer | null = null;
  private speakerChains: Record<SpeakerSlotId, SpeakerBusChain> | null = null;

  private audioMode: AudioOutputMode = 'hrtf';
  private masterGain = 0.9;
  private calibration: AudioCalibrationState;
  private isolatedSpeakerSlot: SpeakerSlotId | null = null;
  private outputPermissionUnlocked = false;
  private orbitTimer: number | null = null;
  private orbitAngleRad = 0;
  private windMeanSpeed = 8.0;

  // Pre-rendered stems state (when countries/<id>/{region,base}/*.ogg|m4a exist)
  private loadedStemCountryKey: string | null = null;
  private stemBuffers: Partial<Record<StemKey, AudioBuffer>> = {};
  private activeStemNodes: Partial<Record<StemKey, { src: AudioBufferSourceNode; gain: GainNode }>> =
    {};
  private usingPreRenderedStems = false;

  // Calibration signal state
  private calibTestMode: CalibrationTestMode = { kind: 'off' };
  private calibPinkSrc: AudioBufferSourceNode | null = null;
  private calibPinkGain: GainNode | null = null;
  private calibIntervalId: number | null = null;
  private onCalibModeChange?: (mode: CalibrationTestMode) => void;

  constructor(initialCalibration: AudioCalibrationState) {
    this.calibration = initialCalibration;
  }

  public setOnCalibrationModeChange(cb: ((mode: CalibrationTestMode) => void) | undefined): void {
    this.onCalibModeChange = cb;
  }

  public getCalibrationTestMode(): CalibrationTestMode {
    return this.calibTestMode;
  }

  public isUsingPreRenderedStems(): boolean {
    return this.usingPreRenderedStems;
  }

  public isSetSinkIdSupported(): boolean {
    if (typeof window === 'undefined') return false;
    const hasMediaElSink =
      typeof HTMLMediaElement !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype;
    const hasAudioCtxSink =
      typeof AudioContext !== 'undefined' && 'setSinkId' in AudioContext.prototype;
    return hasMediaElSink || hasAudioCtxSink;
  }

  public canSelectAudioOutputPrompt(): boolean {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) return false;
    return typeof (navigator.mediaDevices as { selectAudioOutput?: unknown }).selectAudioOutput === 'function';
  }

  public getOutputSupportStatus(devices: ReadonlyArray<AudioDeviceOption>): AudioOutputSupportStatus {
    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      return 'insecure-context';
    }
    if (!this.isSetSinkIdSupported()) {
      return 'unsupported';
    }
    const hasNamedRealDevices = devices.some(
      (d) =>
        d.deviceId &&
        d.deviceId !== 'default' &&
        d.deviceId !== 'communications' &&
        !d.label.startsWith('Saída de Áudio #')
    );
    if (hasNamedRealDevices || this.outputPermissionUnlocked) {
      return 'ready';
    }
    return 'permission-needed';
  }

  public setIsolatedSpeakerSlot(slot: SpeakerSlotId | null): void {
    this.isolatedSpeakerSlot = slot;
    if (this.ctx && this.speakerChains) {
      this.updateSpeakerCalibration(this.calibration);
    }
  }

  public getIsolatedSpeakerSlot(): SpeakerSlotId | null {
    return this.isolatedSpeakerSlot;
  }

  private computeEffectiveChainGain(slotId: SpeakerSlotId): number {
    const cfg = this.calibration.speakers[slotId];
    if (cfg.muted) return 0;
    if (this.isolatedSpeakerSlot !== null) {
      return slotId === this.isolatedSpeakerSlot ? cfg.calibrationGain : 0;
    }
    if (cfg.routeTarget === 'lan-node') {
      return 0;
    }
    return cfg.calibrationGain;
  }

  private computeEffectiveChainPan(slotId: SpeakerSlotId): number {
    if (this.isolatedSpeakerSlot !== null) return 0;
    const cfg = this.calibration.speakers[slotId];
    return Math.max(-1, Math.min(1, cfg.posX));
  }

  public ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;

    if (!this.ctx) {
      const ctx = new AudioCtx({ latencyHint: 'interactive' });
      this.ctx = ctx;

      const master = ctx.createGain();
      master.gain.value = this.masterGain;
      master.connect(ctx.destination);
      this.masterGainNode = master;

      // Build 3 Speaker Chains (for room3 VBAP + Pink Noise + Bluetooth Delay calibration)
      const makeChain = (slotId: SpeakerSlotId): SpeakerBusChain => {
        const cfg = this.calibration.speakers[slotId];
        const input = ctx.createGain();
        const delay = ctx.createDelay(0.5);
        delay.delayTime.value = Math.min(0.4, Math.max(0, cfg.delayMs / 1000));
        const calibGain = ctx.createGain();
        calibGain.gain.value = this.computeEffectiveChainGain(slotId);
        const masterMirrorGain = ctx.createGain();
        masterMirrorGain.gain.value = this.masterGain;
        const stereoPan = ctx.createStereoPanner();
        stereoPan.pan.value = this.computeEffectiveChainPan(slotId);

        input.connect(delay);
        delay.connect(calibGain);
        calibGain.connect(stereoPan);
        stereoPan.connect(master);

        return {
          input,
          delay,
          calibGain,
          masterMirrorGain,
          stereoPan,
          sinkStreamDest: null,
          sinkAudioEl: null,
          sinkCtx: null,
        };
      };

      this.speakerChains = {
        speaker1: makeChain('speaker1'),
        speaker2: makeChain('speaker2'),
        speaker3: makeChain('speaker3'),
      };

      // Build Wind 8D Spatial FX Bus (Ping-Pong Delay + Hall Reverb -> 360° Orbit Panner OR 3-Speaker VBAP)
      const windSend = ctx.createGain();
      const preFilter = ctx.createBiquadFilter();
      preFilter.type = 'bandpass';
      preFilter.frequency.value = 1350;
      preFilter.Q.value = 0.65;

      const delayL = ctx.createDelay(1.0);
      delayL.delayTime.value = 0.27;
      const fbL = ctx.createGain();
      fbL.gain.value = 0.36;

      const convolver = ctx.createConvolver();
      convolver.buffer = createAtmosphericImpulseResponse(ctx, 2.3);

      const windWet = ctx.createGain();
      windWet.gain.value = 0.55;

      const orbitPanner = ctx.createPanner();
      orbitPanner.panningModel = 'HRTF';
      orbitPanner.distanceModel = 'inverse';
      orbitPanner.refDistance = 1.2;
      orbitPanner.positionX.value = 1.4;
      orbitPanner.positionY.value = 0.4;
      orbitPanner.positionZ.value = 0.0;

      const windDirectGain = ctx.createGain();
      const useRoomVbap = this.audioMode === 'room3' || this.isolatedSpeakerSlot !== null;
      windDirectGain.gain.value = useRoomVbap ? 0 : 1;

      const windRoomGains: Record<SpeakerSlotId, GainNode> = {
        speaker1: ctx.createGain(),
        speaker2: ctx.createGain(),
        speaker3: ctx.createGain(),
      };
      for (const id of SPEAKER_IDS) {
        windRoomGains[id].gain.value = 0;
        windWet.connect(windRoomGains[id]);
        windRoomGains[id].connect(this.speakerChains[id].input);
      }

      windSend.connect(preFilter);
      preFilter.connect(delayL);
      delayL.connect(fbL);
      fbL.connect(delayL);
      preFilter.connect(convolver);
      delayL.connect(convolver);
      convolver.connect(windWet);
      windWet.connect(orbitPanner);
      orbitPanner.connect(windDirectGain);
      windDirectGain.connect(master);

      this.windSendNode = windSend;
      this.windWetGainNode = windWet;
      this.windOrbitPanner = orbitPanner;
      this.windDirectGainNode = windDirectGain;
      this.windRoomGainNodes = windRoomGains;

      this.startWindOrbitLoop();
      void this.applySinkRouting();
    }

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private startWindOrbitLoop(): void {
    if (this.orbitTimer !== null || typeof window === 'undefined') return;
    this.orbitTimer = window.setInterval(() => {
      if (!this.ctx || !this.windOrbitPanner) return;
      const angularVel = 0.35 + this.windMeanSpeed * 0.085; // rad/s proportional to NASA wind
      this.orbitAngleRad = (this.orbitAngleRad + angularVel * 0.05) % (Math.PI * 2);
      const radius = 1.65;
      const unitX = Math.cos(this.orbitAngleRad);
      const unitZ = Math.sin(this.orbitAngleRad);
      const ox = unitX * radius;
      const oz = unitZ * radius;
      const oy = 0.35 + 0.25 * Math.sin(this.orbitAngleRad * 2);

      const now = this.ctx.currentTime;
      this.windOrbitPanner.positionX.setTargetAtTime(ox, now, 0.05);
      this.windOrbitPanner.positionY.setTargetAtTime(oy, now, 0.05);
      this.windOrbitPanner.positionZ.setTargetAtTime(oz, now, 0.05);

      // Se estivermos no modo 3 Caixas VBAP (ou Nó LAN isolado), orbita fisicamente entre C1, C2 e C3!
      const useRoomVbap = this.audioMode === 'room3' || this.isolatedSpeakerSlot !== null;
      if (this.windDirectGainNode && this.windRoomGainNodes) {
        this.windDirectGainNode.gain.setTargetAtTime(useRoomVbap ? 0 : 1, now, 0.05);
        if (useRoomVbap) {
          const vbap = computeVbap3Gains(unitX * 0.9, unitZ * 0.9, this.calibration.speakers);
          for (const id of SPEAKER_IDS) {
            this.windRoomGainNodes[id].gain.setTargetAtTime(vbap[id], now, 0.05);
          }
        } else {
          for (const id of SPEAKER_IDS) {
            this.windRoomGainNodes[id].gain.setTargetAtTime(0, now, 0.05);
          }
        }
      }
    }, 50);
  }

  public setMasterGain(gain: number): void {
    this.masterGain = Math.max(0, Math.min(1.5, gain));
    if (this.ctx) {
      const now = this.ctx.currentTime;
      if (this.masterGainNode) {
        this.masterGainNode.gain.setTargetAtTime(this.masterGain, now, 0.03);
      }
      if (this.speakerChains) {
        for (const id of SPEAKER_IDS) {
          this.speakerChains[id].masterMirrorGain.gain.setTargetAtTime(this.masterGain, now, 0.03);
        }
      }
    }
  }

  public setAudioMode(mode: AudioOutputMode): void {
    this.audioMode = mode;
    if (this.ctx && mode === '5.1') {
      const maxCh = this.ctx.destination.maxChannelCount;
      if (maxCh >= 6) {
        try {
          this.ctx.destination.channelCount = 6;
          this.ctx.destination.channelCountMode = 'explicit';
          this.ctx.destination.channelInterpretation = 'discrete';
        } catch {
          // fallback to stereo hardware cleanly
        }
      }
    } else if (this.ctx) {
      try {
        this.ctx.destination.channelCount = 2;
        this.ctx.destination.channelCountMode = 'max';
        this.ctx.destination.channelInterpretation = 'speakers';
      } catch {
        // ignore
      }
    }
  }

  public updateSpeakerCalibration(next: AudioCalibrationState): void {
    const prev = this.calibration;
    this.calibration = next;

    const hasAnyCustomSink = SPEAKER_IDS.some(
      (id) => Boolean(next.speakers[id].sinkDeviceId) && next.speakers[id].routeTarget === 'local'
    );
    if (hasAnyCustomSink && !this.ctx) {
      this.ensureContext();
    }
    if (!this.ctx || !this.speakerChains) return;

    const now = this.ctx.currentTime;
    let sinkChanged = false;
    for (const id of SPEAKER_IDS) {
      const cfg = next.speakers[id];
      const chain = this.speakerChains[id];
      chain.delay.delayTime.setTargetAtTime(
        Math.min(0.4, Math.max(0, cfg.delayMs / 1000)),
        now,
        0.02
      );
      chain.calibGain.gain.setTargetAtTime(this.computeEffectiveChainGain(id), now, 0.02);
      chain.stereoPan.pan.setTargetAtTime(this.computeEffectiveChainPan(id), now, 0.02);

      if (
        prev.speakers[id].sinkDeviceId !== cfg.sinkDeviceId ||
        prev.speakers[id].routeTarget !== cfg.routeTarget
      ) {
        sinkChanged = true;
      }
    }

    if (sinkChanged) {
      void this.applySinkRouting();
    }
  }

  private async applySinkRouting(): Promise<void> {
    if (!this.ctx || !this.speakerChains || !this.masterGainNode) return;
    if (!this.isSetSinkIdSupported()) return;

    for (const id of SPEAKER_IDS) {
      const chain = this.speakerChains[id];
      const cfg = this.calibration.speakers[id];
      const sinkId = cfg.routeTarget === 'local' ? cfg.sinkDeviceId : '';

      // Limpa bridge anterior de saída dedicada (HTMLAudioElement ou AudioContext auxiliar)
      if (chain.sinkAudioEl) {
        try {
          chain.sinkAudioEl.pause();
          chain.sinkAudioEl.srcObject = null;
        } catch {
          // ignore
        }
        chain.sinkAudioEl = null;
      }
      if (chain.sinkCtx) {
        try {
          await chain.sinkCtx.close();
        } catch {
          // ignore
        }
        chain.sinkCtx = null;
      }
      chain.sinkStreamDest = null;

      chain.calibGain.disconnect();
      chain.masterMirrorGain.disconnect();

      if (!sinkId) {
        // Saída padrão do sistema via Master Bus estéreo
        chain.calibGain.connect(chain.stereoPan);
      } else {
        try {
          const streamDest = this.ctx.createMediaStreamDestination();
          chain.masterMirrorGain.gain.value = this.masterGain;
          chain.calibGain.connect(chain.masterMirrorGain);
          chain.masterMirrorGain.connect(streamDest);

          if (typeof Audio !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype) {
            // Caminho preferencial no Chrome/Edge/Brave/Arc: HTMLAudioElement evita o bug de stream silencioso de 2º AudioContext
            const audioEl = new Audio() as AudioElementWithSink;
            audioEl.autoplay = true;
            audioEl.srcObject = streamDest.stream;
            if (audioEl.setSinkId) {
              await audioEl.setSinkId(sinkId);
            }
            await audioEl.play();
            chain.sinkAudioEl = audioEl;
            chain.sinkStreamDest = streamDest;
          } else {
            const auxCtx = new AudioContext({ latencyHint: 'interactive' }) as AudioContextWithSink;
            if (auxCtx.setSinkId) {
              await auxCtx.setSinkId(sinkId);
            }
            const srcNode = auxCtx.createMediaStreamSource(streamDest.stream);
            srcNode.connect(auxCtx.destination);
            chain.sinkCtx = auxCtx;
            chain.sinkStreamDest = streamDest;
          }
        } catch {
          // Fallback limpo para o Master Bus caso a caixa Bluetooth tenha sido desligada
          chain.calibGain.disconnect();
          chain.calibGain.connect(chain.stereoPan);
        }
      }
    }
  }

  public updateWindParameters(windMeanSpeed: number, layers: ExperienceLayersState): void {
    this.windMeanSpeed = windMeanSpeed;
    if (this.windWetGainNode && this.ctx) {
      const targetWet = layers.wind.enabled ? layers.wind.wetMix * 0.95 : 0;
      this.windWetGainNode.gain.setTargetAtTime(targetWet, this.ctx.currentTime, 0.05);
    }
    this.syncStemGains(layers);
  }

  /**
   * Carrega os 8 stems gapless pré-renderizados pelo Python caso `hasAudioStems` esteja presente em `meta.json`.
   */
  public async tryLoadPreRenderedStems(
    countryId: string,
    tuningMode: TuningMode,
    hasAudioStems?: boolean,
    audioExt: 'ogg' | 'm4a' | 'mp3' | 'wav' = 'ogg'
  ): Promise<boolean> {
    if (!hasAudioStems) {
      this.stopStemPlayback();
      this.usingPreRenderedStems = false;
      this.loadedStemCountryKey = null;
      return false;
    }

    const ctx = this.ensureContext();
    if (!ctx) return false;

    const key = `${countryId}:${tuningMode}`;
    if (this.loadedStemCountryKey === key && this.usingPreRenderedStems) {
      return true;
    }

    try {
      const entries = await Promise.all(
        STEM_KEYS.map(async (stem) => {
          const url = resolveAssetUrl(`/countries/${countryId}/${tuningMode}/${stem}.${audioExt}`);
          const res = await window.fetch(url);
          if (!res.ok) throw new Error(`Missing stem ${url}`);
          const arr = await res.arrayBuffer();
          const decoded = await ctx.decodeAudioData(arr);
          return [stem, decoded] as const;
        })
      );

      const nextBuffers: Partial<Record<StemKey, AudioBuffer>> = {};
      for (const [stem, buf] of entries) {
        nextBuffers[stem] = buf;
      }
      this.stemBuffers = nextBuffers;
      this.loadedStemCountryKey = key;
      this.usingPreRenderedStems = true;
      return true;
    } catch {
      this.usingPreRenderedStems = false;
      return false;
    }
  }

  public startStemPlayback(offsetProgress01: number, layers: ExperienceLayersState): void {
    if (!this.usingPreRenderedStems || !this.ctx || !this.masterGainNode) return;
    this.stopStemPlayback();

    const startTime = this.ctx.currentTime + 0.02;
    for (const stem of STEM_KEYS) {
      const buf = this.stemBuffers[stem];
      if (!buf) continue;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;

      const gain = this.ctx.createGain();
      src.connect(gain);
      gain.connect(this.masterGainNode);

      const offsetSec = (offsetProgress01 % 1) * buf.duration;
      src.start(startTime, offsetSec);
      this.activeStemNodes[stem] = { src, gain };
    }
    this.syncStemGains(layers);
  }

  public stopStemPlayback(): void {
    for (const stem of STEM_KEYS) {
      const entry = this.activeStemNodes[stem];
      if (entry) {
        try {
          entry.src.stop();
          entry.src.disconnect();
          entry.gain.disconnect();
        } catch {
          // ignore
        }
      }
    }
    this.activeStemNodes = {};
  }

  public syncStemGains(layers: ExperienceLayersState): void {
    if (!this.usingPreRenderedStems || !this.ctx) return;
    const anySolo = layers.melody.solo || layers.chords.solo || layers.bass.solo;
    const melOn = layers.melody.enabled && (!anySolo || layers.melody.solo);
    const spkOn = melOn && layers.melody.sparkleEnabled;
    const chdOn = layers.chords.enabled && (!anySolo || layers.chords.solo);
    const basOn = layers.bass.enabled && (!anySolo || layers.bass.solo);
    const wet = layers.wind.enabled ? layers.wind.wetMix : 0;
    const dry = 1 - wet * 0.45;
    const now = this.ctx.currentTime;

    const setG = (stem: StemKey, val: number) => {
      this.activeStemNodes[stem]?.gain.gain.setTargetAtTime(val, now, 0.03);
    };

    setG('melody_main_dry', melOn ? layers.melody.gain * dry : 0);
    setG('melody_main_wind', melOn ? layers.melody.gain * wet : 0);
    setG('melody_sparkle_dry', spkOn ? layers.melody.gain * 0.8 * dry : 0);
    setG('melody_sparkle_wind', spkOn ? layers.melody.gain * 0.8 * wet : 0);
    setG('chords_dry', chdOn ? layers.chords.gain * dry : 0);
    setG('chords_wind', chdOn ? layers.chords.gain * wet : 0);
    setG('bass_dry', basOn ? layers.bass.gain * dry : 0);
    setG('bass_wind', basOn ? layers.bass.gain * wet : 0);
  }

  /**
   * Roteia um nó de áudio para o espaço 3D conforme o modo ativo:
   * - `room3`: VBAP nas 3 caixas calibradas (respeitando ganho de Ruído Rosa e delay Bluetooth!)
   * - `hrtf` / `5.1`: PannerNode HRTF 3D ao redor do ouvinte
   */
  private routeSpatialVoice(
    voiceOutput: AudioNode,
    sourceX01: number,
    sourceY01: number,
    sendToWindFactor: number
  ): void {
    if (!this.ctx || !this.masterGainNode) return;

    if (this.windSendNode && sendToWindFactor > 0) {
      const sendGain = this.ctx.createGain();
      sendGain.gain.value = sendToWindFactor;
      voiceOutput.connect(sendGain);
      sendGain.connect(this.windSendNode);
    }

    const normX = (sourceX01 - 0.5) * 2; // -1 (Oeste/Parede Esq) .. +1 (Leste/Parede Dir)
    const normY = (sourceY01 - 0.5) * 2; // -1 (Sul/Fundo) .. +1 (Norte/Teto)

    if ((this.audioMode === 'room3' || this.isolatedSpeakerSlot !== null) && this.speakerChains) {
      const gains = computeVbap3Gains(normX, normY, this.calibration.speakers);
      for (const id of SPEAKER_IDS) {
        if (gains[id] <= 0.001) continue;
        const g = this.ctx.createGain();
        g.gain.value = gains[id];
        voiceOutput.connect(g);
        g.connect(this.speakerChains[id].input);
      }
      return;
    }

    const panner = this.ctx.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = 1.2;
    panner.positionX.value = normX * 1.85;
    panner.positionY.value = normY * 1.15;
    panner.positionZ.value = -1.1 + Math.abs(normX) * 0.45;

    voiceOutput.connect(panner);
    panner.connect(this.masterGainNode);
  }

  /**
   * Síntese 8D em tempo real guiada pelo `meta.json` (quando os 8 stems de áudio ainda não existem no disco).
   */
  public triggerBeatStep(params: {
    beatIndex: number;
    bpm: number;
    activeChord: string;
    keyRoot: string;
    events: LiveNoteEvent[];
    layers: ExperienceLayersState;
  }): void {
    if (this.usingPreRenderedStems) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const { bpm, activeChord, keyRoot, events, layers } = params;
    const beatDur = 60 / Math.max(40, bpm);
    const now = ctx.currentTime + 0.005;

    for (const ev of events) {
      if (ev.layer === 'melody' || ev.layer === 'sparkle') {
        const isSparkle = ev.layer === 'sparkle';
        const freq = midiToFreq(ev.pitch);
        const dur = isSparkle ? beatDur * 0.85 : beatDur * 1.35;
        const level =
          layers.melody.gain * ev.velocity * (isSparkle ? 0.14 : 0.22);

        const oscMain = ctx.createOscillator();
        oscMain.type = 'sine';
        oscMain.frequency.setValueAtTime(freq, now);

        const oscTine = ctx.createOscillator();
        oscTine.type = 'triangle';
        oscTine.frequency.setValueAtTime(freq * (isSparkle ? 3 : 2), now);

        const tineGain = ctx.createGain();
        tineGain.gain.setValueAtTime(0.18, now);
        tineGain.gain.exponentialRampToValueAtTime(0.001, now + dur * 0.35);

        const env = ctx.createGain();
        env.gain.setValueAtTime(0.0001, now);
        env.gain.linearRampToValueAtTime(Math.max(0.001, level), now + 0.012);
        env.gain.exponentialRampToValueAtTime(0.0001, now + dur);

        oscMain.connect(env);
        oscTine.connect(tineGain);
        tineGain.connect(env);

        this.routeSpatialVoice(env, ev.source_x, ev.source_y, 0.72);

        oscMain.start(now);
        oscTine.start(now);
        oscMain.stop(now + dur + 0.04);
        oscTine.stop(now + dur + 0.04);
      } else if (ev.layer === 'chords') {
        // Acorde sustentado por 1 compasso (4 batidas) espalhado entre Parede Esq e Parede Dir
        const midiNotes = parseChordToMidiVoicing(activeChord, keyRoot);
        const barDur = beatDur * 3.95;
        const padFilter = ctx.createBiquadFilter();
        padFilter.type = 'lowpass';
        padFilter.frequency.setValueAtTime(920, now);

        const padEnv = ctx.createGain();
        const peak = Math.max(0.001, layers.chords.gain * 0.095);
        padEnv.gain.setValueAtTime(0.0001, now);
        padEnv.gain.linearRampToValueAtTime(peak, now + Math.min(0.45, barDur * 0.28));
        padEnv.gain.setValueAtTime(peak * 0.85, now + barDur * 0.72);
        padEnv.gain.exponentialRampToValueAtTime(0.0001, now + barDur);

        padFilter.connect(padEnv);
        this.routeSpatialVoice(padEnv, ev.source_x, ev.source_y, 0.85);

        midiNotes.forEach((m, idx) => {
          const osc = ctx.createOscillator();
          osc.type = idx % 2 === 0 ? 'sawtooth' : 'triangle';
          osc.frequency.setValueAtTime(midiToFreq(m), now);
          osc.detune.setValueAtTime((idx - 1.5) * 6, now);
          osc.connect(padFilter);
          osc.start(now);
          osc.stop(now + barDur + 0.05);
        });
      } else if (ev.layer === 'bass') {
        // Sub-bass urbano NO2 (2 batidas)
        const subMidi = Math.max(33, Math.min(48, ev.pitch));
        const subDur = beatDur * 1.85;
        const oscSub = ctx.createOscillator();
        oscSub.type = 'triangle';
        oscSub.frequency.setValueAtTime(midiToFreq(subMidi), now);

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(210 + ev.velocity * 180, now);

        const env = ctx.createGain();
        const peak = Math.max(0.001, layers.bass.gain * 0.26);
        env.gain.setValueAtTime(0.0001, now);
        env.gain.linearRampToValueAtTime(peak, now + 0.025);
        env.gain.exponentialRampToValueAtTime(0.0001, now + subDur);

        oscSub.connect(filter);
        filter.connect(env);
        // Baixo ancorado de forma coesa no centro da sala (0.5, 0.5)
        this.routeSpatialVoice(env, 0.5, 0.5, 0.15);

        oscSub.start(now);
        oscSub.stop(now + subDur + 0.04);
      }
    }
  }

  // --- Ferramentas de Calibração Acústica (Ruído Rosa A/B + Pulso de Delay Bluetooth) ---

  public stopCalibrationSignal(): void {
    if (this.calibIntervalId !== null && typeof window !== 'undefined') {
      window.clearInterval(this.calibIntervalId);
      this.calibIntervalId = null;
    }
    if (this.calibPinkSrc) {
      try {
        this.calibPinkSrc.stop();
        this.calibPinkSrc.disconnect();
      } catch {
        // ignore
      }
      this.calibPinkSrc = null;
    }
    if (this.calibPinkGain) {
      try {
        this.calibPinkGain.disconnect();
      } catch {
        // ignore
      }
      this.calibPinkGain = null;
    }
    this.calibTestMode = { kind: 'off' };
    this.onCalibModeChange?.(this.calibTestMode);
  }

  public startPinkNoiseSingle(speakerId: SpeakerSlotId): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.speakerChains) return;
    this.stopCalibrationSignal();

    if (!this.pinkBuffer) {
      this.pinkBuffer = createPinkNoiseBuffer(ctx, 3.0);
    }

    const src = ctx.createBufferSource();
    src.buffer = this.pinkBuffer;
    src.loop = true;
    const gain = ctx.createGain();
    gain.gain.value = 0.85;

    src.connect(gain);
    gain.connect(this.speakerChains[speakerId].input);
    src.start();

    this.calibPinkSrc = src;
    this.calibPinkGain = gain;
    this.calibTestMode = { kind: 'pink-single', speakerId };
    this.onCalibModeChange?.(this.calibTestMode);
  }

  public startPinkNoiseAB(targetSpeakerId: SpeakerSlotId): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.speakerChains || typeof window === 'undefined') return;
    this.stopCalibrationSignal();

    const refId = this.calibration.referenceSpeakerId;
    if (refId === targetSpeakerId) {
      this.startPinkNoiseSingle(targetSpeakerId);
      return;
    }

    if (!this.pinkBuffer) {
      this.pinkBuffer = createPinkNoiseBuffer(ctx, 3.0);
    }

    const src = ctx.createBufferSource();
    src.buffer = this.pinkBuffer;
    src.loop = true;

    const gainRef = ctx.createGain();
    const gainTarget = ctx.createGain();
    gainRef.gain.value = 0.85;
    gainTarget.gain.value = 0;

    src.connect(gainRef);
    src.connect(gainTarget);
    gainRef.connect(this.speakerChains[refId].input);
    gainTarget.connect(this.speakerChains[targetSpeakerId].input);
    src.start();

    this.calibPinkSrc = src;
    let showingRef = true;
    this.calibTestMode = { kind: 'pink-ab', targetSpeakerId, activeNow: refId };
    this.onCalibModeChange?.(this.calibTestMode);

    this.calibIntervalId = window.setInterval(() => {
      if (!this.ctx) return;
      showingRef = !showingRef;
      const t = this.ctx.currentTime;
      gainRef.gain.setTargetAtTime(showingRef ? 0.85 : 0, t, 0.025);
      gainTarget.gain.setTargetAtTime(showingRef ? 0 : 0.85, t, 0.025);
      this.calibTestMode = {
        kind: 'pink-ab',
        targetSpeakerId,
        activeNow: showingRef ? refId : targetSpeakerId,
      };
      this.onCalibModeChange?.(this.calibTestMode);
    }, 1150);
  }

  public startDelayClickTest(targetSpeakerId: SpeakerSlotId): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.speakerChains || typeof window === 'undefined') return;
    this.stopCalibrationSignal();

    const fireClick = (speakerId: SpeakerSlotId, freqHz: number) => {
      if (!this.ctx || !this.speakerChains) return;
      const t = this.ctx.currentTime + 0.01;
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freqHz, t);
      osc.frequency.exponentialRampToValueAtTime(280, t + 0.028);

      const env = this.ctx.createGain();
      env.gain.setValueAtTime(0.9, t);
      env.gain.exponentialRampToValueAtTime(0.0001, t + 0.032);

      osc.connect(env);
      env.connect(this.speakerChains[speakerId].input);
      osc.start(t);
      osc.stop(t + 0.04);
    };

    const refId = this.calibration.referenceSpeakerId;
    const triggerPair = () => {
      fireClick(refId, 1650);
      if (targetSpeakerId !== refId) {
        fireClick(targetSpeakerId, 1950);
      }
    };

    triggerPair();
    this.calibTestMode = { kind: 'delay-click', targetSpeakerId };
    this.onCalibModeChange?.(this.calibTestMode);
    this.calibIntervalId = window.setInterval(triggerPair, 600);
  }

  public async listOutputDevices(): Promise<AudioDeviceOption[]> {
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.enumerateDevices !== 'function'
    ) {
      return [];
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const outputs = devices.filter(
        (d) => d.kind === 'audiooutput' && Boolean(d.deviceId) && d.deviceId !== 'communications'
      );

      if (outputs.some((d) => d.deviceId !== 'default' && Boolean(d.label))) {
        this.outputPermissionUnlocked = true;
      }

      const seen = new Set<string>();
      const result: AudioDeviceOption[] = [];
      outputs.forEach((d, idx) => {
        if (seen.has(d.deviceId)) return;
        seen.add(d.deviceId);
        result.push({
          deviceId: d.deviceId,
          label: d.label || `Saída de Áudio #${idx + 1}`,
          groupId: d.groupId,
        });
      });
      return result;
    } catch {
      return [];
    }
  }

  /**
   * Desbloqueia no navegador a listagem completa de caixas Bluetooth / USB / HDMI (`audiooutput`).
   * Por privacidade do W3C, Chrome/Edge/Brave escondem todos os `audiooutput` até que a página
   * receba permissão de mídia (`getUserMedia`) ou `selectAudioOutput`.
   * O stream de áudio é encerrado em 0ms (`track.stop()`) para não capturar som nem prender o Bluetooth em modo mãos-livres.
   */
  public async unlockAudioOutputDevices(): Promise<AudioDeviceOption[]> {
    this.ensureContext();
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
      return [];
    }

    if (typeof navigator.mediaDevices.getUserMedia === 'function') {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        });
        for (const track of stream.getTracks()) {
          track.stop();
        }
        this.outputPermissionUnlocked = true;
      } catch {
        // Caso o usuário negue microfone ou o Mac esteja sem entrada, tentamos selectAudioOutput abaixo
      }
    }

    let list = await this.listOutputDevices();
    if (list.length === 0 && this.canSelectAudioOutputPrompt()) {
      const picked = await this.promptSelectSpeakerDevice();
      if (picked) {
        list = await this.listOutputDevices();
        if (!list.some((d) => d.deviceId === picked.deviceId)) {
          list = [picked, ...list];
        }
      }
    }
    return list;
  }

  /**
   * Abre o seletor nativo de caixa de som do navegador (`navigator.mediaDevices.selectAudioOutput`) quando disponível.
   */
  public async promptSelectSpeakerDevice(deviceId?: string): Promise<AudioDeviceOption | null> {
    if (!this.canSelectAudioOutputPrompt() || typeof navigator === 'undefined') {
      return null;
    }
    try {
      const selectFn = (
        navigator.mediaDevices as unknown as {
          selectAudioOutput: (opts?: { deviceId?: string }) => Promise<MediaDeviceInfo>;
        }
      ).selectAudioOutput;
      const chosen = await selectFn(deviceId ? { deviceId } : undefined);
      if (!chosen?.deviceId) return null;
      this.outputPermissionUnlocked = true;
      return {
        deviceId: chosen.deviceId,
        label: chosen.label || 'Caixa Selecionada',
        groupId: chosen.groupId,
      };
    } catch {
      return null;
    }
  }
}
