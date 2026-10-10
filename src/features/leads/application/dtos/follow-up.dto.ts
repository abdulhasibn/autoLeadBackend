import type { FollowUp, FollowUpStatus } from '../../domain/follow-up.entity';

export interface FollowUpDto {
  readonly id: string;
  readonly leadId: string;
  readonly assignedTo: string;
  readonly taskType: string;
  readonly scheduledAt: string;
  readonly notes: string | null;
  /** null for a stored follow-up that has no due reminder. */
  readonly notificationId: string | null;
  readonly dueAt: string | null;
  readonly status: FollowUpStatus;
  readonly outcome: string | null;
  readonly completionNotes: string | null;
  readonly completedAt: string | null;
  readonly cancelledAt: string | null;
}

export function toFollowUpDto(followUp: FollowUp): FollowUpDto {
  const completion = followUp.completion;
  return {
    id: followUp.id,
    leadId: followUp.leadId,
    assignedTo: followUp.assignedTo,
    taskType: followUp.taskType.value,
    scheduledAt: followUp.scheduledAt.toISOString(),
    notes: followUp.notes,
    notificationId: followUp.notificationId,
    dueAt: followUp.dueAt === null ? null : followUp.dueAt.toISOString(),
    status: followUp.status,
    outcome: completion === null ? null : completion.outcome.value,
    completionNotes: completion === null ? null : completion.notes,
    completedAt: completion === null ? null : completion.at.toISOString(),
    cancelledAt: followUp.cancellation === null ? null : followUp.cancellation.at.toISOString(),
  };
}
