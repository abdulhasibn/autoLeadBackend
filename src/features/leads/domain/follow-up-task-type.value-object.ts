export const FOLLOW_UP_TASK_TYPES = [
  'call',
  'whatsapp',
  'meeting',
  'test_drive',
  'send_quotation',
  'other',
] as const;

export type FollowUpTaskTypeValue = (typeof FOLLOW_UP_TASK_TYPES)[number];

export class FollowUpTaskType {
  private constructor(readonly value: FollowUpTaskTypeValue) {}

  static create(input: string): FollowUpTaskType {
    const trimmed = input.trim();
    if (!FOLLOW_UP_TASK_TYPES.includes(trimmed as FollowUpTaskTypeValue)) {
      throw new Error(
        'Follow-up task type must be call, whatsapp, meeting, test_drive, send_quotation, or other',
      );
    }
    return new FollowUpTaskType(trimmed as FollowUpTaskTypeValue);
  }
}
