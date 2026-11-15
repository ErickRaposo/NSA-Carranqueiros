export interface UserAccount {
  name: string;
  email: string;
  username: string;
  password: string;
  originCountryCode?: string;
  isGuest?: boolean;
}

export interface AuthSession {
  user: UserAccount | null;
  onboardingDone: boolean;
}

const USERS_STORAGE_KEY = 'mineiro_users_v1';
const SESSION_STORAGE_KEY = 'mineiro_session_v1';

export const DEFAULT_ADMIN_USER: UserAccount = {
  name: 'Administrador',
  email: 'admin@mineiro.space',
  username: 'admin',
  password: '12345',
  originCountryCode: 'BR',
};

export const GUEST_USER: UserAccount = {
  name: 'Visitante',
  email: 'visitante@mineiro.space',
  username: 'visitante',
  password: '',
  isGuest: true,
};

export const JURY_USER: UserAccount = {
  name: 'Júri Space Apps',
  email: 'juri@mineiro.space',
  username: 'juri',
  password: '',
  isGuest: true,
};

function safeGetStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // Storage disabled (private mode / sandbox)
  }
  return null;
}

export function loadStoredUsers(): UserAccount[] {
  const storage = safeGetStorage();
  if (!storage) return [DEFAULT_ADMIN_USER];

  try {
    const raw = storage.getItem(USERS_STORAGE_KEY);
    if (!raw) return [DEFAULT_ADMIN_USER];
    const parsed = JSON.parse(raw) as UserAccount[];
    if (!Array.isArray(parsed) || parsed.length === 0) return [DEFAULT_ADMIN_USER];
    const hasAdmin = parsed.some((u) => u.username.toLowerCase() === 'admin');
    return hasAdmin ? parsed : [DEFAULT_ADMIN_USER, ...parsed];
  } catch {
    return [DEFAULT_ADMIN_USER];
  }
}

export function saveStoredUsers(users: UserAccount[]): void {
  const storage = safeGetStorage();
  if (!storage) return;
  try {
    storage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  } catch {
    // Ignore quota errors
  }
}

export function loadStoredSession(): AuthSession {
  const storage = safeGetStorage();
  if (!storage) return { user: null, onboardingDone: false };

  try {
    const raw = storage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return { user: null, onboardingDone: false };
    const parsed = JSON.parse(raw) as AuthSession;
    if (!parsed || typeof parsed !== 'object' || !parsed.user) {
      return { user: null, onboardingDone: false };
    }
    return {
      user: parsed.user,
      onboardingDone: Boolean(parsed.onboardingDone),
    };
  } catch {
    return { user: null, onboardingDone: false };
  }
}

export function saveStoredSession(session: AuthSession): void {
  const storage = safeGetStorage();
  if (!storage) return;
  try {
    if (!session.user) {
      storage.removeItem(SESSION_STORAGE_KEY);
    } else {
      storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    }
  } catch {
    // Ignore quota errors
  }
}

export function clearStoredSession(): void {
  const storage = safeGetStorage();
  if (!storage) return;
  try {
    storage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // Ignore
  }
}

export function authenticateUser(
  users: UserAccount[],
  identifier: string,
  password: string
): UserAccount | null {
  const normalized = identifier.trim().toLowerCase();
  if (!normalized || !password) return null;

  return (
    users.find(
      (u) =>
        (u.username.toLowerCase() === normalized || u.email.toLowerCase() === normalized) &&
        u.password === password
    ) ?? null
  );
}

export interface ParticipantProfileInput {
  name: string;
  username: string;
  email: string;
  originCountryCode?: string;
}

export type ParticipantProfileResult =
  | {
      ok: true;
      updatedUser: UserAccount;
      nextUsers: UserAccount[];
      previousUsername: string;
    }
  | {
      ok: false;
      errorPt: string;
    };

const RESERVED_USERNAMES = new Set(['visitante', 'juri', 'guest']);
const USERNAME_PATTERN = /^[a-z0-9_.-]{3,24}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function updateParticipantProfile(
  users: UserAccount[],
  currentUser: UserAccount,
  input: ParticipantProfileInput
): ParticipantProfileResult {
  if (currentUser.isGuest) {
    return { ok: false, errorPt: 'Crie uma conta para salvar dados permanentes de perfil.' };
  }

  const trimmedName = input.name.trim();
  if (trimmedName.length < 2) {
    return { ok: false, errorPt: 'Informe um nome com pelo menos 2 caracteres.' };
  }

  const normalizedUsername = input.username.trim().replace(/^@+/, '').toLowerCase();
  if (!USERNAME_PATTERN.test(normalizedUsername)) {
    return {
      ok: false,
      errorPt: 'Use de 3 a 24 caracteres no usuário (letras, números, ponto, hífen ou _).',
    };
  }
  if (RESERVED_USERNAMES.has(normalizedUsername)) {
    return { ok: false, errorPt: 'Este identificador de usuário é reservado pelo sistema.' };
  }

  const trimmedEmail = input.email.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(trimmedEmail)) {
    return { ok: false, errorPt: 'Informe um endereço de e-mail válido.' };
  }

  const prevUsernameLower = currentUser.username.toLowerCase();

  const usernameTaken = users.some(
    (u) =>
      u.username.toLowerCase() !== prevUsernameLower &&
      u.username.toLowerCase() === normalizedUsername
  );
  if (usernameTaken) {
    return { ok: false, errorPt: 'Este @usuário já está em uso por outro participante.' };
  }

  const emailTaken = users.some(
    (u) =>
      u.username.toLowerCase() !== prevUsernameLower &&
      u.email.toLowerCase() === trimmedEmail
  );
  if (emailTaken) {
    return { ok: false, errorPt: 'Este e-mail já está vinculado a outra conta.' };
  }

  const normalizedOrigin = input.originCountryCode?.trim().toUpperCase() || undefined;
  const updatedUser: UserAccount = {
    ...currentUser,
    name: trimmedName,
    username: normalizedUsername,
    email: trimmedEmail,
    originCountryCode: normalizedOrigin,
  };

  const foundExisting = users.some((u) => u.username.toLowerCase() === prevUsernameLower);
  const nextUsers = foundExisting
    ? users.map((u) => (u.username.toLowerCase() === prevUsernameLower ? updatedUser : u))
    : [...users, updatedUser];

  return {
    ok: true,
    updatedUser,
    nextUsers,
    previousUsername: currentUser.username,
  };
}

export function updateParticipantPassword(
  users: UserAccount[],
  currentUser: UserAccount,
  currentPasswordInput: string,
  newPasswordInput: string
): { ok: true; updatedUser: UserAccount; nextUsers: UserAccount[] } | { ok: false; errorPt: string } {
  if (currentUser.isGuest) {
    return { ok: false, errorPt: 'Sessões de visitante não possuem senha.' };
  }
  if (currentPasswordInput !== currentUser.password) {
    return { ok: false, errorPt: 'A senha atual informada não confere.' };
  }
  if (newPasswordInput.trim().length < 5) {
    return { ok: false, errorPt: 'A nova senha deve ter pelo menos 5 caracteres.' };
  }

  const prevUsernameLower = currentUser.username.toLowerCase();
  const updatedUser: UserAccount = {
    ...currentUser,
    password: newPasswordInput,
  };
  const nextUsers = users.map((u) =>
    u.username.toLowerCase() === prevUsernameLower ? updatedUser : u
  );

  return { ok: true, updatedUser, nextUsers };
}

export function findUserByIdentifier(identifier: string): UserAccount | null {
  const normalized = identifier.trim().toLowerCase();
  if (!normalized) return null;
  const users = loadStoredUsers();
  return (
    users.find(
      (u) => u.username.toLowerCase() === normalized || u.email.toLowerCase() === normalized
    ) ?? null
  );
}

export function updateUserPassword(identifier: string, newPassword: string): boolean {
  const normalized = identifier.trim().toLowerCase();
  if (!normalized || newPassword.length < 5) return false;
  const users = loadStoredUsers();
  const idx = users.findIndex(
    (u) => u.username.toLowerCase() === normalized || u.email.toLowerCase() === normalized
  );
  if (idx === -1) return false;

  const updated = users.map((u, i) => (i === idx ? { ...u, password: newPassword } : u));
  saveStoredUsers(updated);
  return true;
}
