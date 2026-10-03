/**
 * Password value object. Enforces a minimum length only.
 * Never log `value`.
 */
const MIN_LENGTH = 8;

export class Password {
  private constructor(readonly value: string) {}

  static create(input: string): Password {
    if (input.length < MIN_LENGTH) {
      throw new Error('Password must be at least 8 characters');
    }
    return new Password(input);
  }
}
