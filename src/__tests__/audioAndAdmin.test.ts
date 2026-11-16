import { describe, expect, it, vi } from 'vitest';
import { parseRouteFromSearch, parseSpeakerIndexFromSearch } from '../App';
import {
  pauseSpeech,
  resumeSpeech,
  setSpeechGateOpen,
  speakTextPt,
  stopSpeech,
} from '../accessibility/a11yEngine';
import { stopAllSpaceAudio } from '../audio/spaceAmbient';
import {
  computeVbap3Gains,
  createDefaultAudioCalibration,
  speakerIndexToSlotId,
} from '../audio/speakerCalibration';
import {
  midiToFreq,
  parseChordToMidiVoicing,
  SpatialAudioEngine,
} from '../audio/spatialAudioEngine';
import {
  advanceLoopProgress,
  buildBeatTimeline,
  computeSpeakerLiveLevels,
  resolveCompareSwapTarget,
} from '../experience/cueEngine';
import {
  resolveActiveMissionFrameId,
  resolveFramePrompts,
  SHAY_MISSION_FRAMES,
} from '../experience/missionFrames';
import { encodeQrMatrix } from '../lan/qrCodeSvg';
import {
  applyProjectionPreset,
  makeSurfaceQuadKey,
  toggleSurfaceOnOutput,
} from '../projection/homography';

describe('Show Control Admin (?view=admin), Matriz de Projetores Out 1..3, Nós LAN e Motor 8D', () => {
  it('resolve ?view=admin, ?view=setup, ?view=projector&out=1..3 e ?view=audio-node&spk=1..3', () => {
    expect(parseRouteFromSearch('?view=admin').view).toBe('admin');
    expect(parseRouteFromSearch('', '/admin').view).toBe('admin');
    expect(parseRouteFromSearch('?view=setup').view).toBe('setup');
    expect(parseRouteFromSearch('', '/setup').view).toBe('setup');
    expect(parseRouteFromSearch('?view=projector&out=3')).toEqual({
      view: 'projector',
      outId: 3,
    });
    expect(parseRouteFromSearch('?view=projector&out=4')).toEqual({
      view: 'projector',
      outId: 1,
    });
    expect(parseRouteFromSearch('?view=audio-node&spk=3').view).toBe('audio-node');
    expect(parseSpeakerIndexFromSearch('?view=audio-node&spk=2')).toBe(2);
    expect(parseSpeakerIndexFromSearch('?view=audio-node&spk=3')).toBe(3);
    expect(speakerIndexToSlotId(3)).toBe('speaker3');
  });

  it('alterna presets de 2 Projetores vs 3 Projetores (1 por parede + teto em 100% da resolução) e Patchbay custom', () => {
    const twoProj = applyProjectionPreset('2-projectors');
    expect(twoProj.outputs[1].surfaces).toEqual(['leftWall', 'rightWall']);
    expect(twoProj.outputs[2].surfaces).toEqual(['ceiling']);
    expect(twoProj.outputs[3].surfaces).toEqual([]);
    expect(twoProj.quads[makeSurfaceQuadKey(1, 'leftWall')][1].x).toBe(0.5);
    expect(twoProj.quads[makeSurfaceQuadKey(1, 'rightWall')][0].x).toBe(0.5);

    // 3 Dedicated Projectors: each wall gets 100% (0..1 x 0..1) of its own projector
    const threeProj = applyProjectionPreset('3-projectors');
    expect(threeProj.outputs[1].surfaces).toEqual(['leftWall']);
    expect(threeProj.outputs[2].surfaces).toEqual(['rightWall']);
    expect(threeProj.outputs[3].surfaces).toEqual(['ceiling']);
    expect(threeProj.quads[makeSurfaceQuadKey(1, 'leftWall')][1].x).toBe(1);
    expect(threeProj.quads[makeSurfaceQuadKey(2, 'rightWall')][0].x).toBe(0);
    expect(threeProj.quads[makeSurfaceQuadKey(2, 'rightWall')][1].x).toBe(1);

    // Custom Matrix: adding ceiling on Out 3 over '2-projectors' sets preset 'custom' and gives Out 3 full screen
    const custom = toggleSurfaceOnOutput(twoProj, 3, 'ceiling');
    expect(custom.preset).toBe('custom');
    expect(custom.outputs[3].surfaces).toEqual(['ceiling']);
    expect(custom.quads[makeSurfaceQuadKey(3, 'ceiling')][2]).toEqual({ x: 1, y: 1 });
  });

  it('calcula ganhos VBAP das 3 caixas em potência constante (g1² + g2² + g3² = 1) e respeita mute', () => {
    const defaults = createDefaultAudioCalibration().speakers;
    expect(defaults.speaker1.routeTarget).toBe('local');

    const leftBolt = computeVbap3Gains(-0.85, 0.45, defaults);
    const powerSum =
      leftBolt.speaker1 ** 2 + leftBolt.speaker2 ** 2 + leftBolt.speaker3 ** 2;

    expect(powerSum).toBeCloseTo(1, 2);
    expect(leftBolt.speaker1).toBeGreaterThan(leftBolt.speaker2 * 3);
    expect(leftBolt.speaker1).toBeGreaterThan(leftBolt.speaker3 * 2);

    const withSpk1Muted = computeVbap3Gains(-0.85, 0.45, {
      ...defaults,
      speaker1: { ...defaults.speaker1, muted: true },
    });
    expect(withSpk1Muted.speaker1).toBe(0);
    expect(withSpk1Muted.speaker2 ** 2 + withSpk1Muted.speaker3 ** 2).toBeCloseTo(1, 2);
  });

  it('converte cifras do meta.json em voicings MIDI harmônicos válidos', () => {
    expect(midiToFreq(69)).toBeCloseTo(440, 4);
    const dAdd9 = parseChordToMidiVoicing('Dadd9', 'D');
    expect(dAdd9[0]).toBe(50); // D3
    expect(dAdd9.length).toBeGreaterThanOrEqual(4);
  });

  it('gera matriz QR Code ISO/IEC 18004 quadrada offline com finder patterns 7x7 nos 3 cantos', () => {
    const matrix = encodeQrMatrix('http://192.168.15.10:5173/?view=controller');
    const n = matrix.length;
    expect(n).toBeGreaterThanOrEqual(29);
    expect(matrix[0].length).toBe(n);

    expect(matrix[0][0]).toBe(true);
    expect(matrix[3][3]).toBe(true);
    expect(matrix[0][n - 1]).toBe(true);
    expect(matrix[3][n - 4]).toBe(true);
    expect(matrix[n - 1][0]).toBe(true);
    expect(matrix[n - 4][3]).toBe(true);
  });

  it('gera linha do tempo de 32 batidas (8 compassos) e congela loop em um compasso específico', () => {
    const timeline = buildBeatTimeline([
      {
        beat: 0,
        layer: 'bass',
        source_x: 0.5,
        source_y: 0.2,
        pitch: 38,
        velocity: 0.9,
        isAnchor: true,
      },
      {
        beat: 5,
        layer: 'melody',
        source_x: 0.12,
        source_y: 0.78,
        pitch: 74,
        velocity: 0.85,
        isAnchor: false,
      },
    ]);

    expect(timeline).toHaveLength(32);
    expect(timeline[0].hasBass).toBe(true);
    expect(timeline[0].hasMelody).toBe(false);
    expect(timeline[5].bar).toBe(1);
    expect(timeline[5].beatInBar).toBe(1);
    expect(timeline[5].hasMelody).toBe(true);
    expect(timeline[5].primaryX).toBe(0.12);

    expect(buildBeatTimeline(null)).toEqual([]);
    expect(buildBeatTimeline([])).toEqual([]);

    // Loop frozen on Bar 3 (barIndex = 2 -> range [0.25, 0.375))
    const wrapped = advanceLoopProgress(0.37, 0.2, 16, 2, 8);
    expect(wrapped).toBeGreaterThanOrEqual(0.25);
    expect(wrapped).toBeLessThan(0.375);
  });

  it('mapeia todos os 10 quadros reais da jornada da Shay, prompts PT/EN e troca A ⇄ B', () => {
    expect(resolveCompareSwapTarget('076', { slotA: '076', slotB: '818' })).toBe('818');
    expect(resolveCompareSwapTarget('818', { slotA: '076', slotB: '818' })).toBe('076');
    expect(resolveCompareSwapTarget('156', { slotA: '076', slotB: '818' })).toBe('076');

    expect(SHAY_MISSION_FRAMES).toHaveLength(12);
    expect(resolveActiveMissionFrameId('countdown', 0)).toBe('countdown');
    expect(resolveActiveMissionFrameId('exploring', 1)).toBe('exploring-melody');
    expect(resolveActiveMissionFrameId('exploring', 2)).toBe('exploring-chords');
    expect(resolveActiveMissionFrameId('exploring', 3)).toBe('exploring-temperature');
    expect(resolveActiveMissionFrameId('exploring', 4)).toBe('exploring-bass');
    expect(resolveActiveMissionFrameId('exploring', 5)).toBe('exploring-wind');

    const countdownPt = resolveFramePrompts('countdown', {
      lang: 'pt',
      countryName: 'Brasil',
      activeLayerLabel: 'Melodia',
      bpm: 102,
      keyRoot: 'D',
      keyRootPt: 'Ré',
      activeChord: 'Dadd9',
      windMeanSpeed: 6.4,
    });
    expect(countdownPt.spoken).toContain('Cinco, quatro, três');

    const exploringChordsEn = resolveFramePrompts('exploring-chords', {
      lang: 'en',
      countryName: 'Brazil',
      activeLayerLabel: 'Chords',
      bpm: 102,
      keyRoot: 'D',
      keyRootPt: 'Ré',
      activeChord: 'Dadd9',
      windMeanSpeed: 6.4,
    });
    expect(exploringChordsEn.phrases[0]).toContain('Brazil · Dadd9');
  });

  it('calcula níveis ao vivo por caixa física (C1, C2, C3) coerentes com a posição geográfica do raio', () => {
    const calib = createDefaultAudioCalibration();
    const levelsLeft = computeSpeakerLiveLevels({
      events: [
        {
          layer: 'melody',
          source_x: 0.08,
          source_y: 0.72,
          sourceX: 0.08,
          sourceY: 0.72,
          pitch: 76,
          velocity: 0.92,
          isAnchor: true,
        },
      ],
      audioLevels: {
        melody: 0.9,
        sparkle: 0,
        chords: 0,
        bass: 0,
        wind: 0,
        master: 0.9,
      },
      masterGain: 0.95,
      progress01: 0.125,
      speakerCalibration: calib,
    });

    // Lightning on the West edge (Left Wall) must illuminate C1 much more than C2
    expect(levelsLeft.speaker1).toBeGreaterThan(levelsLeft.speaker2 * 3);

    // If C1 is muted, C1 live level drops immediately to 0
    const mutedC1 = computeSpeakerLiveLevels({
      events: [
        {
          layer: 'melody',
          source_x: 0.08,
          source_y: 0.72,
          sourceX: 0.08,
          sourceY: 0.72,
          pitch: 76,
          velocity: 0.92,
          isAnchor: true,
        },
      ],
      audioLevels: {
        melody: 0.9,
        sparkle: 0,
        chords: 0,
        bass: 0,
        wind: 0,
        master: 0.9,
      },
      masterGain: 0.95,
      progress01: 0.125,
      speakerCalibration: {
        ...calib,
        speakers: {
          ...calib.speakers,
          speaker1: { ...calib.speakers.speaker1, muted: true },
        },
      },
    });
    expect(mutedC1.speaker1).toBe(0);
  });

  it('detecta corretamente o status de suporte/permissão de saídas Bluetooth (setSinkId)', () => {
    const engine = new SpatialAudioEngine(createDefaultAudioCalibration());
    const g = globalThis as Record<string, unknown>;
    const prevWindow = g.window;
    const prevMediaEl = g.HTMLMediaElement;

    try {
      g.window = { isSecureContext: false };
      expect(engine.getOutputSupportStatus([])).toBe('insecure-context');

      g.window = { isSecureContext: true };
      g.HTMLMediaElement = { prototype: {} };
      expect(engine.getOutputSupportStatus([])).toBe('unsupported');

      g.HTMLMediaElement = {
        prototype: {
          setSinkId: async () => undefined,
        },
      };
      expect(engine.getOutputSupportStatus([])).toBe('permission-needed');
      expect(
        engine.getOutputSupportStatus([
          { deviceId: 'bt-al-6885', label: 'AL-6885 (Bluetooth)' },
          { deviceId: 'bt-ka-8296', label: 'KA-8296 (Bluetooth)' },
        ])
      ).toBe('ready');
    } finally {
      if (prevWindow === undefined) delete g.window;
      else g.window = prevWindow;
      if (prevMediaEl === undefined) delete g.HTMLMediaElement;
      else g.HTMLMediaElement = prevMediaEl;
    }
  });

  it('encerra fala pendente, impede nova fala com aba oculta e descarta motor de áudio ao sair', () => {
    const engine = new SpatialAudioEngine(createDefaultAudioCalibration());
    engine.dispose();
    expect(engine.ensureContext()).toBeNull();

    const g = globalThis as Record<string, unknown>;
    const prevWindow = g.window;
    const prevDocument = g.document;
    const prevUtterance = g.SpeechSynthesisUtterance;
    const cancelSpy = vi.fn();
    const speakSpy = vi.fn();
    const onEndSpy = vi.fn();

    try {
      g.SpeechSynthesisUtterance = class {
        text: string;
        lang = '';
        rate = 1;
        volume = 1;
        pitch = 1;
        voice: unknown = null;
        onstart: (() => void) | null = null;
        onend: (() => void) | null = null;
        onerror: (() => void) | null = null;
        constructor(t: string) {
          this.text = t;
        }
      };
      g.window = {
        speechSynthesis: {
          cancel: cancelSpy,
          speak: speakSpy,
          getVoices: () => [],
          paused: false,
          pending: false,
          speaking: false,
        },
        setTimeout,
        clearTimeout,
      };
      g.document = { visibilityState: 'visible' };

      speakTextPt('Olá explorador!', true, { onEnd: onEndSpy });
      expect(speakSpy).toHaveBeenCalledTimes(1);

      stopSpeech();
      expect(cancelSpy).toHaveBeenCalled();
      expect(onEndSpy).toHaveBeenCalledTimes(1);

      // With the tab hidden, no delayed speech may be triggered
      g.document = { visibilityState: 'hidden' };
      speakTextPt('Fala fantasma em background', true);
      expect(speakSpy).toHaveBeenCalledTimes(1);

      // Return to visible and validate pauseSpeech / resumeSpeech / setSpeechGateOpen(false)
      g.document = { visibilityState: 'visible' };
      speakTextPt('Segunda fala', true);
      expect(speakSpy).toHaveBeenCalledTimes(2);
      const pausedMode = pauseSpeech();
      expect(pausedMode).toBe('webspeech');
      expect(resumeSpeech()).toBe('needs-replay');

      setSpeechGateOpen(false);
      speakTextPt('Bloqueado pelo gate da sessão', true);
      expect(speakSpy).toHaveBeenCalledTimes(2);
      setSpeechGateOpen(true);

      expect(() => stopAllSpaceAudio()).not.toThrow();
    } finally {
      setSpeechGateOpen(true);
      if (prevWindow === undefined) delete g.window;
      else g.window = prevWindow;
      if (prevDocument === undefined) delete g.document;
      else g.document = prevDocument;
      if (prevUtterance === undefined) delete g.SpeechSynthesisUtterance;
      else g.SpeechSynthesisUtterance = prevUtterance;
    }
  });
});
