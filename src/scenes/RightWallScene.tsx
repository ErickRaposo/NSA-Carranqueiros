import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Award } from 'lucide-react';
import mineiroLogo from '../assets/mineiro-logo.png';
import erickPhoto from '../assets/team/erick.jpeg';
import samuelPhoto from '../assets/team/samuel.png';
import shayenePhoto from '../assets/team/shayene.png';
import { speakTextPt } from '../accessibility/a11yEngine';
import {
  playBlastDoorSlamSfx,
  playCabinDissolveSfx,
  playHatchEjectSfx,
  setSpaceAmbientDucked,
} from '../audio/spaceAmbient';
import { Mineiro3D } from '../components/Mineiro3D';
import { useExperience } from '../experience/ExperienceContext';
import { LAYER_METAS, SceneSurfaceProps, VISUAL_LAYER_ORDER } from '../experience/types';
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

  const activeStep = storyStep % 4;
  const firstActiveLayerId =
    VISUAL_LAYER_ORDER.find((id) => layers[id].enabled) ?? 'melody';
  const activeLayerMeta = LAYER_METAS[firstActiveLayerId];

  const lastSpokenKeyRef = useRef<string>('');
  const [countdownNum, setCountdownNum] = useState<number>(5);

  // Controle de digitação letra por letra
  const [phraseIdx, setPhraseIdx] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [isErasing, setIsErasing] = useState(false);

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

    // Fase `exploring`
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
  }, [missionPhase, activeStep, country?.id, lang]);

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

  // Fala em português sem cortar frases + música espacial abaixa enquanto o robô fala
  useEffect(() => {
    if (missionPhase === 'idle' || renderContext === 'projector') {
      setSpaceAmbientDucked(false);
      return;
    }
    const key = `${missionPhase}-${activeStep}-${country?.id ?? 'none'}-${lang}`;
    if (lastSpokenKeyRef.current === key) return;
    lastSpokenKeyRef.current = key;

    // No briefing inicial, deixa a música espacial tocar antes do robô começar a falar
    const startDelayMs = missionPhase === 'briefing' ? 1400 : 250;
    const timer = window.setTimeout(() => {
      speakTextPt(phaseSpeech.spoken, missionPhase === 'ended', {
        maleVoice: true,
        onStart: () => setSpaceAmbientDucked(true),
        onEnd: () => setSpaceAmbientDucked(false),
      });
    }, startDelayMs);

    return () => window.clearTimeout(timer);
  }, [activeStep, country?.id, lang, missionPhase, phaseSpeech.spoken, renderContext]);

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
        <div className="pointer-events-none relative z-20 m-auto max-w-md px-5 text-center">
          <h1
            className="font-bold tracking-[0.03em] text-slate-50 uppercase"
            style={{
              fontFamily: "'Orbitron', 'Poppins', system-ui, sans-serif",
              fontSize: 'clamp(1rem, 2.5vw, 1.55rem)',
              lineHeight: 1.2,
            }}
          >
            {isPt ? 'Vamos começar a sua imersão?' : 'Shall we begin your immersion?'}
          </h1>
        </div>
      )}

      {/* Contagem regressiva durante a decolagem (5, 4, 3, 2, 1) */}
      {missionPhase === 'countdown' && (
        <div className="pointer-events-none relative z-30 mx-auto mt-6 flex flex-col items-center text-center sm:mt-8">
          <span className="text-[9px] font-semibold tracking-[0.18em] text-amber-300 uppercase sm:text-[10px]">
            {isPt ? 'Motores de Propulsão' : 'Main Engine Ignition'}
          </span>
          <div
            className="mt-1 font-bold text-slate-50"
            style={{
              fontFamily: "'Orbitron', 'Poppins', sans-serif",
              fontSize: countdownNum > 0 ? 'clamp(2rem, 6vw, 3rem)' : 'clamp(1.1rem, 2.8vw, 1.45rem)',
              lineHeight: 1.05,
            }}
          >
            {countdownNum > 0 ? countdownNum : isPt ? 'DECOLAR!' : 'LIFTOFF!'}
          </div>
        </div>
      )}

      {/* Robô MINEIRØ + texto pequeno letra por letra (exceto tela final, que tem layout próprio sem conflito) */}
      {missionPhase !== 'idle' && missionPhase !== 'ended' && (
        <div
          className="pointer-events-none absolute z-30 flex items-center gap-2 transition-all duration-1000 ease-out"
          style={robotPositionStyle}
        >
          <div className="h-12 w-12 shrink-0 sm:h-14 sm:w-14">
            <Mineiro3D
              stepIndex={storyStep}
              isExplaining={true}
              size="avatar"
            />
          </div>

          <p className="max-w-[165px] text-[10px] font-medium leading-snug tracking-tight text-slate-100 sm:max-w-[195px] sm:text-[11px]">
            {visibleText}
            <span
              className="ml-0.5 inline-block h-2.5 w-[1.5px] animate-pulse bg-sky-300 align-middle"
              aria-hidden="true"
            />
          </p>
        </div>
      )}

      {/* Tela final gamificada: Retorno à Terra + Medalha + Logo MINEIRØ grande no meio + fotos pequenas no rodapé */}
      {missionPhase === 'ended' && (
        <div className="pointer-events-none relative z-30 flex h-full w-full flex-col items-center justify-between px-4 py-3 text-center sm:py-4">
          {/* Topo: Mineiro + Medalha de reconhecimento da missão */}
          <div className="flex flex-col items-center gap-1.5">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 shrink-0 sm:h-11 sm:w-11">
                <Mineiro3D stepIndex={storyStep} isExplaining={true} size="avatar" />
              </div>
              <div className="flex items-center gap-2 rounded-full border border-amber-400/45 bg-amber-500/15 px-3 py-1 shadow-[0_0_20px_rgba(251,191,36,0.22)]">
                <Award className="h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" />
                <span className="text-[9px] font-bold tracking-wider text-amber-200 uppercase sm:text-[10px]">
                  {isPt
                    ? 'Missão Reconhecida & Premiada'
                    : 'Mission Recognized & Awarded'}
                </span>
              </div>
            </div>
            <p className="max-w-xs text-[9px] font-medium text-slate-300 sm:text-[10px]">
              {isPt
                ? 'Retorno à Terra concluído · Obrigado pelos seus serviços!'
                : 'Return to Earth complete · Thank you for your service!'}
            </p>
          </div>

          {/* Centro: Logo grande do MINEIRØ */}
          <div className="my-auto flex flex-col items-center justify-center py-2">
            <img
              src={mineiroLogo}
              alt="MINEIRØ"
              className="h-[clamp(44px,14vh,100px)] w-auto object-contain drop-shadow-[0_0_26px_rgba(56,189,248,0.32)]"
            />
          </div>

          {/* Rodapé bem discreto: fotos bem pequenas e somente os nomes embaixo */}
          <footer className="w-full max-w-sm border-t border-slate-800/70 pt-2">
            <div className="grid grid-cols-3 gap-2">
              {TEAM_CREDITS_ALPHABETICAL.map((member) => (
                <div key={member.name} className="flex flex-col items-center gap-1">
                  <img
                    src={member.photo}
                    alt={member.name}
                    className="h-6 w-6 rounded-full border border-slate-600/70 object-cover opacity-90 sm:h-7 sm:w-7"
                  />
                  <span className="truncate text-[8px] font-medium text-slate-400 sm:text-[9px]">
                    {member.name}
                  </span>
                </div>
              ))}
            </div>
          </footer>
        </div>
      )}

      <SpaceshipLaunchOverlay surface="rightWall" phase={missionPhase} />
    </section>
  );
};
