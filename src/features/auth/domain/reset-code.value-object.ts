/**
 * The one-time code emailed for a password reset: exactly six digits.
 * Surrounding whitespace is ignored. Never log `value`.
 */
const RESET_CODE = /^\d{6}$/;

export class ResetCode {
  private constructor(readonly value: string) {}

  static create(input: string): ResetCode {
    const trimmed = input.trim();
    if (!RESET_CODE.test(trimmed)) {
      throw new Error('Reset code must be 6 digits');
    }
    return new ResetCode(trimmed);
  }
}
