import React, { useRef, useState } from 'react';
import { Disc3, Eye, EyeOff, UserRound } from 'lucide-react';
import mineiroLogo from '../assets/mineiro-logo.png';

interface LoginPageProps {
  highContrast: boolean;
  onValidateLogin: (identifier: string, password: string) => boolean;
  onEnterAsGuest: () => void;
  onEnterJuryMode: () => void;
  onGoToRegister: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  highContrast,
  onValidateLogin,
  onEnterAsGuest,
  onEnterJuryMode,
  onGoToRegister,
}) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const alertRef = useRef<HTMLDivElement | null>(null);

  const showError = (msg: string) => {
    setErrorMsg(msg);
    requestAnimationFrame(() => alertRef.current?.focus());
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setInfoMsg(null);

    if (!identifier.trim() || !password) {
      showError('Preencha seu e-mail ou usuário e a senha para entrar.');
      return;
    }

    const ok = onValidateLogin(identifier.trim(), password);
    if (!ok) {
      showError('Usuário ou senha inválidos. Use admin / 12345 ou entre como visitante.');
      return;
    }

    setErrorMsg(null);
  };

  const inputClass = highContrast
    ? 'w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-white'
    : 'w-full rounded-lg bg-[#0c1a36] px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-400 shadow-inner transition focus:bg-[#122449] focus:outline-none focus:ring-2 focus:ring-blue-400/60';

  return (
    <>
      <div className="text-center">
        <img
          src={mineiroLogo}
          alt="Logo"
          className="mx-auto h-11 w-auto object-contain"
        />
        <h1 className="font-display mt-4 text-2xl font-bold tracking-tight text-slate-100">
          Entrar
        </h1>
        <p className="mt-1 text-sm text-slate-300">
          Explore os dados da Terra com som e narração em português.
        </p>
      </div>

      {errorMsg && (
        <div
          ref={alertRef}
          role="alert"
          tabIndex={-1}
          className={`mt-5 rounded-lg border p-3 text-xs font-medium focus:outline-none focus:ring-2 ${
            highContrast
              ? 'border-[#facc15] bg-black text-[#facc15] focus:ring-[#facc15]'
              : 'border-rose-400/50 bg-rose-950/50 text-rose-200 focus:ring-rose-400'
          }`}
          data-testid="login-error-alert"
        >
          {errorMsg}
        </div>
      )}

      {infoMsg && (
        <div
          role="status"
          className={`mt-5 rounded-lg p-3 text-xs font-medium ${
            highContrast
              ? 'bg-zinc-900 text-white'
              : 'bg-[#0f2042] text-slate-200'
          }`}
        >
          {infoMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
        <div>
          <label
            htmlFor="login-identifier"
            className="mb-1.5 block text-xs font-semibold text-slate-200"
          >
            E-mail ou usuário
          </label>
          <input
            id="login-identifier"
            type="text"
            autoComplete="username"
            placeholder="admin ou admin@mineiro.space"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            className={inputClass}
            data-testid="login-identifier-input"
          />
        </div>

        <div>
          <label
            htmlFor="login-password"
            className="mb-1.5 block text-xs font-semibold text-slate-200"
          >
            Senha
          </label>
          <div className="relative">
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Digite sua senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${inputClass} pr-11`}
              data-testid="login-password-input"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              className="absolute inset-y-0 right-0 flex cursor-pointer items-center pr-3.5 text-slate-300 transition hover:text-white"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        <button
          type="submit"
          data-testid="login-submit-btn"
          className={`mt-2 w-full min-h-[42px] cursor-pointer rounded-lg py-2.5 text-sm font-semibold shadow-md transition active:scale-[0.98] ${
            highContrast
              ? 'bg-white text-black hover:bg-zinc-200'
              : 'bg-[#1a3a7a] text-white hover:bg-[#234b9c]'
          }`}
        >
          Entrar
        </button>

        <button
          type="button"
          onClick={onEnterAsGuest}
          data-testid="guest-login-btn"
          className={`flex w-full min-h-[42px] cursor-pointer items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium shadow-sm transition active:scale-[0.98] ${
            highContrast
              ? 'bg-zinc-900 text-white hover:bg-zinc-800'
              : 'bg-[#0f2042] text-slate-200 hover:bg-[#172d59] hover:text-white'
          }`}
        >
          <UserRound className="h-4 w-4" aria-hidden="true" />
          <span>Entrar como visitante</span>
        </button>

        <button
          type="button"
          onClick={onEnterJuryMode}
          data-testid="jury-quick-btn"
          className={`flex w-full min-h-[42px] cursor-pointer items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium shadow-sm transition active:scale-[0.98] ${
            highContrast
              ? 'bg-zinc-900 text-white hover:bg-zinc-800'
              : 'bg-[#0f2042]/90 text-slate-200 hover:bg-[#172d59] hover:text-white'
          }`}
        >
          <Disc3 className="h-4 w-4" aria-hidden="true" />
          <span>Modo Júri (Jukebox Coletiva)</span>
        </button>
      </form>

      <div className="mt-5 flex items-center justify-between px-1 text-xs font-semibold text-slate-300">
        <button
          type="button"
          onClick={onGoToRegister}
          data-testid="go-to-register-btn"
          className="min-h-[36px] cursor-pointer transition hover:text-white hover:underline"
        >
          Criar nova conta
        </button>
        <button
          type="button"
          onClick={() => {
            setErrorMsg(null);
            setInfoMsg('Credenciais rápidas de teste: usuário "admin" e senha "12345".');
          }}
          className="min-h-[36px] cursor-pointer transition hover:text-white hover:underline"
        >
          Esqueci minha senha
        </button>
      </div>
    </>
  );
};
