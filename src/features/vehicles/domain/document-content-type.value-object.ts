const DOCUMENT_CONTENT_TYPES = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
} as const;

export type DocumentContentTypeValue = keyof typeof DOCUMENT_CONTENT_TYPES;

export class DocumentContentType {
  private constructor(readonly value: DocumentContentTypeValue) {}

  static create(input: string): DocumentContentType {
    const trimmed = input.trim().toLowerCase();
    if (!(trimmed in DOCUMENT_CONTENT_TYPES)) {
      throw new Error('Document content type must be application/pdf, image/jpeg, or image/png');
    }
    return new DocumentContentType(trimmed as DocumentContentTypeValue);
  }

  get extension(): string {
    return DOCUMENT_CONTENT_TYPES[this.value];
  }
}
