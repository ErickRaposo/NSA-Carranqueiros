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
import { IntroOnboarding } from './components/IntroOnboarding';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';

type AuthView = 'login' | 'register';

export function App(): React.ReactElement {
  const [authView, setAuthView] = useState<AuthView>('login');
  const [users, setUsers] = useState<UserAccount[]>(() => loadStoredUsers());
  const [session, setSession] = useState<AuthSession>(() => loadStoredSession());

  // Shared visual accessibility preferences across Login -> Onboarding -> Map Explorer
  const [highContrast, setHighContrast] = useState(false);
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
      setSession({ user: matched, onboardingDone: false });
      return true;
    },
    [users]
  );

  const handleEnterAsGuest = useCallback(() => {
    setSession({ user: GUEST_USER, onboardingDone: false });
  }, []);

  const handleEnterJuryMode = useCallback(() => {
    setSession({ user: JURY_USER, onboardingDone: true });
  }, []);

  const handleRegisterSuccess = useCallback((newUser: UserAccount) => {
    setUsers((prev) => [...prev, newUser]);
    setSession({ user: newUser, onboardingDone: false });
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
    setAuthView('login');
  }, []);

  // Stage 1: Login / Cadastro (Sober Dark Navy + Official Astronaut Banner)
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
              ? 'Tela de entrada do EARTHSONG. Preencha seu e-mail ou usuário e senha, ou selecione Entrar como Visitante para demonstração.'
              : 'Tela de cadastro do EARTHSONG. Preencha nome, e-mail, usuário e senha de pelo menos 5 caracteres.'
          )
        }
      >
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

  // Stage 2: Interactive 3D Astronaut Onboarding (can skip straight to Map)
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

  // Stage 3: Main Screen — EARTHSONG Accessible 3D Globe / 2D Map Explorer + Jukebox
  return (
    <EarthExplorerView
      userName={session.user.name}
      userId={session.user.username}
      isJuryQuickEntry={session.user.username === 'juri'}
      highContrast={highContrast}
      onToggleHighContrast={handleToggleHighContrast}
      fontScale={fontScale}
      onCycleFontScale={handleCycleFontScale}
      onReopenTour={handleReopenTour}
      onLogout={handleLogout}
    />
  );
}

export default App;
