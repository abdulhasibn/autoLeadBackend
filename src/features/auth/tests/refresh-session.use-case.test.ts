import { beforeEach, describe, expect, it } from 'vitest';

import type { AuthSession } from '../application/ports/auth.port';
import type { IAuthProvider } from '../application/ports/auth.port';
import { RefreshSessionUseCase } from '../application/use-cases/refresh-session.use-case';

const FAKE_SESSION: AuthSession = {
  accessToken: 'access-token-new',
  refreshToken: 'refresh-token-new',
};

class FakeAuthProvider implements IAuthProvider {
  shouldFail = false;
  lastRefreshToken = '';

  async signIn(): Promise<never> {
    throw new Error('Not expected in this test');
  }

  async refresh(refreshToken: string): Promise<AuthSession> {
    if (this.shouldFail) throw new Error('Invalid email or password');
    this.lastRefreshToken = refreshToken;
    return FAKE_SESSION;
  }
}

describe('RefreshSessionUseCase', () => {
  let useCase: RefreshSessionUseCase;
  let fakeProvider: FakeAuthProvider;

  beforeEach(() => {
    fakeProvider = new FakeAuthProvider();
    useCase = new RefreshSessionUseCase(fakeProvider);
  });

  it('returns the rotated session', async () => {
    const result = await useCase.execute({ refreshToken: 'refresh-token-old' });

    expect(result).toEqual(FAKE_SESSION);
    expect(fakeProvider.lastRefreshToken).toBe('refresh-token-old');
  });

  it('propagates provider errors to the caller', async () => {
    fakeProvider.shouldFail = true;

    await expect(useCase.execute({ refreshToken: 'expired' })).rejects.toThrow(
      'Invalid email or password',
    );
  });
});
