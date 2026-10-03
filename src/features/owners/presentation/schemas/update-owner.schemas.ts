import { z } from 'zod';

import {
  optionalEmailSchema,
  optionalPhoneSchema,
  optionalTextSchema,
  phoneSchema,
  preferredContactMethodSchema,
} from './owner-fields.schemas';

export const updateOwnerBodySchema = z.object({
  fullName: z.string({ error: 'fullName is required' }).min(1, 'fullName cannot be empty'),
  phone: phoneSchema,
  email: optionalEmailSchema,
  address: optionalTextSchema,
  city: optionalTextSchema,
  preferredContactMethod: preferredContactMethodSchema,
  altPhone: optionalPhoneSchema,
  idInfo: optionalTextSchema,
  notes: optionalTextSchema,
});

export type UpdateOwnerBody = z.infer<typeof updateOwnerBodySchema>;
