import React, { useEffect, useState } from 'react';
import { ArrowRight, Compass, Palette, Sparkles, X } from 'lucide-react';
import { Mineiro3D } from './Mineiro3D';

interface InAppRobotGuideProps {
  open: boolean;
  userName: string;
  highContrast: boolean;
  motionPaused?: boolean;
  spotlightCountryLabel?: string | null;
  spotlightUnlockedCount?: number;
  onDismiss: () => void;
  onCycleVisualStyle: () => void;
  onOpenVisualStudio: () => void;
  onFlyToSpotlight?: () => void;
}

export const InAppRobotGuide: React.FC<InAppRobotGuideProps> = ({
  open,
  userName,
  highContrast,
  motionPaused = false,
  spotlightCountryLabel,
  spotlightUnlockedCount = 4,
  onDismiss,
  onCycleVisualStyle,
  onOpenVisualStudio,
  onFlyToSpotlight,
}) => {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (open) {
      setStep(0);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onDismiss();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onDismiss]);

  if (!open) return null;

  const displayName = userName && userName !== 'Visitante' ? userName.split(' ')[0] : 'Explorador';

  const steps = [
    {
      badge: 'Passo 1 de 3 · Planeta Vivo',
      title: `Bem-vindo à órbita, ${displayName}!`,
      body: 'Gire a Terra livremente e passe o cursor pelas cores: o novo Olho Orbital logo acima da barra inferior traduz em tempo real o que os satélites da NASA estão captando.',
    },
    {
      badge: 'Passo 2 de 3 · Arte Generativa NASA',
      title: 'Misture camadas, ordem e estilos',
      body: 'Mesmo em silêncio, o globo é uma tela viva: alterne Estilos Visuais no topo ou abra o Estúdio Visual à esquerda para mudar a ordem das 5 camadas, fusão de cores e compartilhar sua obra.',
    },
    {
      badge: 'Passo 3 de 3 · Órbita Coletiva (5/5)',
      title: '1 pessoa = 1 camada por país',
      body: spotlightCountryLabel
        ? `Quando 5 pessoas iluminam um país, nasce uma Constelação 5/5 e você libera o Rastro Áureo! ${spotlightCountryLabel} já está em ${spotlightUnlockedCount}/5 — quer acender a última voz agora?`
        : 'Cada pessoa desperta 1 camada por país. Quando 5 exploradores colaboram na mesma região, nasce uma Constelação 5/5 e libera o Rastro Áureo!',
    },
  ];

  const current = steps[step];

  return (
    <aside
      className="inapp-robot-guide console-frame"
      role="region"
      aria-label="Guia interativo do robô Mineirø dentro do globo"
      data-testid="inapp-robot-guide"
    >
      <div className="robot-guide-header">
        <div className="robot-guide-avatar" aria-hidden="true">
          {!highContrast && !motionPaused ? (
            <Mineiro3D size="avatar" stepIndex={step} isExplaining />
          ) : (
            <Sparkles size={18} />
          )}
        </div>

        <div className="robot-guide-meta">
          <span className="robot-guide-badge">{current.badge}</span>
          <strong className="robot-guide-title font-display">{current.title}</strong>
        </div>

        <button
          type="button"
          className="icon-btn-sm"
          onClick={onDismiss}
          title="Pular guia (Esc)"
          aria-label="Fechar guia do robô Mineirø"
          data-testid="robot-guide-skip-btn"
        >
          <X size={14} aria-hidden="true" />
        </button>
      </div>

      <p className="robot-guide-copy">{current.body}</p>

      <div className="robot-guide-dots" aria-hidden="true">
        {[0, 1, 2].map((idx) => (
          <span
            key={idx}
            className={`robot-guide-dot ${idx === step ? 'is-active' : ''}`}
          />
        ))}
      </div>

      <div className="robot-guide-actions">
        <button
          type="button"
          className="tiny-btn"
          onClick={onDismiss}
        >
          Pular
        </button>

        <div className="robot-guide-primary-group">
          {step === 1 && (
            <button
              type="button"
              className="tiny-btn is-on"
              onClick={() => {
                onCycleVisualStyle();
                onOpenVisualStudio();
              }}
              data-testid="robot-try-style-btn"
            >
              <Palette size={12} aria-hidden="true" />
              <span>Testar Estilo</span>
            </button>
          )}

          {step < 2 ? (
            <button
              type="button"
              className="primary-glow-btn launchpad-cta-sm"
              onClick={() => setStep((s) => s + 1)}
              data-testid="robot-guide-next-btn"
            >
              <span>Próximo</span>
              <ArrowRight size={13} aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              className="primary-glow-btn launchpad-cta-sm"
              onClick={() => {
                onDismiss();
                onFlyToSpotlight?.();
              }}
              data-testid="robot-guide-finish-btn"
            >
              <Compass size={13} aria-hidden="true" />
              <span>
                {spotlightCountryLabel
                  ? `Voar para ${spotlightCountryLabel} (${spotlightUnlockedCount}/5)`
                  : 'Começar a Explorar'}
              </span>
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};
