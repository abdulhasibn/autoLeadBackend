export class ScheduledAt {
  private constructor(readonly value: Date) {}

  static create(input: string): ScheduledAt {
    const trimmed = input.trim();
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) {
      throw new Error('Follow-up scheduledAt must be an ISO timestamp');
    }
    return new ScheduledAt(parsed);
  }
}
