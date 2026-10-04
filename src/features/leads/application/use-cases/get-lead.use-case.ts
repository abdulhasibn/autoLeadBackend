import { NotFoundError } from '../../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import type { LeadDto } from '../dtos/lead.dto';
import type { LeadManagementPolicy } from '../policies/lead-management.policy';
import { toLeadId } from '../../domain/lead-id';
import type { ILeadQueries } from '../../domain/lead.queries';

export class GetLeadUseCase {
  constructor(
    private readonly policy: LeadManagementPolicy,
    private readonly queries: ILeadQueries,
  ) {}

  async execute(leadIdRaw: string, ctx: AuthenticatedContext): Promise<LeadDto> {
    this.policy.requireStaff(ctx);

    const lead = await this.queries.getLead(toLeadId(leadIdRaw));
    if (lead === null) {
      throw new NotFoundError(`Lead not found for id ${leadIdRaw}`);
    }
    this.policy.requireCanWork(ctx, lead);

    return lead;
  }
}
