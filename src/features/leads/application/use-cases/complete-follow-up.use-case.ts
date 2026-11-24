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
    const outcome = FollowUpOutcome.create(command.outcome);
    followUp.complete({
      by: ctx.userId,
      at: now,
      outcome,
      notes: command.notes,
    });
    const next =
      command.next === null ? null : buildScheduledFollowUp(lead, command.next, ctx, now, this.ids);

    await this.repo.completeFollowUp(followUp, next);

    // Reaching the customer starts the follow-up: `new` → `in_progress`.
    // Saved after the follow-up, so a failure here never loses the completion;
    // the status can still be changed by hand.
    if (outcome.value === 'reached' && lead.markCustomerReached(now)) {
      await this.repo.save(lead, {
        actorId: ctx.userId,
        statusNotes: 'Customer reached on a follow-up',
      });
    }

    return {
      followUp: toFollowUpDto(followUp),
      next: next === null ? null : toFollowUpDto(next),
    };
  }
}
