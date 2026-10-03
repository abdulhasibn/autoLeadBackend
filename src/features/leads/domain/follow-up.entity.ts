import type { NotificationId } from '../../../domain/shared/notification-id';
import type { UserId } from '../../../domain/shared/user-id';
import type { FollowUpId } from './follow-up-id';
import type { FollowUpTaskType } from './follow-up-task-type.value-object';
import type { LeadId } from './lead-id';

export interface FollowUpScheduleProps {
  readonly id: FollowUpId;
  readonly leadId: LeadId;
  readonly assignedTo: UserId;
  readonly taskType: FollowUpTaskType;
  readonly scheduledAt: Date;
  readonly notes: string | null;
  readonly createdBy: UserId;
  readonly createdAt: Date;
  readonly notificationId: NotificationId;
  readonly dueAt: Date;
}

/**
 * A scheduled follow-up is invalid without a due reminder. `dueAt` must match
 * `scheduledAt`.
 */
export class FollowUp {
  private constructor(
    readonly id: FollowUpId,
    readonly leadId: LeadId,
    readonly assignedTo: UserId,
    readonly taskType: FollowUpTaskType,
    readonly scheduledAt: Date,
    readonly notes: string | null,
    readonly createdBy: UserId,
    readonly createdAt: Date,
    readonly notificationId: NotificationId,
    readonly dueAt: Date,
  ) {}

  static schedule(props: FollowUpScheduleProps): FollowUp {
    if (props.dueAt.getTime() !== props.scheduledAt.getTime()) {
      throw new Error('Follow-up notification due time must match the scheduled time');
    }

    const notes = props.notes === null ? null : props.notes.trim();
    return new FollowUp(
      props.id,
      props.leadId,
      props.assignedTo,
      props.taskType,
      props.scheduledAt,
      notes === null || notes.length === 0 ? null : notes,
      props.createdBy,
      props.createdAt,
      props.notificationId,
      props.dueAt,
    );
  }
}
