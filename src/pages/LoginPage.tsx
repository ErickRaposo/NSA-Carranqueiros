import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface LoginPageProps {
  onValidateLogin: (identifier: string, password: string) => boolean;
  onGoToRegister: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onValidateLogin,
  onGoToRegister,
}) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setInfoMsg(null);

    if (!identifier.trim() || !password) {
      setErrorMsg('Preencha seu e-mail/usuário e senha para entrar.');
      return;
    }

    const ok = onValidateLogin(identifier.trim(), password);
    if (!ok) {
      setErrorMsg('Usuário ou senha inválidos. Use admin / 12345.');
      return;
    }

    setErrorMsg(null);
  };

  return (
    <>
      <h1 className="font-display text-center text-3xl font-bold tracking-tight text-slate-100">
        Login
      </h1>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4" noValidate>
        <div>
          <label htmlFor="login-identifier" className="sr-only">
            E-mail ou Usuário
          </label>
          <input
            id="login-identifier"
            type="text"
            autoComplete="username"
            placeholder="E-mail ou Usuário"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            className="w-full rounded-lg border border-[#1C325E] bg-[#0B1936] px-4 py-3 text-sm text-slate-100 placeholder:text-slate-400 transition focus:border-[#496FB8] focus:outline-none focus:ring-2 focus:ring-[#496FB8]/25"
          />
        </div>

        <div className="relative">
          <label htmlFor="login-password" className="sr-only">
            Senha
          </label>
          <input
            id="login-password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-[#1C325E] bg-[#0B1936] py-3 pr-11 pl-4 text-sm text-slate-100 placeholder:text-slate-400 transition focus:border-[#496FB8] focus:outline-none focus:ring-2 focus:ring-[#496FB8]/25"
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
            className="absolute inset-y-0 right-0 flex cursor-pointer items-center pr-3.5 text-slate-400 transition hover:text-slate-200"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        {errorMsg && (
          <p role="alert" className="text-center text-xs font-medium text-rose-400">
            {errorMsg}
          </p>
        )}

        {infoMsg && (
          <p role="status" className="text-center text-xs font-medium text-slate-300">
            {infoMsg}
          </p>
        )}

        <button
          type="submit"
          className="mt-2 w-full cursor-pointer rounded-full bg-[#163675] py-3 text-sm font-semibold text-white transition hover:bg-[#1E4591] active:scale-[0.99]"
        >
          Entrar
        </button>
      </form>

      <div className="mt-4 flex items-center justify-between px-1 text-xs font-semibold text-slate-300">
        <button
          type="button"
          onClick={onGoToRegister}
          className="cursor-pointer transition hover:text-white hover:underline"
        >
          Cadastrar
        </button>
        <button
          type="button"
          onClick={() => {
            setErrorMsg(null);
            setInfoMsg('Use admin / 12345 para acesso rápido ao painel.');
          }}
          className="cursor-pointer transition hover:text-white hover:underline"
        >
          Esqueci minha senha
        </button>
      </div>
    </>
  );
};
