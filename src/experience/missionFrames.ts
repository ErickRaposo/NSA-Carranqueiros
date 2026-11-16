import { Lang, MissionPhase, VisualLayerId } from './types';

export type MissionFrameId =
  | 'idle'
  | 'briefing'
  | 'boarding'
  | 'countdown'
  | 'zero_g'
  | 'exploring-0'
  | 'exploring-melody'
  | 'exploring-chords'
  | 'exploring-temperature'
  | 'exploring-bass'
  | 'exploring-wind'
  | 'ended';

export interface MissionFrameSpec {
  id: MissionFrameId;
  order: number;
  phase: MissionPhase;
  storyStep?: number;
  focusLayer?: VisualLayerId;
  requiresCountry?: boolean;
  autoDurationMs: number;
  titlePt: string;
  titleEn: string;
  leftWallPt: string;
  leftWallEn: string;
  rightWallPt: string;
  rightWallEn: string;
  ceilingPt: string;
  ceilingEn: string;
}

export const SHAY_MISSION_FRAMES: ReadonlyArray<MissionFrameSpec> = [
  {
    id: 'idle',
    order: 1,
    phase: 'idle',
    autoDurationMs: 3500,
    titlePt: '1. Repouso / Espera',
    titleEn: '1. Idle / Standby',
    leftWallPt: 'Globo 3D + astros + MINEIRØ/faixas cruzando a quina',
    leftWallEn: '3D Earth globe + cosmos + MINEIRØ/marquees crossing the corner',
    rightWallPt: 'Texto inicial + Sol/astros espalhados + MINEIRØ/faixas em sincronia',
    rightWallEn: 'Welcome prompt + Sun/spread planets + synced MINEIRØ/marquees',
    ceilingPt: 'Céu estrelado profundo + astros espalhados + cometas (sem países)',
    ceilingEn: 'Deep starfield + spread planets + comets (no flags yet)',
  },
  {
    id: 'briefing',
    order: 2,
    phase: 'briefing',
    autoDurationMs: 6500,
    titlePt: '2. Boas-vindas',
    titleEn: '2. Welcome',
    leftWallPt: 'Globo espacial aguardando embarque',
    leftWallEn: 'Space globe awaiting boarding',
    rightWallPt: 'MINEIRØ 3D gigante em conversa + balão grande + ondas de voz',
    rightWallEn: 'Giant 3D MINEIRØ welcoming visitor w/ large speech panel',
    ceilingPt: 'Céu estrelado aberto · #000000 livre',
    ceilingEn: 'Open starry sky · #000000 free',
  },
  {
    id: 'boarding',
    order: 3,
    phase: 'boarding',
    autoDurationMs: 5500,
    titlePt: '3. Embarque na Nave',
    titleEn: '3. Boarding Ship',
    leftWallPt: 'Vigia circular olhando a torre de lançamento',
    leftWallEn: 'Circular porthole viewing the launch pad',
    rightWallPt: 'Comportas blindadas fechando + fumaça',
    rightWallEn: 'Armored blast doors closing + smoke',
    ceilingPt: 'Topo cônico da nave em metal escovado',
    ceilingEn: 'Brushed-metal rocket nosecone overhead',
  },
  {
    id: 'countdown',
    order: 4,
    phase: 'countdown',
    autoDurationMs: 6000,
    titlePt: '4. Contagem 5..1',
    titleEn: '4. Countdown 5..1',
    leftWallPt: 'Vibração da nave pela vigia circular',
    leftWallEn: 'Rocket vibration through porthole',
    rightWallPt: 'Contagem regressiva 5..4..3..2..1 + motores',
    rightWallEn: 'Countdown 5..4..3..2..1 + propulsion thrust',
    ceilingPt: 'Escotilha cônica vibrando na ignição',
    ceilingEn: 'Overhead hatch shaking at ignition',
  },
  {
    id: 'zero_g',
    order: 5,
    phase: 'zero_g',
    autoDurationMs: 5500,
    titlePt: '5. Gravidade Zero · 4s',
    titleEn: '5. Zero-G · 4s',
    leftWallPt: 'Globo focado com marcações + portas abrindo devagar',
    leftWallEn: 'Focused globe with borders + doors pulling open',
    rightWallPt: 'Portas abrindo devagar + fumaça + Robô no círculo azul',
    rightWallEn: 'Blast doors pulling open + smoke + Robot in blue halo',
    ceilingPt: 'Teto abrindo para cima + chuva de meteoros',
    ceilingEn: 'Ceiling hatch opening upward + meteor shower',
  },
  {
    id: 'exploring-0',
    order: 6,
    phase: 'exploring',
    storyStep: 0,
    autoDurationMs: 5000,
    titlePt: '6. Exploração · Escolha',
    titleEn: '6. Exploring · Pick',
    leftWallPt: 'Globo inteiro girando para escolha de país',
    leftWallEn: 'Full globe rotating for country selection',
    rightWallPt: 'MINEIRØ 3D no espaço convida a girar o Globo no tablet ou olhar as bandeiras no teto',
    rightWallEn: 'Large 3D MINEIRØ invites visitor to spin the Globe on tablet or look at ceiling flags',
    ceilingPt: '19 bandeiras em órbita interativas',
    ceilingEn: '19 interactive orbiting flags',
  },
  {
    id: 'exploring-melody',
    order: 7,
    phase: 'exploring',
    storyStep: 1,
    focusLayer: 'melody',
    requiresCountry: true,
    autoDurationMs: 5500,
    titlePt: '7. Camada · Melodia · Raios',
    titleEn: '7. Layer · Melody · Lightning',
    leftWallPt: 'País em destaque 2D + flashes de raios ISS-LIS',
    leftWallEn: 'Country in 2D highlight + ISS-LIS lightning flashes',
    rightWallPt: 'Estúdio entra em silêncio até ativar camadas; Melodia transforma raios em notas',
    rightWallEn: 'Studio enters in silence until layers are enabled; Melody turns lightning into notes',
    ceilingPt: 'Card oficial NASA por camada + flashes dourados no céu',
    ceilingEn: 'Official NASA layer card + golden lightning flashes overhead',
  },
  {
    id: 'exploring-chords',
    order: 8,
    phase: 'exploring',
    storyStep: 2,
    focusLayer: 'chords',
    requiresCountry: true,
    autoDurationMs: 5500,
    titlePt: '8. Camada · Acordes · CO',
    titleEn: '8. Layer · Chords · CO',
    leftWallPt: 'País em destaque 2D + pluma de Monóxido de Carbono',
    leftWallEn: 'Country in 2D highlight + Carbon Monoxide plume',
    rightWallPt: 'MINEIRØ comenta a harmonia guiada pelo CO',
    rightWallEn: 'MINEIRØ explains harmony shaped by CO',
    ceilingPt: 'Card oficial NASA por camada + anéis harmônicos pulsando no BPM',
    ceilingEn: 'Official NASA layer card + harmonic rings pulsing to BPM',
  },
  {
    id: 'exploring-temperature',
    order: 9,
    phase: 'exploring',
    storyStep: 3,
    focusLayer: 'temperature',
    requiresCountry: true,
    autoDurationMs: 5500,
    titlePt: '9. Camada · Temperatura',
    titleEn: '9. Layer · Temperature',
    leftWallPt: 'País em destaque 2D + camada térmica GEOS-FP',
    leftWallEn: 'Country in 2D highlight + GEOS-FP thermal layer',
    rightWallPt: 'MINEIRØ comenta o calor aquecendo o timbre',
    rightWallEn: 'MINEIRØ explains surface heat warming the timbre',
    ceilingPt: 'Card oficial NASA por camada + aura térmica pulsante no céu',
    ceilingEn: 'Official NASA layer card + pulsing thermal sky glow',
  },
  {
    id: 'exploring-bass',
    order: 10,
    phase: 'exploring',
    storyStep: 4,
    focusLayer: 'bass',
    requiresCountry: true,
    autoDurationMs: 5500,
    titlePt: '10. Camada · Base & Chuva · NO₂',
    titleEn: '10. Layer · Bass & Rain · NO₂',
    leftWallPt: 'País em destaque 2D + concentração urbana de NO₂',
    leftWallEn: 'Country in 2D highlight + urban NO₂ density',
    rightWallPt: 'MINEIRØ comenta o pulso grave e chuva espacial',
    rightWallEn: 'MINEIRØ explains deep bass pulse and sky rain',
    ceilingPt: 'Card oficial NASA por camada + feixes verticais de chuva/NO₂',
    ceilingEn: 'Official NASA layer card + vertical NO₂/rain streaks overhead',
  },
  {
    id: 'exploring-wind',
    order: 11,
    phase: 'exploring',
    storyStep: 5,
    focusLayer: 'wind',
    requiresCountry: true,
    autoDurationMs: 5500,
    titlePt: '11. Camada · Vento · 8D',
    titleEn: '11. Layer · Wind · 8D',
    leftWallPt: 'País em destaque 2D + vetores de vento 10m',
    leftWallEn: 'Country in 2D highlight + 10m wind vectors',
    rightWallPt: 'MINEIRØ lê vento em m/s girando nas 3 caixas',
    rightWallEn: 'MINEIRØ reads wind in m/s panning across 3 speakers',
    ceilingPt: 'Card oficial NASA por camada + rajadas de vento cruzando o céu',
    ceilingEn: 'Official NASA layer card + wind streams sweeping overhead',
  },
  {
    id: 'ended',
    order: 12,
    phase: 'ended',
    autoDurationMs: 10000,
    titlePt: '12. Missão Cumprida',
    titleEn: '12. Mission Ended',
    leftWallPt: 'Nave descendo pela vigia -> pouso -> Globo final',
    leftWallEn: 'Ship descending in porthole -> landing -> final Globe',
    rightWallPt: 'Descida -> Pouso -> Homenagem + Logo MINEIRØ + Developed by',
    rightWallEn: 'Descent -> Touchdown -> Tribute + MINEIRØ Logo + Credits',
    ceilingPt: 'Escotilha fechada na descida -> abre p/ céu e bandeiras',
    ceilingEn: 'Hatch closed on descent -> opens to sky and flags',
  },
];

export function resolveActiveMissionFrameId(
  phase: MissionPhase,
  storyStep: number
): MissionFrameId {
  if (phase === 'exploring') {
    const step = ((storyStep % 6) + 6) % 6;
    if (step === 1) return 'exploring-melody';
    if (step === 2) return 'exploring-chords';
    if (step === 3) return 'exploring-temperature';
    if (step === 4) return 'exploring-bass';
    if (step === 5) return 'exploring-wind';
    return 'exploring-0';
  }
  return phase;
}

export interface FramePromptContext {
  lang: Lang;
  countryName: string;
  activeLayerLabel: string;
  bpm: number;
  keyRoot: string;
  keyRootPt: string;
  activeChord: string;
  windMeanSpeed: number;
}

/**
 * Espelho fiel de leitura das falas reais definidas em `RightWallScene.tsx`,
 * permitindo inspecionar e testar o TTS no Admin sem alterar o código da Shay.
 */
export function resolveFramePrompts(
  frameId: MissionFrameId,
  ctx: FramePromptContext
): { phrases: string[]; spoken: string } {
  const isPt = ctx.lang === 'pt';

  switch (frameId) {
    case 'idle':
      return isPt
        ? {
            phrases: ['Modo espera: Robô MINEIRØ em repouso, sem balão de fala ativo'],
            spoken: '',
          }
        : {
            phrases: ['Idle standby: MINEIRØ robot resting, no active speech bubble'],
            spoken: '',
          };

    case 'briefing':
      return isPt
        ? {
            phrases: [
              'Olá! Eu sou o MINEIRØ...',
              'Você vai entrar em uma missão espacial para explorar a Terra!',
              'Vamos embarcar na nave? Toque em Embarcar no tablet!',
            ],
            spoken:
              'Olá! Eu sou o MINEIRØ. Você vai entrar em uma missão espacial para explorar a Terra! Venha embarcar na nave pelo tablet!',
          }
        : {
            phrases: [
              "Hello! I'm MINEIRØ...",
              'You are about to enter a space mission to explore Earth!',
              'Ready to board the spacecraft? Tap Board Ship on the tablet!',
            ],
            spoken:
              "Hello! I'm MINEIRØ. You are about to enter a space mission to explore Earth! Tap Board Ship on the tablet!",
          };

    case 'boarding':
      return isPt
        ? {
            phrases: [
              'Portas blindadas fechando...',
              'Estamos dentro da nave! Olhe o campo de lançamento à esquerda.',
              'Autorize a decolagem no tablet!',
            ],
            spoken:
              'Portas blindadas fechando! Estamos dentro da nave. Olhe o campo de lançamento à sua esquerda e autorize a decolagem no tablet!',
          }
        : {
            phrases: [
              'Blast doors sealing...',
              'We are inside the ship! Check the launch field on your left.',
              'Authorize liftoff on the tablet!',
            ],
            spoken:
              'Blast doors sealing! We are inside the ship. Look at the launch field on your left and authorize liftoff on the tablet!',
          };

    case 'countdown':
      return isPt
        ? {
            phrases: ['Contagem regressiva ativada!', 'Motores de propulsão no máximo!'],
            spoken: 'Cinco, quatro, três, dois, um! Motores de propulsão!',
          }
        : {
            phrases: ['Countdown initiated!', 'Propulsion engines at full thrust!'],
            spoken: 'Five, four, three, two, one! Main engine ignition!',
          };

    case 'zero_g':
      return isPt
        ? {
            phrases: [
              'Chegamos em gravidade zero! Olhe para cima...',
              'Nossa missão é explorar a Terra de longe.',
              'Olhe para o lado esquerdo e comande tudo pelo tablet!',
            ],
            spoken:
              'Chegamos em gravidade zero! Veja o espaço se abrindo acima de você. Nossa missão é explorar a Terra de longe. Agora olhe para o lado esquerdo e comande tudo pelo tablet!',
          }
        : {
            phrases: [
              'We reached zero gravity! Look above you...',
              'Our mission is to explore Earth from afar.',
              'Look to your left and command everything from the tablet!',
            ],
            spoken:
              'We reached zero gravity! Watch open space unfold above you. Our mission is to explore Earth from afar. Now look to your left and command everything from the tablet!',
          };

    case 'exploring-0':
      return isPt
        ? {
            phrases: [
              'Gire o Globo no tablet para escolher um país!',
              'Se preferir, olhe para as bandeiras orbitando no teto acima.',
            ],
            spoken:
              'Gire o Globo no tablet para escolher um país, ou olhe para as bandeiras orbitando no teto!',
          }
        : {
            phrases: [
              'Spin the Globe on the tablet to choose a country!',
              'Or look up at the flags orbiting on the ceiling above.',
            ],
            spoken:
              'Spin the Globe on the tablet to choose a country, or look up at the flags orbiting on the ceiling!',
          };

    case 'exploring-melody':
      return isPt
        ? {
            phrases: [
              `Raios ISS-LIS sobre ${ctx.countryName}!`,
              'Cada relâmpago vira uma nota melódica e um flash no teto.',
              'Experimente combinar outra camada da NASA por cima!',
            ],
            spoken: `Camada de Melodia ativa sobre ${ctx.countryName}. Os raios captados pela Estação Espacial estão virando notas musicais e flashes no teto!`,
          }
        : {
            phrases: [
              `ISS-LIS Lightning over ${ctx.countryName}!`,
              'Every flash becomes a melodic note and lights up the ceiling.',
              'Try stacking another NASA layer on top!',
            ],
            spoken: `Melody layer active over ${ctx.countryName}. Lightning flashes captured from the Space Station are turning into musical notes above you!`,
          };

    case 'exploring-chords':
      return isPt
        ? {
            phrases: [
              `Monóxido de Carbono em ${ctx.countryName} · ${ctx.activeChord}.`,
              'A pluma atmosférica molda os acordes em tempo real!',
              'Veja os anéis harmônicos pulsando no teto.',
            ],
            spoken: `Camada de Acordes ativa sobre ${ctx.countryName}. A concentração de monóxido de carbono está moldando a harmonia em ${ctx.activeChord}!`,
          }
        : {
            phrases: [
              `Carbon Monoxide over ${ctx.countryName} · ${ctx.activeChord}.`,
              'Atmospheric plumes shape the chords in real time!',
              'Watch the harmonic rings pulsing overhead.',
            ],
            spoken: `Chords layer active over ${ctx.countryName}. Carbon monoxide levels are shaping the harmony in ${ctx.activeChord}!`,
          };

    case 'exploring-temperature':
      return isPt
        ? {
            phrases: [
              `Temperatura na superfície de ${ctx.countryName}!`,
              'O calor observado pela NASA aquece o timbre e o brilho do globo.',
              `Agora soando em ${ctx.keyRootPt} a ${ctx.bpm} BPM.`,
            ],
            spoken: `Camada de Temperatura ativa sobre ${ctx.countryName}. Os dados térmicos da NASA estão aquecendo o timbre e o brilho do planeta!`,
          }
        : {
            phrases: [
              `Surface temperature over ${ctx.countryName}!`,
              'NASA thermal data warms the synth timbre and planet glow.',
              `Now sounding in ${ctx.keyRoot} at ${ctx.bpm} BPM.`,
            ],
            spoken: `Temperature layer active over ${ctx.countryName}. NASA thermal observations are warming the timbre and planet glow!`,
          };

    case 'exploring-bass':
      return isPt
        ? {
            phrases: [
              `Dióxido de Nitrogênio em ${ctx.countryName}!`,
              'As emissões urbanas viram pulso grave e gotículas no teto.',
              'Sinta o peso espacial vibrando nas caixas!',
            ],
            spoken: `Camada de Base e Chuva ativa sobre ${ctx.countryName}. Os níveis de dióxido de nitrogênio estão guiando o pulso grave no quarto!`,
          }
        : {
            phrases: [
              `Nitrogen Dioxide over ${ctx.countryName}!`,
              'Urban emissions become deep bass pulses and rain streaks above.',
              'Feel the spatial weight across the speakers!',
            ],
            spoken: `Bass and Rain layer active over ${ctx.countryName}. Nitrogen dioxide levels are driving the deep spatial pulse across the room!`,
          };

    case 'exploring-wind':
      return isPt
        ? {
            phrases: [
              `Ventos a ${ctx.windMeanSpeed.toFixed(1)} m/s em ${ctx.countryName}!`,
              'As rajadas da NASA giram o som em 8D pelas 3 caixas.',
              'Olhe as correntes de vento cruzando o céu acima!',
            ],
            spoken: `Camada de Vento ativa sobre ${ctx.countryName}, soprando a ${ctx.windMeanSpeed.toFixed(1)} metros por segundo nas três caixas do quarto!`,
          }
        : {
            phrases: [
              `Winds at ${ctx.windMeanSpeed.toFixed(1)} m/s over ${ctx.countryName}!`,
              'NASA wind gusts pan 8D audio across all 3 room speakers.',
              'Watch the wind streams sweeping across the ceiling!',
            ],
            spoken: `Wind layer active over ${ctx.countryName}, blowing at ${ctx.windMeanSpeed.toFixed(1)} meters per second across the room speakers!`,
          };

    case 'ended':
      return isPt
        ? {
            phrases: [
              'Missão cumprida!',
              'Seus trabalhos foram muito relevantes para ouvir a Terra.',
              'Obrigado pelos seus serviços, astronauta!',
            ],
            spoken:
              'Missão cumprida! Seus trabalhos foram muito relevantes. Obrigado pelos seus serviços à Expedição Mineira!',
          }
        : {
            phrases: [
              'Mission accomplished!',
              'Your discoveries were vital to hearing our planet.',
              'Thank you for your service, explorer!',
            ],
            spoken:
              'Mission accomplished! Your discoveries were vital. Thank you for your service to the Mineiro Expedition!',
          };
  }
}
