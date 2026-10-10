import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import type { Clock } from '../../../../shared/clock/clock';
import type { ILeadRepository } from '../../domain/lead.repository';
import type { CancelFollowUpCommand } from '../dtos/cancel-follow-up-command';
import type { FollowUpDto } from '../dtos/follow-up.dto';
import { toFollowUpDto } from '../dtos/follow-up.dto';
import type { LeadManagementPolicy } from '../policies/lead-management.policy';
import { requireLeadFollowUp } from '../services/require-lead-follow-up';

export class CancelFollowUpUseCase {
  constructor(
    private readonly policy: LeadManagementPolicy,
    private readonly repo: ILeadRepository,
    private readonly clock: Clock,
  ) {}

  async execute(command: CancelFollowUpCommand, ctx: AuthenticatedContext): Promise<FollowUpDto> {
    const { followUp } = await requireLeadFollowUp(this.repo, this.policy, command, ctx);

    followUp.cancel({ by: ctx.userId, at: this.clock.now() });

    await this.repo.cancelFollowUp(followUp);
    return toFollowUpDto(followUp);
  }
}
