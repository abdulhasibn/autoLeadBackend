export const LEAD_SOURCES = [
  'marketplace',
  'mobile_app',
  'website',
  'phone',
  'walkin',
  'whatsapp',
  'instagram',
  'facebook',
  'referral',
  'other',
] as const;

export type LeadSourceValue = (typeof LEAD_SOURCES)[number];

export class LeadSource {
  private constructor(readonly value: LeadSourceValue) {}

  static create(input: string): LeadSource {
    const trimmed = input.trim();
    if (!LEAD_SOURCES.includes(trimmed as LeadSourceValue)) {
      throw new Error('Invalid lead source');
    }
    return new LeadSource(trimmed as LeadSourceValue);
  }
}
