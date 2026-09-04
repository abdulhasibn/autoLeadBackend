/**
 * E.164 phone number value object.
 *
 * Rules enforced:
 * - Starts with '+'
 * - Followed by 7–14 digits (total length 8–15 chars)
 * - No spaces, dashes, or punctuation
 *
 * Supabase OTP requires E.164 format (e.g. +919876543210).
 */
const E164_PHONE = /^\+[1-9]\d{6,14}$/;

export class Phone {
  private constructor(readonly value: string) {}

  static create(input: string): Phone {
    const trimmed = input.trim();
    if (!E164_PHONE.test(trimmed)) {
      throw new Error(
        'Phone must be a valid E.164 number (e.g. +919876543210)',
      );
    }
    return new Phone(trimmed);
  }

  equals(other: Phone): boolean {
    return this.value === other.value;
  }
}
