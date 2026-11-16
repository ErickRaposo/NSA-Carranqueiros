import { Globe2, Play, Rocket, RotateCcw } from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MissionGameButton } from '../components/MissionGameButton';
import { NasaDatasetCard } from '../components/NasaDatasetCard';
import { buildCountryNasaReport } from '../datasets/countryNasaReport';
import {
  resolveCountryAssetUrl,
  setRemoteCountryAssetConfig,
} from '../datasets/nasaDatasets';
import { advanceLoopProgress, buildBeatTimeline } from '../experience/cueEngine';
import { DEFAULT_LAYERS_STATE, ExperienceProvider } from '../experience/ExperienceContext';
import { resolveActiveMissionFrameId, resolveFramePrompts } from '../experience/missionFrames';
import {
  GENERATED_COUNTRY_IDS,
  STUDIO_SAVED_GAINS,
  VISUAL_LAYER_ORDER,
} from '../experience/types';
import { buildGlobeLayerStack } from '../hooks/useNasaVideoPool';
import { CeilingScene } from '../scenes/CeilingScene';
import { IdleStageRightWall } from '../scenes/IdleStageRightWall';
import { JukeboxStudioStage } from '../scenes/JukeboxStudioStage';
import { LeftWallScene } from '../scenes/LeftWallScene';
import { RightWallScene } from '../scenes/RightWallScene';
import {
  computeCountryPngFrameMetrics,
  midiToNoteName,
  projectBboxNormToCountryPng01,
} from '../scenes/studioGeometry';
import {
  CONSOLE_HAPTIC_PATTERNS,
  stopConsoleHaptic,
  triggerConsoleHaptic,
} from '../utils/haptics';
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
      remoteIds?: string[];
      localCount?: number;
      remoteCount?: number;
      totalCount?: number;
      excludedIds?: string[];
      count: number;
    };

    expect(indexJson.count).toBe(100);
    expect(indexJson.generatedIds).toHaveLength(100);
    expect(indexJson.remoteIds).toHaveLength(142);
    expect(indexJson.totalCount).toBe(242);
    expect(indexJson.generatedIds).not.toContain('156');
    expect(indexJson.remoteIds).not.toContain('156');
    expect(indexJson.excludedIds).toContain('156');
    for (const cid of GENERATED_COUNTRY_IDS) {
      expect(indexJson.generatedIds).toContain(cid);

      const dirUrl = new URL(`../../public/countries/${cid}/`, import.meta.url);
      expect(fs.existsSync(dirUrl)).toBe(true);

      // 5 1024x1024 PNGs + 5 NASA Video Sprite Sheets 96f (12x8)
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

    // Loop C2–C3 ([1, 2] -> range [0.125, 0.375) in an 8-bar loop)
    const wrapped = advanceLoopProgress(0.37, 0.5, 16, null, 8, [1, 2]);
    expect(wrapped).toBeGreaterThanOrEqual(0.125);
    expect(wrapped).toBeLessThan(0.375);

    // If playhead is outside barLoop (e.g., C1 = 0.02), jump immediately to the start of the range
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

    const tabletEnDefaultHtml = renderToStaticMarkup(
      <ExperienceProvider>
        <TabletControllerView />
      </ExperienceProvider>
    );
    expect(tabletEnDefaultHtml).toContain('Voice: ON');
    expect(tabletEnDefaultHtml).toContain('Open Jukebox Studio Directly');
    expect(tabletEnDefaultHtml).toContain('EN · US');

    const tabletHtml = renderToStaticMarkup(
      <ExperienceProvider initialLang="pt">
        <TabletControllerView />
      </ExperienceProvider>
    );
    expect(tabletHtml).toContain('data-testid="tablet-controller-view"');
    expect(tabletHtml).toContain('data-testid="tablet-voice-toggle"');
    expect(tabletHtml).toContain('Voz: ON');
    expect(tabletHtml).toContain('Abrir Jukebox Studio Direto');

    const demoHtml = renderToStaticMarkup(
      <ExperienceProvider routeView="demo" initialLang="pt">
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
        <ExperienceProvider initialLang="pt" initialMissionPhase={phase}>
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
          <ExperienceProvider initialLang="pt" initialMissionPhase={phase}>
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
      <ExperienceProvider initialLang="pt" initialMissionPhase="exploring" initialStoryStep={0}>
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
      <ExperienceProvider initialLang="pt" initialMissionPhase="exploring" initialStoryStep={0}>
        <TabletControllerView />
      </ExperienceProvider>
    );
    expect(tabletFrame6Html).toContain('Escolher País');
    expect(tabletFrame6Html).toContain('Sugestões para explorar');
    expect(tabletFrame6Html).toContain('Gire o globo para mirar na parede, pesquise pelo nome ou escolha um destaque.');
    expect(tabletFrame6Html).toContain('@[740px]:grid-cols-[1.15fr_1fr]');
    expect(tabletFrame6Html).not.toContain('Pacotes reais NASA pré-gerados');
    expect(tabletFrame6Html).not.toContain('data-testid="tablet-switch-country-btn"');

    const wallStudioSilentHtml = renderToStaticMarkup(
      <ExperienceProvider initialLang="pt" initialMissionPhase="exploring" initialStoryStep={1}>
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
      <ExperienceProvider initialLang="pt" initialMissionPhase="exploring" initialStoryStep={1}>
        <TabletControllerView />
      </ExperienceProvider>
    );
    expect(tabletStudioSilentHtml).toContain('data-testid="tablet-switch-country-btn"');
    expect(tabletStudioSilentHtml).toContain('Ir para outro país');
    expect(tabletStudioSilentHtml).toContain('data-testid="tablet-mixer-silence-banner"');
    expect(tabletStudioSilentHtml).toContain('@[740px]:grid-cols-5');
    expect(tabletStudioSilentHtml).toContain('data-testid="tablet-layer-pad-melody"');
    expect(tabletStudioSilentHtml).toContain('data-testid="tablet-layer-adjust-melody"');
    expect(tabletStudioSilentHtml).toContain('data-testid="tablet-pad-sparkle-toggle"');
  });

  it('posiciona botão discreto no canto inferior da Parede Direita e ativa Globo na Parede Esquerda no Quadro 6', () => {
    const wallBriefingHtml = renderToStaticMarkup(
      <ExperienceProvider initialMissionPhase="briefing">
        <RightWallScene
          renderContext="simulator"
          surfaceId="rightWall"
          widthCm={400}
          heightCm={300}
          aspectRatio={4 / 3}
        />
      </ExperienceProvider>
    );
    expect(wallBriefingHtml).toContain('right-8 bottom-6');
    expect(wallBriefingHtml).toContain('scale-[0.88] opacity-70');

    const leftWallPickingHtml = renderToStaticMarkup(
      <ExperienceProvider initialMissionPhase="exploring" initialStoryStep={0}>
        <LeftWallScene
          renderContext="simulator"
          surfaceId="leftWall"
          widthCm={400}
          heightCm={300}
          aspectRatio={4 / 3}
        />
      </ExperienceProvider>
    );
    expect(leftWallPickingHtml).toContain('data-globe-mirror="true"');
    expect(leftWallPickingHtml).toContain('data-view-mode="3d"');

    const leftWallFocusedHtml = renderToStaticMarkup(
      <ExperienceProvider initialMissionPhase="exploring" initialStoryStep={1}>
        <LeftWallScene
          renderContext="simulator"
          surfaceId="leftWall"
          widthCm={400}
          heightCm={300}
          aspectRatio={4 / 3}
        />
      </ExperienceProvider>
    );
    expect(leftWallFocusedHtml).toContain('data-globe-mirror="false"');
    expect(leftWallFocusedHtml).toContain('data-view-mode="2d"');
  });

  it('roteia assets híbridos local/Supabase Storage e executa haptic de botões/impactos seguro', () => {
    expect(() => triggerConsoleHaptic(12)).not.toThrow();
    expect(() => triggerConsoleHaptic(CONSOLE_HAPTIC_PATTERNS.launchSequence)).not.toThrow();
    expect(() => stopConsoleHaptic()).not.toThrow();

    // 5 countdown ticks (5..1 every 1100ms) total 5500ms before 8D engine ignition
    const countdownMs = CONSOLE_HAPTIC_PATTERNS.launchSequence
      .slice(0, 10)
      .reduce((acc, val) => acc + val, 0);
    expect(countdownMs).toBe(5500);
    expect(CONSOLE_HAPTIC_PATTERNS.launchSequence.length).toBeGreaterThan(15);

    const calls: Array<number | number[]> = [];
    const originalNav = globalThis.navigator;
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {
        vibrate: (pattern: number | number[]) => {
          calls.push(pattern);
          return true;
        },
      },
    });
    try {
      triggerConsoleHaptic(CONSOLE_HAPTIC_PATTERNS.boardingSlam);
      triggerConsoleHaptic(CONSOLE_HAPTIC_PATTERNS.launchSequence);
      triggerConsoleHaptic(CONSOLE_HAPTIC_PATTERNS.zeroGEject);
      triggerConsoleHaptic(CONSOLE_HAPTIC_PATTERNS.landingThud);
      stopConsoleHaptic();
      expect(calls).toEqual([
        CONSOLE_HAPTIC_PATTERNS.boardingSlam,
        CONSOLE_HAPTIC_PATTERNS.launchSequence,
        CONSOLE_HAPTIC_PATTERNS.zeroGEject,
        CONSOLE_HAPTIC_PATTERNS.landingThud,
        0,
      ]);
    } finally {
      Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        value: originalNav,
      });
    }

    setRemoteCountryAssetConfig(
      'https://proj.supabase.co/storage/v1/object/public/nasa-countries',
      ['840', '276']
    );
    expect(resolveCountryAssetUrl('076', 'meta.json')).toBe('/countries/076/meta.json');
    expect(resolveCountryAssetUrl('840', 'stems/melody.ogg')).toBe(
      'https://proj.supabase.co/storage/v1/object/public/nasa-countries/countries/840/stems/melody.ogg'
    );

    setRemoteCountryAssetConfig('', []);
    expect(resolveCountryAssetUrl('840', 'meta.json')).toBe('/countries/840/meta.json');
  });

  it('substitui informações culturais por telemetria oficial NASA de cada layer no Teto e nos cards', async () => {
    const fs = (await import('node:fs')) as unknown as MinimalNodeFs;
    const decoder = new TextDecoder();
    const brazilMeta = JSON.parse(
      decoder.decode(fs.readFileSync(new URL('../../public/countries/076/meta.json', import.meta.url)))
    );

    const report = buildCountryNasaReport({
      country: {
        id: '076',
        namePt: 'Brasil',
        nameEn: 'Brazil',
        regionPt: 'América do Sul',
        regionEn: 'South America',
        hemispherePt: 'Sul',
        hemisphereEn: 'South',
        lon: -51.9,
        lat: -14.2,
        lonSpan: 41.6,
        latSpan: 39.0,
        idealDistance: 2.2,
        bbox: brazilMeta.bbox,
        isPilot: true,
      },
      telemetrySummary: brazilMeta.telemetrySummary,
      studioData: brazilMeta.studio,
      playback: { bpm: 101, keyRoot: 'Eb', keyRootPt: 'Mi bemol', windMeanSpeed: 2.9 },
      layers: DEFAULT_LAYERS_STATE,
      lang: 'pt',
    });

    expect(report).not.toBeNull();
    expect(report!.alpha2).toBe('BR');
    expect(report!.curiosityText).toContain('891');
    expect(report!.layers).toHaveLength(5);
    expect(report!.byLayerId.melody.metricHeadline).toContain('891 focos elétricos');
    expect(report!.byLayerId.chords.metricHeadline).toContain('CO médio: 64%');
    expect(report!.byLayerId.bass.metricHeadline).toContain('NO₂ médio: 66%');
    expect(report!.byLayerId.wind.metricHeadline).toContain('7.7 m/s');
    expect(report!.byLayerId.temperature.metricHeadline).toContain('76% T2M · 101 BPM');

    const ceilingExploringHtml = renderToStaticMarkup(
      <ExperienceProvider initialLang="pt" initialMissionPhase="exploring" initialStoryStep={1}>
        <CeilingScene
          renderContext="simulator"
          surfaceId="ceiling"
          widthCm={400}
          heightCm={400}
          aspectRatio={1}
        />
      </ExperienceProvider>
    );
    expect(ceilingExploringHtml).toContain('data-testid="ceiling-country-nasa-card"');
    expect(ceilingExploringHtml).toContain('data-testid="ceiling-card-flag"');
    expect(ceilingExploringHtml).toContain('h-[152px] w-full');
    expect(ceilingExploringHtml).toContain('Curiosidades da Órbita');
    expect(ceilingExploringHtml).toContain('#facc15');
    expect(ceilingExploringHtml).toContain('#fb7185');
    expect(ceilingExploringHtml).toContain('SVS 5011');
    expect(ceilingExploringHtml).toContain('SVS 5147');
    expect(ceilingExploringHtml).not.toContain('Cristo Redentor');
    expect(ceilingExploringHtml).not.toContain('fi-cn');

    const tabletHtml = renderToStaticMarkup(
      <ExperienceProvider initialLang="pt" initialMissionPhase="exploring" initialStoryStep={1}>
        <TabletControllerView />
      </ExperienceProvider>
    );
    expect(tabletHtml).toContain('data-testid="tablet-nasa-report-btn"');
    expect(tabletHtml).toContain('Curiosidades NASA');

    const datasetCardHtml = renderToStaticMarkup(
      <NasaDatasetCard
        open={true}
        datasetId="svs5011"
        enabledDatasetIds={['svs5011']}
        lang="pt"
        countryName={report!.countryName}
        countryCoordinates={report!.coordinatesLabel}
        countryLayerMetric={report!.byDatasetId.svs5011}
        onSelectDataset={() => {}}
        onCloseOnce={() => {}}
      />
    );
    expect(datasetCardHtml).toContain('data-testid="nasa-card-country-reading"');
    expect(datasetCardHtml).toContain('891 focos elétricos');
  });
});
