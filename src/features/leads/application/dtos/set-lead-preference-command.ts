export interface SetLeadPreferenceCommand {
  readonly leadId: string;
  readonly preferredMakeId: string | null;
  readonly preferredModelId: string | null;
  readonly preferredVariantId: string | null;
}
