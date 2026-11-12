import { z } from 'zod';

import { optionalTextSchema } from './lead-fields.schemas';

/** Optional note recorded on the status history ("Sale undone" when blank). */
export const reopenConvertedLeadBodySchema = z.object({
  notes: optionalTextSchema,
});
