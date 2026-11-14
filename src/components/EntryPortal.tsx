import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Compass,
  Contrast,
  Disc3,
  LogIn,
  Music2,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import mineiroLogo from '../assets/mineiro-logo.png';
import { speakTextPt, stopSpeech } from '../accessibility/a11yEngine';
import { STEM_METAS, STEM_ORDER } from '../community/unlockStore';
import { Mineiro3D } from './Mineiro3D';
import { StarfieldBackground } from './StarfieldBackground';

interface EntryPortalProps {
  highContrast: boolean;
  onToggleHighContrast: () => void;
  fontScale: number;
  onCycleFontScale: () => void;
  onExploreEarth: () => void;
  onEnterJuryMode: () => void;
  onOpenAuth: () => void;
}

export const EntryPortal: React.FC<EntryPortalProps> = ({
  highContrast,
  onToggleHighContrast,
  fontScale,
  onCycleFontScale,
  onExploreEarth,
  onEnterJuryMode,
  onOpenAuth,
}) => {
  const [audioPreviewActive, setAudioPreviewActive] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const previewCtxRef = useRef<AudioContext | null>(null);

  const stopPreviewAudio = useCallback(() => {
    if (previewCtxRef.current) {
      void previewCtxRef.current.close().catch(() => {});
      previewCtxRef.current = null;
    }
    setAudioPreviewActive(false);
  }, []);

  useEffect(() => {
    return () => {
      stopPreviewAudio();
      stopSpeech();
    };
  }, [stopPreviewAudio]);

  const handleToggleAudioPreview = useCallback(() => {
    if (audioPreviewActive) {
      stopPreviewAudio();
      return;
    }
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      previewCtxRef.current = ctx;

      const master = ctx.createGain();
      master.gain.setValueAtTime(0.001, ctx.currentTime);
      master.gain.exponentialRampToValueAtTime(0.16, ctx.currentTime + 0.6);
      master.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 4.8);
      master.connect(ctx.destination);

      // F#m9 warm planetary chord matching Brasil/Amazonia harmonic palette
      [185.0, 220.0, 277.18, 329.63, 415.3].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
        osc.frequency.value = freq;
        osc.connect(master);
        osc.start();
        osc.stop(ctx.currentTime + 5.0);
      });

      setAudioPreviewActive(true);
      window.setTimeout(() => {
        stopPreviewAudio();
      }, 4900);
    } catch {
      setAudioPreviewActive(false);
    }
  }, [audioPreviewActive, stopPreviewAudio]);

  const handleSpeakIntro = useCallback(() => {
    if (isSpeaking) {
      stopSpeech();
      setIsSpeaking(false);
      return;
    }
    speakTextPt(
      'O planeta está esperando para ser ouvido. Em MINEIRØ, dados reais da NASA de raios, monóxido de carbono, temperatura, óxidos de nitrogênio e ventos ganham voz em cinco instrumentos. Clique em Explorar a Terra para navegar pelo globo vivo e acender camadas com a comunidade.',
      true,
      {
        maleVoice: true,
        onStart: () => setIsSpeaking(true),
        onEnd: () => setIsSpeaking(false),
      }
    );
  }, [isSpeaking]);

  return (
    <main
      className={`entry-portal ${highContrast ? 'high-contrast' : ''}`}
      style={{ fontSize: `${Math.round(fontScale * 100)}%` }}
      aria-label="Portal de entrada do MINEIRØ — Explorador Planetário Sonoro"
    >
      {!highContrast && <StarfieldBackground />}

      {/* Ambient radial planetary glow */}
      {!highContrast && (
        <div className="entry-planet-aura" aria-hidden="true">
          <div className="entry-orbital-ring entry-ring-outer" />
          <div className="entry-orbital-ring entry-ring-inner" />
        </div>
      )}

      {/* Top minimal bar */}
      <header className="entry-topbar">
        <div className="entry-brand">
          <img src={mineiroLogo} alt="MINEIRØ" className="h-8 w-auto object-contain" />
        </div>

        <div className="entry-top-actions" role="group" aria-label="Acessibilidade e conta">
          <button
            type="button"
            className="portal-pill-btn"
            onClick={handleSpeakIntro}
            aria-pressed={isSpeaking}
            title="Ouvir introdução falada em português"
            data-testid="portal-speak-btn"
          >
            {isSpeaking ? <VolumeX size={16} aria-hidden="true" /> : <Volume2 size={16} aria-hidden="true" />}
            <span>{isSpeaking ? 'Parar voz' : 'Ouvir portal'}</span>
          </button>

          <button
            type="button"
            className={`portal-pill-btn ${highContrast ? 'is-active' : ''}`}
            onClick={onToggleHighContrast}
            aria-pressed={highContrast}
            title="Alternar Alto Contraste WCAG AAA (C)"
            data-testid="portal-contrast-btn"
          >
            <Contrast size={16} aria-hidden="true" />
            <span>Contraste</span>
          </button>

          <button
            type="button"
            className="portal-pill-btn"
            onClick={onCycleFontScale}
            title="Alterar tamanho do texto"
          >
            <span>A+{Math.round(fontScale * 100)}%</span>
          </button>

          <button
            type="button"
            className="portal-pill-btn"
            onClick={onOpenAuth}
            data-testid="open-login-btn"
            title="Entrar com sua conta ou criar cadastro"
          >
            <LogIn size={16} aria-hidden="true" />
            <span>Entrar / Conta</span>
          </button>
        </div>
      </header>

      {/* Center Stage */}
      <section className="entry-center-stage">
        <div className="entry-visual-col" aria-hidden="true">
          <div className="entry-planet-sphere">
            <div className="entry-mascot-wrap">
              <Mineiro3D stepIndex={0} isExplaining={isSpeaking || audioPreviewActive} size="full" />
            </div>
          </div>

          <div className="entry-spectrum-halo">
            {STEM_ORDER.map((id) => {
              const meta = STEM_METAS[id];
              return (
                <span
                  key={id}
                  className="entry-stem-chip"
                  style={{ '--chip-color': meta.accentHex } as React.CSSProperties}
                >
                  <span className="entry-stem-dot" style={{ background: meta.accentHex }} />
                  <span>{meta.labelPt}</span>
                </span>
              );
            })}
          </div>
        </div>

        <div className="entry-copy-col">
          <h1 className="entry-headline font-display">
            O planeta está esperando para ser ouvido.
          </h1>

          <p className="entry-lead">
            Explore fenômenos atmosféricos reais da NASA no globo 3D, desperte cinco instrumentos
            musicais conectados aos pixels da Terra e ilumine regiões inteiras em colaboração com
            pessoas do mundo todo.
          </p>

          <div className="entry-cta-group">
            <button
              type="button"
              className="entry-primary-cta"
              onClick={() => {
                stopPreviewAudio();
                stopSpeech();
                onExploreEarth();
              }}
              data-testid="explore-earth-btn"
            >
              <Compass size={20} aria-hidden="true" />
              <span>EXPLORAR A TERRA</span>
            </button>

            <button
              type="button"
              className={`entry-audio-btn ${audioPreviewActive ? 'is-playing' : ''}`}
              onClick={handleToggleAudioPreview}
              aria-pressed={audioPreviewActive}
              data-testid="portal-audio-preview-btn"
            >
              <Music2 size={18} aria-hidden="true" />
              <span>{audioPreviewActive ? 'Ouvindo acorde planetário...' : 'Ouvir prévia sonora'}</span>
            </button>
          </div>

          <div className="entry-secondary-row">
            <button
              type="button"
              className="entry-jury-btn"
              onClick={() => {
                stopPreviewAudio();
                stopSpeech();
                onEnterJuryMode();
              }}
              data-testid="jury-quick-btn"
            >
              <Disc3 size={16} aria-hidden="true" />
              <span>Modo Júri (Jukebox Coletiva — Brasil 1/5 pronto)</span>
            </button>

            <span className="entry-collective-note">
              <Sparkles size={14} aria-hidden="true" />
              <span>1 camada por pessoa em cada região · 5 vozes acendem a sinfonia completa</span>
            </span>
          </div>
        </div>
      </section>
    </main>
  );
};
