import React, { useCallback, useEffect, useState } from 'react';
import { speakTextPt, stopSpeech } from './accessibility/a11yEngine';
import {
  AuthSession,
  GUEST_USER,
  JURY_USER,
  UserAccount,
  authenticateUser,
  clearStoredSession,
  loadStoredSession,
  loadStoredUsers,
  saveStoredSession,
  saveStoredUsers,
} from './auth/authStorage';
import { AuthLayout } from './components/AuthLayout';
import { EarthExplorerView } from './components/EarthExplorerView';
import { EntryPortal } from './components/EntryPortal';
import { IntroOnboarding } from './components/IntroOnboarding';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';

type AuthView = 'portal' | 'login' | 'register';

function getInitialHighContrast(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-contrast: more)').matches;
}

export function App(): React.ReactElement {
  const [authView, setAuthView] = useState<AuthView>('portal');
  const [users, setUsers] = useState<UserAccount[]>(() => loadStoredUsers());
  const [session, setSession] = useState<AuthSession>(() => loadStoredSession());

  // Shared visual accessibility preferences across Portal -> Login -> Onboarding -> Map Explorer
  const [highContrast, setHighContrast] = useState<boolean>(getInitialHighContrast);
  const [fontScale, setFontScale] = useState(1);

  useEffect(() => {
    saveStoredSession(session);
  }, [session]);

  useEffect(() => {
    saveStoredUsers(users);
  }, [users]);

  const handleToggleHighContrast = useCallback(() => {
    setHighContrast((prev) => !prev);
  }, []);

  const handleCycleFontScale = useCallback(() => {
    setFontScale((s) => (s >= 1.29 ? 1 : Number((s + 0.15).toFixed(2))));
  }, []);

  const handleValidateLogin = useCallback(
    (identifier: string, password: string): boolean => {
      const matched = authenticateUser(users, identifier, password);
      if (!matched) return false;
      setSession({ user: matched, onboardingDone: true });
      return true;
    },
    [users]
  );

  const handleEnterAsGuest = useCallback(() => {
    setSession({ user: GUEST_USER, onboardingDone: true });
  }, []);

  const handleEnterJuryMode = useCallback(() => {
    setSession({ user: JURY_USER, onboardingDone: true });
  }, []);

  const handleRegisterSuccess = useCallback((newUser: UserAccount) => {
    setUsers((prev) => [...prev, newUser]);
    setSession({ user: newUser, onboardingDone: true });
  }, []);

  const handleFinishOnboarding = useCallback(() => {
    setSession((prev) => ({ ...prev, onboardingDone: true }));
  }, []);

  const handleReopenTour = useCallback(() => {
    setSession((prev) => ({ ...prev, onboardingDone: false }));
  }, []);

  const handleLogout = useCallback(() => {
    stopSpeech();
    clearStoredSession();
    setSession({ user: null, onboardingDone: false });
    setAuthView('portal');
  }, []);

  const handleOpenAccountAuth = useCallback(() => {
    stopSpeech();
    clearStoredSession();
    setSession({ user: null, onboardingDone: false });
    setAuthView('login');
  }, []);

  const handleOpenRegister = useCallback(() => {
    stopSpeech();
    clearStoredSession();
    setSession({ user: null, onboardingDone: false });
    setAuthView('register');
  }, []);

  const handleChangeOriginCountry = useCallback(
    (countryCode: string) => {
      const normalized = countryCode || undefined;
      setSession((prev) =>
        prev.user ? { ...prev, user: { ...prev.user, originCountryCode: normalized } } : prev
      );
      setUsers((prev) =>
        prev.map((u) =>
          session.user && u.username.toLowerCase() === session.user.username.toLowerCase()
            ? { ...u, originCountryCode: normalized }
            : u
        )
      );
    },
    [session.user]
  );

  // Stage 1A: Cinematic Entry Portal ("O planeta está esperando para ser ouvido.")
  if (!session.user && authView === 'portal') {
    return (
      <EntryPortal
        highContrast={highContrast}
        onToggleHighContrast={handleToggleHighContrast}
        fontScale={fontScale}
        onCycleFontScale={handleCycleFontScale}
        onExploreEarth={handleEnterAsGuest}
        onEnterJuryMode={handleEnterJuryMode}
        onOpenAuth={() => setAuthView('login')}
        onOpenRegister={() => setAuthView('register')}
      />
    );
  }

  // Stage 1B: Login / Cadastro (accessible from Portal or HUD "Entrar / Conta")
  if (!session.user) {
    return (
      <AuthLayout
        highContrast={highContrast}
        onToggleHighContrast={handleToggleHighContrast}
        fontScale={fontScale}
        onCycleFontScale={handleCycleFontScale}
        onSpeakScreen={() =>
          speakTextPt(
            authView === 'login'
              ? 'Tela de entrada do MINEIRØ. Preencha seu e-mail ou usuário e senha, ou clique em Explorar sem login.'
              : 'Tela de cadastro do MINEIRØ. Preencha nome, e-mail, usuário e senha de pelo menos 5 caracteres.'
          )
        }
      >
        <button
          type="button"
          onClick={() => setAuthView('portal')}
          className="mb-3 inline-flex min-h-[36px] cursor-pointer items-center text-xs font-semibold text-slate-300 underline-offset-4 hover:text-white hover:underline"
          data-testid="back-to-portal-btn"
        >
          Voltar
        </button>

        {authView === 'login' ? (
          <LoginPage
            highContrast={highContrast}
            onValidateLogin={handleValidateLogin}
            onEnterAsGuest={handleEnterAsGuest}
            onEnterJuryMode={handleEnterJuryMode}
            onGoToRegister={() => setAuthView('register')}
          />
        ) : (
          <RegisterPage
            highContrast={highContrast}
            onRegisterSuccess={handleRegisterSuccess}
            onGoToLogin={() => setAuthView('login')}
          />
        )}
      </AuthLayout>
    );
  }

  // Stage 2: Optional guided 3D MINEIRØ tour when requested from HUD
  if (!session.onboardingDone) {
    return (
      <IntroOnboarding
        userName={session.user.name}
        highContrast={highContrast}
        onToggleHighContrast={handleToggleHighContrast}
        fontScale={fontScale}
        onCycleFontScale={handleCycleFontScale}
        onFinish={handleFinishOnboarding}
      />
    );
  }

  // Stage 3: Full-Bleed Planetary Explorer + Gamified Collective Jukebox
  return (
    <EarthExplorerView
      userName={session.user.name}
      userId={session.user.username}
      username={session.user.username}
      originCountryCode={session.user.originCountryCode}
      onChangeOriginCountry={handleChangeOriginCountry}
      isGuestSession={Boolean(session.user.isGuest)}
      isJuryQuickEntry={session.user.username === 'juri'}
      highContrast={highContrast}
      onToggleHighContrast={handleToggleHighContrast}
      fontScale={fontScale}
      onCycleFontScale={handleCycleFontScale}
      onReopenTour={handleReopenTour}
      onOpenAuth={handleOpenAccountAuth}
      onOpenRegister={handleOpenRegister}
      onLogout={handleLogout}
    />
  );
}

export default App;
