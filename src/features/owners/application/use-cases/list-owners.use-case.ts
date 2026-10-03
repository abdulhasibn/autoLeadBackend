import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import { Phone } from '../../../../domain/shared/phone.value-object';
import type { Page } from '../../../../shared/pagination/pagination';
import type { ListOwnersQuery } from '../dtos/list-owners-query';
import type { OwnerDto } from '../dtos/owner.dto';
import type { OwnerManagementPolicy } from '../policies/owner-management.policy';
import type { IOwnerQueries } from '../../domain/owner.queries';

export class ListOwnersUseCase {
  constructor(
    private readonly policy: OwnerManagementPolicy,
    private readonly queries: IOwnerQueries,
  ) {}

  async execute(query: ListOwnersQuery, ctx: AuthenticatedContext): Promise<Page<OwnerDto>> {
    this.policy.requireAdminOrSalesperson(ctx);

    const phone = query.phone === undefined ? undefined : Phone.create(query.phone).value;
    return this.queries.listOwners({ city: query.city, phone }, query.page);
  }
}
