import { beforeEach, describe, expect, it } from 'vitest';

import type { OtpSession } from '../application/ports/auth.port';
import type { IAuthProvider } from '../application/ports/auth.port';
import { VerifyOtpUseCase } from '../application/use-cases/verify-otp.use-case';

// ── Fake ──────────────────────────────────────────────────────────────────────

const FAKE_SESSION: OtpSession = {
  accessToken: 'access-token-abc',
  refreshToken: 'refresh-token-xyz',
};

class FakeAuthProvider implements IAuthProvider {
  shouldFail = false;
  verifiedPhone = '';
  verifiedToken = '';

  async sendOtp(): Promise<void> {
    throw new Error('Not expected in this test');
  }

  async verifyOtp(phone: string, token: string): Promise<OtpSession> {
    if (this.shouldFail) throw new Error('Invalid or expired OTP');
    this.verifiedPhone = phone;
    this.verifiedToken = token;
    return FAKE_SESSION;
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('VerifyOtpUseCase', () => {
  let useCase: VerifyOtpUseCase;
  let fakeProvider: FakeAuthProvider;

  beforeEach(() => {
    fakeProvider = new FakeAuthProvider();
    useCase = new VerifyOtpUseCase(fakeProvider);
  });

  it('returns session tokens on successful verification', async () => {
    const result = await useCase.execute({
      phone: '+919876543210',
      token: '123456',
    });

    expect(result).toEqual({
      accessToken: 'access-token-abc',
      refreshToken: 'refresh-token-xyz',
    });
  });

  it('passes the normalised phone and token to the provider', async () => {
    await useCase.execute({ phone: '  +919876543210  ', token: '654321' });

    expect(fakeProvider.verifiedPhone).toBe('+919876543210');
    expect(fakeProvider.verifiedToken).toBe('654321');
  });

  it('throws when phone is not a valid E.164 number', async () => {
    await expect(
      useCase.execute({ phone: 'not-a-phone', token: '123456' }),
    ).rejects.toThrow('E.164');
  });

  it('propagates provider errors to the caller', async () => {
    fakeProvider.shouldFail = true;

    await expect(
      useCase.execute({ phone: '+919876543210', token: '000000' }),
    ).rejects.toThrow('Invalid or expired OTP');
  });
});
