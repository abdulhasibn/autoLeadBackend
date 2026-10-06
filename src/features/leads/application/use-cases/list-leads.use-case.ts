import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import { toUserId } from '../../../../domain/shared/user-id';
import { toVehicleId } from '../../../../domain/shared/vehicle-id';
import type { Page } from '../../../../shared/pagination/pagination';
import type { LeadDto } from '../dtos/lead.dto';
import type { ListLeadsQuery } from '../dtos/list-leads-query';
import type { LeadManagementPolicy } from '../policies/lead-management.policy';
import type { ILeadQueries } from '../../domain/lead.queries';
import { LeadStatus } from '../../domain/lead-status.value-object';

export class ListLeadsUseCase {
  constructor(
    private readonly policy: LeadManagementPolicy,
    private readonly queries: ILeadQueries,
  ) {}

  async execute(query: ListLeadsQuery, ctx: AuthenticatedContext): Promise<Page<LeadDto>> {
    this.policy.requireStaff(ctx);

    return this.queries.listLeads(
      {
        status: query.status === undefined ? undefined : LeadStatus.create(query.status).value,
        vehicleId: query.vehicleId === undefined ? undefined : toVehicleId(query.vehicleId),
        assignedTo: this.policy.assigneeScope(
          ctx,
          query.assignedTo === undefined ? undefined : toUserId(query.assignedTo),
        ),
        preferredMakeId: query.preferredMakeId,
        preferredModelId: query.preferredModelId,
        preferredVariantId: query.preferredVariantId,
      },
      query.page,
    );
  }
}
