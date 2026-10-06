import { z } from 'zod';

import { optionalCatalogIdSchema } from './lead-fields.schemas';

/** Full replacement: omitted ids count as null, and all-null clears the preference. */
export const setLeadPreferenceBodySchema = z.object({
  preferredMakeId: optionalCatalogIdSchema('preferredMakeId'),
  preferredModelId: optionalCatalogIdSchema('preferredModelId'),
  preferredVariantId: optionalCatalogIdSchema('preferredVariantId'),
});
