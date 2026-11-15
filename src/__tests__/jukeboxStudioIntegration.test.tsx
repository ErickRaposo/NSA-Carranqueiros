import { Globe2, Play, Rocket, RotateCcw } from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MissionGameButton } from '../components/MissionGameButton';
import { advanceLoopProgress, buildBeatTimeline } from '../experience/cueEngine';
import { DEFAULT_LAYERS_STATE, ExperienceProvider } from '../experience/ExperienceContext';
import { resolveActiveMissionFrameId, resolveFramePrompts } from '../experience/missionFrames';
import {
  GENERATED_COUNTRY_IDS,
  STUDIO_SAVED_GAINS,
  VISUAL_LAYER_ORDER,
} from '../experience/types';
import { buildGlobeLayerStack } from '../hooks/useNasaVideoPool';
import { IdleStageRightWall } from '../scenes/IdleStageRightWall';
import { JukeboxStudioStage } from '../scenes/JukeboxStudioStage';
import { RightWallScene } from '../scenes/RightWallScene';
import {
  computeCountryPngFrameMetrics,
  midiToNoteName,
  projectBboxNormToCountryPng01,
} from '../scenes/studioGeometry';
import { TabletControllerView } from '../views/TabletControllerView';
import { WebDemoView } from '../views/WebDemoView';

interface MinimalNodeFs {
  existsSync(path: URL): boolean;
  readFileSync(path: URL): Uint8Array;
}

const REQUIRED_STEMS = [
  'chords_dry',
  'chords_wind',
  'bass_dry',
  'bass_wind',
  'melody_main_dry',
  'melody_main_wind',
  'melody_sparkle_dry',
  'melody_sparkle_wind',
] as const;

describe('Jukebox Studio Integration — 12 Real Countries, Zero Fallback, Right Wall MIDI & Tablet Controls', () => {
  it('verifica que os 12 países pré-gerados possuem index.json, 5 PNGs, 16 OGGs e partitura MIDI studio completa', async () => {
    const fsModuleId = 'node:fs';
    const fs = (await import(/* @vite-ignore */ fsModuleId)) as unknown as MinimalNodeFs;
    const decoder = new TextDecoder('utf-8');

    const indexUrl = new URL('../../public/countries/index.json', import.meta.url);
    expect(fs.existsSync(indexUrl)).toBe(true);
    const indexJson = JSON.parse(decoder.decode(fs.readFileSync(indexUrl))) as {
      generatedIds: string[];
      count: number;
    };

    expect(indexJson.count).toBeGreaterThanOrEqual(11);
    for (const cid of GENERATED_COUNTRY_IDS) {
      expect(indexJson.generatedIds).toContain(cid);

      const dirUrl = new URL(`../../public/countries/${cid}/`, import.meta.url);
      expect(fs.existsSync(dirUrl)).toBe(true);

      // 5 PNGs 1024x1024 + 5 Sprite Sheets de Vídeo NASA 96f (12x8)
      for (const lid of VISUAL_LAYER_ORDER) {
        expect(fs.existsSync(new URL(`${lid}.png`, dirUrl))).toBe(true);
        expect(fs.existsSync(new URL(`video/${lid}_sheet.jpg`, dirUrl))).toBe(true);
      }

      // 16 OGG stems (region + base)
      for (const tuning of ['region', 'base'] as const) {
        for (const stem of REQUIRED_STEMS) {
          expect(fs.existsSync(new URL(`${tuning}/${stem}.ogg`, dirUrl))).toBe(true);
        }
      }

      // meta.json + studio MIDI payload
      const metaRaw = decoder.decode(fs.readFileSync(new URL('meta.json', dirUrl)));
      const meta = JSON.parse(metaRaw) as {
        hasAudioStems: boolean;
        audioFormat: string;
        studio: {
          numFrames: number;
          yellowCounts: number[];
          persistentPeaks: Array<[number, number]>;
          sessions: {
            region: {
              bpm: number;
              chordProgression: string[];
              tracks: {
                melody: Array<{ pitch: number; start_beat: number; duration_beats: number }>;
                melody_sparkle: Array<{ pitch: number; sub_role?: string }>;
                chords_pad: Array<{ pitch: number }>;
                bass: Array<{ pitch: number }>;
              };
            };
            base: {
              bpm: number;
              keyRoot: string;
            };
          };
        };
      };

      expect(meta.hasAudioStems).toBe(true);
      expect(meta.audioFormat).toBe('ogg');
      expect(meta.studio).toBeDefined();
      expect(meta.studio.numFrames).toBe(96);
      expect(meta.studio.yellowCounts).toHaveLength(96);
      expect(meta.studio.sessions.region.chordProgression).toHaveLength(8);
      expect(meta.studio.sessions.region.tracks.chords_pad.length).toBeGreaterThan(0);
      expect(meta.studio.sessions.region.tracks.bass.length).toBeGreaterThan(0);
      expect(meta.studio.sessions.base.bpm).toBe(90);
      expect(meta.studio.sessions.base.keyRoot).toBe('A');
    }
  });

  it('garante zero fallback sintético em buildBeatTimeline e suporta barLoop [b0, b1] no advanceLoopProgress', () => {
    const emptyTimeline = buildBeatTimeline([]);
    expect(emptyTimeline).toEqual([]);

    // Loop C2–C3 ([1, 2] -> intervalo [0.125, 0.375) num loop de 8 compassos)
    const wrapped = advanceLoopProgress(0.37, 0.5, 16, null, 8, [1, 2]);
    expect(wrapped).toBeGreaterThanOrEqual(0.125);
    expect(wrapped).toBeLessThan(0.375);

    // Se playhead estiver fora do barLoop (ex.: C1 = 0.02), salta imediatamente para o início do trecho
    const jumped = advanceLoopProgress(0.02, 0.016, 16, null, 8, [4, 5]);
    expect(jumped).toBeGreaterThanOrEqual(0.5);
    expect(jumped).toBeLessThan(0.75);
  });

  it('projeta coordenadas normalizadas (source_x, source_y) exatamente na moldura 1024x1024 dos PNGs e formata notas MIDI', () => {
    expect(midiToNoteName(60)).toBe('C4');
    expect(midiToNoteName(66)).toBe('F#4');
    expect(midiToNoteName(36)).toBe('C2');

    const brazilBbox: [number, number, number, number] = [-74.0185, -33.7423, -32.3877, 5.2672];
    const metrics = computeCountryPngFrameMetrics(brazilBbox);
    expect(metrics.offsetX01).toBeGreaterThanOrEqual(0.079);
    expect(metrics.offsetY01).toBeGreaterThanOrEqual(0.079);

    const center = projectBboxNormToCountryPng01(0.5, 0.5, brazilBbox);
    expect(center.x01).toBeCloseTo(0.5, 3);
    expect(center.y01).toBeCloseTo(0.5, 3);
  });

  it('isola svs5011 no Globo quando sparkleSolo está ativo e aplica os ganhos salvos canônicos do config.py', () => {
    expect(DEFAULT_LAYERS_STATE.melody.gain).toBe(STUDIO_SAVED_GAINS.melody);
    expect(DEFAULT_LAYERS_STATE.chords.gain).toBe(STUDIO_SAVED_GAINS.chords);
    expect(DEFAULT_LAYERS_STATE.bass.gain).toBe(STUDIO_SAVED_GAINS.bass);

    const sparkleSoloState = {
      ...DEFAULT_LAYERS_STATE,
      melody: {
        ...DEFAULT_LAYERS_STATE.melody,
        enabled: false,
        sparkleEnabled: true,
        sparkleSolo: true,
      },
    };
    const globeLayers = buildGlobeLayerStack(sparkleSoloState);
    expect(globeLayers.filter((l) => l.enabled).map((l) => l.id)).toEqual(['svs5011']);
  });

  it('renderiza JukeboxStudioStage passivo em simulator/demo, interativo em controller, e TabletControllerView com controles de voz', () => {
    const stageSimHtml = renderToStaticMarkup(
      <ExperienceProvider>
        <JukeboxStudioStage renderContext="simulator" />
      </ExperienceProvider>
    );
    expect(stageSimHtml).toContain('data-testid="jukebox-studio-stage"');
    expect(stageSimHtml).toContain('#000000');
    expect(stageSimHtml).toContain('pointer-events-none');
    expect(stageSimHtml).not.toContain('cursor-pointer');

    const stageCtrlHtml = renderToStaticMarkup(
      <ExperienceProvider>
        <JukeboxStudioStage renderContext="controller" />
      </ExperienceProvider>
    );
    expect(stageCtrlHtml).toContain('cursor-pointer');

    const tabletHtml = renderToStaticMarkup(
      <ExperienceProvider>
        <TabletControllerView />
      </ExperienceProvider>
    );
    expect(tabletHtml).toContain('data-testid="tablet-controller-view"');
    expect(tabletHtml).toContain('data-testid="tablet-voice-toggle"');
    expect(tabletHtml).toContain('Voz: ON');
    expect(tabletHtml).toContain('Abrir Jukebox Studio Direto');

    const demoHtml = renderToStaticMarkup(
      <ExperienceProvider routeView="demo">
        <WebDemoView />
      </ExperienceProvider>
    );
    expect(demoHtml).toContain('data-testid="web-demo-view"');
    expect(demoHtml).toContain('data-testid="demo-back-btn"');
    expect(demoHtml).toContain('data-testid="demo-mode-split"');
    expect(demoHtml).toContain('data-testid="demo-mode-tablet"');
    expect(demoHtml).toContain('data-testid="demo-mode-room2d"');
    expect(demoHtml).toContain('data-testid="demo-voice-toggle"');
    expect(demoHtml).toContain('data-testid="demo-setup-btn"');
    expect(demoHtml).toContain('Painel Técnico');
    expect(demoHtml).not.toContain('Controle Studio');
    expect(demoHtml).not.toContain('Simulador 3D do Quarto');
  });

  it('garante paridade 1:1 do MissionGameButton entre Parede (passivo) e Tablet (interativo) em todas as fases', () => {
    const interactiveBtnHtml = renderToStaticMarkup(
      <MissionGameButton label="Start" icon={Play} interactive testId="btn-interactive" />
    );
    expect(interactiveBtnHtml).toContain('<button');
    expect(interactiveBtnHtml).toContain('border-b-[4px]');
    expect(interactiveBtnHtml).toContain('Start');

    const passiveBtnHtml = renderToStaticMarkup(
      <MissionGameButton
        label="Autorizar Decolagem"
        icon={Rocket}
        interactive={false}
        testId="btn-passive"
      />
    );
    expect(passiveBtnHtml).toContain('<div');
    expect(passiveBtnHtml).toContain('aria-hidden="true"');
    expect(passiveBtnHtml).not.toContain('<button');
    expect(passiveBtnHtml).toContain('border-b-[4px]');
    expect(passiveBtnHtml).toContain('Autorizar Decolagem');

    const idleWallHtml = renderToStaticMarkup(
      <ExperienceProvider>
        <IdleStageRightWall isPt={true} interactive={false} />
      </ExperienceProvider>
    );
    expect(idleWallHtml).toContain('Start');
    expect(idleWallHtml).toContain('border-b-[4px]');

    const phases: Array<{
      phase: 'briefing' | 'boarding' | 'zero_g' | 'ended';
      expectedLabel: string;
      checkRightWall?: boolean;
    }> = [
      { phase: 'briefing', expectedLabel: 'Embarcar na Nave', checkRightWall: true },
      { phase: 'boarding', expectedLabel: 'Autorizar Decolagem', checkRightWall: true },
      { phase: 'zero_g', expectedLabel: 'Escolher País', checkRightWall: true },
      { phase: 'ended', expectedLabel: 'Nova Missão', checkRightWall: false },
    ];

    for (const { phase, expectedLabel, checkRightWall } of phases) {
      const tabletPhaseHtml = renderToStaticMarkup(
        <ExperienceProvider initialMissionPhase={phase}>
          <TabletControllerView />
        </ExperienceProvider>
      );
      expect(tabletPhaseHtml).toContain(expectedLabel);
      expect(tabletPhaseHtml).toContain('Etapas da missão');
      expect(tabletPhaseHtml).not.toContain('Progresso da expedição gamificada');
      expect(tabletPhaseHtml).not.toContain('Medalha Desbloqueada');
      expect(tabletPhaseHtml).not.toContain('Conquista:');
      expect(tabletPhaseHtml).not.toContain('Concluir &amp; Medalha');
      expect(tabletPhaseHtml).not.toContain('Concluir & Medalha');
      if (phase !== 'ended') {
        expect(tabletPhaseHtml).toContain('Encerrar Missão');
      }

      if (checkRightWall) {
        const wallPhaseHtml = renderToStaticMarkup(
          <ExperienceProvider initialMissionPhase={phase}>
            <RightWallScene
              renderContext="simulator"
              surfaceId="rightWall"
              widthCm={400}
              heightCm={300}
              aspectRatio={4 / 3}
            />
          </ExperienceProvider>
        );
        expect(wallPhaseHtml).toContain(expectedLabel);
        expect(wallPhaseHtml).toContain('border-b-[4px]');
      }
    }

    const globeBtnHtml = renderToStaticMarkup(
      <MissionGameButton label="Escolher País" icon={Globe2} interactive={false} />
    );
    const resetBtnHtml = renderToStaticMarkup(
      <MissionGameButton label="Nova Missão" icon={RotateCcw} interactive={false} />
    );
    expect(globeBtnHtml).toContain('Escolher País');
    expect(resetBtnHtml).toContain('Nova Missão');
  });

  it('mantém Quadro 6 (exploring-0) no Tablet e na Parede Direita e inicia Estúdio em silêncio total', () => {
    expect(resolveActiveMissionFrameId('exploring', 0)).toBe('exploring-0');
    const frame0Prompts = resolveFramePrompts('exploring-0', {
      lang: 'pt',
      countryName: 'Brasil',
      activeLayerLabel: 'Raios ISS',
      bpm: 90,
      keyRoot: 'C',
      keyRootPt: 'Dó',
      activeChord: 'Cm7',
      windMeanSpeed: 5.2,
    });
    expect(frame0Prompts.phrases.length).toBeGreaterThan(0);
    expect(frame0Prompts.spoken.length).toBeGreaterThan(0);

    const wallFrame6Html = renderToStaticMarkup(
      <ExperienceProvider initialMissionPhase="exploring" initialStoryStep={0}>
        <RightWallScene
          renderContext="simulator"
          surfaceId="rightWall"
          widthCm={400}
          heightCm={300}
          aspectRatio={4 / 3}
        />
      </ExperienceProvider>
    );
    expect(wallFrame6Html).toContain('MINEIRØ · ESCOLHA SEU DESTINO');
    expect(wallFrame6Html).not.toContain('data-testid="jukebox-studio-stage"');

    const tabletFrame6Html = renderToStaticMarkup(
      <ExperienceProvider initialMissionPhase="exploring" initialStoryStep={0}>
        <TabletControllerView />
      </ExperienceProvider>
    );
    expect(tabletFrame6Html).toContain('Escolher País');
    expect(tabletFrame6Html).toContain('Sugestões para explorar');
    expect(tabletFrame6Html).toContain('Gire o globo, pesquise pelo nome ou escolha um destaque para começar.');
    expect(tabletFrame6Html).not.toContain('Pacotes reais NASA pré-gerados');
    expect(tabletFrame6Html).not.toContain('data-testid="tablet-switch-country-btn"');

    const wallStudioSilentHtml = renderToStaticMarkup(
      <ExperienceProvider initialMissionPhase="exploring" initialStoryStep={1}>
        <RightWallScene
          renderContext="simulator"
          surfaceId="rightWall"
          widthCm={400}
          heightCm={300}
          aspectRatio={4 / 3}
        />
      </ExperienceProvider>
    );
    expect(wallStudioSilentHtml).toContain('data-testid="jukebox-studio-stage"');
    expect(wallStudioSilentHtml).not.toContain('MINEIRØ · ESCOLHA SEU DESTINO');

    const tabletStudioSilentHtml = renderToStaticMarkup(
      <ExperienceProvider initialMissionPhase="exploring" initialStoryStep={1}>
        <TabletControllerView />
      </ExperienceProvider>
    );
    expect(tabletStudioSilentHtml).toContain('data-testid="tablet-switch-country-btn"');
    expect(tabletStudioSilentHtml).toContain('Ir para outro país');
    expect(tabletStudioSilentHtml).toContain('data-testid="tablet-mixer-silence-banner"');
  });
});
