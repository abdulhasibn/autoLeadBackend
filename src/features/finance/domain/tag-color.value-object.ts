const HEX = /^#[0-9A-F]{6}$/;

/** A tag colour as `#RRGGBB`, stored upper-case. */
export class TagColor {
  private constructor(readonly value: string) {}

  static create(input: string): TagColor {
    const value = input.trim().toUpperCase();
    if (!HEX.test(value)) {
      throw new Error('Tag colour must be a hex colour like #1E88E5');
    }
    return new TagColor(value);
  }
}
