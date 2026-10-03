export const LEAD_STATUSES = [
  'new',
  'contacted',
  'interested',
  'follow_up',
  'test_drive',
  'negotiation',
  'booking_confirmed',
  'sold',
  'lost',
  'not_interested',
  'no_response',
] as const;

export type LeadStatusValue = (typeof LEAD_STATUSES)[number];

const TERMINAL: readonly LeadStatusValue[] = ['sold', 'lost', 'not_interested', 'no_response'];

const ALLOWED: Readonly<Record<LeadStatusValue, readonly LeadStatusValue[]>> = {
  new: ['contacted', 'lost', 'not_interested', 'no_response'],
  contacted: ['interested', 'lost', 'not_interested', 'no_response'],
  interested: ['follow_up', 'lost', 'not_interested', 'no_response'],
  follow_up: ['test_drive', 'lost', 'not_interested', 'no_response'],
  test_drive: ['negotiation', 'lost'],
  negotiation: ['booking_confirmed', 'lost'],
  booking_confirmed: ['sold', 'lost'],
  sold: [],
  lost: [],
  not_interested: [],
  no_response: [],
};

export class LeadStatus {
  private constructor(readonly value: LeadStatusValue) {}

  static create(input: string): LeadStatus {
    const trimmed = input.trim();
    if (!LEAD_STATUSES.includes(trimmed as LeadStatusValue)) {
      throw new Error('Invalid lead status');
    }
    return new LeadStatus(trimmed as LeadStatusValue);
  }

  static initial(): LeadStatus {
    return new LeadStatus('new');
  }

  isTerminal(): boolean {
    return TERMINAL.includes(this.value);
  }

  canTransitionTo(next: LeadStatus): boolean {
    return ALLOWED[this.value].includes(next.value);
  }
}
