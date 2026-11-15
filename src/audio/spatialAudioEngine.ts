import { resolveAssetUrl } from '../datasets/nasaDatasets';
import {
  AudioLevelsMap,
  AudioOutputMode,
  BarLoopRange,
  ExperienceLayersState,
  TuningMode,
} from '../experience/types';
import {
  AudioCalibrationState,
  computeEffectiveAudioVisualDelays,
  computeVbap3Gains,
  SPEAKER_IDS,
  SpeakerSlotId,
} from './speakerCalibration';

export type CalibrationTestMode =
  | { kind: 'off' }
  | { kind: 'pink-multi'; speakers: SpeakerSlotId[] }
  | { kind: 'delay-click-multi'; speakers: SpeakerSlotId[]; headphones?: boolean }
  | { kind: 'pink-single'; speakerId: SpeakerSlotId }
  | { kind: 'pink-ab'; targetSpeakerId: SpeakerSlotId; activeNow: SpeakerSlotId }
  | { kind: 'delay-click'; targetSpeakerId: SpeakerSlotId }
  | { kind: 'pink-all' }
  | { kind: 'delay-click-all' };

export function isPinkNoiseSpeakerActive(
  mode: CalibrationTestMode,
  speakerId: SpeakerSlotId
): boolean {
  if (mode.kind === 'pink-multi') return mode.speakers.includes(speakerId);
  if (mode.kind === 'pink-all') return true;
  if (mode.kind === 'pink-single') return mode.speakerId === speakerId;
  if (mode.kind === 'pink-ab') return mode.activeNow === speakerId;
  return false;
}

export function isDelayClickSpeakerActive(
  mode: CalibrationTestMode,
  speakerId: SpeakerSlotId,
  refId?: SpeakerSlotId
): boolean {
  if (mode.kind === 'delay-click-multi') return mode.speakers.includes(speakerId);
  if (mode.kind === 'delay-click-all') return true;
  if (mode.kind === 'delay-click') {
    return mode.targetSpeakerId === speakerId || (refId !== undefined && refId === speakerId);
  }
  return false;
}

export interface AudioDeviceOption {
  deviceId: string;
  label: string;
  groupId?: string;
}

export type SpeakerSinkEngine = 'native' | 'audiocontext' | 'element';
export type SpeakerSinkStatus = 'default' | 'routed' | 'pending-gesture' | 'error';

export interface SpeakerSinkRouteInfo {
  status: SpeakerSinkStatus;
  engine: SpeakerSinkEngine;
  detail?: string;
}

export type SpeakerSinkStatusMap = Record<SpeakerSlotId, SpeakerSinkRouteInfo>;

export type AudioOutputSupportStatus =
  | 'ready'
  | 'permission-needed'
  | 'insecure-context'
  | 'unsupported';

const HEADROOM_INV = 2.0;

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
  const baseMidi = 48 + rootSemi;

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

function makeSoftLimiterCurve(threshold = 0.94): Float32Array<ArrayBuffer> {
  const n = 8192;
  const curve = new Float32Array(new ArrayBuffer(n * 4));
  const headroom = Math.max(0.01, 0.998 - threshold);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / (n - 1) - 1;
    const mag = Math.abs(x);
    if (mag <= threshold) {
      curve[i] = x;
    } else {
      const lim = threshold + headroom * Math.tanh((mag - threshold) / headroom);
      curve[i] = Math.sign(x) * lim;
    }
  }
  return curve;
}

function createPinkNoiseBuffer(ctx: BaseAudioContext, durationSeconds = 3.0): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = Math.floor(sampleRate * durationSeconds);
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const out = buffer.getChannelData(0);

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

    let env = 1;
    const fadeSamples = Math.floor(sampleRate * 0.025);
    if (i < fadeSamples) env = i / fadeSamples;
    else if (i > length - fadeSamples) env = (length - i) / fadeSamples;

    out[i] = pink * 0.09 * env;
  }

  return buffer;
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

type StemComponentId = 'chords' | 'bass' | 'melody_main' | 'melody_sparkle';

const STEM_COMPONENTS: StemComponentId[] = [
  'chords',
  'bass',
  'melody_main',
  'melody_sparkle',
];

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

interface ComponentBusNodes {
  dryGain: GainNode;
  windGain: GainNode;
  sumGain: GainNode;
  meter: AnalyserNode;
  directGain: GainNode;
  stereoPan: StereoPannerNode;
  roomGains: Record<SpeakerSlotId, GainNode>;
}

type AudioContextWithSink = AudioContext & {
  setSinkId?: (sinkId: string) => Promise<void>;
};

type AudioElementWithSink = HTMLAudioElement & {
  setSinkId?: (sinkId: string) => Promise<void>;
};

const activeAudioEngines = new Set<SpatialAudioEngine>();

export function setSpatialMusicDucked(ducked: boolean): void {
  for (const engine of activeAudioEngines) {
    engine.setVoiceDucking(ducked);
  }
}

export interface SpatialSfxTarget {
  ctx: AudioContext;
  destination: AudioNode;
  setPan: (panX: number, panY?: number) => void;
  disconnect: () => void;
}

/**
 * Retorna a instância principal não-mutada do SpatialAudioEngine na aba atual
 * (permitindo rotear nave/SFX e falas Piper pelas 3 caixas físicas com setSinkId e calibração).
 */
export function getActiveUnmutedAudioEngine(): SpatialAudioEngine | null {
  for (const engine of activeAudioEngines) {
    if (!engine.isMuted()) {
      return engine;
    }
  }
  return null;
}

export function stopAllSpatialSpeech(): void {
  for (const engine of activeAudioEngines) {
    engine.stopSpeechPlayback();
  }
}

export class SpatialAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGainNode: GainNode | null = null;
  private directDelayNode: DelayNode | null = null;
  private musicDirectDuckNode: GainNode | null = null;
  private musicRoomDuckNodes: Record<SpeakerSlotId, GainNode> | null = null;
  private sfxTargets = new Set<{
    syncRouting: () => void;
    duckGain: GainNode | null;
  }>();
  private activeSpeechSource: AudioBufferSourceNode | null = null;
  private activeSpeechCleanups: (() => void) | null = null;
  private masterAnalyserNode: AnalyserNode | null = null;
  private analyserTimeData: Uint8Array<ArrayBuffer> | null = null;
  private masterAnalyser: AnalyserNode | null = null;
  private windDiffAnalyser: AnalyserNode | null = null;
  private windOrbitPanner: PannerNode | null = null;
  private windDirectGainNode: GainNode | null = null;
  private windRoomGainNodes: Record<SpeakerSlotId, GainNode> | null = null;
  private componentBuses: Record<StemComponentId, ComponentBusNodes> | null = null;
  private pinkBuffer: AudioBuffer | null = null;
  private speakerChains: Record<SpeakerSlotId, SpeakerBusChain> | null = null;

  private audioMode: AudioOutputMode = 'hrtf';
  private masterGain = 1.0;
  private voiceDuckMultiplier = 1.0;
  private calibration: AudioCalibrationState;
  private isolatedSpeakerSlot: SpeakerSlotId | null = null;
  private outputPermissionUnlocked = false;

  // Pre-rendered stems state (100% deterministic from nasa-geo-sonification)
  private loadedStemCountryKey: string | null = null;
  private loadingPromise: Promise<boolean> | null = null;
  private loadingKey: string | null = null;
  private stemBuffers: Partial<Record<StemKey, AudioBuffer>> = {};
  private activeSources: AudioBufferSourceNode[] = [];
  private usingPreRenderedStems = false;
  private stemsActivelyPlaying = false;
  private stemLoopStartCtxTime = 0;
  private stemLoopBoundsSec: [number, number] = [0, 16];
  private stemFullDurationSec = 16;

  private analyserScratch = new Float32Array(512);

  // Calibration signal state
  private calibTestMode: CalibrationTestMode = { kind: 'off' };
  private calibPinkSrc: AudioBufferSourceNode | null = null;
  private calibPinkGain: GainNode | null = null;
  private calibIntervalId: number | null = null;
  private calibBeatTimers: number[] = [];
  private calibBeatSeq = 0;
  private onCalibModeChange?: (mode: CalibrationTestMode) => void;
  private onCalibBeat?: (beatSeq: number) => void;
  private onSinkStatusChange?: (statuses: SpeakerSinkStatusMap) => void;

  // Incremental per-speaker sink routing state (prevents cross-speaker teardown & race conditions)
  private appliedSinkKeys: Record<SpeakerSlotId, string> = {
    speaker1: 'local:',
    speaker2: 'local:',
    speaker3: 'local:',
  };
  private preferredSinkEngines: Partial<Record<SpeakerSlotId, 'audiocontext' | 'element'>> = {};
  private sinkGenerations: Record<SpeakerSlotId, number> = {
    speaker1: 0,
    speaker2: 0,
    speaker3: 0,
  };
  private sinkStatuses: SpeakerSinkStatusMap = {
    speaker1: { status: 'default', engine: 'native' },
    speaker2: { status: 'default', engine: 'native' },
    speaker3: { status: 'default', engine: 'native' },
  };

  constructor(initialCalibration: AudioCalibrationState) {
    this.calibration = initialCalibration;
    activeAudioEngines.add(this);
  }

  public setOnCalibrationModeChange(cb: ((mode: CalibrationTestMode) => void) | undefined): void {
    this.onCalibModeChange = cb;
  }

  public setOnCalibrationBeat(cb: ((beatSeq: number) => void) | undefined): void {
    this.onCalibBeat = cb;
  }

  public setOnSinkStatusChange(cb: ((statuses: SpeakerSinkStatusMap) => void) | undefined): void {
    this.onSinkStatusChange = cb;
  }

  public getSinkStatuses(): SpeakerSinkStatusMap {
    return {
      speaker1: { ...this.sinkStatuses.speaker1 },
      speaker2: { ...this.sinkStatuses.speaker2 },
      speaker3: { ...this.sinkStatuses.speaker3 },
    };
  }

  private setSpeakerSinkStatus(slotId: SpeakerSlotId, next: SpeakerSinkRouteInfo): void {
    this.sinkStatuses = {
      ...this.sinkStatuses,
      [slotId]: next,
    };
    this.onSinkStatusChange?.(this.getSinkStatuses());
  }

  public isMuted(): boolean {
    return this.masterGain <= 0.0005;
  }

  public getCalibrationTestMode(): CalibrationTestMode {
    return this.calibTestMode;
  }

  public isUsingPreRenderedStems(): boolean {
    return this.usingPreRenderedStems;
  }

  public isStemAudioPlaying(): boolean {
    return this.stemsActivelyPlaying && Boolean(this.ctx);
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
      this.syncSpatialModeRouting();
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

      const effectiveDelays = computeEffectiveAudioVisualDelays(
        this.calibration,
        this.audioMode,
        this.isolatedSpeakerSlot
      );

      const directDelay = ctx.createDelay(1.5);
      directDelay.delayTime.value = effectiveDelays.masterDirectDelaySec;
      directDelay.connect(master);
      this.directDelayNode = directDelay;

      const musicDirectDuck = ctx.createGain();
      musicDirectDuck.gain.value = this.voiceDuckMultiplier;
      musicDirectDuck.connect(directDelay);
      this.musicDirectDuckNode = musicDirectDuck;

      const limiter = ctx.createWaveShaper();
      limiter.curve = makeSoftLimiterCurve(0.94);
      limiter.oversample = '2x';

      const mAnalyser = ctx.createAnalyser();
      mAnalyser.fftSize = 512;

      master.connect(limiter);
      limiter.connect(mAnalyser);
      mAnalyser.connect(ctx.destination);

      this.masterGainNode = master;
      this.masterAnalyser = mAnalyser;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      master.connect(analyser);
      this.masterAnalyserNode = analyser;
      this.analyserTimeData = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));

      // Build 3 Speaker Chains (for room3 VBAP + Pink Noise + Delay calibration + SFX + Speech)
      const makeChain = (slotId: SpeakerSlotId): SpeakerBusChain => {
        const input = ctx.createGain();
        const delay = ctx.createDelay(1.5);
        delay.delayTime.value = effectiveDelays.speakerDelaySec[slotId];
        const calibGain = ctx.createGain();
        calibGain.gain.value = this.computeEffectiveChainGain(slotId);
        const masterMirrorGain = ctx.createGain();
        masterMirrorGain.gain.value = this.masterGain;
        const stereoPan = ctx.createStereoPanner();
        stereoPan.pan.value = this.computeEffectiveChainPan(slotId);

        input.connect(delay);
        delay.connect(calibGain);
        calibGain.connect(stereoPan);
        stereoPan.connect(masterMirrorGain);
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

      const musicRoomDuck: Record<SpeakerSlotId, GainNode> = {
        speaker1: ctx.createGain(),
        speaker2: ctx.createGain(),
        speaker3: ctx.createGain(),
      };
      for (const id of SPEAKER_IDS) {
        musicRoomDuck[id].gain.value = this.voiceDuckMultiplier;
        musicRoomDuck[id].connect(this.speakerChains[id].input);
      }
      this.musicRoomDuckNodes = musicRoomDuck;

      // Wind 8D Orbit Bus (receives pre-rendered *_wind stems and orbits in 360° HRTF or 3-Speaker VBAP)
      const windDiffAn = ctx.createAnalyser();
      windDiffAn.fftSize = 256;
      this.windDiffAnalyser = windDiffAn;

      const orbitPanner = ctx.createPanner();
      orbitPanner.panningModel = 'HRTF';
      orbitPanner.distanceModel = 'inverse';
      orbitPanner.refDistance = 1.45;
      orbitPanner.positionX.value = 1.25;
      orbitPanner.positionY.value = 0.35;
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
        windDiffAn.connect(windRoomGains[id]);
        windRoomGains[id].connect(musicRoomDuck[id]);
      }

      windDiffAn.connect(orbitPanner);
      orbitPanner.connect(windDirectGain);
      windDirectGain.connect(musicDirectDuck);

      this.windOrbitPanner = orbitPanner;
      this.windDirectGainNode = windDirectGain;
      this.windRoomGainNodes = windRoomGains;

      // Build 4 Independent Stem Component Buses (matching jukebox_studio.py + VBAP/HRTF routing)
      const compBuses = {} as Record<StemComponentId, ComponentBusNodes>;
      for (const comp of STEM_COMPONENTS) {
        const dryGain = ctx.createGain();
        const windGain = ctx.createGain();
        const sumGain = ctx.createGain();
        const meter = ctx.createAnalyser();
        meter.fftSize = 256;

        dryGain.connect(sumGain);
        windGain.connect(sumGain);
        sumGain.connect(meter);

        const stereoPan = ctx.createStereoPanner();
        stereoPan.pan.value = 0;
        const directGain = ctx.createGain();
        directGain.gain.value = useRoomVbap ? 0 : 1;

        dryGain.connect(stereoPan);
        stereoPan.connect(directGain);
        directGain.connect(musicDirectDuck);

        windGain.connect(windDiffAn);

        const roomGains: Record<SpeakerSlotId, GainNode> = {
          speaker1: ctx.createGain(),
          speaker2: ctx.createGain(),
          speaker3: ctx.createGain(),
        };
        const baseVbap =
          comp === 'bass'
            ? computeVbap3Gains(0, 0, this.calibration.speakers)
            : comp === 'chords'
              ? { speaker1: 0.65, speaker2: 0.65, speaker3: 0.38 }
              : computeVbap3Gains(0, 0.25, this.calibration.speakers);

        for (const id of SPEAKER_IDS) {
          roomGains[id].gain.value = useRoomVbap ? baseVbap[id] : 0;
          dryGain.connect(roomGains[id]);
          roomGains[id].connect(musicRoomDuck[id]);
        }

        compBuses[comp] = {
          dryGain,
          windGain,
          sumGain,
          meter,
          directGain,
          stereoPan,
          roomGains,
        };
      }
      this.componentBuses = compBuses;

      this.steerWindByTelemetry(0, 0, 0.4, 0.2);
      void this.applySinkRouting();
    }

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private syncSpatialModeRouting(): void {
    if (!this.ctx || !this.componentBuses) return;
    const useRoomVbap = this.audioMode === 'room3' || this.isolatedSpeakerSlot !== null;
    const now = this.ctx.currentTime;

    for (const comp of STEM_COMPONENTS) {
      const bus = this.componentBuses[comp];
      bus.directGain.gain.setTargetAtTime(useRoomVbap ? 0 : 1, now, 0.04);
      const vbap =
        comp === 'bass'
          ? computeVbap3Gains(0, 0, this.calibration.speakers)
          : comp === 'chords'
            ? { speaker1: 0.65, speaker2: 0.65, speaker3: 0.38 }
            : computeVbap3Gains(0, 0.25, this.calibration.speakers);
      for (const id of SPEAKER_IDS) {
        bus.roomGains[id].gain.setTargetAtTime(useRoomVbap ? vbap[id] : 0, now, 0.04);
      }
    }

    const effectiveDelays = computeEffectiveAudioVisualDelays(
      this.calibration,
      this.audioMode,
      this.isolatedSpeakerSlot
    );
    if (this.directDelayNode) {
      this.directDelayNode.delayTime.setTargetAtTime(
        effectiveDelays.masterDirectDelaySec,
        now,
        0.02
      );
    }
    if (this.speakerChains) {
      for (const id of SPEAKER_IDS) {
        this.speakerChains[id].delay.delayTime.setTargetAtTime(
          effectiveDelays.speakerDelaySec[id],
          now,
          0.02
        );
      }
    }
    for (const target of this.sfxTargets) {
      target.syncRouting();
    }
  }

  /**
   * Direciona dinamicamente a espacialização 8D/VBAP das notas ativas de raios (`melody_main` e `melody_sparkle`)
   * usando `source_x` (Oeste->Leste) e `source_y` (Sul->Norte/Teto) reais do `meta.json`.
   */
  public steerMelodySpatialFocus(sourceX01: number, sourceY01: number): void {
    if (!this.ctx || !this.componentBuses) return;
    const now = this.ctx.currentTime;
    const normX = Math.max(-1, Math.min(1, (sourceX01 - 0.5) * 2));
    const normY = Math.max(-1, Math.min(1, (sourceY01 - 0.5) * 2));
    const useRoomVbap = this.audioMode === 'room3' || this.isolatedSpeakerSlot !== null;

    for (const comp of ['melody_main', 'melody_sparkle'] as const) {
      const bus = this.componentBuses[comp];
      bus.stereoPan.pan.setTargetAtTime(normX * 0.96, now, 0.025);
      if (useRoomVbap) {
        const vbap = computeVbap3Gains(normX, normY, this.calibration.speakers);
        for (const id of SPEAKER_IDS) {
          bus.roomGains[id].gain.setTargetAtTime(vbap[id], now, 0.025);
        }
      }
    }
  }

  /**
   * Move o barramento 8D do Vento de um lado para o outro (Oeste <-> Leste) e profundidade
   * com base na direção e concentração reais do vento extraídas do vídeo `svs5148` da NASA.
   */
  public steerWindByTelemetry(
    panX: number,
    depthY: number,
    speed01 = 0.5,
    turbulence01 = 0.2
  ): void {
    if (!this.ctx || !this.windOrbitPanner) return;
    const now = this.ctx.currentTime;
    const clampedX = Math.max(-1, Math.min(1, panX));
    const clampedY = Math.max(-1, Math.min(1, depthY));
    const span = 1.55 + Math.min(1, Math.max(0, speed01)) * 0.45;
    const ox = clampedX * span;
    const oy = 0.2 + clampedY * 0.45 + turbulence01 * 0.18;
    const oz = 0.35 - Math.abs(clampedX) * 0.55;

    this.windOrbitPanner.positionX.setTargetAtTime(ox, now, 0.08);
    this.windOrbitPanner.positionY.setTargetAtTime(oy, now, 0.08);
    this.windOrbitPanner.positionZ.setTargetAtTime(oz, now, 0.08);

    const useRoomVbap = this.audioMode === 'room3' || this.isolatedSpeakerSlot !== null;
    if (this.windDirectGainNode && this.windRoomGainNodes) {
      this.windDirectGainNode.gain.setTargetAtTime(useRoomVbap ? 0 : 1, now, 0.06);
      if (useRoomVbap) {
        const vbap = computeVbap3Gains(clampedX * 0.98, clampedY * 0.85, this.calibration.speakers);
        for (const id of SPEAKER_IDS) {
          this.windRoomGainNodes[id].gain.setTargetAtTime(vbap[id], now, 0.06);
        }
      } else {
        for (const id of SPEAKER_IDS) {
          this.windRoomGainNodes[id].gain.setTargetAtTime(0, now, 0.06);
        }
      }
    }
  }

  public getAudioContextState(): AudioContextState | 'uninitialized' {
    return this.ctx ? this.ctx.state : 'uninitialized';
  }

  public async ensureUnlocked(): Promise<AudioContextState | 'uninitialized'> {
    const ctx = this.ensureContext();
    if (!ctx) return 'uninitialized';
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        // ignore resume errors
      }
    }
    await this.resumeAllSinkOutputs();
    return ctx.state;
  }

  public async resumeAllSinkOutputs(): Promise<void> {
    if (!this.speakerChains) return;
    for (const id of SPEAKER_IDS) {
      const chain = this.speakerChains[id];
      if (chain.sinkCtx && chain.sinkCtx.state === 'suspended') {
        try {
          await chain.sinkCtx.resume();
          if (
            (chain.sinkCtx.state as AudioContextState) === 'running' &&
            this.sinkStatuses[id].status === 'pending-gesture'
          ) {
            this.setSpeakerSinkStatus(id, { status: 'routed', engine: 'audiocontext' });
          }
        } catch {
          // ignore
        }
      }
      if (chain.sinkAudioEl && chain.sinkAudioEl.paused) {
        try {
          await chain.sinkAudioEl.play();
          if (this.sinkStatuses[id].status === 'pending-gesture') {
            this.setSpeakerSinkStatus(id, { status: 'routed', engine: 'element' });
          }
        } catch {
          // ignore
        }
      }
    }
  }

  public getMasterRmsLevel(): number {
    if (!this.ctx || this.ctx.state !== 'running' || !this.masterAnalyserNode || !this.analyserTimeData) {
      return 0;
    }
    this.masterAnalyserNode.getByteTimeDomainData(this.analyserTimeData);
    let sumSq = 0;
    const len = this.analyserTimeData.length;
    for (let i = 0; i < len; i += 1) {
      const sample = (this.analyserTimeData[i] - 128) / 128;
      sumSq += sample * sample;
    }
    const rms = Math.sqrt(sumSq / Math.max(1, len));
    return Math.min(1, rms * 3.2);
  }

  public setMasterGain(gain: number): void {
    this.masterGain = Math.max(0, Math.min(1.6, gain));
    this.applyEffectiveMasterGain(0.02);
  }

  /**
   * Abaixa suavemente apenas os barramentos musicais e pad espacial enquanto o Robô MINEIRØ fala,
   * sem abafar a própria voz, os efeitos mecânicos nem os sinais de calibração.
   */
  public setVoiceDucking(ducked: boolean): void {
    this.voiceDuckMultiplier = ducked ? 0.22 : 1.0;
    const tc = ducked ? 0.08 : 0.18;
    if (this.ctx) {
      const now = this.ctx.currentTime;
      if (this.musicDirectDuckNode) {
        this.musicDirectDuckNode.gain.setTargetAtTime(this.voiceDuckMultiplier, now, tc);
      }
      if (this.musicRoomDuckNodes) {
        for (const id of SPEAKER_IDS) {
          this.musicRoomDuckNodes[id].gain.setTargetAtTime(this.voiceDuckMultiplier, now, tc);
        }
      }
      for (const target of this.sfxTargets) {
        if (target.duckGain) {
          target.duckGain.gain.setTargetAtTime(this.voiceDuckMultiplier, now, tc);
        }
      }
    }
  }

  private applyEffectiveMasterGain(timeConstantSec: number): void {
    const target = this.masterGain;
    if (this.ctx) {
      const now = this.ctx.currentTime;
      if (this.masterGainNode) {
        this.masterGainNode.gain.setTargetAtTime(target, now, timeConstantSec);
      }
      if (this.speakerChains) {
        for (const id of SPEAKER_IDS) {
          this.speakerChains[id].masterMirrorGain.gain.setTargetAtTime(target, now, timeConstantSec);
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
          // fallback cleanly
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
    this.syncSpatialModeRouting();
  }

  public updateSpeakerCalibration(next: AudioCalibrationState): void {
    const prev = this.calibration;
    this.calibration = next;

    const hasAnyCustomSink = SPEAKER_IDS.some(
      (id) =>
        next.speakers[id].routeTarget === 'local' &&
        Boolean(next.speakers[id].sinkDeviceId) &&
        next.speakers[id].sinkDeviceId !== 'default'
    );
    if (hasAnyCustomSink && !this.ctx) {
      this.ensureContext();
    }
    if (!this.ctx || !this.speakerChains) return;

    const now = this.ctx.currentTime;
    const effectiveDelays = computeEffectiveAudioVisualDelays(
      next,
      this.audioMode,
      this.isolatedSpeakerSlot
    );
    if (this.directDelayNode) {
      this.directDelayNode.delayTime.setTargetAtTime(
        effectiveDelays.masterDirectDelaySec,
        now,
        0.02
      );
    }
    const changedSlots: SpeakerSlotId[] = [];
    for (const id of SPEAKER_IDS) {
      const cfg = next.speakers[id];
      const chain = this.speakerChains[id];
      chain.delay.delayTime.setTargetAtTime(effectiveDelays.speakerDelaySec[id], now, 0.02);
      chain.calibGain.gain.setTargetAtTime(this.computeEffectiveChainGain(id), now, 0.02);
      chain.stereoPan.pan.setTargetAtTime(this.computeEffectiveChainPan(id), now, 0.02);

      if (
        prev.speakers[id].sinkDeviceId !== cfg.sinkDeviceId ||
        prev.speakers[id].routeTarget !== cfg.routeTarget
      ) {
        changedSlots.push(id);
      }
    }

    this.syncSpatialModeRouting();

    if (changedSlots.length > 0) {
      void this.applySinkRouting(changedSlots);
    }
  }

  public retrySpeakerSink(slotId: SpeakerSlotId, toggleEngine = false): void {
    this.ensureContext();
    if (!this.ctx || !this.speakerChains) return;
    if (toggleEngine) {
      const current =
        this.preferredSinkEngines[slotId] ??
        (this.sinkStatuses[slotId].engine === 'audiocontext' ? 'audiocontext' : 'element');
      this.preferredSinkEngines[slotId] = current === 'audiocontext' ? 'element' : 'audiocontext';
    }
    this.appliedSinkKeys[slotId] = '__force_retry__';
    void this.applySinkRouting([slotId]);
  }

  public retryErroredSinks(): void {
    if (!this.ctx || !this.speakerChains) return;
    const toRetry = SPEAKER_IDS.filter((id) => {
      const cfg = this.calibration.speakers[id];
      return (
        cfg.routeTarget === 'local' &&
        Boolean(cfg.sinkDeviceId) &&
        cfg.sinkDeviceId !== 'default' &&
        this.sinkStatuses[id].status === 'error'
      );
    });
    if (toRetry.length === 0) return;
    for (const id of toRetry) {
      this.appliedSinkKeys[id] = '__force_retry__';
    }
    void this.applySinkRouting(toRetry);
  }

  private async teardownSpeakerSink(chain: SpeakerBusChain): Promise<void> {
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
  }

  private async applySinkRouting(targetSlots: ReadonlyArray<SpeakerSlotId> = SPEAKER_IDS): Promise<void> {
    if (!this.ctx || !this.speakerChains || !this.masterGainNode) return;
    for (const id of targetSlots) {
      await this.routeSingleSpeakerSink(id);
    }
  }

  private async routeSingleSpeakerSink(id: SpeakerSlotId): Promise<void> {
    if (!this.ctx || !this.speakerChains || !this.masterGainNode) return;
    const chain = this.speakerChains[id];
    const cfg = this.calibration.speakers[id];
    const rawSinkId = cfg.routeTarget === 'local' ? cfg.sinkDeviceId : '';
    const sinkId = rawSinkId === 'default' ? '' : rawSinkId;
    const nextKey = `${cfg.routeTarget}:${sinkId}:${this.preferredSinkEngines[id] ?? 'auto'}`;

    if (this.appliedSinkKeys[id] === nextKey) {
      return;
    }
    this.appliedSinkKeys[id] = nextKey;
    const myGen = ++this.sinkGenerations[id];

    await this.teardownSpeakerSink(chain);
    if (myGen !== this.sinkGenerations[id] || !this.ctx) return;

    chain.calibGain.disconnect();
    chain.masterMirrorGain.disconnect();

    if (!sinkId) {
      chain.calibGain.connect(chain.stereoPan);
      this.setSpeakerSinkStatus(id, { status: 'default', engine: 'native' });
      return;
    }

    if (!this.isSetSinkIdSupported()) {
      chain.calibGain.connect(chain.stereoPan);
      this.setSpeakerSinkStatus(id, {
        status: 'error',
        engine: 'native',
        detail: 'setSinkId unsupported',
      });
      return;
    }

    const streamDest = this.ctx.createMediaStreamDestination();
    chain.masterMirrorGain.gain.value = this.masterGain;
    chain.calibGain.connect(chain.masterMirrorGain);
    chain.masterMirrorGain.connect(streamDest);

    const hasAudioCtxSink =
      typeof AudioContext !== 'undefined' && 'setSinkId' in AudioContext.prototype;
    const hasMediaElSink =
      typeof Audio !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype;

    const tryAudioContextEngine = async (): Promise<'routed' | 'pending-gesture'> => {
      if (!hasAudioCtxSink) {
        throw new Error('AudioContext.setSinkId unsupported');
      }
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      const auxCtx = new AudioCtx({ latencyHint: 'interactive' }) as AudioContextWithSink;
      try {
        await auxCtx.setSinkId!(sinkId);
        const srcNode = auxCtx.createMediaStreamSource(streamDest.stream);
        srcNode.connect(auxCtx.destination);
        await auxCtx.resume().catch(() => {});
        if (myGen !== this.sinkGenerations[id]) {
          await auxCtx.close().catch(() => {});
          return 'routed';
        }
        chain.sinkCtx = auxCtx;
        chain.sinkStreamDest = streamDest;
        return auxCtx.state === 'running' ? 'routed' : 'pending-gesture';
      } catch (err) {
        await auxCtx.close().catch(() => {});
        throw err;
      }
    };

    const tryElementEngine = async (setSinkBeforeSrc: boolean): Promise<'routed' | 'pending-gesture'> => {
      if (!hasMediaElSink) {
        throw new Error('HTMLMediaElement.setSinkId unsupported');
      }
      const audioEl = new Audio() as AudioElementWithSink & { playsInline?: boolean };
      audioEl.autoplay = true;
      audioEl.volume = 1.0;
      audioEl.muted = false;
      audioEl.playsInline = true;
      try {
        if (setSinkBeforeSrc) {
          await audioEl.setSinkId!(sinkId);
          audioEl.srcObject = streamDest.stream;
        } else {
          audioEl.srcObject = streamDest.stream;
          await audioEl.setSinkId!(sinkId);
        }
        await audioEl.play();
        if (myGen !== this.sinkGenerations[id]) {
          audioEl.pause();
          audioEl.srcObject = null;
          return 'routed';
        }
        chain.sinkAudioEl = audioEl;
        chain.sinkStreamDest = streamDest;
        return 'routed';
      } catch (err) {
        const errName = (err as { name?: string })?.name ?? '';
        if (errName === 'NotAllowedError') {
          if (myGen !== this.sinkGenerations[id]) {
            audioEl.pause();
            audioEl.srcObject = null;
            return 'pending-gesture';
          }
          chain.sinkAudioEl = audioEl;
          chain.sinkStreamDest = streamDest;
          return 'pending-gesture';
        }
        audioEl.pause();
        audioEl.srcObject = null;
        throw err;
      }
    };

    const preferred = this.preferredSinkEngines[id];
    const engineOrder: Array<'audiocontext' | 'element'> =
      preferred === 'element'
        ? ['element', 'audiocontext']
        : hasAudioCtxSink
          ? ['audiocontext', 'element']
          : ['element', 'audiocontext'];

    let lastErr: unknown = null;
    for (const eng of engineOrder) {
      if (myGen !== this.sinkGenerations[id]) return;
      try {
        if (eng === 'audiocontext') {
          const state = await tryAudioContextEngine();
          if (myGen !== this.sinkGenerations[id]) return;
          this.setSpeakerSinkStatus(id, { status: state, engine: 'audiocontext' });
          return;
        } else {
          let state: 'routed' | 'pending-gesture';
          try {
            state = await tryElementEngine(false);
          } catch {
            state = await tryElementEngine(true);
          }
          if (myGen !== this.sinkGenerations[id]) return;
          this.setSpeakerSinkStatus(id, { status: state, engine: 'element' });
          return;
        }
      } catch (err) {
        lastErr = err;
      }
    }

    if (myGen !== this.sinkGenerations[id]) return;
    chain.calibGain.disconnect();
    chain.masterMirrorGain.disconnect();
    chain.calibGain.connect(chain.stereoPan);
    const reason =
      (lastErr as { name?: string; message?: string })?.name ||
      (lastErr as { message?: string })?.message ||
      'routing-failed';
    this.setSpeakerSinkStatus(id, {
      status: 'error',
      engine: 'native',
      detail: reason,
    });
  }

  public updateWindParameters(_windMeanSpeed: number, layers: ExperienceLayersState): void {
    this.syncStemGains(layers);
  }

  /**
   * Carrega os 8 stems gapless pré-renderizados pelo Python (`nasa-geo-sonification`).
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

    if (this.loadingPromise && this.loadingKey === key) {
      return this.loadingPromise;
    }

    this.loadingKey = key;
    const job = (async () => {
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
        this.stemFullDurationSec = nextBuffers.chords_dry?.duration ?? 16;
        this.loadedStemCountryKey = key;
        this.usingPreRenderedStems = true;
        return true;
      } catch {
        this.usingPreRenderedStems = false;
        return false;
      } finally {
        if (this.loadingKey === key) {
          this.loadingPromise = null;
          this.loadingKey = null;
        }
      }
    })();

    this.loadingPromise = job;
    return job;
  }

  private computeLoopBoundsSec(barLoop: BarLoopRange, totalBars = 8): [number, number] {
    const dur = Math.max(0.5, this.stemBuffers.chords_dry?.duration ?? this.stemFullDurationSec);
    if (!barLoop) return [0, dur];
    const barSec = dur / Math.max(1, totalBars);
    const b0 = Math.max(0, Math.min(totalBars - 1, Math.min(barLoop[0], barLoop[1])));
    const b1 = Math.max(b0, Math.min(totalBars - 1, Math.max(barLoop[0], barLoop[1])));
    return [b0 * barSec, Math.min(dur, (b1 + 1) * barSec)];
  }

  /**
   * Inicia os 8 stems em loop gapless exato, respeitando `barLoop` (`loopStart` / `loopEnd`) idêntico ao `jukebox_studio.py`.
   */
  public startStemPlayback(
    offsetProgress01: number,
    layers: ExperienceLayersState,
    barLoop: BarLoopRange = null,
    totalBars = 8
  ): void {
    if (!this.usingPreRenderedStems || !this.ctx || !this.componentBuses) return;
    this.stopStemPlayback();

    const refBuf = this.stemBuffers.chords_dry;
    if (!refBuf) return;

    this.stemFullDurationSec = refBuf.duration;
    const [loopStartSec, loopEndSec] = this.computeLoopBoundsSec(barLoop, totalBars);
    const rawOffsetSec = Math.max(0, Math.min(refBuf.duration - 0.005, offsetProgress01 * refBuf.duration));
    const clampedOffsetSec =
      rawOffsetSec < loopStartSec || rawOffsetSec >= loopEndSec
        ? loopStartSec
        : Math.min(loopEndSec - 0.005, rawOffsetSec);

    const startTime = this.ctx.currentTime + 0.02;

    for (const comp of STEM_COMPONENTS) {
      for (const mode of ['dry', 'wind'] as const) {
        const stemKey = `${comp}_${mode}` as StemKey;
        const buf = this.stemBuffers[stemKey];
        if (!buf) continue;

        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        src.loopStart = loopStartSec;
        src.loopEnd = Math.min(buf.duration, loopEndSec);

        const targetNode =
          mode === 'dry' ? this.componentBuses[comp].dryGain : this.componentBuses[comp].windGain;
        src.connect(targetNode);
        src.start(startTime, clampedOffsetSec);
        this.activeSources.push(src);
      }
    }

    this.stemLoopBoundsSec = [loopStartSec, loopEndSec];
    this.stemLoopStartCtxTime = startTime - (clampedOffsetSec - loopStartSec);
    this.stemsActivelyPlaying = true;
    this.syncStemGains(layers);
  }

  public stopStemPlayback(): void {
    for (const src of this.activeSources) {
      try {
        src.stop();
        src.disconnect();
      } catch {
        // ignore
      }
    }
    this.activeSources = [];
    this.stemsActivelyPlaying = false;
  }

  /**
   * Retorna `progress01` (`0..1`) sample-accurate diretamente do relógio Web Audio (`ctx.currentTime`).
   */
  public getPlayheadProgress01(): number | null {
    if (!this.stemsActivelyPlaying || !this.ctx || this.stemFullDurationSec <= 0.05) {
      return null;
    }
    const [loopStart, loopEnd] = this.stemLoopBoundsSec;
    const span = Math.max(0.05, loopEnd - loopStart);
    const elapsed = Math.max(0, this.ctx.currentTime - this.stemLoopStartCtxTime);
    const curSec = loopStart + (((elapsed % span) + span) % span);
    return Math.min(0.9999, Math.max(0, curSec / this.stemFullDurationSec));
  }

  /**
   * Mistura Dry/Wind, Solo (`melody`, `sparkle`, `chords`, `bass`) e Ganhos idêntica ao `jukebox_studio.py`.
   */
  public syncStemGains(layers: ExperienceLayersState): void {
    if (!this.ctx || !this.componentBuses) return;

    const spkSolo = layers.melody.sparkleSolo;
    const anyGenSolo =
      spkSolo || layers.melody.solo || layers.chords.solo || layers.bass.solo;

    const isAudible = (comp: StemComponentId): boolean => {
      if (spkSolo) {
        return comp === 'melody_sparkle' && layers.melody.sparkleEnabled;
      }
      if (anyGenSolo) {
        if (comp === 'melody_main') return layers.melody.solo && layers.melody.enabled;
        if (comp === 'melody_sparkle') {
          return layers.melody.solo && layers.melody.enabled && layers.melody.sparkleEnabled;
        }
        if (comp === 'chords') return layers.chords.solo && layers.chords.enabled;
        if (comp === 'bass') return layers.bass.solo && layers.bass.enabled;
        return false;
      }
      if (comp === 'chords') return layers.chords.enabled;
      if (comp === 'bass') return layers.bass.enabled;
      if (comp === 'melody_main') return layers.melody.enabled;
      if (comp === 'melody_sparkle') {
        return layers.melody.enabled && layers.melody.sparkleEnabled;
      }
      return false;
    };

    const w = layers.wind.enabled ? Math.min(1, Math.max(0, layers.wind.wetMix)) : 0;
    const now = this.ctx.currentTime;
    const tau = 0.015;

    const compGainMap: Record<StemComponentId, number> = {
      chords: isAudible('chords') ? layers.chords.gain : 0,
      bass: isAudible('bass') ? layers.bass.gain : 0,
      melody_main: isAudible('melody_main') ? layers.melody.gain : 0,
      melody_sparkle: isAudible('melody_sparkle')
        ? layers.melody.gain * layers.melody.sparkleGain
        : 0,
    };

    for (const comp of STEM_COMPONENTS) {
      const val = compGainMap[comp];
      const dryTarget = HEADROOM_INV * val * (1.0 - w);
      const windTarget = HEADROOM_INV * val * w;
      this.componentBuses[comp].dryGain.gain.setTargetAtTime(dryTarget, now, tau);
      this.componentBuses[comp].windGain.gain.setTargetAtTime(windTarget, now, tau);
    }
  }

  private readAnalyserStats(an: AnalyserNode | null): { rms: number; peak: number } {
    if (!an) return { rms: 0, peak: 0 };
    const n = Math.min(this.analyserScratch.length, an.fftSize);
    const buf = this.analyserScratch.subarray(0, n);
    an.getFloatTimeDomainData(buf);
    let sum = 0;
    let peak = 0;
    for (let i = 0; i < n; i++) {
      const v = Math.abs(buf[i]);
      sum += v * v;
      if (v > peak) peak = v;
    }
    return { rms: Math.sqrt(sum / Math.max(1, n)), peak };
  }

  /**
   * Lê os medidores VU reais (0..1) e o pico Master em dBFS diretamente dos `AnalyserNode`s Web Audio.
   */
  public readLiveMeters(): { vu: AudioLevelsMap; masterDbFs: number } {
    if (!this.ctx || !this.stemsActivelyPlaying || !this.componentBuses) {
      return {
        vu: { melody: 0, sparkle: 0, chords: 0, bass: 0, wind: 0, master: 0 },
        masterDbFs: -99,
      };
    }

    const toNorm = (rms: number, mult = 1.45) =>
      Math.min(1, Math.max(0, Math.sqrt(rms) * mult));

    const mel = toNorm(this.readAnalyserStats(this.componentBuses.melody_main.meter).rms);
    const spk = toNorm(this.readAnalyserStats(this.componentBuses.melody_sparkle.meter).rms);
    const chd = toNorm(this.readAnalyserStats(this.componentBuses.chords.meter).rms);
    const bas = toNorm(this.readAnalyserStats(this.componentBuses.bass.meter).rms);
    const wnd = toNorm(this.readAnalyserStats(this.windDiffAnalyser).rms);

    const masterStats = this.readAnalyserStats(this.masterAnalyser);
    const mst = toNorm(masterStats.rms, 1.35);
    const masterDbFs =
      masterStats.peak > 1e-5 ? Number((20 * Math.log10(masterStats.peak)).toFixed(1)) : -99;

    return {
      vu: {
        melody: mel,
        sparkle: spk,
        chords: chd,
        bass: bas,
        wind: wnd,
        master: mst,
      },
      masterDbFs,
    };
  }

  // --- Roteamento Multi-Caixa para Nave / SFX Espacial e Voz Piper TTS ---

  public createSpatialSfxTarget(
    initialPanX = 0,
    initialPanY = 0,
    options?: { duckWithVoice?: boolean }
  ): SpatialSfxTarget | null {
    const ctx = this.ensureContext();
    if (!ctx || !this.speakerChains || !this.directDelayNode) return null;

    const input = ctx.createGain();
    const duckGain = options?.duckWithVoice ? ctx.createGain() : null;
    if (duckGain) {
      duckGain.gain.value = this.voiceDuckMultiplier;
      input.connect(duckGain);
    }
    const sourceBus: AudioNode = duckGain ?? input;

    const stereoPan = ctx.createStereoPanner();
    const directGain = ctx.createGain();
    sourceBus.connect(stereoPan);
    stereoPan.connect(directGain);
    directGain.connect(this.directDelayNode);

    const roomGains: Record<SpeakerSlotId, GainNode> = {
      speaker1: ctx.createGain(),
      speaker2: ctx.createGain(),
      speaker3: ctx.createGain(),
    };
    for (const id of SPEAKER_IDS) {
      sourceBus.connect(roomGains[id]);
      roomGains[id].connect(this.speakerChains[id].input);
    }

    let curX = Math.max(-1, Math.min(1, initialPanX));
    let curY = Math.max(-1, Math.min(1, initialPanY));

    const syncRouting = () => {
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const useRoomVbap = this.audioMode === 'room3' || this.isolatedSpeakerSlot !== null;
      stereoPan.pan.setTargetAtTime(curX, now, 0.02);
      directGain.gain.setTargetAtTime(useRoomVbap ? 0 : 1, now, 0.02);

      if (useRoomVbap) {
        const vbap = computeVbap3Gains(curX, curY, this.calibration.speakers);
        for (const id of SPEAKER_IDS) {
          roomGains[id].gain.setTargetAtTime(vbap[id], now, 0.02);
        }
      } else {
        for (const id of SPEAKER_IDS) {
          roomGains[id].gain.setTargetAtTime(0, now, 0.02);
        }
      }
    };

    syncRouting();

    const record = { syncRouting, duckGain };
    this.sfxTargets.add(record);

    return {
      ctx,
      destination: input,
      setPan: (nextX: number, nextY = 0) => {
        curX = Math.max(-1, Math.min(1, nextX));
        curY = Math.max(-1, Math.min(1, nextY));
        syncRouting();
      },
      disconnect: () => {
        this.sfxTargets.delete(record);
        try {
          input.disconnect();
          duckGain?.disconnect();
          stereoPan.disconnect();
          directGain.disconnect();
          for (const id of SPEAKER_IDS) {
            roomGains[id].disconnect();
          }
        } catch {
          // ignore
        }
      },
    };
  }

  public stopSpeechPlayback(): void {
    if (this.activeSpeechSource) {
      try {
        this.activeSpeechSource.onended = null;
        this.activeSpeechSource.stop();
        this.activeSpeechSource.disconnect();
      } catch {
        // ignore
      }
      this.activeSpeechSource = null;
    }
    if (this.activeSpeechCleanups) {
      this.activeSpeechCleanups();
      this.activeSpeechCleanups = null;
    }
  }

  public async playSpeechWavBuffer(
    wavBuffer: ArrayBuffer,
    volume01: number,
    callbacks?: { onStart?: () => void; onEnd?: () => void }
  ): Promise<boolean> {
    if (this.isMuted() || volume01 <= 0.001) return false;
    const ctx = this.ensureContext();
    if (!ctx || !this.speakerChains || !this.directDelayNode) return false;

    this.stopSpeechPlayback();
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        // ignore
      }
    }

    const cloned = wavBuffer.slice(0);
    const decoded = await ctx.decodeAudioData(cloned);
    this.stopSpeechPlayback();

    const src = ctx.createBufferSource();
    src.buffer = decoded;

    const voiceGain = ctx.createGain();
    voiceGain.gain.value = Math.max(0, Math.min(1.5, volume01));
    src.connect(voiceGain);

    const useRoomVbap = this.audioMode === 'room3' || this.isolatedSpeakerSlot !== null;
    const branchNodes: AudioNode[] = [voiceGain];

    if (useRoomVbap) {
      // Distribuição equilibrada nas 3 caixas juntas (C1 + C2 + C3) respeitando calibração e setSinkId
      for (const id of SPEAKER_IDS) {
        if (this.calibration.speakers[id].muted) continue;
        const g = ctx.createGain();
        g.gain.value = 0.72;
        voiceGain.connect(g);
        g.connect(this.speakerChains[id].input);
        branchNodes.push(g);
      }
    } else {
      voiceGain.connect(this.directDelayNode);
    }

    const cleanupNodes = () => {
      for (const node of branchNodes) {
        try {
          node.disconnect();
        } catch {
          // ignore
        }
      }
    };

    this.activeSpeechSource = src;
    this.activeSpeechCleanups = cleanupNodes;

    src.onended = () => {
      if (this.activeSpeechSource === src) {
        this.activeSpeechSource = null;
      }
      if (this.activeSpeechCleanups === cleanupNodes) {
        this.activeSpeechCleanups = null;
      }
      cleanupNodes();
      callbacks?.onEnd?.();
    };

    callbacks?.onStart?.();
    src.start();
    return true;
  }

  // --- Ferramentas de Calibração Acústica (Multi-Caixa Independente + Pulso Visual A/V) ---

  private clearCalibBeatTimers(): void {
    if (typeof window === 'undefined') return;
    for (const id of this.calibBeatTimers) {
      window.clearTimeout(id);
    }
    this.calibBeatTimers = [];
  }

  private scheduleVisualBeatPulse(): void {
    if (!this.onCalibBeat || this.isMuted() || this.isolatedSpeakerSlot !== null) return;
    const effective = computeEffectiveAudioVisualDelays(
      this.calibration,
      this.audioMode,
      this.isolatedSpeakerSlot
    );
    const delayMs = Math.max(0, Math.round(15 + effective.visualDelayMs));
    const seq = ++this.calibBeatSeq;
    if (typeof window === 'undefined' || delayMs <= 4) {
      this.onCalibBeat(seq);
      return;
    }
    const tid = window.setTimeout(() => {
      this.calibBeatTimers = this.calibBeatTimers.filter((t) => t !== tid);
      this.onCalibBeat?.(seq);
    }, delayMs);
    this.calibBeatTimers.push(tid);
  }

  public stopCalibrationSignal(): void {
    if (this.calibIntervalId !== null && typeof window !== 'undefined') {
      window.clearInterval(this.calibIntervalId);
      this.calibIntervalId = null;
    }
    this.clearCalibBeatTimers();
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

  public setPinkNoiseSpeakers(rawSpeakers: ReadonlyArray<SpeakerSlotId>): SpeakerSlotId[] {
    const unique = SPEAKER_IDS.filter((id) => rawSpeakers.includes(id));
    if (unique.length === 0) {
      this.stopCalibrationSignal();
      return [];
    }
    this.stopCalibrationSignal();
    this.calibTestMode = { kind: 'pink-multi', speakers: unique };
    this.onCalibModeChange?.(this.calibTestMode);

    const ctx = this.ensureContext();
    if (!ctx || !this.speakerChains) return unique;
    if (ctx.state === 'suspended') {
      void ctx.resume().catch(() => {});
    }
    void this.resumeAllSinkOutputs();

    if (!this.pinkBuffer) {
      this.pinkBuffer = createPinkNoiseBuffer(ctx, 3.0);
    }

    const src = ctx.createBufferSource();
    src.buffer = this.pinkBuffer;
    src.loop = true;
    const gain = ctx.createGain();
    gain.gain.value = unique.length === 1 ? 0.85 : unique.length === 2 ? 0.75 : 0.65;
    src.connect(gain);

    for (const spkId of unique) {
      gain.connect(this.speakerChains[spkId].input);
    }
    src.start();

    this.calibPinkSrc = src;
    this.calibPinkGain = gain;
    return unique;
  }

  public togglePinkNoiseSpeaker(speakerId: SpeakerSlotId): SpeakerSlotId[] {
    const prevActive = SPEAKER_IDS.filter((id) =>
      isPinkNoiseSpeakerActive(this.calibTestMode, id)
    );
    const next = prevActive.includes(speakerId)
      ? prevActive.filter((id) => id !== speakerId)
      : [...prevActive, speakerId];
    return this.setPinkNoiseSpeakers(next);
  }

  public setDelayClickSpeakers(
    rawSpeakers: ReadonlyArray<SpeakerSlotId>,
    headphones = false
  ): SpeakerSlotId[] {
    const unique = SPEAKER_IDS.filter((id) => rawSpeakers.includes(id));
    if (!headphones && unique.length === 0) {
      this.stopCalibrationSignal();
      return [];
    }
    this.stopCalibrationSignal();
    this.calibTestMode = { kind: 'delay-click-multi', speakers: unique, headphones };
    this.onCalibModeChange?.(this.calibTestMode);

    const ctx = this.ensureContext();
    if (!ctx || !this.speakerChains || !this.directDelayNode || typeof window === 'undefined') {
      return unique;
    }
    if (ctx.state === 'suspended') {
      void ctx.resume().catch(() => {});
    }
    void this.resumeAllSinkOutputs();

    const FREQ_BY_SPEAKER: Record<SpeakerSlotId, number> = {
      speaker1: 1600,
      speaker2: 1850,
      speaker3: 2100,
    };

    const fireBurst = () => {
      if (!this.ctx || !this.speakerChains || !this.directDelayNode) return;
      const t = this.ctx.currentTime + 0.015;

      if (headphones) {
        const osc = this.ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(1750, t);
        osc.frequency.exponentialRampToValueAtTime(280, t + 0.028);
        const env = this.ctx.createGain();
        env.gain.setValueAtTime(0.85, t);
        env.gain.exponentialRampToValueAtTime(0.0001, t + 0.032);
        osc.connect(env);
        env.connect(this.directDelayNode);
        osc.start(t);
        osc.stop(t + 0.04);
      }

      for (const spkId of unique) {
        const osc = this.ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(FREQ_BY_SPEAKER[spkId], t);
        osc.frequency.exponentialRampToValueAtTime(280, t + 0.028);
        const env = this.ctx.createGain();
        env.gain.setValueAtTime(0.9, t);
        env.gain.exponentialRampToValueAtTime(0.0001, t + 0.032);
        osc.connect(env);
        env.connect(this.speakerChains[spkId].input);
        osc.start(t);
        osc.stop(t + 0.04);
      }

      this.scheduleVisualBeatPulse();
    };

    fireBurst();
    this.calibIntervalId = window.setInterval(fireBurst, 650);
    return unique;
  }

  public toggleDelayClickSpeaker(speakerId: SpeakerSlotId): SpeakerSlotId[] {
    const prevActive = SPEAKER_IDS.filter((id) =>
      isDelayClickSpeakerActive(this.calibTestMode, id, this.calibration.referenceSpeakerId)
    );
    const next = prevActive.includes(speakerId)
      ? prevActive.filter((id) => id !== speakerId)
      : [...prevActive, speakerId];
    return this.setDelayClickSpeakers(next, false);
  }

  public toggleHeadphoneDelayClick(): boolean {
    const wasActive =
      this.calibTestMode.kind === 'delay-click-multi' && Boolean(this.calibTestMode.headphones);
    if (wasActive) {
      this.stopCalibrationSignal();
      return false;
    }
    this.setDelayClickSpeakers([], true);
    return true;
  }

  public startPinkNoiseSingle(speakerId: SpeakerSlotId): void {
    this.setPinkNoiseSpeakers([speakerId]);
  }

  public startPinkNoiseAB(targetSpeakerId: SpeakerSlotId): void {
    const refId = this.calibration.referenceSpeakerId;
    this.setPinkNoiseSpeakers(refId === targetSpeakerId ? [targetSpeakerId] : [refId, targetSpeakerId]);
  }

  public startDelayClickTest(targetSpeakerId: SpeakerSlotId): void {
    this.setDelayClickSpeakers([targetSpeakerId], false);
  }

  public startPinkNoiseAll(): void {
    this.setPinkNoiseSpeakers([...SPEAKER_IDS]);
  }

  public startDelayClickAll(): void {
    this.setDelayClickSpeakers([...SPEAKER_IDS], false);
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

  public async unlockAudioOutputDevices(): Promise<AudioDeviceOption[]> {
    this.ensureContext();
    await this.resumeAllSinkOutputs();
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
      return [];
    }

    let list = await this.listOutputDevices();
    const alreadyUnlocked = list.some(
      (d) =>
        Boolean(d.deviceId) &&
        d.deviceId !== 'default' &&
        d.deviceId !== 'communications' &&
        !d.label.startsWith('Saída de Áudio #')
    );

    if (!alreadyUnlocked && typeof navigator.mediaDevices.getUserMedia === 'function') {
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
        // Aguarda brevemente o Windows restaurar Bluetooth A2DP após liberar o canal de microfone HFP
        await new Promise<void>((resolve) => window.setTimeout(resolve, 260));
      } catch {
        // PC sem microfone ou permissão negada -> tenta selectAudioOutput abaixo
      }
      list = await this.listOutputDevices();
    }

    if (list.length === 0 && this.canSelectAudioOutputPrompt()) {
      const picked = await this.promptSelectSpeakerDevice();
      if (picked) {
        list = await this.listOutputDevices();
        if (!list.some((d) => d.deviceId === picked.deviceId)) {
          list = [picked, ...list];
        }
      }
    }

    this.retryErroredSinks();
    return list;
  }

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
