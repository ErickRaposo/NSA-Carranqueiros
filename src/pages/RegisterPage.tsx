import React, { useRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { UserAccount } from '../auth/authStorage';

interface RegisterPageProps {
  highContrast: boolean;
  onRegisterSuccess: (data: UserAccount) => void;
  onGoToLogin: () => void;
}

export const RegisterPage: React.FC<RegisterPageProps> = ({
  highContrast,
  onRegisterSuccess,
  onGoToLogin,
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const alertRef = useRef<HTMLDivElement | null>(null);

  const showError = (msg: string) => {
    setErrorMsg(msg);
    requestAnimationFrame(() => alertRef.current?.focus());
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !email.trim() || !username.trim() || !password || !confirmPassword) {
      showError('Preencha todos os campos para criar sua conta.');
      return;
    }

    if (password.length < 5) {
      showError('A senha deve ter pelo menos 5 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      showError('As senhas não coincidem.');
      return;
    }

    setErrorMsg(null);
    onRegisterSuccess({
      name: name.trim(),
      email: email.trim(),
      username: username.trim(),
      password,
    });
  };

  const inputClass = highContrast
    ? 'w-full rounded-lg border-2 border-[#facc15] bg-black px-4 py-2.5 text-sm text-white placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#facc15]'
    : 'w-full rounded-lg border border-[#1C325E] bg-[#0B1936] px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-400 transition focus:border-[#38bdf8] focus:outline-none focus:ring-2 focus:ring-[#38bdf8]/25';

  return (
    <>
      <h1 className="font-display text-center text-3xl font-bold tracking-tight">Criar Conta</h1>
      <p className="mt-1 text-center text-xs text-slate-300">
        Seu perfil fica salvo localmente neste navegador.
      </p>

      {errorMsg && (
        <div
          ref={alertRef}
          role="alert"
          tabIndex={-1}
          className={`mt-4 rounded-lg border p-3 text-xs font-medium focus:outline-none focus:ring-2 ${
            highContrast
              ? 'border-[#facc15] bg-black text-[#facc15] focus:ring-[#facc15]'
              : 'border-rose-400/50 bg-rose-950/50 text-rose-200 focus:ring-rose-400'
          }`}
        >
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-5 space-y-3" noValidate>
        <div>
          <label htmlFor="reg-name" className="mb-1 block text-xs font-semibold text-slate-200">
            Nome completo
          </label>
          <input
            id="reg-name"
            type="text"
            autoComplete="name"
            placeholder="Ex: Ana Beatriz"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="reg-email" className="mb-1 block text-xs font-semibold text-slate-200">
            E-mail
          </label>
          <input
            id="reg-email"
            type="email"
            autoComplete="email"
            placeholder="nome@exemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="reg-username" className="mb-1 block text-xs font-semibold text-slate-200">
            Usuário
          </label>
          <input
            id="reg-username"
            type="text"
            autoComplete="username"
            placeholder="anabeatriz"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="reg-password" className="mb-1 block text-xs font-semibold text-slate-200">
            Senha (mínimo 5 caracteres)
          </label>
          <div className="relative">
            <input
              id="reg-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Crie uma senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`${inputClass} pr-11`}
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

        <div>
          <label
            htmlFor="reg-confirm-password"
            className="mb-1 block text-xs font-semibold text-slate-200"
          >
            Confirmar senha
          </label>
          <div className="relative">
            <input
              id="reg-confirm-password"
              type={showConfirm ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Repita a senha"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={`${inputClass} pr-11`}
            />
            <button
              type="button"
              onClick={() => setShowConfirm((prev) => !prev)}
              aria-label={
                showConfirm ? 'Ocultar confirmação de senha' : 'Mostrar confirmação de senha'
              }
              className="absolute inset-y-0 right-0 flex cursor-pointer items-center pr-3.5 text-slate-300 transition hover:text-white"
            >
              {showConfirm ? (
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        <button
          type="submit"
          className={`mt-2 w-full min-h-[44px] cursor-pointer rounded-full py-3 text-sm font-semibold transition active:scale-[0.99] ${
            highContrast
              ? 'bg-[#facc15] text-black hover:bg-[#fde047]'
              : 'bg-[#163675] text-white hover:bg-[#1E4591]'
          }`}
        >
          Cadastrar e continuar
        </button>
      </form>

      <div className="mt-4 text-center text-xs font-semibold text-slate-300">
        Já tem conta?{' '}
        <button
          type="button"
          onClick={onGoToLogin}
          className="cursor-pointer underline transition hover:text-white"
        >
          Voltar ao login
        </button>
      </div>
    </>
  );
};
