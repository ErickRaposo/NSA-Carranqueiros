import { Lang, MissionPhase } from './types';

export type MissionFrameId =
  | 'idle'
  | 'briefing'
  | 'boarding'
  | 'countdown'
  | 'zero_g'
  | 'exploring-0'
  | 'exploring-1'
  | 'exploring-2'
  | 'exploring-3'
  | 'ended';

export interface MissionFrameSpec {
  id: MissionFrameId;
  order: number;
  phase: MissionPhase;
  storyStep?: number;
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
    leftWallPt: 'Globo inteiro girando no espaço #000000',
    leftWallEn: 'Full Earth globe rotating in #000000 space',
    rightWallPt: 'Robô MINEIRØ em espera (sem balão de fala)',
    rightWallEn: 'MINEIRØ robot waiting (no speech bubble)',
    ceilingPt: 'Arco do Globo + 12 bandeiras flutuando',
    ceilingEn: 'Globe rim + 12 floating country flags',
  },
  {
    id: 'briefing',
    order: 2,
    phase: 'briefing',
    autoDurationMs: 6500,
    titlePt: '2. Boas-vindas (Briefing)',
    titleEn: '2. Welcome (Briefing)',
    leftWallPt: 'Globo espacial aguardando embarque',
    leftWallEn: 'Space globe awaiting boarding',
    rightWallPt: 'MINEIRØ apresenta a missão e chama para embarcar',
    rightWallEn: 'MINEIRØ introduces mission and invites boarding',
    ceilingPt: 'Céu estrelado aberto (#000000 livre)',
    ceilingEn: 'Open starry sky (#000000 free)',
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
    titlePt: '4. Contagem (5..1)',
    titleEn: '4. Countdown (5..1)',
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
    titlePt: '5. Gravidade Zero (4s)',
    titleEn: '5. Zero-G (4s)',
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
    rightWallPt: 'MINEIRØ pede para escolher um país no tablet/teto',
    rightWallEn: 'MINEIRØ asks to pick a country on tablet/ceiling',
    ceilingPt: '12 bandeiras flutuantes interativas',
    ceilingEn: '12 interactive floating flags',
  },
  {
    id: 'exploring-1',
    order: 7,
    phase: 'exploring',
    storyStep: 1,
    requiresCountry: true,
    autoDurationMs: 5500,
    titlePt: '7. Exploração · Destaque 2D',
    titleEn: '7. Exploring · 2D Highlight',
    leftWallPt: 'Globo morphing para 2D com destaque máximo no país',
    leftWallEn: 'Globe morphs to 2D with maximum country highlight',
    rightWallPt: 'MINEIRØ explica o país e a 1ª camada ativa',
    rightWallEn: 'MINEIRØ explains country and active layer',
    ceilingPt: 'Card cultural com foto referenciada + céu vivo',
    ceilingEn: 'Referenced cultural photo card + live sky',
  },
  {
    id: 'exploring-2',
    order: 8,
    phase: 'exploring',
    storyStep: 2,
    requiresCountry: true,
    autoDurationMs: 5500,
    titlePt: '8. Exploração · Harmonia',
    titleEn: '8. Exploring · Harmony',
    leftWallPt: 'País em destaque máximo 2D + camadas climáticas',
    leftWallEn: 'Country in 2D max highlight + climate layers',
    rightWallPt: 'MINEIRØ lê BPM, tom musical e acorde ao vivo',
    rightWallEn: 'MINEIRØ reads live BPM, key and chord',
    ceilingPt: 'Card cultural + ações climáticas no céu',
    ceilingEn: 'Cultural card + climate sky effects',
  },
  {
    id: 'exploring-3',
    order: 9,
    phase: 'exploring',
    storyStep: 3,
    requiresCountry: true,
    autoDurationMs: 5500,
    titlePt: '9. Exploração · Vento',
    titleEn: '9. Exploring · Wind',
    leftWallPt: 'País em destaque 2D até trocar para outro país',
    leftWallEn: 'Country stays in 2D highlight until swapped',
    rightWallPt: 'MINEIRØ lê vento (m/s) e convida a trocar de país',
    rightWallEn: 'MINEIRØ reads wind (m/s) and invites next country',
    ceilingPt: 'Card cultural + fluxo de vento no céu',
    ceilingEn: 'Cultural card + sky wind streaks',
  },
  {
    id: 'ended',
    order: 10,
    phase: 'ended',
    autoDurationMs: 10000,
    titlePt: '10. Missão Cumprida',
    titleEn: '10. Mission Ended',
    leftWallPt: 'Nave descendo pela vigia -> pouso -> Globo final',
    leftWallEn: 'Ship descending in porthole -> landing -> final Globe',
    rightWallPt: 'Descida -> Tranco + Medalha -> Logo MINEIRØ + Developed by',
    rightWallEn: 'Descent -> Landing thud + Medal -> MINEIRØ Logo + Credits',
    ceilingPt: 'Escotilha fechada na descida -> abre p/ céu e bandeiras',
    ceilingEn: 'Hatch closed on descent -> opens to sky and flags',
  },
];

export function resolveActiveMissionFrameId(
  phase: MissionPhase,
  storyStep: number
): MissionFrameId {
  if (phase === 'exploring') {
    const step = ((storyStep % 4) + 4) % 4;
    if (step === 1) return 'exploring-1';
    if (step === 2) return 'exploring-2';
    if (step === 3) return 'exploring-3';
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
            phrases: ['(Modo espera: Robô MINEIRØ em repouso, sem balão de fala ativo)'],
            spoken: '',
          }
        : {
            phrases: ['(Idle standby: MINEIRØ robot resting, no active speech bubble)'],
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
              'Escolha qualquer país no tablet!',
              'Se tiver dúvida, olhe para o teto e escolha um!',
            ],
            spoken: 'Escolha um país no tablet, ou olhe para o teto e escolha um!',
          }
        : {
            phrases: [
              'Choose any country on the tablet!',
              'If unsure, look up at the ceiling and pick one!',
            ],
            spoken: 'Choose any country on the tablet, or look up at the ceiling!',
          };

    case 'exploring-1':
      return isPt
        ? {
            phrases: [
              `Perfeito! Você escolheu ${ctx.countryName}.`,
              `Ative uma camada no tablet, como ${ctx.activeLayerLabel}...`,
              'Cada dado da NASA vira música e acende no teto!',
            ],
            spoken: `Perfeito! Você escolheu ${ctx.countryName}. Ative uma camada no tablet para ouvir os dados da NASA virarem música.`,
          }
        : {
            phrases: [
              `Great choice: ${ctx.countryName}!`,
              `Enable a layer on the tablet, like ${ctx.activeLayerLabel}...`,
              'Each NASA dataset becomes music and lights up above!',
            ],
            spoken: `Great choice: ${ctx.countryName}. Enable a layer on the tablet to hear NASA data become music.`,
          };

    case 'exploring-2':
      return isPt
        ? {
            phrases: [
              `${ctx.bpm} BPM em ${ctx.keyRootPt} (${ctx.activeChord}).`,
              'Experimente ligar outra camada por cima...',
              'Os sons vão se harmonizando juntos em tempo real!',
            ],
            spoken: `Agora experimente ativar outra camada por cima para ouvir os sons se harmonizando juntos sobre ${ctx.countryName}.`,
          }
        : {
            phrases: [
              `${ctx.bpm} BPM in ${ctx.keyRoot} (${ctx.activeChord}).`,
              'Try stacking another layer on top...',
              'The sounds harmonize together in real time!',
            ],
            spoken: `Try stacking another layer on top so the sounds harmonize together over ${ctx.countryName}.`,
          };

    case 'exploring-3':
      return isPt
        ? {
            phrases: [
              `Em ${ctx.countryName}, o vento sopra a ${ctx.windMeanSpeed.toFixed(1)} m/s.`,
              'Quer explorar outro lugar? Toque em outro país no tablet!',
            ],
            spoken: `Em ${ctx.countryName}, a atmosfera está soando em ${ctx.bpm} batidas por minuto. Quer explorar outro país?`,
          }
        : {
            phrases: [
              `In ${ctx.countryName}, winds blow at ${ctx.windMeanSpeed.toFixed(1)} m/s.`,
              'Want another region? Tap any country on the tablet!',
            ],
            spoken: `In ${ctx.countryName}, the atmosphere is sounding at ${ctx.bpm} beats per minute. Want to explore another country?`,
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
