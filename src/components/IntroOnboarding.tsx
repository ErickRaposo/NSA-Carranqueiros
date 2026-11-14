import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowRight,
  ChevronLeft,
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
    tag: '01 · Missão NASA Space Apps',
    title: 'Olá! Eu sou o MINEIRØ, seu guia orbital.',
    text: 'Este portal une visualizações reais da NASA (SVS 5011, 5147, 5148, 5153 e 5154) com leitura por voz em português, sonificação e mapa acessível.',
  },
  {
    tag: '02 · Globo 3D, Mapa 2D e Mistura de Camadas',
    title: 'Explore o planeta e sobreponha até 5 vídeos.',
    text: 'Navegue pelo Globo 3D ou Mapa 2D, dê zoom dentro de cada país e misture camadas de raios, ventos, temperatura, CO e NOx com modos de mesclagem em tempo real.',
  },
  {
    tag: '03 · Destaque Territorial & Logística',
    title: 'Selecione um país para focar região e rotas.',
    text: 'Ao clicar ou buscar um país, uma máscara destaca o território escolhido, desloca o mapa para a esquerda e abre o painel direito com fronteiras, portos e corredores.',
  },
  {
    tag: '04 · Acessibilidade Universal (WCAG AAA)',
    title: 'Ciência sentida por voz, som e alto contraste.',
    text: 'Use as teclas V (voz automática), R (ler local e dados sob o cursor), S (sonificar intensidade), C (alto contraste) e as setas para explorar todo o planeta sem mouse.',
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

  // Automatically speak each step when autoAudio is enabled
  useEffect(() => {
    if (!autoAudio) return;

    const timer = window.setTimeout(() => {
      speakStep(stepIndex);
    }, 180);

    return () => {
      window.clearTimeout(timer);
    };
  }, [stepIndex, autoAudio, speakStep]);

  // Pre-warm speech voices list & cleanup on unmount
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
      className={`relative flex min-h-screen w-full items-center justify-center overflow-y-auto px-4 py-8 sm:px-6 ${
        highContrast
          ? 'bg-black text-white'
          : 'bg-gradient-to-br from-[#030816] via-[#07142E] to-[#040B1C] text-slate-100'
      }`}
      aria-label="Introdução interativa do EARTHSONG com o mascote MINEIRØ"
    >
      {!highContrast && <StarfieldBackground />}

      <div
        className={`relative z-10 flex w-full max-w-4xl flex-col items-center gap-6 rounded-3xl border p-6 shadow-2xl backdrop-blur-md md:flex-row md:gap-8 md:p-10 ${
          highContrast
            ? 'border-2 border-[#facc15] bg-black'
            : 'border-[#1C325E] bg-[#061024]/90'
        }`}
      >
        {/* Top bar inside card */}
        <div className="flex w-full flex-wrap items-center justify-between gap-2 md:absolute md:top-5 md:right-6 md:left-6 md:w-auto">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-300">
              Olá, <strong className="text-white">{userName}</strong>
            </span>
            <button
              type="button"
              onClick={onToggleHighContrast}
              aria-pressed={highContrast}
              className={`inline-flex min-h-[32px] cursor-pointer items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
                highContrast
                  ? 'border-[#facc15] bg-[#facc15] text-black'
                  : 'border-[#1C325E] bg-[#0B1936] text-slate-200 hover:border-[#38bdf8]'
              }`}
            >
              <Contrast className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Contraste</span>
            </button>
            <button
              type="button"
              onClick={onCycleFontScale}
              className={`inline-flex min-h-[32px] cursor-pointer items-center rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
                highContrast
                  ? 'border-[#facc15] bg-black text-[#facc15]'
                  : 'border-[#1C325E] bg-[#0B1936] text-slate-200 hover:border-[#38bdf8]'
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
            className={`min-h-[36px] cursor-pointer rounded-full border px-3.5 py-1 text-xs font-semibold transition ${
              highContrast
                ? 'border-[#facc15] text-[#facc15] hover:bg-[#1a1a00]'
                : 'border-[#1C325E] bg-[#0B1936]/70 text-slate-200 hover:border-[#38bdf8] hover:text-white'
            }`}
          >
            Pular para o Mapa (Esc)
          </button>
        </div>

        {/* Left: 3D Floating Mascot MINEIRØ */}
        <div className="flex w-full flex-col items-center justify-center md:mt-6 md:w-5/12">
          <Mineiro3D stepIndex={stepIndex} isExplaining={isSpeaking || stepIndex > 0} />
          <span
            className={`mt-1 rounded-full border px-3 py-0.5 text-[11px] font-bold tracking-widest ${
              highContrast
                ? 'border-[#facc15] bg-black text-[#facc15]'
                : 'border-[#1C325E] bg-[#0B1936] text-slate-200'
            }`}
          >
            MINEIRØ
          </span>
        </div>

        {/* Right: Speech Bubble + Step Navigation */}
        <div className="flex w-full flex-col justify-center md:mt-6 md:w-7/12">
          <div className="sr-only" aria-live="polite">
            MINEIRØ diz: {current.tag}. {current.title} {current.text}
          </div>

          {/* Speech Bubble pointing toward MINEIRØ */}
          <div
            className={`relative rounded-2xl border p-5 shadow-xl sm:p-6 ${
              highContrast
                ? 'border-2 border-[#facc15] bg-black'
                : 'border-[#254073] bg-[#0B1936]/95'
            }`}
          >
            {/* Desktop left pointer tail */}
            <div
              aria-hidden="true"
              className={`hidden md:block absolute top-12 -left-2.5 h-5 w-5 rotate-45 border-b border-l ${
                highContrast
                  ? 'border-[#facc15] bg-black'
                  : 'border-[#254073] bg-[#0B1936]'
              }`}
            />
            {/* Mobile top pointer tail */}
            <div
              aria-hidden="true"
              className={`md:hidden absolute -top-2.5 left-1/2 -translate-x-1/2 h-5 w-5 rotate-45 border-t border-l ${
                highContrast
                  ? 'border-[#facc15] bg-black'
                  : 'border-[#254073] bg-[#0B1936]'
              }`}
            />

            <div className="flex items-center justify-between gap-2">
              <span
                className={`text-xs font-semibold tracking-wider ${
                  highContrast ? 'text-[#facc15]' : 'text-[#38bdf8]'
                }`}
              >
                {current.tag}
              </span>

              {/* Live Voice Indicator */}
              {isSpeaking && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#163675] px-2.5 py-0.5 text-[10px] font-semibold text-slate-100">
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
              className={`inline-flex min-h-[38px] cursor-pointer items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold transition ${
                highContrast
                  ? 'border-[#facc15] bg-black text-[#facc15] hover:bg-[#1a1a00]'
                  : 'border-[#254073] bg-[#0B1936] text-slate-100 hover:border-[#38bdf8] hover:bg-[#122650]'
              }`}
            >
              {isSpeaking ? (
                <>
                  <VolumeX className="h-4 w-4" aria-hidden="true" />
                  <span>Silenciar MINEIRØ</span>
                </>
              ) : (
                <>
                  <Volume2 className="h-4 w-4" aria-hidden="true" />
                  <span>Ouvir novamente</span>
                </>
              )}
            </button>

            <div className="flex items-center gap-2" aria-label="Progresso da introdução">
              {INTRO_STEPS.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  aria-label={`Ir para passo ${idx + 1} de ${INTRO_STEPS.length}`}
                  aria-current={idx === stepIndex ? 'step' : undefined}
                  onClick={() => setStepIndex(idx)}
                  className={`h-2.5 cursor-pointer rounded-full transition-all ${
                    idx === stepIndex
                      ? highContrast
                        ? 'w-8 bg-[#facc15]'
                        : 'w-8 bg-[#38bdf8]'
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
                className={`inline-flex min-h-[44px] cursor-pointer items-center gap-1 rounded-full border px-4 py-2.5 text-sm font-semibold transition ${
                  highContrast
                    ? 'border-[#facc15] bg-black text-[#facc15]'
                    : 'border-[#1C325E] bg-[#0B1936] text-slate-100 hover:bg-[#122650]'
                }`}
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                <span>Voltar</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleNext}
              data-testid="onboarding-next-btn"
              className={`inline-flex min-h-[44px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold transition ${
                highContrast
                  ? 'bg-[#facc15] text-black hover:bg-[#fde047]'
                  : 'bg-[#163675] text-white hover:bg-[#1E4591]'
              }`}
            >
              <span>{isLast ? 'Abrir Explorador do Mundo' : 'Próximo'}</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </main>
  );
};
