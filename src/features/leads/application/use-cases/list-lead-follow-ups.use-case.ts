import { NotFoundError } from '../../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import { toLeadId } from '../../../../domain/shared/lead-id';
import type { Page, Pagination } from '../../../../shared/pagination/pagination';
import type { LeadManagementPolicy } from '../policies/lead-management.policy';
import type {
  FollowUpListScope,
  FollowUpReadModel,
  IFollowUpQueries,
} from '../../domain/follow-up.queries';
import type { ILeadQueries } from '../../domain/lead.queries';

export class ListLeadFollowUpsUseCase {
  constructor(
    private readonly policy: LeadManagementPolicy,
    private readonly leadQueries: ILeadQueries,
    private readonly followUpQueries: IFollowUpQueries,
  ) {}

  async execute(
    leadIdRaw: string,
    scope: FollowUpListScope,
    page: Pagination,
    ctx: AuthenticatedContext,
  ): Promise<Page<FollowUpReadModel>> {
    this.policy.requireStaff(ctx);

    const leadId = toLeadId(leadIdRaw);
    const lead = await this.leadQueries.getLead(leadId);
    if (lead === null) {
      throw new NotFoundError(`Lead not found for id ${leadIdRaw}`);
    }
    this.policy.requireCanWork(ctx, lead);

    return this.followUpQueries.listByLead(leadId, scope, page);
  }
}
