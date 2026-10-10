import { NotFoundError } from '../../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import { toLeadId } from '../../../../domain/shared/lead-id';
import type { Page, Pagination } from '../../../../shared/pagination/pagination';
import type { LeadManagementPolicy } from '../policies/lead-management.policy';
import type { ILeadQueries } from '../../domain/lead.queries';
import type {
  ILeadStatusHistoryQueries,
  LeadStatusHistoryReadModel,
} from '../../domain/lead-status-history.queries';

export class ListLeadStatusHistoryUseCase {
  constructor(
    private readonly policy: LeadManagementPolicy,
    private readonly leadQueries: ILeadQueries,
    private readonly historyQueries: ILeadStatusHistoryQueries,
  ) {}

  async execute(
    leadIdRaw: string,
    page: Pagination,
    ctx: AuthenticatedContext,
  ): Promise<Page<LeadStatusHistoryReadModel>> {
    this.policy.requireStaff(ctx);

    const leadId = toLeadId(leadIdRaw);
    const lead = await this.leadQueries.getLead(leadId);
    if (lead === null) {
      throw new NotFoundError(`Lead not found for id ${leadIdRaw}`);
    }
    this.policy.requireCanWork(ctx, lead);

    return this.historyQueries.listByLead(leadId, page);
  }
}
