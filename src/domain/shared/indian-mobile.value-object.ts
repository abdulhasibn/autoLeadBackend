/**
 * An Indian mobile number typed by a website visitor, normalised to E.164.
 *
 * Accepts the shapes people actually type: `98765 43210`, `098765-43210`,
 * `+91 98765 43210`, `919876543210`. A mobile is ten digits starting 6–9.
 */
const MOBILE = /^[6-9]\d{9}$/;

export class IndianMobile {
  private constructor(readonly value: string) {}

  static parse(input: string): IndianMobile | null {
    let digits = input.replace(/[\s\-().]/g, '');
    if (digits.startsWith('+91')) {
      digits = digits.slice(3);
    } else if (digits.length === 12 && digits.startsWith('91')) {
      digits = digits.slice(2);
    } else if (digits.length === 11 && digits.startsWith('0')) {
      digits = digits.slice(1);
    }
    return MOBILE.test(digits) ? new IndianMobile(`+91${digits}`) : null;
  }
}
