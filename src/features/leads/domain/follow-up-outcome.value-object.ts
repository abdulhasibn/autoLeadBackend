export const FOLLOW_UP_OUTCOMES = [
  'reached',
  'no_answer',
  'rescheduled',
  'not_interested',
  'done',
] as const;

export type FollowUpOutcomeValue = (typeof FOLLOW_UP_OUTCOMES)[number];

export class FollowUpOutcome {
  private constructor(readonly value: FollowUpOutcomeValue) {}

  static create(input: string): FollowUpOutcome {
    const trimmed = input.trim();
    if (!FOLLOW_UP_OUTCOMES.includes(trimmed as FollowUpOutcomeValue)) {
      throw new Error(
        'Follow-up outcome must be reached, no_answer, rescheduled, not_interested, or done',
      );
    }
    return new FollowUpOutcome(trimmed as FollowUpOutcomeValue);
  }
}
