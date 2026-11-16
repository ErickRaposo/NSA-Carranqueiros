import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Compass,
  Contrast,
  LogIn,
  Menu,
  Music2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import earthHorizon from '../assets/earth-horizon.png';
import mineiroLogo from '../assets/mineiro-logo.png';
import symbollLogo from '../assets/symboll.png';
import erickPhoto from '../assets/team/erick.jpeg';
import samuelPhoto from '../assets/team/samuel.png';
import shayenePhoto from '../assets/team/shayene.png';
import momentVideo1 from '../assets/moments/IMG_0312.MOV';
import momentVideo2 from '../assets/moments/IMG_0314.MOV';
import momentVideo3 from '../assets/moments/IMG_0316.MOV';
import momentVideo4 from '../assets/moments/IMG_0317.MOV';
import momentVideo5 from '../assets/moments/IMG_0319.MOV';
import momentVideo6 from '../assets/moments/IMG_0322.MOV';
import { speakTextPt, stopSpeech } from '../accessibility/a11yEngine';
import { LAYER_METAS, VISUAL_LAYER_ORDER } from '../experience/types';
import { Mineiro3D } from './Mineiro3D';
import { StarfieldBackground } from './StarfieldBackground';

const MOMENT_VIDEOS = [
  { id: 'moment-1', src: momentVideo1, label: 'Momento da projeção imersiva 1' },
  { id: 'moment-2', src: momentVideo2, label: 'Momento da projeção imersiva 2' },
  { id: 'moment-3', src: momentVideo3, label: 'Momento da projeção imersiva 3' },
  { id: 'moment-4', src: momentVideo4, label: 'Momento da projeção imersiva 4' },
  { id: 'moment-5', src: momentVideo5, label: 'Momento da projeção imersiva 5' },
  { id: 'moment-6', src: momentVideo6, label: 'Momento da projeção imersiva 6' },
] as const;

const TEAM_MEMBERS = [
  {
    name: 'Erick Raposo',
    photo: erickPhoto,
    github: 'https://github.com/ErickRaposo',
    linkedin: 'https://www.linkedin.com/in/erickraposo/',
  },
  {
    name: 'Samuel Amorim',
    photo: samuelPhoto,
    github: 'https://github.com/samuel-famorim',
    linkedin: 'https://www.linkedin.com/in/samuelfamorim/',
  },
  {
    name: 'Shayene Figueredo',
    photo: shayenePhoto,
    github: 'https://github.com/ShayeneFigueredo',
    linkedin: 'https://www.linkedin.com/in/shayene-figueredo/',
  },
] as const;

interface EntryPortalProps {
  highContrast: boolean;
  onToggleHighContrast: () => void;
  fontScale: number;
  onCycleFontScale: () => void;
  onExploreEarth: () => void;
  onEnterJuryMode?: () => void;
  onOpenAuth?: () => void;
  onOpenRegister?: () => void;
}

export const EntryPortal: React.FC<EntryPortalProps> = ({
  highContrast,
  onToggleHighContrast,
  fontScale,
  onCycleFontScale,
  onExploreEarth,
  onOpenAuth,
  onOpenRegister,
}) => {
  const [audioPreviewActive, setAudioPreviewActive] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [activeNav, setActiveNav] = useState<'inicio' | 'sobre' | 'camadas'>('inicio');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const portalRef = useRef<HTMLElement | null>(null);
  const previewCtxRef = useRef<AudioContext | null>(null);

  const stopPreviewAudio = useCallback(() => {
    if (previewCtxRef.current) {
      void previewCtxRef.current.close().catch(() => {});
      previewCtxRef.current = null;
    }
    setAudioPreviewActive(false);
  }, []);

  useEffect(() => {
    const handleLeave = () => {
      if (document.visibilityState === 'hidden') {
        stopPreviewAudio();
        stopSpeech();
        setIsSpeaking(false);
      }
    };
    const handleUnload = () => {
      stopPreviewAudio();
      stopSpeech();
    };
    document.addEventListener('visibilitychange', handleLeave);
    window.addEventListener('pagehide', handleUnload);
    window.addEventListener('beforeunload', handleUnload);
    return () => {
      document.removeEventListener('visibilitychange', handleLeave);
      window.removeEventListener('pagehide', handleUnload);
      window.removeEventListener('beforeunload', handleUnload);
      stopPreviewAudio();
      stopSpeech();
    };
  }, [stopPreviewAudio]);

  const handleScroll = useCallback(() => {
    const el = portalRef.current;
    if (!el) return;
    const top = el.scrollTop;
    setScrollY(top);

    const vh = el.clientHeight || 720;

    if (top < vh * 0.45) {
      setActiveNav('inicio');
    } else if (top < vh * 1.15) {
      setActiveNav('sobre');
    } else {
      setActiveNav('camadas');
    }
  }, []);

  const scrollToSection = useCallback((id: 'inicio' | 'sobre' | 'camadas') => {
    setMobileMenuOpen(false);
    const el = portalRef.current;
    if (!el) return;
    if (id === 'inicio') {
      el.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const target = el.querySelector(`#portal-${id}`);
    if (target instanceof HTMLElement) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

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

  // Header starts transparent at scroll 0 and increases dark navy opacity on scroll
  const headerAlpha = highContrast ? 1 : Math.min(0.95, scrollY / 220);

  return (
    <main
      ref={portalRef}
      onScroll={handleScroll}
      className={`entry-portal ${highContrast ? 'high-contrast' : ''}`}
      style={{ fontSize: `${Math.round(fontScale * 100)}%` }}
      aria-label="Portal de entrada do MINEIRØ — Explorador Planetário Sonoro"
    >
      <a href="#portal-inicio" className="skip-link">
        Pular para o conteúdo principal
      </a>
      {/* Sticky Top Menu (transparent at top, deepens to dark navy on scroll) */}
      <header
        className="entry-topbar"
        style={{
          backgroundColor: highContrast
            ? '#000000'
            : `rgba(4, 10, 24, ${mobileMenuOpen ? '0.98' : headerAlpha.toFixed(3)})`,
          borderBottomColor:
            highContrast || headerAlpha > 0.12 || mobileMenuOpen
              ? 'rgba(30, 58, 102, 0.55)'
              : 'transparent',
        }}
      >
        <div className="entry-brand">
          <img src={mineiroLogo} alt="MINEIRØ" className="h-8 w-auto object-contain" />
        </div>

        <nav className="entry-nav" aria-label="Navegação principal">
          <button
            type="button"
            className={`entry-nav-link ${activeNav === 'inicio' ? 'is-active' : ''}`}
            onClick={() => scrollToSection('inicio')}
          >
            Início
          </button>
          <button
            type="button"
            className={`entry-nav-link ${activeNav === 'sobre' ? 'is-active' : ''}`}
            onClick={() => scrollToSection('sobre')}
          >
            Sobre o App
          </button>
          <button
            type="button"
            className={`entry-nav-link ${activeNav === 'camadas' ? 'is-active' : ''}`}
            onClick={() => scrollToSection('camadas')}
          >
            Equipe
          </button>
        </nav>

        <div className="entry-top-actions" role="group" aria-label="Acessibilidade e conta">
          <button
            type="button"
            className="portal-icon-btn entry-desktop-only"
            onClick={handleSpeakIntro}
            aria-pressed={isSpeaking}
            title="Ouvir introdução falada em português"
            data-testid="portal-speak-btn"
          >
            {isSpeaking ? <VolumeX size={16} aria-hidden="true" /> : <Volume2 size={16} aria-hidden="true" />}
          </button>

          <button
            type="button"
            className={`portal-icon-btn entry-desktop-only ${highContrast ? 'is-active' : ''}`}
            onClick={onToggleHighContrast}
            aria-pressed={highContrast}
            aria-keyshortcuts="Alt+C"
            title="Alternar Alto Contraste WCAG AAA (Alt+C)"
            data-testid="portal-contrast-btn"
          >
            <Contrast size={16} aria-hidden="true" />
          </button>

          <button
            type="button"
            className="portal-icon-btn entry-desktop-only"
            onClick={onCycleFontScale}
            aria-keyshortcuts="Alt+A"
            title="Alterar tamanho do texto (Alt+A)"
          >
            <span>A+</span>
          </button>

          <button
            type="button"
            className="portal-outline-btn entry-desktop-only"
            onClick={onOpenRegister ?? onExploreEarth}
            data-testid="open-register-btn"
          >
            <span>Controle Tablet</span>
          </button>

          <button
            type="button"
            className="portal-login-btn"
            onClick={onOpenAuth ?? onExploreEarth}
            data-testid="open-login-btn"
            title="Criar Sala Sensorial (Setup)"
          >
            <LogIn size={15} aria-hidden="true" />
            <span>Criar Sala Sensorial</span>
          </button>

          <button
            type="button"
            className="portal-icon-btn entry-mobile-menu-btn"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? 'Fechar menu' : 'Abrir menu'}
            data-testid="mobile-menu-toggle"
          >
            {mobileMenuOpen ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="entry-mobile-drawer" role="region" aria-label="Menu mobile">
            <div className="entry-mobile-nav-list">
              <button
                type="button"
                className={`entry-nav-link ${activeNav === 'inicio' ? 'is-active' : ''}`}
                onClick={() => scrollToSection('inicio')}
              >
                Início
              </button>
              <button
                type="button"
                className={`entry-nav-link ${activeNav === 'sobre' ? 'is-active' : ''}`}
                onClick={() => scrollToSection('sobre')}
              >
                Sobre o App
              </button>
              <button
                type="button"
                className={`entry-nav-link ${activeNav === 'camadas' ? 'is-active' : ''}`}
                onClick={() => scrollToSection('camadas')}
              >
                Equipe
              </button>
            </div>

            <div className="entry-mobile-actions">
              <button
                type="button"
                className="portal-outline-btn w-full"
                onClick={() => {
                  setMobileMenuOpen(false);
                  (onOpenRegister ?? onExploreEarth)();
                }}
              >
                <span>Controle Tablet</span>
              </button>
              <div className="entry-mobile-a11y-row">
                <button
                  type="button"
                  className="portal-icon-btn flex-1 gap-1.5"
                  onClick={handleSpeakIntro}
                  aria-pressed={isSpeaking}
                >
                  {isSpeaking ? <VolumeX size={15} aria-hidden="true" /> : <Volume2 size={15} aria-hidden="true" />}
                  <span>{isSpeaking ? 'Parar' : 'Ouvir'}</span>
                </button>
                <button
                  type="button"
                  className={`portal-icon-btn flex-1 gap-1.5 ${highContrast ? 'is-active' : ''}`}
                  onClick={onToggleHighContrast}
                  aria-pressed={highContrast}
                  aria-keyshortcuts="Alt+C"
                  title="Alternar Alto Contraste WCAG AAA (Alt+C)"
                >
                  <Contrast size={15} aria-hidden="true" />
                  <span>Contraste</span>
                </button>
                <button
                  type="button"
                  className="portal-icon-btn flex-1"
                  onClick={onCycleFontScale}
                  aria-keyshortcuts="Alt+A"
                  title="Alterar tamanho do texto (Alt+A)"
                >
                  <span>A+</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Hero Banner with Starfield + Crescent Earth on Left + Text on Right */}
      <section id="portal-inicio" tabIndex={-1} className="entry-hero-section">
        {!highContrast && <StarfieldBackground />}

        <div className="entry-center-stage">
          <div className="entry-earth-col" aria-hidden="true">
            {!highContrast && (
              <img
                src={earthHorizon}
                alt=""
                className="entry-banner-earth"
              />
            )}
          </div>

          <div className="entry-copy-col">
            <h1 className="entry-headline">
              O PLANETA ESTÁ ESPERANDO PARA SER OUVIDO.
            </h1>

            <p className="entry-lead">
              Entre em uma sala sensorial projetada em duas paredes e teto, controlada por tablet em
              tempo real. Escolha qualquer país e ouça dados reais da NASA ganharem vida em cinco
              camadas musicais e áudio espacial 8D.
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
                <span>Entrar na Sala Sensorial</span>
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
          </div>
        </div>
      </section>

      {/* Content Band — separated by a crisp real horizontal cut below the banner */}
      <div className="entry-content-band">
        <section id="portal-sobre" className="entry-about-section">
          {!highContrast && (
            <img
              src={symbollLogo}
              alt=""
              className="entry-about-watermark"
              aria-hidden="true"
            />
          )}

          <div className="entry-about-grid">
            <div className="entry-about-copy">
              <h2 className="entry-section-title">
                O MINEIRØ
              </h2>
              <div className="entry-title-accent" aria-hidden="true" />
              <p className="entry-about-text">
                O MINEIRØ transforma observações reais de satélites da NASA — raios detectados pela
                ISS, monóxido de carbono, temperatura superficial, óxidos de nitrogênio e ventos —
                em uma instalação audiovisual imersiva projetada em canto (duas paredes e teto).
              </p>
              <p className="entry-about-text">
                Pelo controle do tablet, você escolhe qualquer país e mistura as cinco camadas como
                no Photoshop: o globo gira na parede esquerda, o guia MINEIRØ conduz a jornada na
                parede direita, o teto acende os mapas do território e o áudio 8D envolve toda a sala.
              </p>
              <div className="entry-cta-group">
                <button
                  type="button"
                  className="entry-about-cta"
                  onClick={() => {
                    stopPreviewAudio();
                    stopSpeech();
                    onExploreEarth();
                  }}
                >
                  <Compass size={19} aria-hidden="true" />
                  <span>Entrar na Sala Sensorial</span>
                </button>
              </div>
            </div>

            <div className="entry-about-mascot-col">
              <div className="entry-speech-bubble" role="note">
                <span>Vamos entrar na sala sensorial!</span>
              </div>

              <div className="entry-mascot-stage entry-mascot-stage--lg" aria-hidden="true">
                <div className="entry-mascot-wrap entry-mascot-wrap--lg">
                  <Mineiro3D stepIndex={0} isExplaining={isSpeaking || audioPreviewActive} size="full" />
                </div>

                <div className="entry-orbit-ring">
                  {VISUAL_LAYER_ORDER.map((id, index) => {
                    const meta = LAYER_METAS[id];
                    const angle = index * (360 / VISUAL_LAYER_ORDER.length);
                    const label = meta.labelPt;
                    return (
                      <div
                        key={id}
                        className="entry-orbit-item"
                        style={{ '--orbit-angle': `${angle}deg` } as React.CSSProperties}
                      >
                        <span className="entry-stem-chip entry-stem-chip--light">
                          <span>{label}</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="portal-camadas" className="entry-team-section">
          <div className="entry-team-header">
            <h2 className="entry-team-title">EQUIPE</h2>
          </div>

          <div className="entry-team-grid">
            {TEAM_MEMBERS.map((member) => (
              <article key={member.name} className="entry-team-member">
                <img
                  src={member.photo}
                  alt={member.name}
                  className="entry-team-avatar"
                  loading="lazy"
                />
                <h3 className="entry-team-name">{member.name}</h3>
                <div className="entry-team-links">
                  <a
                    href={member.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="entry-social-btn"
                    aria-label={`LinkedIn de ${member.name}`}
                    title={`LinkedIn de ${member.name}`}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
                    </svg>
                  </a>

                  <a
                    href={member.github}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="entry-social-btn"
                    aria-label={`GitHub de ${member.name}`}
                    title={`GitHub de ${member.name}`}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5c.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34c-.46-1.16-1.11-1.47-1.11-1.47c-.91-.62.07-.6.07-.6c1 .07 1.53 1.03 1.53 1.03c.87 1.52 2.34 1.07 2.91.83c.09-.65.35-1.09.63-1.34c-2.22-.25-4.55-1.11-4.55-4.92c0-1.11.38-2 1.03-2.71c-.1-.25-.45-1.29.1-2.64c0 0 .84-.27 2.75 1.02c.79-.22 1.65-.33 2.5-.33c.85 0 1.71.11 2.5.33c1.91-1.29 2.75-1.02 2.75-1.02c.55 1.35.2 2.39.1 2.64c.65.71 1.03 1.6 1.03 2.71c0 3.82-2.34 4.66-4.57 4.91c.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2z" />
                    </svg>
                  </a>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section
          id="portal-video"
          className="entry-video-section"
          aria-label="Vídeo oficial do projeto MINEIRØ"
        >
          <div className="entry-video-frame">
            <iframe
              className="entry-video-iframe"
              src="https://www.youtube.com/embed/KCzPyhl4ewY?rel=0&modestbranding=1"
              title="MINEIRØ — Vídeo de Apresentação (NASA Space Apps Challenge)"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
        </section>

        <section
          id="portal-moments"
          data-testid="portal-moments-section"
          aria-labelledby="portal-moments-heading"
          className="relative z-[3] w-full bg-[#040b1a] px-4 py-6 sm:px-8 sm:py-9"
        >
          <div className="mx-auto max-w-6xl">
            <h2 id="portal-moments-heading" className="sr-only">
              Reproduza a experiência em qualquer lugar
            </h2>
            <p className="mb-4 px-2 text-center text-xs leading-relaxed font-normal italic text-slate-300 sm:mb-5 sm:text-sm">
              Dois projetores, um navegador e qualquer parede: é só disso que você precisa para viver essa imersão em qualquer lugar do mundo.
            </p>
            <div className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto pb-1 sm:grid sm:grid-cols-3 sm:gap-3 sm:overflow-visible sm:pb-0 md:grid-cols-6">
              {MOMENT_VIDEOS.map((video) => (
                <div
                  key={video.id}
                  className="w-32 shrink-0 snap-start overflow-hidden rounded-xl border border-slate-700/40 bg-[#020612] shadow-lg sm:w-auto"
                >
                  <video
                    src={video.src}
                    aria-label={video.label}
                    autoPlay
                    loop
                    muted
                    playsInline
                    preload="auto"
                    className="h-40 w-full bg-transparent object-cover sm:h-44"
                  />
                </div>
              ))}
            </div>
          </div>
        </section>

        <footer className="entry-footer">
          <img src={mineiroLogo} alt="MINEIRØ" className="h-6 w-auto object-contain opacity-90" />
          <span className="entry-footer-copy">
            MINEIRØ · The Earth Information Jukebox · NASA Space Apps Challenge
          </span>
        </footer>
      </div>
    </main>
  );
};
