import { z } from 'zod';

import {
  documentContentTypeSchema,
  documentTypeSchema,
  optionalDocumentFileNameSchema,
} from './vehicle-fields.schemas';

export const createDocumentUploadBodySchema = z.object({
  docType: documentTypeSchema,
  contentType: documentContentTypeSchema,
});

export const confirmDocumentBodySchema = z.object({
  storagePath: z
    .string({ error: 'storagePath is required' })
    .trim()
    .min(1, 'storagePath cannot be empty'),
  docType: documentTypeSchema,
  fileName: optionalDocumentFileNameSchema,
});

export const documentIdParamSchema = z.object({
  id: z.string().uuid('id must be a UUID'),
  documentId: z.string().uuid('documentId must be a UUID'),
});
