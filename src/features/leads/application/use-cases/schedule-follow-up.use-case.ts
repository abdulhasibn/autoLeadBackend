import { NotFoundError } from '../../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import { toNotificationId } from '../../../../domain/shared/notification-id';
import type { Clock } from '../../../../shared/clock/clock';
import type { IdGenerator } from '../../../../shared/ids/id-generator';
import type { FollowUpDto } from '../dtos/follow-up.dto';
import { toFollowUpDto } from '../dtos/follow-up.dto';
import type { ScheduleFollowUpCommand } from '../dtos/schedule-follow-up-command';
import type { LeadManagementPolicy } from '../policies/lead-management.policy';
import { FollowUp } from '../../domain/follow-up.entity';
import { toFollowUpId } from '../../domain/follow-up-id';
import { FollowUpTaskType } from '../../domain/follow-up-task-type.value-object';
import { toLeadId } from '../../domain/lead-id';
import type { ILeadRepository } from '../../domain/lead.repository';
import { ScheduledAt } from '../../domain/scheduled-at.value-object';

export class ScheduleFollowUpUseCase {
  constructor(
    private readonly policy: LeadManagementPolicy,
    private readonly repo: ILeadRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(command: ScheduleFollowUpCommand, ctx: AuthenticatedContext): Promise<FollowUpDto> {
    this.policy.requireAdmin(ctx);

    const lead = await this.repo.findById(toLeadId(command.leadId));
    if (lead === null) {
      throw new NotFoundError(`Lead not found for id ${command.leadId}`);
    }

    const scheduledAt = ScheduledAt.create(command.scheduledAt).value;
    const followUp = FollowUp.schedule({
      id: toFollowUpId(this.ids.generate()),
      leadId: lead.id,
      assignedTo: ctx.userId,
      taskType: FollowUpTaskType.create(command.taskType),
      scheduledAt,
      notes: command.notes,
      createdBy: ctx.userId,
      createdAt: this.clock.now(),
      notificationId: toNotificationId(this.ids.generate()),
      dueAt: scheduledAt,
    });

    await this.repo.scheduleFollowUp(followUp);
    return toFollowUpDto(followUp);
  }
}
