/**
 * Indian-style registration plate. Stored uppercase with spaces removed.
 */
export class RegistrationNumber {
  private constructor(readonly value: string) {}

  static create(input: string): RegistrationNumber {
    const normalized = input.trim().toUpperCase().replace(/\s+/g, '');
    if (normalized.length === 0) {
      throw new Error('Registration number cannot be empty');
    }
    if (normalized.length > 16) {
      throw new Error('Registration number is too long');
    }
    if (!/^[A-Z0-9-]+$/.test(normalized)) {
      throw new Error('Registration number must be alphanumeric');
    }
    return new RegistrationNumber(normalized);
  }
}
