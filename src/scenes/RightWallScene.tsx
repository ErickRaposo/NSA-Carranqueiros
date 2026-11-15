import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Award } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import mineiroLogo from '../assets/mineiro-logo.png';
import erickPhoto from '../assets/team/erick.jpeg';
import samuelPhoto from '../assets/team/samuel.png';
import shayenePhoto from '../assets/team/shayene.png';
import { preloadPiperVoice, speakText, stopSpeech } from '../accessibility/a11yEngine';
import {
  playBlastDoorSlamSfx,
  playCabinDissolveSfx,
  playHatchEjectSfx,
  playLandingThudSfx,
  setSpaceAmbientDucked,
} from '../audio/spaceAmbient';
import { setSpatialMusicDucked } from '../audio/spatialAudioEngine';
import { Mineiro3D } from '../components/Mineiro3D';
import { useExperience } from '../experience/ExperienceContext';
import {
  LAYER_METAS,
  SceneSurfaceProps,
  VISUAL_LAYER_ORDER,
  VisualLayerId,
} from '../experience/types';
import { SpaceStarfield } from './SpaceStarfield';
import { SpaceshipLaunchOverlay } from './SpaceshipLaunchOverlay';

const TEAM_CREDITS_ALPHABETICAL = [
  { name: 'Erick Raposo', photo: erickPhoto },
  { name: 'Samuel Amorim', photo: samuelPhoto },
  { name: 'Shayene Figueredo', photo: shayenePhoto },
] as const;

/**
 * Superfície Projetada — PAREDE DIREITA (`rightWall` · Projetor 1 Canto em L):
 * Conduz toda a jornada sensorial da Expedição Mineira:
 * `idle` -> `boarding` -> `countdown` (5..1) -> `zero_g` -> `exploring` -> `ended` (créditos NASA).
 */
export const RightWallScene: React.FC<SceneSurfaceProps> = ({ renderContext }) => {
  const { country, lang, layers, missionPhase, playback, storyStep } = useExperience();
  const isPt = lang === 'pt';
  const countryName = country
    ? isPt
      ? country.namePt
      : country.nameEn
    : isPt
      ? 'a Terra'
      : 'Earth';

  const activeStep = storyStep % 6;
  const stepToLayerId: Partial<Record<number, VisualLayerId>> = {
    1: 'melody',
    2: 'chords',
    3: 'temperature',
    4: 'bass',
    5: 'wind',
  };
  const stepLayerId = stepToLayerId[activeStep] ?? null;
  const enabledLayerIds = VISUAL_LAYER_ORDER.filter((id) => layers[id].enabled);
  const [focusedLayerId, setFocusedLayerId] = useState<VisualLayerId | null>(null);
  const prevLayerEnabledRef = useRef<Record<VisualLayerId, boolean>>({
    melody: layers.melody.enabled,
    chords: layers.chords.enabled,
    temperature: layers.temperature.enabled,
    bass: layers.bass.enabled,
    wind: layers.wind.enabled,
  });

  useEffect(() => {
    const newlyEnabled = VISUAL_LAYER_ORDER.find(
      (id) => layers[id].enabled && !prevLayerEnabledRef.current[id]
    );
    VISUAL_LAYER_ORDER.forEach((id) => {
      prevLayerEnabledRef.current[id] = layers[id].enabled;
    });
    if (newlyEnabled) {
      setFocusedLayerId(newlyEnabled);
    } else if (focusedLayerId && !layers[focusedLayerId].enabled) {
      setFocusedLayerId(enabledLayerIds[0] ?? null);
    }
  }, [enabledLayerIds, focusedLayerId, layers]);

  const activeLayerForSpeech: VisualLayerId | null =
    stepLayerId ??
    (focusedLayerId && layers[focusedLayerId].enabled
      ? focusedLayerId
      : (enabledLayerIds[0] ?? null));
  const activeLayerMeta = LAYER_METAS[activeLayerForSpeech ?? 'melody'];

  const lastSpokenKeyRef = useRef<string>('');
  const [countdownNum, setCountdownNum] = useState<number>(5);
  const [endedStage, setEndedStage] = useState<'reentry' | 'medal' | 'credits'>('reentry');
  const [landingBump, setLandingBump] = useState<boolean>(false);

  // Controle de digitação letra por letra
  const [phraseIdx, setPhraseIdx] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [isErasing, setIsErasing] = useState(false);

  // Sequência automática em 3 etapas da Missão Cumprida (`ended`)
  useEffect(() => {
    if (missionPhase !== 'ended') {
      setEndedStage('reentry');
      setLandingBump(false);
      return;
    }

    setEndedStage('reentry');
    setLandingBump(false);

    const medalTimer = window.setTimeout(() => {
      if (renderContext !== 'projector') {
        playLandingThudSfx();
      }
      setLandingBump(true);
      setEndedStage('medal');
      window.setTimeout(() => setLandingBump(false), 420);
    }, 3200);

    const creditsTimer = window.setTimeout(() => {
      setEndedStage('credits');
    }, 6700);

    return () => {
      window.clearTimeout(medalTimer);
      window.clearTimeout(creditsTimer);
    };
  }, [missionPhase, renderContext]);

  // Contagem regressiva 5, 4, 3, 2, 1 durante a fase `countdown`
  useEffect(() => {
    if (missionPhase !== 'countdown') {
      setCountdownNum(5);
      return;
    }
    setCountdownNum(5);
    const timers: number[] = [];
    [4, 3, 2, 1, 0].forEach((val, i) => {
      timers.push(window.setTimeout(() => setCountdownNum(val), (i + 1) * 1000));
    });
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [missionPhase]);

  const phaseSpeech = useMemo(() => {
    if (missionPhase === 'briefing') {
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
    }

    if (missionPhase === 'boarding') {
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
    }

    if (missionPhase === 'countdown') {
      return isPt
        ? {
            phrases: ['Contagem regressiva ativada!', 'Motores de propulsão no máximo!'],
            spoken: 'Cinco, quatro, três, dois, um! Motores de propulsão!',
          }
        : {
            phrases: ['Countdown initiated!', 'Propulsion engines at full thrust!'],
            spoken: 'Five, four, three, two, one! Main engine ignition!',
          };
    }

    if (missionPhase === 'zero_g') {
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
    }

    if (missionPhase === 'ended') {
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

    // Fase `exploring`: comentário exclusivo por camada ativa (todas as 5 camadas) ou passo guiado
    if (activeLayerForSpeech) {
      const layerComments: Record<
        VisualLayerId,
        { pt: { phrases: string[]; spoken: string }; en: { phrases: string[]; spoken: string } }
      > = {
        melody: {
          pt: {
            phrases: [
              `Raios ISS-LIS sobre ${countryName}!`,
              'Cada relâmpago vira uma nota melódica e um flash no teto.',
              'Experimente combinar outra camada da NASA por cima!',
            ],
            spoken: `Camada de Melodia ativa sobre ${countryName}. Os raios captados pela Estação Espacial estão virando notas musicais e flashes no teto!`,
          },
          en: {
            phrases: [
              `ISS-LIS Lightning over ${countryName}!`,
              'Every flash becomes a melodic note and lights up the ceiling.',
              'Try stacking another NASA layer on top!',
            ],
            spoken: `Melody layer active over ${countryName}. Lightning flashes captured from the Space Station are turning into musical notes above you!`,
          },
        },
        chords: {
          pt: {
            phrases: [
              `Monóxido de Carbono (CO) em ${countryName} (${playback.activeChord}).`,
              'A pluma atmosférica molda os acordes em tempo real!',
              'Veja os anéis harmônicos pulsando no teto.',
            ],
            spoken: `Camada de Acordes ativa sobre ${countryName}. A concentração de monóxido de carbono está moldando a harmonia em ${playback.activeChord}!`,
          },
          en: {
            phrases: [
              `Carbon Monoxide (CO) over ${countryName} (${playback.activeChord}).`,
              'Atmospheric plumes shape the chords in real time!',
              'Watch the harmonic rings pulsing overhead.',
            ],
            spoken: `Chords layer active over ${countryName}. Carbon monoxide levels are shaping the harmony in ${playback.activeChord}!`,
          },
        },
        temperature: {
          pt: {
            phrases: [
              `Temperatura na superfície de ${countryName}!`,
              'O calor observado pela NASA aquece o timbre e o brilho do globo.',
              `Agora soando em ${playback.keyRootPt} a ${playback.bpm} BPM.`,
            ],
            spoken: `Camada de Temperatura ativa sobre ${countryName}. Os dados térmicos da NASA estão aquecendo o timbre e o brilho do planeta!`,
          },
          en: {
            phrases: [
              `Surface temperature over ${countryName}!`,
              'NASA thermal data warms the synth timbre and planet glow.',
              `Now sounding in ${playback.keyRoot} at ${playback.bpm} BPM.`,
            ],
            spoken: `Temperature layer active over ${countryName}. NASA thermal observations are warming the timbre and planet glow!`,
          },
        },
        bass: {
          pt: {
            phrases: [
              `Dióxido de Nitrogênio (NO₂) em ${countryName}!`,
              'As emissões urbanas viram pulso grave e gotículas no teto.',
              'Sinta o peso espacial vibrando nas caixas!',
            ],
            spoken: `Camada de Base e Chuva ativa sobre ${countryName}. Os níveis de dióxido de nitrogênio estão guiando o pulso grave no quarto!`,
          },
          en: {
            phrases: [
              `Nitrogen Dioxide (NO₂) over ${countryName}!`,
              'Urban emissions become deep bass pulses and rain streaks above.',
              'Feel the spatial weight across the speakers!',
            ],
            spoken: `Bass and Rain layer active over ${countryName}. Nitrogen dioxide levels are driving the deep spatial pulse across the room!`,
          },
        },
        wind: {
          pt: {
            phrases: [
              `Ventos a ${playback.windMeanSpeed.toFixed(1)} m/s em ${countryName}!`,
              'As rajadas da NASA giram o som em 8D pelas 3 caixas.',
              'Olhe as correntes de vento cruzando o céu acima!',
            ],
            spoken: `Camada de Vento ativa sobre ${countryName}, soprando a ${playback.windMeanSpeed.toFixed(1)} metros por segundo nas três caixas do quarto!`,
          },
          en: {
            phrases: [
              `Winds at ${playback.windMeanSpeed.toFixed(1)} m/s over ${countryName}!`,
              'NASA wind gusts pan 8D audio across all 3 room speakers.',
              'Watch the wind streams sweeping across the ceiling!',
            ],
            spoken: `Wind layer active over ${countryName}, blowing at ${playback.windMeanSpeed.toFixed(1)} meters per second across the room speakers!`,
          },
        },
      };
      return isPt ? layerComments[activeLayerForSpeech].pt : layerComments[activeLayerForSpeech].en;
    }

    const exploringSteps = isPt
      ? [
          {
            phrases: [
              'Escolha qualquer país no tablet!',
              'Se tiver dúvida, olhe para o teto e escolha um!',
            ],
            spoken: 'Escolha um país no tablet, ou olhe para o teto e escolha um!',
          },
          {
            phrases: [
              `Perfeito! Você escolheu ${countryName}.`,
              `Ative uma camada no tablet, como ${activeLayerMeta.labelPt}...`,
              'Cada dado da NASA vira música e acende no teto!',
            ],
            spoken: `Perfeito! Você escolheu ${countryName}. Ative uma camada no tablet para ouvir os dados da NASA virarem música.`,
          },
          {
            phrases: [
              `${playback.bpm} BPM em ${playback.keyRootPt} (${playback.activeChord}).`,
              'Experimente ligar outra camada por cima...',
              'Os sons vão se harmonizando juntos em tempo real!',
            ],
            spoken: `Agora experimente ativar outra camada por cima para ouvir os sons se harmonizando juntos sobre ${countryName}.`,
          },
          {
            phrases: [
              `Em ${countryName}, o vento sopra a ${playback.windMeanSpeed.toFixed(1)} m/s.`,
              'Quer explorar outro lugar? Toque em outro país no tablet!',
            ],
            spoken: `Em ${countryName}, a atmosfera está soando em ${playback.bpm} batidas por minuto. Quer explorar outro país?`,
          },
        ]
      : [
          {
            phrases: [
              'Choose any country on the tablet!',
              'If unsure, look up at the ceiling and pick one!',
            ],
            spoken: 'Choose any country on the tablet, or look up at the ceiling!',
          },
          {
            phrases: [
              `Great choice: ${countryName}!`,
              `Enable a layer on the tablet, like ${activeLayerMeta.labelEn}...`,
              'Each NASA dataset becomes music and lights up above!',
            ],
            spoken: `Great choice: ${countryName}. Enable a layer on the tablet to hear NASA data become music.`,
          },
          {
            phrases: [
              `${playback.bpm} BPM in ${playback.keyRoot} (${playback.activeChord}).`,
              'Try stacking another layer on top...',
              'The sounds harmonize together in real time!',
            ],
            spoken: `Try stacking another layer on top so the sounds harmonize together over ${countryName}.`,
          },
          {
            phrases: [
              `In ${countryName}, winds blow at ${playback.windMeanSpeed.toFixed(1)} m/s.`,
              'Want another region? Tap any country on the tablet!',
            ],
            spoken: `In ${countryName}, the atmosphere is sounding at ${playback.bpm} beats per minute. Want to explore another country?`,
          },
        ];

    return exploringSteps[activeStep] ?? exploringSteps[0];
  }, [
    activeLayerForSpeech,
    activeLayerMeta.labelEn,
    activeLayerMeta.labelPt,
    activeStep,
    countryName,
    isPt,
    missionPhase,
    playback.activeChord,
    playback.bpm,
    playback.keyRoot,
    playback.keyRootPt,
    playback.windMeanSpeed,
  ]);

  const showTypewriter = missionPhase !== 'idle';

  useEffect(() => {
    setPhraseIdx(0);
    setCharCount(0);
    setIsErasing(false);
  }, [missionPhase, activeStep, activeLayerForSpeech, country?.id, lang]);

  useEffect(() => {
    if (!showTypewriter) return;
    const phrases = phaseSpeech.phrases;
    const activePhrase = phrases[phraseIdx] ?? phrases[0] ?? '';

    if (!isErasing && charCount < activePhrase.length) {
      const t = window.setTimeout(() => setCharCount((c) => c + 1), 34);
      return () => window.clearTimeout(t);
    }

    if (!isErasing && charCount >= activePhrase.length) {
      const holdMs = phraseIdx === phrases.length - 1 ? 3000 : 1200;
      const t = window.setTimeout(() => setIsErasing(true), holdMs);
      return () => window.clearTimeout(t);
    }

    if (isErasing && charCount > 0) {
      const t = window.setTimeout(() => setCharCount((c) => Math.max(0, c - 2)), 18);
      return () => window.clearTimeout(t);
    }

    if (isErasing && charCount === 0) {
      const t = window.setTimeout(() => {
        setIsErasing(false);
        setPhraseIdx((idx) => (idx + 1) % phrases.length);
      }, 180);
      return () => window.clearTimeout(t);
    }
  }, [charCount, isErasing, phaseSpeech.phrases, phraseIdx, showTypewriter]);

  const prevPhaseRef = useRef(missionPhase);

  // Efeitos sonoros mecânicos sincronizados com as comportas, ejeção e dissolução da cabine
  useEffect(() => {
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = missionPhase;
    if (renderContext === 'projector' || prev === missionPhase) return;

    if (missionPhase === 'boarding') {
      playBlastDoorSlamSfx();
    } else if (missionPhase === 'zero_g') {
      playHatchEjectSfx();
    } else if (prev === 'zero_g' && missionPhase === 'exploring') {
      playCabinDissolveSfx();
    }
  }, [missionPhase, renderContext]);

  // Pré-carrega a voz neural Piper do idioma ativo (en_US-bryce-medium / pt_BR-faber-medium)
  useEffect(() => {
    if (renderContext === 'projector') return;
    preloadPiperVoice(lang);
  }, [lang, renderContext]);

  // Fala no idioma selecionado interrompendo imediatamente qualquer fala anterior ao trocar país/camada/fase
  // + abaixa suavemente TODA a música (ambiente espacial e motor 8D dos países) enquanto o robô fala
  useEffect(() => {
    const setAllMusicDucked = (ducked: boolean) => {
      setSpaceAmbientDucked(ducked);
      setSpatialMusicDucked(ducked);
    };

    if (missionPhase === 'idle' || renderContext === 'projector') {
      stopSpeech();
      setAllMusicDucked(false);
      return;
    }
    const key = `${missionPhase}-${activeStep}-${activeLayerForSpeech ?? 'none'}-${country?.id ?? 'none'}-${lang}`;
    if (lastSpokenKeyRef.current === key) return;
    lastSpokenKeyRef.current = key;

    // Corta imediatamente qualquer fala em andamento antes de iniciar a nova
    stopSpeech();
    setAllMusicDucked(false);

    // No briefing inicial, deixa a música espacial tocar antes do robô começar a falar
    const startDelayMs = missionPhase === 'briefing' ? 1400 : 180;
    const timer = window.setTimeout(() => {
      speakText(phaseSpeech.spoken, lang, true, {
        maleVoice: true,
        onStart: () => setAllMusicDucked(true),
        onEnd: () => setAllMusicDucked(false),
      });
    }, startDelayMs);

    return () => {
      window.clearTimeout(timer);
      stopSpeech();
      setAllMusicDucked(false);
    };
  }, [activeLayerForSpeech, activeStep, country?.id, lang, missionPhase, phaseSpeech.spoken, renderContext]);

  const activePhrase = phaseSpeech.phrases[phraseIdx] ?? '';
  const visibleText = activePhrase.slice(0, charCount);

  const robotPositionStyle =
    missionPhase === 'zero_g'
      ? { left: '10%', top: '30%', opacity: 1 }
      : missionPhase === 'ended'
        ? { left: '10%', top: '8%', opacity: 1 }
        : missionPhase === 'countdown'
          ? { left: '10%', top: '58%', opacity: 1 }
          : { left: '12%', top: '36%', opacity: 1 };

  return (
    <section
      className="relative flex h-full w-full overflow-hidden bg-black select-none"
      style={{ backgroundColor: '#000000' }}
      data-surface="rightWall"
      data-render-context={renderContext}
    >
      <SpaceStarfield seedOffset={2} count={64} accentHex={activeLayerMeta.accentHex} />

      {/* Arco sutil na borda esquerda conectando com a Parede Esquerda */}
      <div
        className="pointer-events-none absolute top-1/2 -left-24 h-72 w-48 -translate-y-1/2 rounded-full border border-sky-400/20 opacity-45"
        style={{
          background:
            'radial-gradient(circle at left center, rgba(14, 165, 233, 0.14), transparent 70%)',
        }}
        aria-hidden="true"
      />

      {/* Estado inicial antes de iniciar operação */}
      {missionPhase === 'idle' && (
        <div className="pointer-events-none relative z-20 m-auto max-w-[74%] px-8 text-center">
          <h1
            className="font-bold tracking-[0.04em] text-slate-50 uppercase"
            style={{
              fontFamily: "'Orbitron', 'Poppins', system-ui, sans-serif",
              fontSize: '56px',
              lineHeight: 1.2,
            }}
          >
            {isPt ? 'Vamos começar a sua imersão?' : 'Shall we begin your immersion?'}
          </h1>
        </div>
      )}

      {/* Contagem regressiva durante a decolagem (5, 4, 3, 2, 1) */}
      {missionPhase === 'countdown' && (
        <div className="pointer-events-none relative z-30 mx-auto mt-14 flex flex-col items-center text-center">
          <span className="text-[18px] font-semibold tracking-[0.2em] text-amber-300 uppercase">
            {isPt ? 'Motores de Propulsão' : 'Main Engine Ignition'}
          </span>
          <div
            className="mt-2 font-bold text-slate-50"
            style={{
              fontFamily: "'Orbitron', 'Poppins', sans-serif",
              fontSize: countdownNum > 0 ? '96px' : '54px',
              lineHeight: 1.05,
            }}
          >
            {countdownNum > 0 ? countdownNum : isPt ? 'DECOLAR!' : 'LIFTOFF!'}
          </div>
        </div>
      )}

      {/* Robô MINEIRØ no círculo azul + barra conectada saindo do globo */}
      {missionPhase !== 'idle' && missionPhase !== 'ended' && (
        <div
          className="pointer-events-none absolute z-30 flex items-center transition-all duration-1000 ease-out"
          style={robotPositionStyle}
        >
          <div className="relative z-10 flex h-[120px] w-[120px] shrink-0 items-center justify-center rounded-full border-2 border-sky-400/60 bg-sky-500/15 shadow-[0_0_48px_rgba(56,189,248,0.35)]">
            <div className="h-[92px] w-[92px]">
              <Mineiro3D
                stepIndex={storyStep}
                isExplaining={true}
                size="avatar"
              />
            </div>
          </div>

          <div className="-ml-5 flex min-h-[76px] max-w-[480px] items-center rounded-r-full border border-l-0 border-sky-400/40 bg-[#050d20]/90 py-3 pr-7 pl-8 shadow-[0_0_36px_rgba(14,165,233,0.18)]">
            <p className="text-[21px] font-medium leading-snug tracking-tight text-slate-100">
              {visibleText}
              <span
                className="ml-1 inline-block h-5 w-[3px] animate-pulse bg-sky-300 align-middle"
                aria-hidden="true"
              />
            </p>
          </div>
        </div>
      )}

      {/* Tela final em 3 etapas: 1) Descida na nave -> 2) Tranco + Medalha animada -> 3) Logo MINEIRØ + Developed by */}
      {missionPhase === 'ended' && (
        <motion.div
          className="pointer-events-none relative z-30 flex h-full w-full flex-col items-center justify-center px-4 py-3 text-center"
          animate={
            landingBump
              ? { x: [0, -5, 5, -3, 2, 0], y: [0, 6, -4, 3, -1, 0] }
              : { x: 0, y: 0 }
          }
          transition={{ duration: 0.38 }}
        >
          <AnimatePresence mode="wait">
            {endedStage === 'reentry' && (
              <motion.div
                key="ended-reentry"
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                transition={{ duration: 0.45 }}
                className="flex flex-col items-center gap-6"
              >
                <div className="flex items-center">
                  <div className="relative z-10 flex h-[112px] w-[112px] shrink-0 items-center justify-center rounded-full border-2 border-sky-400/60 bg-sky-500/15 shadow-[0_0_48px_rgba(56,189,248,0.35)]">
                    <div className="h-[88px] w-[88px]">
                      <Mineiro3D stepIndex={storyStep} isExplaining={true} size="avatar" />
                    </div>
                  </div>
                  <div className="-ml-5 rounded-r-full border border-l-0 border-sky-400/40 bg-[#050d20]/92 py-3.5 pr-7 pl-8 text-left">
                    <p className="text-[21px] font-semibold text-slate-100">
                      {isPt
                        ? 'Missão encerrada! Descendo de volta para a Terra...'
                        : 'Mission complete! Descending back to Earth...'}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {endedStage === 'medal' && (
              <motion.div
                key="ended-medal"
                initial={{ opacity: 0, scale: 0.65 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, y: -16 }}
                transition={{ type: 'spring', stiffness: 220, damping: 16 }}
                className="flex flex-col items-center gap-7"
              >
                {/* Medalha de Honra Animada */}
                <motion.div
                  animate={{ rotateY: [0, 360], scale: [1, 1.07, 1] }}
                  transition={{
                    rotateY: { duration: 2.6, ease: 'easeInOut' },
                    scale: { duration: 1.8, repeat: Infinity, ease: 'easeInOut' },
                  }}
                  className="flex h-[180px] w-[180px] items-center justify-center rounded-full border-4 border-amber-300/80 bg-gradient-to-br from-amber-300/25 via-amber-500/20 to-amber-700/30 shadow-[0_0_75px_rgba(251,191,36,0.45)]"
                >
                  <Award className="h-[92px] w-[92px] text-amber-300 drop-shadow-[0_0_18px_rgba(251,191,36,0.85)]" />
                </motion.div>

                <div className="flex items-center">
                  <div className="relative z-10 flex h-[96px] w-[96px] shrink-0 items-center justify-center rounded-full border-2 border-sky-400/60 bg-sky-500/15 shadow-[0_0_40px_rgba(56,189,248,0.35)]">
                    <div className="h-[72px] w-[72px]">
                      <Mineiro3D stepIndex={storyStep} isExplaining={true} size="avatar" />
                    </div>
                  </div>
                  <div className="-ml-4 rounded-r-full border border-l-0 border-amber-400/45 bg-[#050d20]/92 py-3 pr-7 pl-7 text-left">
                    <p className="text-[21px] font-semibold text-amber-200">
                      {isPt
                        ? 'Pouso concluído! Receba sua Medalha de Honra pela missão.'
                        : 'Touchdown! Here is your Medal of Honor for the mission.'}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {endedStage === 'credits' && (
              <motion.div
                key="ended-credits"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
                className="flex h-full w-full flex-col items-center justify-between py-10"
              >
                <div className="my-auto flex flex-col items-center justify-center">
                  <motion.img
                    src={mineiroLogo}
                    alt="MINEIRØ"
                    initial={{ y: 20, scale: 0.9, opacity: 0 }}
                    animate={{ y: 0, scale: 1, opacity: 1 }}
                    transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                    className="h-[210px] w-auto object-contain drop-shadow-[0_0_42px_rgba(56,189,248,0.38)]"
                  />
                </div>

                <footer className="w-full max-w-[680px] border-t border-slate-800/70 pt-5">
                  <div className="mb-3 text-[16px] font-semibold tracking-[0.2em] text-slate-400 uppercase">
                    Developed by
                  </div>
                  <div className="grid grid-cols-3 gap-6">
                    {TEAM_CREDITS_ALPHABETICAL.map((member) => (
                      <div key={member.name} className="flex flex-col items-center gap-2">
                        <img
                          src={member.photo}
                          alt={member.name}
                          className="h-[48px] w-[48px] rounded-full border border-slate-600/70 object-cover opacity-90"
                        />
                        <span className="truncate text-[16px] font-medium text-slate-300">
                          {member.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </footer>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      <SpaceshipLaunchOverlay surface="rightWall" phase={missionPhase} />
    </section>
  );
};
