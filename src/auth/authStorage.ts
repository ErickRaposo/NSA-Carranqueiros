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
