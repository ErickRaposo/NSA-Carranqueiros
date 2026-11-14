import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowRight,
  Contrast,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { speakTextPt, stopSpeech } from '../accessibility/a11yEngine';
import { Mineiro3D } from './Mineiro3D';
import { StarfieldBackground } from './StarfieldBackground';

interface IntroOnboardingProps {
  userName: string;
  highContrast: boolean;
  onToggleHighContrast: () => void;
  fontScale: number;
  onCycleFontScale: () => void;
  onFinish: () => void;
}

const INTRO_STEPS = [
  {
    tag: '1. Boas-vindas',
    title: 'Olá! Bem-vindo.',
    text: 'Aqui você navega por imagens reais de satélite da NASA e transforma dados do planeta em som, música e leitura por voz em português.',
  },
  {
    tag: '2. Globo 3D e Camadas',
    title: 'Explore o mundo do seu jeito.',
    text: 'Gire o globo em 3D ou veja no mapa plano, dê zoom em qualquer país e misture camadas de raios, ventos, temperatura, CO e NOx em tempo real.',
  },
  {
    tag: '3. Países e Rotas',
    title: 'Clique em um país para focar.',
    text: 'Ao escolher um território, o mapa destaca a região e abre os detalhes ao lado com fronteiras, portos e informações do local.',
  },
  {
    tag: '4. Feito para todos',
    title: 'Voz, som e alto contraste no teclado.',
    text: 'Aperte V para ativar a voz automática, R para ouvir o ponto atual, S para ouvir o som dos dados e C para alto contraste, sem precisar do mouse.',
  },
];

export const IntroOnboarding: React.FC<IntroOnboardingProps> = ({
  userName,
  highContrast,
  onToggleHighContrast,
  fontScale,
  onCycleFontScale,
  onFinish,
}) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [autoAudio, setAutoAudio] = useState(true);

  const current = INTRO_STEPS[stepIndex];
  const isLast = stepIndex === INTRO_STEPS.length - 1;

  const stopOnboardingSpeech = useCallback(() => {
    stopSpeech();
    setIsSpeaking(false);
  }, []);

  const speakStep = useCallback((index: number) => {
    const step = INTRO_STEPS[index];
    speakTextPt(`${step.title} ${step.text}`, true, {
      maleVoice: true,
      onStart: () => setIsSpeaking(true),
      onEnd: () => setIsSpeaking(false),
    });
  }, []);

  useEffect(() => {
    if (!autoAudio) return;

    const timer = window.setTimeout(() => {
      speakStep(stepIndex);
    }, 180);

    return () => {
      window.clearTimeout(timer);
    };
  }, [stepIndex, autoAudio, speakStep]);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
    }
    return () => {
      stopSpeech();
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setStepIndex((prev) => Math.min(INTRO_STEPS.length - 1, prev + 1));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setStepIndex((prev) => Math.max(0, prev - 1));
      } else if (e.key === 'Escape') {
        e.preventDefault();
        stopOnboardingSpeech();
        onFinish();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onFinish, stopOnboardingSpeech]);

  const handleNext = () => {
    if (isLast) {
      stopOnboardingSpeech();
      onFinish();
      return;
    }
    setStepIndex((prev) => prev + 1);
  };

  const handlePrev = () => {
    if (stepIndex === 0) return;
    setStepIndex((prev) => prev - 1);
  };

  const handleToggleAudio = () => {
    if (autoAudio && isSpeaking) {
      setAutoAudio(false);
      stopOnboardingSpeech();
    } else if (autoAudio) {
      speakStep(stepIndex);
    } else {
      setAutoAudio(true);
      speakStep(stepIndex);
    }
  };

  return (
    <main
      style={{ fontSize: `${Math.round(fontScale * 100)}%` }}
      className={`relative flex h-screen w-full items-center justify-center overflow-hidden px-4 py-6 sm:px-6 ${
        highContrast
          ? 'bg-black text-white'
          : 'bg-gradient-to-br from-[#030816] via-[#07142E] to-[#040B1C] text-slate-100'
      }`}
      aria-label="Apresentação do sistema"
    >
      {!highContrast && <StarfieldBackground />}

      <div
        className={`relative z-10 flex w-full max-w-4xl flex-col items-center gap-6 rounded-xl p-6 shadow-2xl md:flex-row md:gap-8 md:p-10 ${
          highContrast
            ? 'bg-black'
            : 'bg-[#07152e]/95'
        }`}
      >
        {/* Top bar inside card */}
        <div className="flex w-full flex-wrap items-center justify-between gap-2 md:absolute md:top-5 md:right-6 md:left-6 md:w-auto">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-300">
              Olá, <strong className="text-white">{userName}</strong>
            </span>
            <button
              type="button"
              onClick={onToggleHighContrast}
              aria-pressed={highContrast}
              className={`inline-flex min-h-[32px] cursor-pointer items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium shadow-sm transition ${
                highContrast
                  ? 'bg-white text-black'
                  : 'bg-[#0c2044] text-slate-200 hover:bg-[#122d5c]'
              }`}
            >
              <Contrast className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Contraste</span>
            </button>
            <button
              type="button"
              onClick={onCycleFontScale}
              className={`inline-flex min-h-[32px] cursor-pointer items-center rounded-md px-2.5 py-1 text-xs font-medium shadow-sm transition ${
                highContrast
                  ? 'bg-zinc-900 text-white'
                  : 'bg-[#0c2044] text-slate-200 hover:bg-[#122d5c]'
              }`}
              aria-label={`Tamanho do texto ${Math.round(fontScale * 100)} por cento`}
            >
              A+{Math.round(fontScale * 100)}%
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              stopOnboardingSpeech();
              onFinish();
            }}
            data-testid="skip-onboarding-btn"
            className={`min-h-[34px] cursor-pointer rounded-md px-3.5 py-1 text-xs font-medium shadow-sm transition ${
              highContrast
                ? 'bg-zinc-900 text-white hover:bg-zinc-800'
                : 'bg-[#0c2044] text-slate-200 hover:bg-[#122d5c] hover:text-white'
            }`}
          >
            Pular para o Mapa (Esc)
          </button>
        </div>

        {/* Left: 3D Floating Mascot */}
        <div className="flex w-full flex-col items-center justify-center md:mt-6 md:w-5/12">
          <Mineiro3D stepIndex={stepIndex} isExplaining={isSpeaking || stepIndex > 0} />
        </div>

        {/* Right: Speech Bubble + Step Navigation */}
        <div className="flex w-full flex-col justify-center md:mt-6 md:w-7/12">
          <div className="sr-only" aria-live="polite">
            {current.tag}. {current.title} {current.text}
          </div>

          {/* Speech Bubble pointing toward MINEIRØ */}
          <div
            className={`relative rounded-xl p-5 shadow-lg sm:p-6 ${
              highContrast
                ? 'bg-zinc-900'
                : 'bg-[#0c2044]/95'
            }`}
          >
            {/* Desktop left pointer tail */}
            <div
              aria-hidden="true"
              className={`hidden md:block absolute top-12 -left-2.5 h-5 w-5 rotate-45 ${
                highContrast
                  ? 'bg-zinc-900'
                  : 'bg-[#0c2044]'
              }`}
            />
            {/* Mobile top pointer tail */}
            <div
              aria-hidden="true"
              className={`md:hidden absolute -top-2.5 left-1/2 -translate-x-1/2 h-5 w-5 rotate-45 ${
                highContrast
                  ? 'bg-zinc-900'
                  : 'bg-[#0c2044]'
              }`}
            />

            <div className="flex items-center justify-between gap-2">
              <span
                className={`text-xs font-semibold tracking-wider ${
                  highContrast ? 'text-[#facc15]' : 'text-slate-300'
                }`}
              >
                {current.tag}
              </span>

              {isSpeaking && (
                <span className="inline-flex items-center gap-1 rounded-md bg-[#163675] px-2.5 py-0.5 text-[10px] font-medium text-slate-100">
                  <Volume2 className="h-3 w-3 animate-pulse" aria-hidden="true" />
                  Falando...
                </span>
              )}
            </div>

            <h1 className="font-display mt-2 text-2xl font-bold leading-tight sm:text-3xl">
              {current.title}
            </h1>

            <p className="mt-3 max-w-[60ch] text-sm leading-relaxed text-slate-200">
              {current.text}
            </p>
          </div>

          {/* Audio control + Progress dots */}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleToggleAudio}
              aria-pressed={isSpeaking}
              className={`inline-flex min-h-[38px] cursor-pointer items-center gap-2 rounded-lg px-4 py-1.5 text-xs font-medium shadow-sm transition active:scale-[0.97] ${
                highContrast
                  ? 'bg-zinc-900 text-white hover:bg-zinc-800'
                  : 'bg-[#122650] text-slate-100 hover:bg-[#18336b]'
              }`}
            >
              {isSpeaking ? (
                <>
                  <VolumeX className="h-4 w-4" aria-hidden="true" />
                  <span>Silenciar voz</span>
                </>
              ) : (
                <>
                  <Volume2 className="h-4 w-4" aria-hidden="true" />
                  <span>Ouvir novamente</span>
                </>
              )}
            </button>

            <div className="flex items-center gap-2" aria-label="Progresso da apresentação">
              {INTRO_STEPS.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  aria-label={`Ir para passo ${idx + 1} de ${INTRO_STEPS.length}`}
                  aria-current={idx === stepIndex ? 'step' : undefined}
                  onClick={() => setStepIndex(idx)}
                  className={`h-2.5 cursor-pointer rounded-sm transition-all ${
                    idx === stepIndex
                      ? highContrast
                        ? 'w-8 bg-white'
                        : 'w-8 bg-[#496FB8]'
                      : 'w-2.5 bg-[#1C325E] hover:bg-[#294885]'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Navigation Buttons */}
          <div className="mt-6 flex items-center gap-3">
            {stepIndex > 0 && (
              <button
                type="button"
                onClick={handlePrev}
                className={`inline-flex min-h-[42px] cursor-pointer items-center justify-center rounded-lg px-4 py-2 text-sm font-medium shadow-sm transition active:scale-[0.97] ${
                  highContrast
                    ? 'bg-zinc-900 text-white hover:bg-zinc-800'
                    : 'bg-[#122650] text-slate-100 hover:bg-[#18336b]'
                }`}
              >
                <span>Voltar</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleNext}
              data-testid="onboarding-next-btn"
              className={`inline-flex min-h-[42px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg px-6 py-2 text-sm font-semibold shadow-md transition active:scale-[0.98] ${
                highContrast
                  ? 'bg-white text-black hover:bg-zinc-200'
                  : 'bg-[#163675] text-white hover:bg-[#1E4591]'
              }`}
            >
              <span>{isLast ? 'Abrir Mapa' : 'Próximo'}</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </main>
  );
};
