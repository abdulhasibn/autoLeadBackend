import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import { toNotificationId } from '../../../../domain/shared/notification-id';
import type { IdGenerator } from '../../../../shared/ids/id-generator';
import { FollowUp, type ScheduledFollowUp } from '../../domain/follow-up.entity';
import { toFollowUpId } from '../../domain/follow-up-id';
import { FollowUpTaskType } from '../../domain/follow-up-task-type.value-object';
import type { Lead } from '../../domain/lead.entity';
import { ScheduledAt } from '../../domain/scheduled-at.value-object';

export interface FollowUpPlan {
  readonly scheduledAt: string;
  readonly taskType: string;
  readonly notes: string | null;
}

/**
 * A new follow-up on `lead` with its due reminder. It goes to the lead's
 * assignee so their reminder fires, or to the scheduler if unassigned.
 */
export function buildScheduledFollowUp(
  lead: Lead,
  plan: FollowUpPlan,
  ctx: AuthenticatedContext,
  now: Date,
  ids: IdGenerator,
): ScheduledFollowUp {
  const scheduledAt = ScheduledAt.create(plan.scheduledAt).value;
  return FollowUp.schedule({
    id: toFollowUpId(ids.generate()),
    leadId: lead.id,
    assignedTo: lead.assignedTo ?? ctx.userId,
    taskType: FollowUpTaskType.create(plan.taskType),
    scheduledAt,
    notes: plan.notes,
    createdBy: ctx.userId,
    createdAt: now,
    notificationId: toNotificationId(ids.generate()),
    dueAt: scheduledAt,
  });
}
