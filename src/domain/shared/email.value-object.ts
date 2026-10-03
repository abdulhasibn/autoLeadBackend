/**
 * Email address value object.
 *
 * Rules enforced:
 * - Trimmed and lowercased
 * - Length 1–255
 * - Basic mailbox shape (local@domain.tld)
 */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class Email {
  private constructor(readonly value: string) {}

  static create(input: string): Email {
    const normalised = input.trim().toLowerCase();
    if (normalised.length === 0 || normalised.length > 255 || !EMAIL.test(normalised)) {
      throw new Error('Email must be a valid email address');
    }
    return new Email(normalised);
  }

  equals(other: Email): boolean {
    return this.value === other.value;
  }
}
