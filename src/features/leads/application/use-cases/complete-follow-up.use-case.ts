import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import type { Clock } from '../../../../shared/clock/clock';
import type { IdGenerator } from '../../../../shared/ids/id-generator';
import { FollowUpOutcome } from '../../domain/follow-up-outcome.value-object';
import type { ILeadRepository } from '../../domain/lead.repository';
import type {
  CompleteFollowUpCommand,
  CompleteFollowUpResult,
} from '../dtos/complete-follow-up-command';
import { toFollowUpDto } from '../dtos/follow-up.dto';
import type { LeadManagementPolicy } from '../policies/lead-management.policy';
import { buildScheduledFollowUp } from '../services/build-scheduled-follow-up';
import { requireLeadFollowUp } from '../services/require-lead-follow-up';

export class CompleteFollowUpUseCase {
  constructor(
    private readonly policy: LeadManagementPolicy,
    private readonly repo: ILeadRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(
    command: CompleteFollowUpCommand,
    ctx: AuthenticatedContext,
  ): Promise<CompleteFollowUpResult> {
    const { lead, followUp } = await requireLeadFollowUp(this.repo, this.policy, command, ctx);

    const now = this.clock.now();
    followUp.complete({
      by: ctx.userId,
      at: now,
      outcome: FollowUpOutcome.create(command.outcome),
      notes: command.notes,
    });
    const next =
      command.next === null ? null : buildScheduledFollowUp(lead, command.next, ctx, now, this.ids);

    await this.repo.completeFollowUp(followUp, next);
    return {
      followUp: toFollowUpDto(followUp),
      next: next === null ? null : toFollowUpDto(next),
    };
  }
}
