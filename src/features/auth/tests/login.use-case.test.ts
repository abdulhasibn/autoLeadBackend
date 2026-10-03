import { beforeEach, describe, expect, it } from 'vitest';

import type { AuthSession } from '../application/ports/auth.port';
import type { IAuthProvider } from '../application/ports/auth.port';
import { LoginUseCase } from '../application/use-cases/login.use-case';

const FAKE_SESSION: AuthSession = {
  accessToken: 'access-token-abc',
  refreshToken: 'refresh-token-xyz',
};

class FakeAuthProvider implements IAuthProvider {
  shouldFail = false;
  signedInEmail = '';
  signedInPassword = '';

  async signIn(email: string, password: string): Promise<AuthSession> {
    if (this.shouldFail) throw new Error('Invalid email or password');
    this.signedInEmail = email;
    this.signedInPassword = password;
    return FAKE_SESSION;
  }

  async refresh(): Promise<never> {
    throw new Error('Not expected in this test');
  }
}

describe('LoginUseCase', () => {
  let useCase: LoginUseCase;
  let fakeProvider: FakeAuthProvider;

  beforeEach(() => {
    fakeProvider = new FakeAuthProvider();
    useCase = new LoginUseCase(fakeProvider);
  });

  it('returns session tokens on successful sign-in', async () => {
    const result = await useCase.execute({
      email: 'ada@example.com',
      password: 'secret12',
    });

    expect(result).toEqual({
      accessToken: 'access-token-abc',
      refreshToken: 'refresh-token-xyz',
    });
  });

  it('normalises email before calling the provider', async () => {
    await useCase.execute({ email: '  Ada@Example.COM  ', password: 'secret12' });

    expect(fakeProvider.signedInEmail).toBe('ada@example.com');
    expect(fakeProvider.signedInPassword).toBe('secret12');
  });

  it('throws when email is invalid', async () => {
    await expect(useCase.execute({ email: 'not-an-email', password: 'secret12' })).rejects.toThrow(
      'valid email',
    );

    expect(fakeProvider.signedInEmail).toBe('');
  });

  it('throws when password is shorter than 8 characters', async () => {
    await expect(useCase.execute({ email: 'ada@example.com', password: 'short' })).rejects.toThrow(
      'at least 8 characters',
    );
  });

  it('propagates provider errors to the caller', async () => {
    fakeProvider.shouldFail = true;

    await expect(
      useCase.execute({ email: 'ada@example.com', password: 'secret12' }),
    ).rejects.toThrow('Invalid email or password');
  });
});
