import React, { useEffect, useState } from 'react';
import { ArrowRight, ChevronLeft, Volume2, VolumeX } from 'lucide-react';
import { Astronaut3D } from './Astronaut3D';
import { StarfieldBackground } from './StarfieldBackground';

interface IntroOnboardingProps {
  onFinish: () => void;
}

const INTRO_STEPS = [
  {
    tag: '01 · Missão NASA Space Apps',
    title: 'Olá! Eu sou seu guia orbital.',
    text: 'Este portal transforma visualizações reais de satélite da NASA em experiências sonoras e acessíveis, conectando ciência da Terra, música e inclusão.',
  },
  {
    tag: '02 · Dados da Terra em Camadas',
    title: 'Explore o planeta e seus fenômenos.',
    text: 'No dashboard você poderá escolher regiões do globo e alternar entre dados ambientais da NASA — como florestas, oceanos, raios, luzes noturnas e gases atmosféricos.',
  },
  {
    tag: '03 · Sonificação Musical',
    title: 'Cada imagem ganha voz e acorde.',
    text: 'Cada tipo de dado ambiental é traduzido em acordes e texturas musicais próprias, permitindo sentir padrões climáticos pelo ouvido.',
  },
  {
    tag: '04 · Acessibilidade Universal',
    title: 'Ciência feita para todos sentirem.',
    text: 'Com audiodescrição contextual em português e interface acessível, pessoas cegas, com baixa visão ou videntes exploram e vivenciam o planeta juntas.',
  },
];

export const IntroOnboarding: React.FC<IntroOnboardingProps> = ({ onFinish }) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const current = INTRO_STEPS[stepIndex];
  const isLast = stepIndex === INTRO_STEPS.length - 1;

  const stopSpeech = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  };

  const speakStep = (index: number) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();

    const step = INTRO_STEPS[index];
    const utterance = new SpeechSynthesisUtterance(`${step.title} ${step.text}`);
    utterance.lang = 'pt-BR';
    utterance.rate = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const ptVoice =
      voices.find((v) => v.lang.toLowerCase().includes('pt-br')) ||
      voices.find((v) => v.lang.toLowerCase().startsWith('pt'));
    if (ptVoice) utterance.voice = ptVoice;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handleNext = () => {
    if (isLast) {
      stopSpeech();
      onFinish();
      return;
    }
    const next = stepIndex + 1;
    setStepIndex(next);
    if (isSpeaking) speakStep(next);
  };

  const handlePrev = () => {
    if (stepIndex === 0) return;
    const prev = stepIndex - 1;
    setStepIndex(prev);
    if (isSpeaking) speakStep(prev);
  };

  const handleToggleVoice = () => {
    if (isSpeaking) {
      stopSpeech();
    } else {
      speakStep(stepIndex);
    }
  };

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-gradient-to-br from-[#030816] via-[#07142E] to-[#040B1C] px-6 py-10 text-slate-100">
      <StarfieldBackground />

      <div className="relative z-10 flex w-full max-w-4xl flex-col items-center gap-8 rounded-3xl border border-[#1C325E] bg-[#061024]/85 p-6 shadow-2xl backdrop-blur-md md:flex-row md:p-10">
        {/* Top-right Skip button */}
        <button
          type="button"
          onClick={() => {
            stopSpeech();
            onFinish();
          }}
          className="absolute top-5 right-6 cursor-pointer text-xs font-semibold text-slate-400 transition hover:text-slate-100"
        >
          Pular introdução
        </button>

        {/* Left: 3D Modern Astronaut */}
        <div className="flex w-full items-center justify-center md:w-1/2">
          <Astronaut3D stepIndex={stepIndex} isExplaining={isSpeaking || stepIndex > 0} />
        </div>

        {/* Right: Step Explanation */}
        <div className="flex w-full flex-col justify-center md:w-1/2">
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            {current.tag}
          </span>

          <h1 className="font-display mt-2 text-2xl font-bold leading-tight text-slate-100 sm:text-3xl">
            {current.title}
          </h1>

          <p className="mt-4 text-sm leading-relaxed text-slate-300">{current.text}</p>

          {/* Voice button for accessibility */}
          <div className="mt-5">
            <button
              type="button"
              onClick={handleToggleVoice}
              aria-pressed={isSpeaking}
              className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[#254073] bg-[#0B1936] px-4 py-2 text-xs font-semibold text-slate-200 transition hover:bg-[#122650]"
            >
              {isSpeaking ? (
                <>
                  <VolumeX className="h-4 w-4" />
                  Parar voz do astronauta
                </>
              ) : (
                <>
                  <Volume2 className="h-4 w-4" />
                  Ouvir explicação
                </>
              )}
            </button>
          </div>

          {/* Step Dots */}
          <div className="mt-7 flex items-center gap-2" aria-label="Progresso da introdução">
            {INTRO_STEPS.map((_, idx) => (
              <button
                key={idx}
                type="button"
                aria-label={`Ir para passo ${idx + 1}`}
                onClick={() => {
                  setStepIndex(idx);
                  if (isSpeaking) speakStep(idx);
                }}
                className={`h-2 cursor-pointer rounded-full transition-all ${
                  idx === stepIndex ? 'w-7 bg-[#2E59A8]' : 'w-2 bg-[#1C325E] hover:bg-[#294885]'
                }`}
              />
            ))}
          </div>

          {/* Navigation Buttons */}
          <div className="mt-6 flex items-center gap-3">
            {stepIndex > 0 && (
              <button
                type="button"
                onClick={handlePrev}
                className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-[#1C325E] bg-[#0B1936] px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-[#122650]"
              >
                <ChevronLeft className="h-4 w-4" />
                Voltar
              </button>
            )}

            <button
              type="button"
              onClick={handleNext}
              className="inline-flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-full bg-[#163675] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1E4591]"
            >
              {isLast ? 'Entrar no Dashboard' : 'Próximo'}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
