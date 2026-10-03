export interface ScheduleFollowUpCommand {
  readonly leadId: string;
  readonly scheduledAt: string;
  readonly taskType: string;
  readonly notes: string | null;
}
