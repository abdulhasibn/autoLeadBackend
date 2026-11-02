const MAX_LENGTH = 40;

/** A tag's display name: trimmed, inner whitespace collapsed, 1–40 characters. */
export class TagName {
  private constructor(readonly value: string) {}

  static create(input: string): TagName {
    const value = input.trim().replace(/\s+/g, ' ');
    if (value.length === 0 || value.length > MAX_LENGTH) {
      throw new Error(`Tag name must be 1–${MAX_LENGTH} characters`);
    }
    return new TagName(value);
  }

  /** Case-insensitive identity used for uniqueness. */
  get key(): string {
    return this.value.toLocaleLowerCase('en-IN');
  }
}
