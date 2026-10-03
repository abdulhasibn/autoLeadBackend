import { z } from 'zod';

import {
  mediaCategorySchema,
  mediaContentTypeSchema,
  sortOrderSchema,
} from './vehicle-fields.schemas';

export const createMediaUploadBodySchema = z.object({
  category: mediaCategorySchema,
  contentType: mediaContentTypeSchema,
});

export const confirmMediaBodySchema = z.object({
  storagePath: z
    .string({ error: 'storagePath is required' })
    .trim()
    .min(1, 'storagePath cannot be empty'),
  category: mediaCategorySchema,
  sortOrder: sortOrderSchema,
});

export const mediaIdParamSchema = z.object({
  id: z.string().uuid('id must be a UUID'),
  mediaId: z.string().uuid('mediaId must be a UUID'),
});
