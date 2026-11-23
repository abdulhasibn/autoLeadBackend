import { IndianMobile } from './indian-mobile.value-object';

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
      throw new Error('Phone must be a valid E.164 number (e.g. +919876543210)');
    }
    return new Phone(trimmed);
  }

  /**
   * For phones staff type into the CRM (new and edited leads, owners, staff).
   * Must be an Indian mobile (10 digits, starting 6-9); forgiving input such as
   * `98765 43210` is normalised to `+91...`. Rows already stored are read with
   * `create`, so older non-mobile numbers still load.
   */
  static createIndianMobile(input: string): Phone {
    const mobile = IndianMobile.parse(input);
    if (mobile === null) {
      throw new Error('Enter a 10-digit mobile number (e.g. +919876543210)');
    }
    return new Phone(mobile.value);
  }

  equals(other: Phone): boolean {
    return this.value === other.value;
  }
}
