export const MEDIA_CATEGORIES = [
  'front',
  'rear',
  'left',
  'right',
  'interior',
  'dashboard',
  'engine',
  'tyres',
  'other',
] as const;

export type MediaCategoryValue = (typeof MEDIA_CATEGORIES)[number];

export class MediaCategory {
  private constructor(readonly value: MediaCategoryValue) {}

  static create(input: string): MediaCategory {
    const trimmed = input.trim();
    if (!MEDIA_CATEGORIES.includes(trimmed as MediaCategoryValue)) {
      throw new Error('Invalid media category');
    }
    return new MediaCategory(trimmed as MediaCategoryValue);
  }
}
