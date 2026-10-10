export const BODY_TYPES = [
  'hatchback',
  'sedan',
  'suv',
  'muv',
  'mpv',
  'crossover',
  'coupe',
  'convertible',
  'sports',
  'pick-up',
] as const;

export type BodyTypeValue = (typeof BODY_TYPES)[number];

/** A catalog body style. Some variants list two (e.g. "crossover, suv"). */
export class BodyType {
  private constructor(readonly value: BodyTypeValue) {}

  static create(input: string): BodyType {
    const normalized = input.trim().toLowerCase();
    if (!BODY_TYPES.includes(normalized as BodyTypeValue)) {
      throw new Error(`Body type must be one of ${BODY_TYPES.join(', ')}`);
    }
    return new BodyType(normalized as BodyTypeValue);
  }

  /** Reads a catalog `body_type` cell; unknown parts are skipped. */
  static parseCatalogList(input: string | null): BodyTypeValue[] {
    if (input === null) {
      return [];
    }
    return input
      .split(',')
      .map((part) => part.trim().toLowerCase())
      .filter((part): part is BodyTypeValue => BODY_TYPES.includes(part as BodyTypeValue));
  }
}
