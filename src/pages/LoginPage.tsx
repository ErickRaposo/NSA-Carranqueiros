import React, { useRef, useState } from 'react';
import { Eye, EyeOff, Sparkles } from 'lucide-react';

interface LoginPageProps {
  highContrast: boolean;
  onValidateLogin: (identifier: string, password: string) => boolean;
  onEnterAsGuest: () => void;
  onGoToRegister: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  highContrast,
  onValidateLogin,
  onEnterAsGuest,
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
    ? 'w-full rounded-lg border-2 border-[#facc15] bg-black px-4 py-3 text-sm text-white placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#facc15]'
    : 'w-full rounded-lg border border-[#1C325E] bg-[#0B1936] px-4 py-3 text-sm text-slate-100 placeholder:text-slate-400 transition focus:border-[#38bdf8] focus:outline-none focus:ring-2 focus:ring-[#38bdf8]/25';

  return (
    <>
      <div className="text-center">
        <span
          className={`inline-block rounded-full border px-3 py-1 text-xs font-semibold ${
            highContrast
              ? 'border-[#facc15] text-[#facc15]'
              : 'border-[#1C325E] bg-[#0B1936]/80 text-[#38bdf8]'
          }`}
        >
          Portal EARTHSONG · NASA SVS
        </span>
        <h1 className="font-display mt-3 text-3xl font-bold tracking-tight">Entrar</h1>
        <p className="mt-1.5 text-sm text-slate-300">
          Acesse o explorador acessível da Terra com 5 camadas climáticas da NASA.
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
          className={`mt-5 rounded-lg border p-3 text-xs font-medium ${
            highContrast
              ? 'border-white bg-black text-white'
              : 'border-[#38bdf8]/40 bg-[#0B1936] text-slate-200'
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
            placeholder="admin ou admin@earthsong.space"
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
          className={`mt-2 w-full min-h-[44px] cursor-pointer rounded-full py-3 text-sm font-semibold transition active:scale-[0.99] ${
            highContrast
              ? 'bg-[#facc15] text-black hover:bg-[#fde047]'
              : 'bg-[#163675] text-white hover:bg-[#1E4591]'
          }`}
        >
          Entrar na missão
        </button>

        <button
          type="button"
          onClick={onEnterAsGuest}
          data-testid="guest-login-btn"
          className={`flex w-full min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-full border py-2.5 text-sm font-semibold transition ${
            highContrast
              ? 'border-2 border-[#facc15] bg-black text-[#facc15] hover:bg-[#1a1a00]'
              : 'border-[#38bdf8]/45 bg-[#0B1936] text-[#38bdf8] hover:border-[#38bdf8] hover:bg-[#102652]'
          }`}
        >
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          <span>Entrar como Visitante (Demonstração)</span>
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
