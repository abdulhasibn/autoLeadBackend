import { NotFoundError } from '../../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import type { Clock } from '../../../../shared/clock/clock';
import type { ChangeLeadStatusCommand } from '../dtos/change-lead-status-command';
import type { LeadManagementPolicy } from '../policies/lead-management.policy';
import { toLeadId } from '../../domain/lead-id';
import type { ILeadRepository } from '../../domain/lead.repository';
import { LeadStatus } from '../../domain/lead-status.value-object';

export class ChangeLeadStatusUseCase {
  constructor(
    private readonly policy: LeadManagementPolicy,
    private readonly repo: ILeadRepository,
    private readonly clock: Clock,
  ) {}

  async execute(
    command: ChangeLeadStatusCommand,
    ctx: AuthenticatedContext,
  ): Promise<{ readonly status: string }> {
    this.policy.requireAdmin(ctx);

    const lead = await this.repo.findById(toLeadId(command.leadId));
    if (lead === null) {
      throw new NotFoundError(`Lead not found for id ${command.leadId}`);
    }

    lead.changeStatus(LeadStatus.create(command.status), this.clock.now());
    await this.repo.save(lead, null, command.notes);
    return { status: lead.status.value };
  }
}
