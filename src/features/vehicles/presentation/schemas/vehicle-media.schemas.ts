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

export const reorderMediaBodySchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().uuid('id must be a UUID'),
        category: mediaCategorySchema,
        sortOrder: sortOrderSchema,
      }),
    )
    .min(1, 'items cannot be empty')
    .max(100, 'items cannot have more than 100 entries')
    .refine((items) => new Set(items.map((i) => i.id)).size === items.length, {
      message: 'items must not repeat an id',
    }),
});
