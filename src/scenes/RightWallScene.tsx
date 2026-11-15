import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Award, Globe2, Rocket, RotateCcw } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import mineiroLogo from '../assets/mineiro-logo.png';
import erickPhoto from '../assets/team/erick.jpeg';
import samuelPhoto from '../assets/team/samuel.png';
import shayenePhoto from '../assets/team/shayene.png';
import {
  pauseSpeech,
  preloadPiperVoice,
  resumeSpeech,
  speakText,
  stopSpeech,
} from '../accessibility/a11yEngine';
import {
  playBlastDoorSlamSfx,
  playCabinDissolveSfx,
  playHatchEjectSfx,
  playLandingThudSfx,
  setSpaceAmbientDucked,
} from '../audio/spaceAmbient';
import { setSpatialMusicDucked } from '../audio/spatialAudioEngine';
import { Mineiro3D } from '../components/Mineiro3D';
import { MissionGameButton } from '../components/MissionGameButton';
import { useExperience } from '../experience/ExperienceContext';
import {
  LAYER_METAS,
  SceneSurfaceProps,
  VISUAL_LAYER_ORDER,
  VisualLayerId,
} from '../experience/types';
import { JukeboxStudioStage } from './JukeboxStudioStage';
import { IdleStageRightWall } from './IdleStageRightWall';
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
  const {
    audioSessionUnlocked,
    country,
    lang,
    lastSpeechCommand,
    layers,
    missionPhase,
    playback,
    reportSpeechStatus,
    speechCommandNonce,
    speechStatus,
    storyStep,
    voiceAutoEnabled,
  } = useExperience();
  const isRobotSpeaking = speechStatus === 'speaking';
  const speechStatusRef = useRef(speechStatus);
  speechStatusRef.current = speechStatus;
  const speechDelayTimerRef = useRef<number | null>(null);
  const isPt = lang === 'pt';
  const countryName = country
    ? isPt
      ? country.namePt
      : country.nameEn
    : isPt
      ? 'a Terra'
      : 'Earth';

  const activeStep = storyStep % 6;
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
    activeStep === 0 || enabledLayerIds.length === 0
      ? null
      : focusedLayerId && layers[focusedLayerId].enabled
        ? focusedLayerId
        : enabledLayerIds[0];
  const onlyTemperatureEnabled =
    enabledLayerIds.length === 1 && enabledLayerIds[0] === 'temperature';
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

    let bumpResetTimer: number | null = null;
    const medalTimer = window.setTimeout(() => {
      if (
        renderContext !== 'projector' &&
        audioSessionUnlocked &&
        document.visibilityState !== 'hidden'
      ) {
        playLandingThudSfx();
      }
      setLandingBump(true);
      setEndedStage('medal');
      bumpResetTimer = window.setTimeout(() => setLandingBump(false), 420);
    }, 3200);

    const creditsTimer = window.setTimeout(() => {
      setEndedStage('credits');
    }, 6700);

    return () => {
      window.clearTimeout(medalTimer);
      window.clearTimeout(creditsTimer);
      if (bumpResetTimer !== null) {
        window.clearTimeout(bumpResetTimer);
      }
    };
  }, [audioSessionUnlocked, missionPhase, renderContext]);

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

    // Quadro 6 (`exploring-0`): escolha de país no Globo do tablet ou bandeiras no teto
    if (activeStep === 0) {
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
    }

    // Fase `exploring`: comentário exclusivo por camada ativa (todas as 5 camadas)
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
              `Monóxido de Carbono em ${countryName} · ${playback.activeChord}.`,
              'A pluma atmosférica molda os acordes em tempo real!',
              'Veja os anéis harmônicos pulsando no teto.',
            ],
            spoken: `Camada de Acordes ativa sobre ${countryName}. A concentração de monóxido de carbono está moldando a harmonia em ${playback.activeChord}!`,
          },
          en: {
            phrases: [
              `Carbon Monoxide over ${countryName} · ${playback.activeChord}.`,
              'Atmospheric plumes shape the chords in real time!',
              'Watch the harmonic rings pulsing overhead.',
            ],
            spoken: `Chords layer active over ${countryName}. Carbon monoxide levels are shaping the harmony in ${playback.activeChord}!`,
          },
        },
        temperature: onlyTemperatureEnabled
          ? {
              pt: {
                phrases: [
                  `Temperatura de ${countryName}: tom em ${playback.keyRootPt} a ${playback.bpm} BPM.`,
                  'A Temperatura ajusta o ritmo e a afinação do país!',
                  'Ligue Melodia, Acordes ou Baixo no tablet para ouvir as notas musicais.',
                ],
                spoken: `Camada de Temperatura ativa sobre ${countryName}, ajustando o tom para ${playback.keyRootPt} a ${playback.bpm} batidas por minuto. Ligue Melodia, Acordes ou Baixo no tablet para ouvir as notas musicais!`,
              },
              en: {
                phrases: [
                  `Temperature over ${countryName}: ${playback.keyRoot} at ${playback.bpm} BPM.`,
                  'Temperature sets the country key and tempo!',
                  'Turn on Melody, Chords, or Bass on the tablet to hear musical notes.',
                ],
                spoken: `Temperature layer active over ${countryName}, setting the key to ${playback.keyRoot} at ${playback.bpm} beats per minute. Turn on Melody, Chords, or Bass on the tablet to hear musical notes!`,
              },
            }
          : {
              pt: {
                phrases: [
                  `Temperatura na superfície de ${countryName}!`,
                  'O calor observado pela NASA ajusta o tom e o ritmo do país.',
                  `Agora soando em ${playback.keyRootPt} a ${playback.bpm} BPM.`,
                ],
                spoken: `Camada de Temperatura ativa sobre ${countryName}, ajustando a música para ${playback.keyRootPt} a ${playback.bpm} batidas por minuto!`,
              },
              en: {
                phrases: [
                  `Surface temperature over ${countryName}!`,
                  'NASA thermal data sets the country key and tempo.',
                  `Now sounding in ${playback.keyRoot} at ${playback.bpm} BPM.`,
                ],
                spoken: `Temperature layer active over ${countryName}, tuning the music to ${playback.keyRoot} at ${playback.bpm} beats per minute!`,
              },
            },
        bass: {
          pt: {
            phrases: [
              `Dióxido de Nitrogênio em ${countryName}!`,
              'As emissões urbanas viram pulso grave e gotículas no teto.',
              'Sinta o peso espacial vibrando nas caixas!',
            ],
            spoken: `Camada de Base e Chuva ativa sobre ${countryName}. Os níveis de dióxido de nitrogênio estão guiando o pulso grave no quarto!`,
          },
          en: {
            phrases: [
              `Nitrogen Dioxide over ${countryName}!`,
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

    // `exploring-ready` (Silêncio Intencional: país escolhido e todas as camadas desligadas)
    return isPt
      ? {
          phrases: [
            `${countryName} selecionado! Todas as camadas começam em silêncio.`,
            'Toque nos botões do tablet para ligar sua 1ª camada...',
            'Ouça a música e os dados da NASA acenderem no ambiente!',
          ],
          spoken: `${countryName} foi escolhido! Todas as camadas começam desligadas em silêncio. Clique nos botões do tablet para ligar uma camada e ouvir a música surgir no ambiente!`,
        }
      : {
          phrases: [
            `${countryName} selected! All layers start in silence.`,
            'Tap the buttons on the tablet to switch on your 1st layer...',
            'Hear the music and NASA data light up across the room!',
          ],
          spoken: `${countryName} has been chosen! All layers start turned off in silence. Tap the buttons on the tablet to switch on a layer and hear the music emerge in the room!`,
        };
  }, [
    activeLayerForSpeech,
    activeStep,
    countryName,
    isPt,
    missionPhase,
    onlyTemperatureEnabled,
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

    if (speechStatus === 'paused') {
      return;
    }

    if (speechStatus === 'stopped' || !voiceAutoEnabled) {
      if (isErasing) setIsErasing(false);
      if (charCount < activePhrase.length) {
        setCharCount(activePhrase.length);
      }
      return;
    }

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
  }, [charCount, isErasing, phaseSpeech.phrases, phraseIdx, showTypewriter, speechStatus, voiceAutoEnabled]);

  const prevPhaseRef = useRef(missionPhase);

  // Efeitos sonoros mecânicos sincronizados com as comportas, ejeção e dissolução da cabine
  useEffect(() => {
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = missionPhase;
    if (
      renderContext === 'projector' ||
      !audioSessionUnlocked ||
      prev === missionPhase ||
      (typeof document !== 'undefined' && document.visibilityState === 'hidden')
    ) {
      return;
    }

    if (missionPhase === 'boarding') {
      playBlastDoorSlamSfx();
    } else if (missionPhase === 'zero_g') {
      playHatchEjectSfx();
    } else if (prev === 'zero_g' && missionPhase === 'exploring') {
      playCabinDissolveSfx();
    }
  }, [audioSessionUnlocked, missionPhase, renderContext]);

  // Pré-carrega a voz neural Piper apenas após sessão de áudio desbloqueada pelo usuário
  useEffect(() => {
    if (renderContext === 'projector' || !audioSessionUnlocked || !voiceAutoEnabled) return;
    preloadPiperVoice(lang);
  }, [audioSessionUnlocked, lang, renderContext, voiceAutoEnabled]);

  const spokenTextRef = useRef(phaseSpeech.spoken);
  spokenTextRef.current = phaseSpeech.spoken;

  // Fala no idioma selecionado interrompendo imediatamente qualquer fala anterior ao trocar país/camada/fase
  // + abaixa suavemente TODA a música (ambiente espacial e motor 8D dos países) enquanto o robô fala
  useEffect(() => {
    const setAllMusicDucked = (ducked: boolean) => {
      setSpaceAmbientDucked(ducked);
      setSpatialMusicDucked(ducked);
    };

    if (speechDelayTimerRef.current !== null) {
      window.clearTimeout(speechDelayTimerRef.current);
      speechDelayTimerRef.current = null;
    }

    if (
      missionPhase === 'idle' ||
      renderContext === 'projector' ||
      !audioSessionUnlocked ||
      !voiceAutoEnabled
    ) {
      lastSpokenKeyRef.current = '';
      stopSpeech();
      setAllMusicDucked(false);
      if (speechStatusRef.current === 'speaking') {
        reportSpeechStatus('idle');
      }
      return;
    }

    if (speechStatusRef.current === 'paused' || speechStatusRef.current === 'stopped') {
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
      speechDelayTimerRef.current = null;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      if (speechStatusRef.current === 'paused' || speechStatusRef.current === 'stopped') return;
      speakText(spokenTextRef.current, lang, true, {
        maleVoice: true,
        onStart: () => {
          setAllMusicDucked(true);
          reportSpeechStatus('speaking');
        },
        onEnd: () => {
          setAllMusicDucked(false);
          reportSpeechStatus('idle');
        },
      });
    }, startDelayMs);
    speechDelayTimerRef.current = timer;

    return () => {
      if (speechDelayTimerRef.current === timer) {
        speechDelayTimerRef.current = null;
      }
      window.clearTimeout(timer);
      stopSpeech();
      setAllMusicDucked(false);
    };
  }, [
    activeLayerForSpeech,
    activeStep,
    audioSessionUnlocked,
    country?.id,
    lang,
    missionPhase,
    renderContext,
    reportSpeechStatus,
    voiceAutoEnabled,
  ]);

  // Responde imediatamente aos comandos de Pausa / Retomada / Interrupção vindos do Tablet
  useEffect(() => {
    if (renderContext === 'projector' || speechCommandNonce === 0 || !lastSpeechCommand) return;
    const setAllMusicDucked = (ducked: boolean) => {
      setSpaceAmbientDucked(ducked);
      setSpatialMusicDucked(ducked);
    };

    if (speechDelayTimerRef.current !== null) {
      window.clearTimeout(speechDelayTimerRef.current);
      speechDelayTimerRef.current = null;
    }

    if (lastSpeechCommand === 'stop') {
      stopSpeech();
      setAllMusicDucked(false);
      return;
    }

    if (lastSpeechCommand === 'pause') {
      pauseSpeech();
      setAllMusicDucked(false);
      return;
    }

    if (lastSpeechCommand === 'resume') {
      if (!audioSessionUnlocked || !voiceAutoEnabled || missionPhase === 'idle') return;
      const outcome = resumeSpeech();
      if (outcome === 'resumed-piper') {
        setAllMusicDucked(true);
        reportSpeechStatus('speaking');
      } else {
        speakText(spokenTextRef.current, lang, true, {
          maleVoice: true,
          onStart: () => {
            setAllMusicDucked(true);
            reportSpeechStatus('speaking');
          },
          onEnd: () => {
            setAllMusicDucked(false);
            reportSpeechStatus('idle');
          },
        });
      }
    }
  }, [
    audioSessionUnlocked,
    lang,
    lastSpeechCommand,
    missionPhase,
    renderContext,
    reportSpeechStatus,
    speechCommandNonce,
    voiceAutoEnabled,
  ]);

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
      <SpaceStarfield
        seedOffset={2}
        count={missionPhase === 'idle' ? 96 : 64}
        accentHex={activeLayerMeta.accentHex}
      />

      {/* Arco sutil na borda esquerda conectando com a Parede Esquerda */}
      <div
        className="pointer-events-none absolute top-1/2 -left-24 h-72 w-48 -translate-y-1/2 rounded-full border border-sky-400/20 opacity-45"
        style={{
          background:
            'radial-gradient(circle at left center, rgba(14, 165, 233, 0.14), transparent 70%)',
        }}
        aria-hidden="true"
      />

      {/* Estado inicial antes de iniciar operação (superfície 3D puramente ilustrativa) */}
      {missionPhase === 'idle' && (
        <IdleStageRightWall isPt={isPt} interactive={false} />
      )}

      {/* Tela 2 · Boas-vindas: Robô MINEIRØ 3D gigante solto no espaço + balão de conversa cinematográfico */}
      {missionPhase === 'briefing' && (
        <motion.div
          key="briefing-hero-stage"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="pointer-events-none relative z-30 flex h-full w-full items-center justify-center gap-10 px-14"
        >
          {/* Robô 3D gigante solto no espaço #000000 com aura azul suave */}
          <div className="relative flex shrink-0 items-center justify-center">
            <motion.div
              className="pointer-events-none absolute h-[420px] w-[420px] rounded-full blur-3xl mix-blend-screen"
              style={{
                background:
                  'radial-gradient(circle, rgba(56,189,248,0.28) 0%, rgba(14,165,233,0.12) 45%, transparent 72%)',
              }}
              animate={{ scale: [0.95, 1.06, 0.95], opacity: [0.7, 0.95, 0.7] }}
              transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
              aria-hidden="true"
            />
            <div className="relative z-10">
              <Mineiro3D stepIndex={0} isExplaining={isRobotSpeaking} size="spotlight" />
            </div>
          </div>

          {/* Painel de conversa amplo e legível ao lado */}
          <div className="relative flex max-w-[600px] flex-1 flex-col gap-6 rounded-3xl border border-sky-400/35 bg-[#050d20]/84 px-10 py-8 shadow-[0_0_54px_rgba(14,165,233,0.18)] backdrop-blur-md">
            {/* Cabeçalho + Barrinhas/Ondas de Voz Animadas */}
            <div className="flex items-center justify-between gap-4 border-b border-sky-400/15 pb-4">
              <span
                className="text-[13px] font-semibold tracking-[0.22em] text-sky-300/85 uppercase"
                style={{ fontFamily: "'Orbitron', 'Poppins', system-ui, sans-serif" }}
              >
                {isPt ? 'MINEIRØ · BOAS-VINDAS' : 'MINEIRØ · MISSION BRIEFING'}
              </span>

              <div className="flex h-5 items-center gap-1" aria-hidden="true">
                {[0, 1, 2, 3, 4].map((barIdx) => (
                  <motion.span
                    key={`voice-bar-${barIdx}`}
                    className={`w-[3px] rounded-full ${
                      isRobotSpeaking ? 'bg-sky-300' : 'bg-slate-600/70'
                    }`}
                    animate={
                      isRobotSpeaking
                        ? {
                            height: ['6px', `${14 + ((barIdx * 5) % 8)}px`, '6px'],
                            opacity: [0.45, 1, 0.45],
                          }
                        : { height: '6px', opacity: 0.4 }
                    }
                    transition={
                      isRobotSpeaking
                        ? {
                            duration: 0.75 + barIdx * 0.12,
                            repeat: Infinity,
                            ease: 'easeInOut',
                            delay: barIdx * 0.1,
                          }
                        : { duration: 0.2 }
                    }
                  />
                ))}
              </div>
            </div>

            {/* Texto de conversa bem grande */}
            <p className="min-h-[145px] text-[34px] font-semibold leading-[1.32] tracking-tight text-slate-50">
              {visibleText}
              {speechStatus !== 'stopped' && speechStatus !== 'paused' && (
                <span
                  className="ml-1.5 inline-block h-8 w-[4px] animate-pulse bg-sky-300 align-middle"
                  aria-hidden="true"
                />
              )}
            </p>

            {/* Indicador das frases + Placa visual Embarcar (controlada pelo Tablet) */}
            <div className="flex items-center justify-between gap-4 pt-2">
              <div className="flex items-center gap-2" aria-hidden="true">
                {phaseSpeech.phrases.map((_, idx) => (
                  <span
                    key={`phrase-dot-${idx}`}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      idx === phraseIdx ? 'w-7 bg-sky-300' : 'w-2 bg-slate-600/70'
                    }`}
                  />
                ))}
              </div>

              <MissionGameButton
                label={isPt ? 'Embarcar na Nave' : 'Board Ship'}
                icon={Rocket}
                interactive={false}
                size="md"
              />
            </div>
          </div>
        </motion.div>
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

      {/* Quadro 6 (`exploring-0`): Palco dedicado de Escolha de País com MINEIRØ 3D gigante no espaço #000000 */}
      {missionPhase === 'exploring' && activeStep === 0 && (
        <motion.div
          key="exploring-0-hero-stage"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="pointer-events-none relative z-30 flex h-full w-full items-center justify-center gap-10 px-14"
        >
          <div className="relative flex shrink-0 items-center justify-center">
            <motion.div
              className="pointer-events-none absolute h-[420px] w-[420px] rounded-full blur-3xl mix-blend-screen"
              style={{
                background:
                  'radial-gradient(circle, rgba(56,189,248,0.28) 0%, rgba(14,165,233,0.12) 45%, transparent 72%)',
              }}
              animate={{ scale: [0.95, 1.06, 0.95], opacity: [0.7, 0.95, 0.7] }}
              transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
              aria-hidden="true"
            />
            <div className="relative z-10">
              <Mineiro3D stepIndex={0} isExplaining={isRobotSpeaking} size="spotlight" />
            </div>
          </div>

          <div className="relative flex max-w-[600px] flex-1 flex-col gap-6 rounded-3xl border border-sky-400/35 bg-[#050d20]/84 px-10 py-8 shadow-[0_0_54px_rgba(14,165,233,0.18)] backdrop-blur-md">
            <div className="flex items-center justify-between gap-4 border-b border-sky-400/15 pb-4">
              <span
                className="text-[13px] font-semibold tracking-[0.22em] text-sky-300/85 uppercase"
                style={{ fontFamily: "'Orbitron', 'Poppins', system-ui, sans-serif" }}
              >
                {isPt ? 'MINEIRØ · ESCOLHA SEU DESTINO' : 'MINEIRØ · CHOOSE DESTINATION'}
              </span>

              <div className="flex h-5 items-center gap-1" aria-hidden="true">
                {[0, 1, 2, 3, 4].map((barIdx) => (
                  <motion.span
                    key={`pick-voice-bar-${barIdx}`}
                    className={`w-[3px] rounded-full ${
                      isRobotSpeaking ? 'bg-sky-300' : 'bg-slate-600/70'
                    }`}
                    animate={
                      isRobotSpeaking
                        ? {
                            height: ['6px', `${14 + ((barIdx * 5) % 8)}px`, '6px'],
                            opacity: [0.45, 1, 0.45],
                          }
                        : { height: '6px', opacity: 0.4 }
                    }
                    transition={
                      isRobotSpeaking
                        ? {
                            duration: 0.75 + barIdx * 0.12,
                            repeat: Infinity,
                            ease: 'easeInOut',
                            delay: barIdx * 0.1,
                          }
                        : { duration: 0.2 }
                    }
                  />
                ))}
              </div>
            </div>

            <p className="min-h-[145px] text-[34px] font-semibold leading-[1.32] tracking-tight text-slate-50">
              {visibleText}
              {speechStatus !== 'stopped' && speechStatus !== 'paused' && (
                <span
                  className="ml-1.5 inline-block h-8 w-[4px] animate-pulse bg-sky-300 align-middle"
                  aria-hidden="true"
                />
              )}
            </p>

            <div className="flex items-center justify-between gap-4 pt-2">
              <div className="flex items-center gap-2" aria-hidden="true">
                {phaseSpeech.phrases.map((_, idx) => (
                  <span
                    key={`pick-phrase-dot-${idx}`}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      idx === phraseIdx ? 'w-7 bg-sky-300' : 'w-2 bg-slate-600/70'
                    }`}
                  />
                ))}
              </div>

              <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/35 bg-[#060c1a]/90 px-4 py-2 text-xs font-semibold tracking-[0.12em] text-sky-200 uppercase">
                <Globe2 size={15} className="text-sky-300" aria-hidden="true" />
                <span>{isPt ? 'Globo no Tablet · Bandeiras no Teto' : 'Tablet Globe · Ceiling Flags'}</span>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Fase Exploring (`storyStep > 0`): Palco Jukebox Studio + Partitura MIDI em Loop ocupando a Parede Direita */}
      {missionPhase === 'exploring' && activeStep > 0 && (
        <JukeboxStudioStage
          renderContext={renderContext}
          storyStep={storyStep}
          robotText={visibleText}
        />
      )}

      {/* Robô MINEIRØ no círculo azul + barra conectada nas fases com cabine/contagem (boarding, countdown, zero_g) */}
      {(missionPhase === 'boarding' ||
        missionPhase === 'countdown' ||
        missionPhase === 'zero_g') && (
        <div
          className="pointer-events-none absolute z-30 flex flex-col items-start gap-4 transition-all duration-1000 ease-out"
          style={robotPositionStyle}
        >
          <div className="flex items-center">
            <div className="relative z-10 flex h-[120px] w-[120px] shrink-0 items-center justify-center rounded-full border-2 border-sky-400/60 bg-sky-500/15 shadow-[0_0_48px_rgba(56,189,248,0.35)]">
              <div className="h-[92px] w-[92px]">
                <Mineiro3D
                  stepIndex={storyStep}
                  isExplaining={isRobotSpeaking}
                  size="avatar"
                />
              </div>
            </div>

            <div className="-ml-5 flex min-h-[76px] max-w-[480px] items-center rounded-r-full border border-l-0 border-sky-400/40 bg-[#050d20]/90 py-3 pr-7 pl-8 shadow-[0_0_36px_rgba(14,165,233,0.18)]">
              <p className="text-[21px] font-medium leading-snug tracking-tight text-slate-100">
                {visibleText}
                {speechStatus !== 'stopped' && speechStatus !== 'paused' && (
                  <span
                    className="ml-1 inline-block h-5 w-[3px] animate-pulse bg-sky-300 align-middle"
                    aria-hidden="true"
                  />
                )}
              </p>
            </div>
          </div>

          {missionPhase === 'boarding' && (
            <div className="pl-28">
              <MissionGameButton
                label={isPt ? 'Autorizar Decolagem' : 'Authorize Liftoff'}
                icon={Rocket}
                interactive={false}
                size="md"
              />
            </div>
          )}

          {missionPhase === 'zero_g' && (
            <div className="pl-28">
              <MissionGameButton
                label={isPt ? 'Escolher País' : 'Choose Country'}
                icon={Globe2}
                interactive={false}
                size="md"
              />
            </div>
          )}
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
                      <Mineiro3D stepIndex={storyStep} isExplaining={isRobotSpeaking} size="avatar" />
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
                      <Mineiro3D stepIndex={storyStep} isExplaining={isRobotSpeaking} size="avatar" />
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
                className="flex h-full w-full flex-col items-center justify-between py-6"
              >
                <div className="my-auto flex flex-col items-center justify-center gap-5">
                  <motion.img
                    src={mineiroLogo}
                    alt="MINEIRØ"
                    initial={{ y: 20, scale: 0.9, opacity: 0 }}
                    animate={{ y: 0, scale: 1, opacity: 1 }}
                    transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                    className="h-[165px] w-auto object-contain drop-shadow-[0_0_42px_rgba(56,189,248,0.38)]"
                  />
                  <MissionGameButton
                    label={isPt ? 'Nova Missão' : 'New Mission'}
                    icon={RotateCcw}
                    interactive={false}
                    size="md"
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
                  <p className="mt-5 text-[12px] tracking-[0.06em] text-slate-500">
                    NASA SVS (5011 · 5147 · 5148 · 5153 · 5154) · Natural Earth / world-atlas · flag-icons (MIT)
                  </p>
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
