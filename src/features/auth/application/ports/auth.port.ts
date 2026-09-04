export interface OtpSession {
  readonly accessToken: string;
  readonly refreshToken: string;
}

/**
 * Auth provider port — OTP-based authentication operations.
 * Use cases depend on this interface; Supabase Auth is one implementation.
 */
export interface IAuthProvider {
  /**
   * Sends a one-time password to the given E.164 phone number.
   * Rejects with an Error when the downstream provider fails.
   */
  sendOtp(phone: string): Promise<void>;

  /**
   * Exchanges a phone + OTP token pair for session credentials.
   * Rejects with an Error when verification fails (wrong/expired token).
   */
  verifyOtp(phone: string, token: string): Promise<OtpSession>;
}
