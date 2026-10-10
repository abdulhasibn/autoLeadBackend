import { BusinessRuleViolationError } from '../../../domain/errors/business-rule-violation.error';
import type { NotificationId } from '../../../domain/shared/notification-id';
import type { UserId } from '../../../domain/shared/user-id';
import type { FollowUpId } from './follow-up-id';
import type { FollowUpOutcome } from './follow-up-outcome.value-object';
import type { FollowUpTaskType } from './follow-up-task-type.value-object';
import type { LeadId } from '../../../domain/shared/lead-id';

export type FollowUpStatus = 'open' | 'completed' | 'cancelled';

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

export interface FollowUpCompletion {
  readonly by: UserId;
  readonly at: Date;
  readonly outcome: FollowUpOutcome;
  readonly notes: string | null;
}

export interface FollowUpCancellation {
  readonly by: UserId;
  readonly at: Date;
}

export interface FollowUpReconstituteProps extends Omit<
  FollowUpScheduleProps,
  'notificationId' | 'dueAt'
> {
  /** null when the follow-up was stored without a due reminder (e.g. imported). */
  readonly notificationId: NotificationId | null;
  readonly dueAt: Date | null;
  readonly completion: FollowUpCompletion | null;
  readonly cancellation: FollowUpCancellation | null;
}

/** A follow-up created by `schedule()`: it always carries its due reminder. */
export type ScheduledFollowUp = FollowUp & {
  readonly notificationId: NotificationId;
  readonly dueAt: Date;
};

/**
 * A newly scheduled follow-up is invalid without a due reminder, and `dueAt`
 * must match `scheduledAt`. Stored follow-ups may lack one. An open follow-up
 * closes exactly once: completed with an outcome, or cancelled.
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
    readonly notificationId: NotificationId | null,
    readonly dueAt: Date | null,
    private completionState: FollowUpCompletion | null,
    private cancellationState: FollowUpCancellation | null,
  ) {}

  static schedule(props: FollowUpScheduleProps): ScheduledFollowUp {
    if (props.dueAt.getTime() !== props.scheduledAt.getTime()) {
      throw new Error('Follow-up notification due time must match the scheduled time');
    }

    return new FollowUp(
      props.id,
      props.leadId,
      props.assignedTo,
      props.taskType,
      props.scheduledAt,
      trimToNull(props.notes),
      props.createdBy,
      props.createdAt,
      props.notificationId,
      props.dueAt,
      null,
      null,
    ) as ScheduledFollowUp;
  }

  static reconstitute(props: FollowUpReconstituteProps): FollowUp {
    return new FollowUp(
      props.id,
      props.leadId,
      props.assignedTo,
      props.taskType,
      props.scheduledAt,
      props.notes,
      props.createdBy,
      props.createdAt,
      props.notificationId,
      props.dueAt,
      props.completion,
      props.cancellation,
    );
  }

  get status(): FollowUpStatus {
    if (this.completionState !== null) {
      return 'completed';
    }
    return this.cancellationState === null ? 'open' : 'cancelled';
  }

  get completion(): FollowUpCompletion | null {
    return this.completionState;
  }

  get cancellation(): FollowUpCancellation | null {
    return this.cancellationState;
  }

  complete(completion: FollowUpCompletion): void {
    this.assertOpen();
    this.completionState = { ...completion, notes: trimToNull(completion.notes) };
  }

  cancel(cancellation: FollowUpCancellation): void {
    this.assertOpen();
    this.cancellationState = cancellation;
  }

  private assertOpen(): void {
    if (this.status !== 'open') {
      throw new BusinessRuleViolationError(
        'FOLLOW_UP_CLOSED',
        `Follow-up is already ${this.status}`,
      );
    }
  }
}

function trimToNull(value: string | null): string | null {
  const trimmed = value === null ? null : value.trim();
  return trimmed === null || trimmed.length === 0 ? null : trimmed;
}
