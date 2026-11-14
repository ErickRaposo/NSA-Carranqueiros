import { useState } from 'react';
import { LogOut, Sparkles } from 'lucide-react';
import { AuthLayout } from './components/AuthLayout';
import { IntroOnboarding } from './components/IntroOnboarding';
import { StarfieldBackground } from './components/StarfieldBackground';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';

type AuthView = 'login' | 'register';

interface UserAccount {
  name: string;
  email: string;
  username: string;
  password: string;
}

const DEFAULT_USERS: UserAccount[] = [
  {
    name: 'Administrador',
    email: 'admin@earthsong.space',
    username: 'admin',
    password: '12345',
  },
];

export function App() {
  const [authView, setAuthView] = useState<AuthView>('login');
  const [users, setUsers] = useState<UserAccount[]>(DEFAULT_USERS);
  const [loggedUser, setLoggedUser] = useState<UserAccount | null>(null);
  const [showIntroAfterLogin, setShowIntroAfterLogin] = useState(true);

  const handleValidateLogin = (identifier: string, password: string): boolean => {
    const normalized = identifier.toLowerCase();
    const matched = users.find(
      (u) =>
        (u.username.toLowerCase() === normalized || u.email.toLowerCase() === normalized) &&
        u.password === password
    );
    if (!matched) return false;
    setLoggedUser(matched);
    setShowIntroAfterLogin(true);
    return true;
  };

  const handleRegisterSuccess = (data: UserAccount) => {
    setUsers((prev) => [...prev, data]);
    setLoggedUser(data);
    setShowIntroAfterLogin(true);
  };

  // 1. Primeiro: Login e Cadastro
  if (!loggedUser) {
    return (
      <AuthLayout>
        {authView === 'login' ? (
          <LoginPage
            onValidateLogin={handleValidateLogin}
            onGoToRegister={() => setAuthView('register')}
          />
        ) : (
          <RegisterPage
            onRegisterSuccess={handleRegisterSuccess}
            onGoToLogin={() => setAuthView('login')}
          />
        )}
      </AuthLayout>
    );
  }

  // 2. Depois do Login: Introdução animada com Astronauta 3D
  if (showIntroAfterLogin) {
    return <IntroOnboarding onFinish={() => setShowIntroAfterLogin(false)} />;
  }

  // 3. Dashboard principal
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-[#030816] via-[#07142E] to-[#040B1C] p-6 text-slate-100">
      <StarfieldBackground />

      <div className="relative z-10 w-full max-w-md rounded-2xl border border-[#1C325E] bg-[#08142C]/90 p-8 text-center shadow-2xl backdrop-blur-md">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          Dashboard do Sistema
        </p>
        <h1 className="font-display mt-2 text-2xl font-bold text-slate-100">
          Bem-vindo, {loggedUser.name}
        </h1>
        <p className="mt-2 text-sm text-slate-300/80">
          Sessão iniciada como <span className="font-semibold text-white">{loggedUser.username}</span>.
          Aqui construiremos os módulos do painel principal.
        </p>

        <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => setShowIntroAfterLogin(true)}
            className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-[#254073] bg-[#0B1936] px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-[#122650]"
          >
            <Sparkles className="h-4 w-4" />
            Rever Astronauta 3D
          </button>

          <button
            type="button"
            onClick={() => {
              setLoggedUser(null);
              setAuthView('login');
            }}
            className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full bg-[#163675] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1E4591]"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
