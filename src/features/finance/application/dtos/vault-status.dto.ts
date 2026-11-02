export interface VaultStatusDto {
  /** A vault exists (pending or active). */
  readonly initialized: boolean;
  /** The recovery key has been confirmed; finance can be unlocked. */
  readonly confirmed: boolean;
  /** The request carried a valid finance session. */
  readonly unlocked: boolean;
  /** When the session locks if left idle; null when not unlocked. */
  readonly expiresAt: string | null;
}
