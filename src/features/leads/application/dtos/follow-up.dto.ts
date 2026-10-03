import type { FollowUp } from '../../domain/follow-up.entity';

export interface FollowUpDto {
  readonly id: string;
  readonly leadId: string;
  readonly assignedTo: string;
  readonly taskType: string;
  readonly scheduledAt: string;
  readonly notes: string | null;
  readonly notificationId: string;
  readonly dueAt: string;
}

export function toFollowUpDto(followUp: FollowUp): FollowUpDto {
  return {
    id: followUp.id,
    leadId: followUp.leadId,
    assignedTo: followUp.assignedTo,
    taskType: followUp.taskType.value,
    scheduledAt: followUp.scheduledAt.toISOString(),
    notes: followUp.notes,
    notificationId: followUp.notificationId,
    dueAt: followUp.dueAt.toISOString(),
  };
}
