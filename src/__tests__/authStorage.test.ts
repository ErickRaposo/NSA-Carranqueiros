import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ADMIN_USER,
  GUEST_USER,
  authenticateUser,
  loadStoredSession,
  loadStoredUsers,
  updateParticipantPassword,
  updateParticipantProfile,
} from '../auth/authStorage';
import {
  createInitialProgressionState,
  loadProgressionState,
  renameUserProgression,
  saveProgressionState,
} from '../game/progressionStore';

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
    expect(GUEST_USER.originCountryCode).toBeUndefined();
    expect(DEFAULT_ADMIN_USER.originCountryCode).toBe('BR');
  });

  it('updates participant profile and rejects duplicate or invalid handles/emails', () => {
    const users = [
      DEFAULT_ADMIN_USER,
      {
        name: 'Helena Costa',
        username: 'helena',
        email: 'helena@nasa.gov',
        password: 'secret',
        originCountryCode: 'PT',
      },
    ];

    // Reject guest profile edit
    expect(
      updateParticipantProfile(users, GUEST_USER, {
        name: 'Visitante Novo',
        username: 'visitante2',
        email: 'v@nasa.gov',
      }).ok
    ).toBe(false);

    // Reject duplicate username
    expect(
      updateParticipantProfile(users, DEFAULT_ADMIN_USER, {
        name: 'Administrador',
        username: 'helena',
        email: 'admin@mineiro.space',
      }).ok
    ).toBe(false);

    // Reject reserved username
    expect(
      updateParticipantProfile(users, DEFAULT_ADMIN_USER, {
        name: 'Administrador',
        username: 'visitante',
        email: 'admin@mineiro.space',
      }).ok
    ).toBe(false);

    // Valid update of name, @username, email, and country
    const okRes = updateParticipantProfile(users, DEFAULT_ADMIN_USER, {
      name: 'Samuel Amorim',
      username: '@samuel_amorim',
      email: 'samuel@mineiro.space',
      originCountryCode: 'PT',
    });
    expect(okRes.ok).toBe(true);
    if (okRes.ok) {
      expect(okRes.updatedUser.name).toBe('Samuel Amorim');
      expect(okRes.updatedUser.username).toBe('samuel_amorim');
      expect(okRes.updatedUser.email).toBe('samuel@mineiro.space');
      expect(okRes.updatedUser.originCountryCode).toBe('PT');
      expect(okRes.nextUsers[0].username).toBe('samuel_amorim');
      expect(okRes.previousUsername).toBe('admin');
    }
  });

  it('validates and updates participant password cleanly', () => {
    const users = [DEFAULT_ADMIN_USER];

    expect(updateParticipantPassword(users, DEFAULT_ADMIN_USER, 'errada', 'nova123').ok).toBe(
      false
    );
    expect(updateParticipantPassword(users, DEFAULT_ADMIN_USER, '12345', '123').ok).toBe(false);

    const updated = updateParticipantPassword(users, DEFAULT_ADMIN_USER, '12345', 'orbita2026');
    expect(updated.ok).toBe(true);
    if (updated.ok) {
      expect(authenticateUser(updated.nextUsers, 'admin', 'orbita2026')?.username).toBe('admin');
    }
  });

  it('handles renameUserProgression safely even without browser localStorage', () => {
    const base = createInitialProgressionState();
    saveProgressionState('old_handle', {
      ...base,
      exploredRegionKeys: ['country:076'],
    });
    expect(() => renameUserProgression('old_handle', 'new_handle')).not.toThrow();
    expect(loadProgressionState('new_handle')).toBeDefined();
  });
});
