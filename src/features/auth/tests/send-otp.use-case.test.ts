import { beforeEach, describe, expect, it } from 'vitest';

import { SendOtpUseCase } from '../application/use-cases/send-otp.use-case';
import type { IAuthProvider } from '../application/ports/auth.port';

// ── Fake ──────────────────────────────────────────────────────────────────────

class FakeAuthProvider implements IAuthProvider {
  sendOtpCalls: string[] = [];
  shouldFailSend = false;

  async sendOtp(phone: string): Promise<void> {
    if (this.shouldFailSend) throw new Error('Provider error');
    this.sendOtpCalls.push(phone);
  }

  async verifyOtp(): Promise<never> {
    throw new Error('Not expected in this test');
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SendOtpUseCase', () => {
  let useCase: SendOtpUseCase;
  let fakeProvider: FakeAuthProvider;

  beforeEach(() => {
    fakeProvider = new FakeAuthProvider();
    useCase = new SendOtpUseCase(fakeProvider);
  });

  it('calls the provider with the exact E.164 phone number', async () => {
    await useCase.execute({ phone: '+919876543210' });

    expect(fakeProvider.sendOtpCalls).toEqual(['+919876543210']);
  });

  it('strips surrounding whitespace from the phone before calling the provider', async () => {
    await useCase.execute({ phone: '  +919876543210  ' });

    expect(fakeProvider.sendOtpCalls).toEqual(['+919876543210']);
  });

  it('throws when phone is not a valid E.164 number', async () => {
    await expect(useCase.execute({ phone: '9876543210' })).rejects.toThrow(
      'E.164',
    );

    expect(fakeProvider.sendOtpCalls).toHaveLength(0);
  });

  it('propagates provider errors to the caller', async () => {
    fakeProvider.shouldFailSend = true;

    await expect(useCase.execute({ phone: '+919876543210' })).rejects.toThrow(
      'Provider error',
    );
  });
});
