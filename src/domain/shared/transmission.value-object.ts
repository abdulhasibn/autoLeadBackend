export const TRANSMISSIONS = ['manual', 'automatic', 'amt', 'cvt', 'dct'] as const;

export type TransmissionValue = (typeof TRANSMISSIONS)[number];

export class Transmission {
  private constructor(readonly value: TransmissionValue) {}

  static create(input: string): Transmission {
    const trimmed = input.trim();
    if (!TRANSMISSIONS.includes(trimmed as TransmissionValue)) {
      throw new Error('Transmission must be manual, automatic, amt, cvt, or dct');
    }
    return new Transmission(trimmed as TransmissionValue);
  }
}
