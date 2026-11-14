import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ADMIN_USER,
  GUEST_USER,
  authenticateUser,
  loadStoredSession,
  loadStoredUsers,
} from '../auth/authStorage';

describe('authStorage', () => {
  it('authenticates default admin by username or email', () => {
    const users = [DEFAULT_ADMIN_USER];
    expect(authenticateUser(users, 'admin', '12345')?.name).toBe('Administrador');
    expect(authenticateUser(users, 'ADMIN@mineiro.space', '12345')?.username).toBe('admin');
    expect(authenticateUser(users, 'admin', 'wrong')).toBeNull();
    expect(authenticateUser(users, '', '12345')).toBeNull();
  });

  it('provides fallback defaults when localStorage is unavailable in Node Vitest', () => {
    const users = loadStoredUsers();
    expect(users.length).toBeGreaterThanOrEqual(1);
    expect(users[0].username).toBe('admin');

    const session = loadStoredSession();
    expect(session).toEqual({ user: null, onboardingDone: false });
    expect(GUEST_USER.isGuest).toBe(true);
  });
});
