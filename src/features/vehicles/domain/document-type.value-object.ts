export const DOCUMENT_TYPES = [
  'rc',
  'insurance',
  'service_record',
  'loan_clearance',
  'inspection_report',
  'other',
] as const;

export type DocumentTypeValue = (typeof DOCUMENT_TYPES)[number];

export class DocumentType {
  private constructor(readonly value: DocumentTypeValue) {}

  static create(input: string): DocumentType {
    const trimmed = input.trim();
    if (!DOCUMENT_TYPES.includes(trimmed as DocumentTypeValue)) {
      throw new Error('Invalid document type');
    }
    return new DocumentType(trimmed as DocumentTypeValue);
  }
}
