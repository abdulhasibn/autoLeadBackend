import { DataIntegrityError } from '../../../domain/errors/data-integrity.error';
import { toLeadId } from '../../../domain/shared/lead-id';
import { toNotificationId } from '../../../domain/shared/notification-id';
import { toUserId } from '../../../domain/shared/user-id';
import { FollowUp, type FollowUpCompletion } from '../domain/follow-up.entity';
import { toFollowUpId } from '../domain/follow-up-id';
import { FollowUpOutcome } from '../domain/follow-up-outcome.value-object';
import { FollowUpTaskType } from '../domain/follow-up-task-type.value-object';

export interface FollowUpRow {
  readonly id: string;
  readonly lead_id: string;
  readonly assigned_to: string;
  readonly task_type: string;
  readonly scheduled_at: string;
  readonly notes: string | null;
  readonly created_by: string;
  readonly created_at: string;
  readonly completed_at: string | null;
  readonly completed_by: string | null;
  readonly outcome: string | null;
  readonly completion_notes: string | null;
  readonly deleted_at: string | null;
  readonly cancelled_by: string | null;
}

export interface FollowUpReminderRow {
  readonly id: string;
  readonly due_at: string | null;
}

export function toFollowUp(row: FollowUpRow, reminder: FollowUpReminderRow | null): FollowUp {
  try {
    return FollowUp.reconstitute({
      id: toFollowUpId(row.id),
      leadId: toLeadId(row.lead_id),
      assignedTo: toUserId(row.assigned_to),
      taskType: FollowUpTaskType.create(row.task_type),
      scheduledAt: new Date(row.scheduled_at),
      notes: row.notes,
      createdBy: toUserId(row.created_by),
      createdAt: new Date(row.created_at),
      notificationId: reminder === null ? null : toNotificationId(reminder.id),
      dueAt: reminder === null ? null : new Date(reminder.due_at ?? row.scheduled_at),
      completion: completionOf(row),
      cancellation:
        row.completed_at === null && row.deleted_at !== null
          ? {
              by: toUserId(row.cancelled_by ?? row.created_by),
              at: new Date(row.deleted_at),
            }
          : null,
    });
  } catch (err) {
    throw new DataIntegrityError(`Follow-up ${row.id} is invalid`, { cause: err });
  }
}

function completionOf(row: FollowUpRow): FollowUpCompletion | null {
  if (row.completed_at === null) {
    return null;
  }
  if (row.outcome === null || row.completed_by === null) {
    throw new Error('Completed follow-up is missing its outcome or actor');
  }
  return {
    by: toUserId(row.completed_by),
    at: new Date(row.completed_at),
    outcome: FollowUpOutcome.create(row.outcome),
    notes: row.completion_notes,
  };
}
