import { BusinessRuleViolationError } from '../../../../domain/errors/business-rule-violation.error';
import { NotFoundError } from '../../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import { toUserId } from '../../../../domain/shared/user-id';
import type { Clock } from '../../../../shared/clock/clock';
import type { AssignLeadCommand } from '../dtos/assign-lead-command';
import type { LeadManagementPolicy } from '../policies/lead-management.policy';
import type { IAssignableStaffLookup } from '../../domain/assignable-staff.port';
import { toLeadId } from '../../domain/lead-id';
import type { ILeadRepository } from '../../domain/lead.repository';

export class AssignLeadUseCase {
  constructor(
    private readonly policy: LeadManagementPolicy,
    private readonly repo: ILeadRepository,
    private readonly staff: IAssignableStaffLookup,
    private readonly clock: Clock,
  ) {}

  async execute(
    command: AssignLeadCommand,
    ctx: AuthenticatedContext,
  ): Promise<{ readonly id: string; readonly assignedTo: string | null }> {
    this.policy.requireAdmin(ctx);

    const lead = await this.repo.findById(toLeadId(command.leadId));
    if (lead === null) {
      throw new NotFoundError(`Lead not found for id ${command.leadId}`);
    }

    const assignee = command.assignedTo === null ? null : toUserId(command.assignedTo);
    if (assignee !== null && !(await this.staff.isAssignable(assignee))) {
      throw new BusinessRuleViolationError(
        'ASSIGNEE_NOT_ELIGIBLE',
        'assignedTo must be an active admin or salesperson',
      );
    }

    lead.assign(assignee, this.clock.now());
    if (lead.hasAssigneeChanged) {
      await this.repo.save(lead, { actorId: ctx.userId });
    }
    return { id: lead.id, assignedTo: lead.assignedTo };
  }
}
