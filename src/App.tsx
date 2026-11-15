import React, { useCallback, useEffect, useState } from 'react';
import { speakTextPt, stopSpeech } from './accessibility/a11yEngine';
import {
  AuthSession,
  GUEST_USER,
  JURY_USER,
  ParticipantProfileInput,
  UserAccount,
  authenticateUser,
  clearStoredSession,
  loadStoredSession,
  loadStoredUsers,
  saveStoredSession,
  saveStoredUsers,
  updateParticipantPassword,
  updateParticipantProfile,
} from './auth/authStorage';
import { AuthLayout } from './components/AuthLayout';
import { EarthExplorerView } from './components/EarthExplorerView';
import { EntryPortal } from './components/EntryPortal';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { migrateGuestContributionsToUser } from './community/unlockStore';
import {
  migrateGuestProgressionToUser,
  renameUserProgression,
} from './game/progressionStore';

type AuthView = 'portal' | 'login' | 'register';

function getInitialHighContrast(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-contrast: more)').matches;
}

export function App(): React.ReactElement {
  const [authView, setAuthView] = useState<AuthView>('portal');
  const [users, setUsers] = useState<UserAccount[]>(() => loadStoredUsers());
  const [session, setSession] = useState<AuthSession>(() => loadStoredSession());

  // Shared visual accessibility preferences across Portal -> Login -> Map Explorer
  const [highContrast, setHighContrast] = useState<boolean>(getInitialHighContrast);
  const [fontScale, setFontScale] = useState(1);
  const [tourNonce, setTourNonce] = useState(0);

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
    migrateGuestProgressionToUser(GUEST_USER.username, newUser.username);
    migrateGuestContributionsToUser(GUEST_USER.username, newUser.username, newUser.name);
    setUsers((prev) => [...prev, newUser]);
    setSession({ user: newUser, onboardingDone: true });
  }, []);

  const handleReopenTour = useCallback(() => {
    setTourNonce((n) => n + 1);
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

  const handleUpdateParticipantProfile = useCallback(
    (input: ParticipantProfileInput): { ok: boolean; errorPt?: string } => {
      if (!session.user) {
        return { ok: false, errorPt: 'Nenhuma sessão ativa.' };
      }
      const res = updateParticipantProfile(users, session.user, input);
      if (!res.ok) {
        return { ok: false, errorPt: res.errorPt };
      }
      if (res.previousUsername.toLowerCase() !== res.updatedUser.username.toLowerCase()) {
        renameUserProgression(res.previousUsername, res.updatedUser.username);
      }
      migrateGuestContributionsToUser(
        res.previousUsername,
        res.updatedUser.username,
        res.updatedUser.name
      );
      setUsers(res.nextUsers);
      setSession((prev) => (prev.user ? { ...prev, user: res.updatedUser } : prev));
      return { ok: true };
    },
    [session.user, users]
  );

  const handleUpdateParticipantPassword = useCallback(
    (currentPassword: string, newPassword: string): { ok: boolean; errorPt?: string } => {
      if (!session.user) {
        return { ok: false, errorPt: 'Nenhuma sessão ativa.' };
      }
      const res = updateParticipantPassword(users, session.user, currentPassword, newPassword);
      if (!res.ok) {
        return { ok: false, errorPt: res.errorPt };
      }
      setUsers(res.nextUsers);
      setSession((prev) => (prev.user ? { ...prev, user: res.updatedUser } : prev));
      return { ok: true };
    },
    [session.user, users]
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
          className="mb-3 inline-flex min-h-[36px] cursor-pointer items-center gap-1.5 text-xs font-semibold text-slate-300 underline-offset-4 hover:text-white hover:underline"
          data-testid="back-to-portal-btn"
        >
          ← Voltar ao Portal
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

  // Stage 2: Full-Bleed Planetary Explorer + In-App Mineiro3D Guide + Generative Art Studio
  return (
    <EarthExplorerView
      userName={session.user.name}
      userId={session.user.username}
      username={session.user.username}
      userEmail={session.user.email}
      originCountryCode={session.user.originCountryCode}
      onChangeOriginCountry={handleChangeOriginCountry}
      onUpdateProfile={handleUpdateParticipantProfile}
      onUpdatePassword={handleUpdateParticipantPassword}
      isGuestSession={Boolean(session.user.isGuest)}
      isJuryQuickEntry={session.user.username === 'juri'}
      highContrast={highContrast}
      onToggleHighContrast={handleToggleHighContrast}
      fontScale={fontScale}
      onCycleFontScale={handleCycleFontScale}
      tourNonce={tourNonce}
      onReopenTour={handleReopenTour}
      onOpenAuth={handleOpenAccountAuth}
      onOpenRegister={handleOpenRegister}
      onLogout={handleLogout}
    />
  );
}

export default App;
