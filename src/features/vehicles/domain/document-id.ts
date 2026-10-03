import type { Brand } from '../../../shared/primitives/brand';

export type DocumentId = Brand<string, 'DocumentId'>;

export function toDocumentId(value: string): DocumentId {
  return value as DocumentId;
}
