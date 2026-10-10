import type { UserId } from '../../../domain/shared/user-id';
import type { AuthSession, IAuthProvider, SignOutScope } from '../application/ports/auth.port';
import type {
  IPasswordCredentials,
  RedeemedResetCode,
} from '../application/ports/password-credentials.port';

/** Records every provider call in order, so tests can assert sequencing. */
export type AuthCall =
  | { readonly kind: 'signOut'; readonly accessToken: string; readonly scope: SignOutScope }
  | { readonly kind: 'verifyPassword'; readonly userId: UserId; readonly password: string }
  | { readonly kind: 'setPassword'; readonly userId: UserId; readonly password: string }
  | { readonly kind: 'sendResetCode'; readonly email: string }
  | { readonly kind: 'redeemResetCode'; readonly email: string; readonly code: string };

export class FakeAuthProvider implements IAuthProvider {
  constructor(private readonly calls: AuthCall[]) {}

  async signIn(): Promise<AuthSession> {
    throw new Error('Not expected in this test');
  }

  async refresh(): Promise<AuthSession> {
    throw new Error('Not expected in this test');
  }

  async signOut(accessToken: string, scope: SignOutScope): Promise<void> {
    this.calls.push({ kind: 'signOut', accessToken, scope });
  }
}

export class FakePasswordCredentials implements IPasswordCredentials {
  currentPassword = 'old-secret-1';
  redeemable: RedeemedResetCode | null = null;

  constructor(private readonly calls: AuthCall[]) {}

  async verifyPassword(userId: UserId, password: string): Promise<boolean> {
    this.calls.push({ kind: 'verifyPassword', userId, password });
    return password === this.currentPassword;
  }

  async setPassword(userId: UserId, password: string): Promise<void> {
    this.calls.push({ kind: 'setPassword', userId, password });
  }

  async sendResetCode(email: string): Promise<void> {
    this.calls.push({ kind: 'sendResetCode', email });
  }

  async redeemResetCode(email: string, code: string): Promise<RedeemedResetCode | null> {
    this.calls.push({ kind: 'redeemResetCode', email, code });
    return this.redeemable;
  }
}
