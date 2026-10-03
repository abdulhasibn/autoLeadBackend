import { z } from 'zod';

export const vehicleIdParamSchema = z.object({
  id: z.string().uuid('id must be a UUID'),
});

export const makeIdParamSchema = z.object({
  makeId: z.string().uuid('makeId must be a UUID'),
});

export const modelIdParamSchema = z.object({
  modelId: z.string().uuid('modelId must be a UUID'),
});
