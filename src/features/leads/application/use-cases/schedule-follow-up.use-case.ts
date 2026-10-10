import { NotFoundError } from '../../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import type { Clock } from '../../../../shared/clock/clock';
import type { IdGenerator } from '../../../../shared/ids/id-generator';
import type { FollowUpDto } from '../dtos/follow-up.dto';
import { toFollowUpDto } from '../dtos/follow-up.dto';
import type { ScheduleFollowUpCommand } from '../dtos/schedule-follow-up-command';
import type { LeadManagementPolicy } from '../policies/lead-management.policy';
import { buildScheduledFollowUp } from '../services/build-scheduled-follow-up';
import { toLeadId } from '../../../../domain/shared/lead-id';
import type { ILeadRepository } from '../../domain/lead.repository';

export class ScheduleFollowUpUseCase {
  constructor(
    private readonly policy: LeadManagementPolicy,
    private readonly repo: ILeadRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(command: ScheduleFollowUpCommand, ctx: AuthenticatedContext): Promise<FollowUpDto> {
    this.policy.requireStaff(ctx);

    const lead = await this.repo.findById(toLeadId(command.leadId));
    if (lead === null) {
      throw new NotFoundError(`Lead not found for id ${command.leadId}`);
    }
    this.policy.requireCanWork(ctx, lead);

    const followUp = buildScheduledFollowUp(lead, command, ctx, this.clock.now(), this.ids);

    await this.repo.scheduleFollowUp(followUp);
    return toFollowUpDto(followUp);
  }
}
