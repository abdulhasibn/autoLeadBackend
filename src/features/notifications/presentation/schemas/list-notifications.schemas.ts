import { z } from 'zod';

import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../../../../shared/pagination/pagination';

export const listNotificationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  offset: z.coerce.number().int().min(0).default(0),
});

export const notificationIdParamSchema = z.object({
  id: z.string().uuid('id must be a UUID'),
});
