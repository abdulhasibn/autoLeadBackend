import { z } from 'zod';

import { leadPreferenceShape, refineLeadPreference } from './lead-fields.schemas';

/** Full replacement: omitted fields are cleared, so an empty body clears the preference. */
export const setLeadPreferenceBodySchema = z
  .object(leadPreferenceShape)
  .superRefine(refineLeadPreference);
