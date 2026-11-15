import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Eye, EyeOff, Search } from 'lucide-react';
import { UserAccount } from '../auth/authStorage';
import {
  ALL_COUNTRY_OPTIONS,
  CountryFlagIcon,
  getOriginCountryNamePt,
} from '../components/CountryFlag';

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
  const [originCountryCode, setOriginCountryCode] = useState('BR');
  const [countryDropdownOpen, setCountryDropdownOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const alertRef = useRef<HTMLDivElement | null>(null);
  const countryDropdownRef = useRef<HTMLDivElement | null>(null);
  const countrySearchInputRef = useRef<HTMLInputElement | null>(null);

  const filteredCountries = useMemo(() => {
    const q = countrySearch
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    if (!q) return ALL_COUNTRY_OPTIONS;
    return ALL_COUNTRY_OPTIONS.filter((opt) => {
      const normalizedName = opt.namePt
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      return normalizedName.includes(q) || opt.code.toLowerCase().includes(q);
    });
  }, [countrySearch]);

  useEffect(() => {
    if (!countryDropdownOpen) return;
    requestAnimationFrame(() => countrySearchInputRef.current?.focus());
    const handleOutside = (e: MouseEvent) => {
      if (countryDropdownRef.current && !countryDropdownRef.current.contains(e.target as Node)) {
        setCountryDropdownOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCountryDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [countryDropdownOpen]);

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
      originCountryCode: originCountryCode || undefined,
    });
  };

  const inputClass = highContrast
    ? 'w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-white'
    : 'w-full rounded-lg bg-[#0c1a36] px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-400 shadow-inner transition focus:bg-[#122449] focus:outline-none focus:ring-2 focus:ring-blue-400/60';

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

        <div ref={countryDropdownRef} className="relative">
          <label
            id="reg-country-label"
            htmlFor="reg-country-btn"
            className="mb-1 block text-xs font-semibold text-slate-200"
          >
            País de origem
          </label>
          <button
            id="reg-country-btn"
            type="button"
            aria-haspopup="listbox"
            aria-expanded={countryDropdownOpen}
            aria-labelledby="reg-country-label reg-country-btn"
            onClick={() => setCountryDropdownOpen((prev) => !prev)}
            className={`${inputClass} flex items-center justify-between gap-2 text-left cursor-pointer`}
            data-testid="reg-country-select"
          >
            <span className="flex items-center gap-2.5 min-w-0 truncate">
              <CountryFlagIcon code={originCountryCode || null} />
              <span className="truncate">
                {originCountryCode
                  ? `${getOriginCountryNamePt(originCountryCode)} (${originCountryCode})`
                  : 'Órbita Livre / Não informar'}
              </span>
            </span>
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-slate-300 transition-transform ${
                countryDropdownOpen ? 'rotate-180' : ''
              }`}
              aria-hidden="true"
            />
          </button>

          {countryDropdownOpen && (
            <div
              className={`absolute left-0 right-0 z-30 mt-1.5 rounded-lg border shadow-xl ${
                highContrast
                  ? 'border-white bg-black text-white'
                  : 'border-[#1e3a66] bg-[#09152c] text-slate-100'
              }`}
            >
              <div
                className={`flex items-center gap-2 border-b px-3 py-2 transition-colors ${
                  highContrast
                    ? 'border-white/30 focus-within:border-white'
                    : 'border-[#1e3a66] focus-within:border-[#3b82f6]'
                }`}
              >
                <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                <input
                  ref={countrySearchInputRef}
                  type="text"
                  value={countrySearch}
                  onChange={(e) => setCountrySearch(e.target.value)}
                  placeholder="Pesquisar país..."
                  aria-label="Pesquisar país de origem"
                  data-testid="reg-country-search"
                  className="reg-country-search-input w-full bg-transparent text-xs text-slate-100 placeholder:text-slate-400 focus:outline-none"
                />
              </div>

              <ul
                role="listbox"
                aria-labelledby="reg-country-label"
                className="max-h-52 overflow-y-auto p-1"
              >
                {!countrySearch.trim() && (
                  <li
                    role="option"
                    aria-selected={originCountryCode === ''}
                    onClick={() => {
                      setOriginCountryCode('');
                      setCountryDropdownOpen(false);
                      setCountrySearch('');
                    }}
                    className={`flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-sm transition ${
                      originCountryCode === ''
                        ? 'bg-[#1a3a7a] text-white'
                        : 'hover:bg-[#122449]'
                    }`}
                  >
                    <CountryFlagIcon code={null} />
                    <span>Órbita Livre / Não informar</span>
                  </li>
                )}

                {filteredCountries.length === 0 ? (
                  <li className="px-3 py-2.5 text-center text-xs text-slate-400">
                    Nenhum país encontrado.
                  </li>
                ) : (
                  filteredCountries.map((opt) => {
                    const selected = originCountryCode === opt.code;
                    return (
                      <li
                        key={opt.code}
                        role="option"
                        aria-selected={selected}
                        onClick={() => {
                          setOriginCountryCode(opt.code);
                          setCountryDropdownOpen(false);
                          setCountrySearch('');
                        }}
                        className={`flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-sm transition ${
                          selected ? 'bg-[#1a3a7a] text-white' : 'hover:bg-[#122449]'
                        }`}
                      >
                        <CountryFlagIcon code={opt.code} />
                        <span>
                          {opt.namePt} ({opt.code})
                        </span>
                      </li>
                    );
                  })
                )}
              </ul>
            </div>
          )}
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
          className={`mt-2 w-full min-h-[42px] cursor-pointer rounded-lg py-2.5 text-sm font-semibold shadow-md transition active:scale-[0.98] ${
            highContrast
              ? 'bg-white text-black hover:bg-zinc-200'
              : 'bg-[#1a3a7a] text-white hover:bg-[#234b9c]'
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
          Voltar
        </button>
      </div>
    </>
  );
};
