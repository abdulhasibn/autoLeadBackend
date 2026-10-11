import type { UserId } from '../../../../domain/shared/user-id';

/** A redeemed reset code: who it was for, and the short-lived recovery session. */
export interface RedeemedResetCode {
  readonly userId: UserId;
  readonly accessToken: string;
}

/**
 * Password checks and changes on the identity provider.
 * Kept apart from IAuthProvider so session use cases don't depend on it.
 */
export interface IPasswordCredentials {
  /** True when `password` is the user's current password. */
  verifyPassword(userId: UserId, password: string): Promise<boolean>;

  /** Replaces the user's password. Existing sessions are left alone. */
  setPassword(userId: UserId, password: string): Promise<void>;

  /**
   * Emails a one-time reset code. Resolves the same way whether or not an
   * account exists for `email`, so callers can't probe for accounts.
   */
  sendResetCode(email: string): Promise<void>;

  /** Redeems a reset code, or returns null when it is wrong or expired. */
  redeemResetCode(email: string, code: string): Promise<RedeemedResetCode | null>;
}
