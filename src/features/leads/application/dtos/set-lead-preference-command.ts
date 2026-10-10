import type { LeadPreferenceFields } from './lead-preference-fields';

export interface SetLeadPreferenceCommand extends LeadPreferenceFields {
  readonly leadId: string;
}
