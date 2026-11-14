import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface RegisterPageProps {
  onRegisterSuccess: (data: { name: string; email: string; username: string; password: string }) => void;
  onGoToLogin: () => void;
}

export const RegisterPage: React.FC<RegisterPageProps> = ({
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !email.trim() || !username.trim() || !password || !confirmPassword) {
      setErrorMsg('Preencha todos os campos para criar sua conta.');
      return;
    }

    if (password.length < 5) {
      setErrorMsg('A senha deve ter pelo menos 5 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('As senhas não coincidem.');
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

  return (
    <>
      <h1 className="font-display text-center text-3xl font-bold tracking-tight text-slate-100">
        Cadastro
      </h1>

      <form onSubmit={handleSubmit} className="mt-7 space-y-3.5" noValidate>
        <div>
          <label htmlFor="reg-name" className="sr-only">
            Nome completo
          </label>
          <input
            id="reg-name"
            type="text"
            autoComplete="name"
            placeholder="Nome completo"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-[#1C325E] bg-[#0B1936] px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-400 transition focus:border-[#496FB8] focus:outline-none focus:ring-2 focus:ring-[#496FB8]/25"
          />
        </div>

        <div>
          <label htmlFor="reg-email" className="sr-only">
            E-mail
          </label>
          <input
            id="reg-email"
            type="email"
            autoComplete="email"
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-[#1C325E] bg-[#0B1936] px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-400 transition focus:border-[#496FB8] focus:outline-none focus:ring-2 focus:ring-[#496FB8]/25"
          />
        </div>

        <div>
          <label htmlFor="reg-username" className="sr-only">
            Usuário
          </label>
          <input
            id="reg-username"
            type="text"
            autoComplete="username"
            placeholder="Usuário"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full rounded-lg border border-[#1C325E] bg-[#0B1936] px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-400 transition focus:border-[#496FB8] focus:outline-none focus:ring-2 focus:ring-[#496FB8]/25"
          />
        </div>

        <div className="relative">
          <label htmlFor="reg-password" className="sr-only">
            Senha
          </label>
          <input
            id="reg-password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-[#1C325E] bg-[#0B1936] py-2.5 pr-11 pl-4 text-sm text-slate-100 placeholder:text-slate-400 transition focus:border-[#496FB8] focus:outline-none focus:ring-2 focus:ring-[#496FB8]/25"
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

        <div className="relative">
          <label htmlFor="reg-confirm-password" className="sr-only">
            Confirmar senha
          </label>
          <input
            id="reg-confirm-password"
            type={showConfirm ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="Confirmar senha"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full rounded-lg border border-[#1C325E] bg-[#0B1936] py-2.5 pr-11 pl-4 text-sm text-slate-100 placeholder:text-slate-400 transition focus:border-[#496FB8] focus:outline-none focus:ring-2 focus:ring-[#496FB8]/25"
          />
          <button
            type="button"
            onClick={() => setShowConfirm((prev) => !prev)}
            aria-label={showConfirm ? 'Ocultar confirmação de senha' : 'Mostrar confirmação de senha'}
            className="absolute inset-y-0 right-0 flex cursor-pointer items-center pr-3.5 text-slate-400 transition hover:text-slate-200"
          >
            {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        {errorMsg && (
          <p role="alert" className="text-center text-xs font-medium text-rose-400">
            {errorMsg}
          </p>
        )}

        <button
          type="submit"
          className="mt-2 w-full cursor-pointer rounded-full bg-[#163675] py-3 text-sm font-semibold text-white transition hover:bg-[#1E4591] active:scale-[0.99]"
        >
          Criar Conta
        </button>
      </form>

      <div className="mt-4 text-center text-xs font-semibold text-slate-300">
        <button
          type="button"
          onClick={onGoToLogin}
          className="cursor-pointer transition hover:text-white hover:underline"
        >
          Já tenho uma conta · Entrar
        </button>
      </div>
    </>
  );
};
