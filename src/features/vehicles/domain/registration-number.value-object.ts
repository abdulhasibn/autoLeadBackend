/**
 * Separators people type inside a plate ("KA 01-AB 1234", "KA.01/AB1234").
 * They are dropped so every spelling of a plate maps to one stored value,
 * which is what the unique index compares. Any other symbol is rejected.
 */
const SEPARATORS = /[\s.\-/]+/g;

/**
 * Indian-style registration plate. Stored uppercase, letters and digits only:
 * spaces, dashes, dots and slashes are removed (issue #30).
 */
export class RegistrationNumber {
  private constructor(readonly value: string) {}

  static create(input: string): RegistrationNumber {
    const normalized = input.toUpperCase().replace(SEPARATORS, '');
    if (normalized.length === 0) {
      throw new Error('Registration number cannot be empty');
    }
    if (normalized.length > 16) {
      throw new Error('Registration number is too long');
    }
    if (!/^[A-Z0-9]+$/.test(normalized)) {
      throw new Error('Registration number must be alphanumeric');
    }
    return new RegistrationNumber(normalized);
  }
}
