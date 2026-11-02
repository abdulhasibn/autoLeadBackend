export interface FinanceSessionDto {
  /** Send as `X-Finance-Session` on every finance request. */
  readonly sessionToken: string;
  /** When the session locks if left idle. */
  readonly expiresAt: string;
}
