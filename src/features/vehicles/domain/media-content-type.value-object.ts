const MEDIA_CONTENT_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const;

export type MediaContentTypeValue = keyof typeof MEDIA_CONTENT_TYPES;

export class MediaContentType {
  private constructor(readonly value: MediaContentTypeValue) {}

  static create(input: string): MediaContentType {
    const trimmed = input.trim().toLowerCase();
    if (!(trimmed in MEDIA_CONTENT_TYPES)) {
      throw new Error('Media content type must be image/jpeg, image/png, or image/webp');
    }
    return new MediaContentType(trimmed as MediaContentTypeValue);
  }

  get extension(): string {
    return MEDIA_CONTENT_TYPES[this.value];
  }
}
