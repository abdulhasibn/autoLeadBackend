import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import type { Page, Pagination } from '../../../../shared/pagination/pagination';
import type { VehicleManagementPolicy } from '../policies/vehicle-management.policy';
import type { ICatalogQueries, MakeReadModel } from '../../domain/catalog.queries';

export class ListMakesUseCase {
  constructor(
    private readonly policy: VehicleManagementPolicy,
    private readonly queries: ICatalogQueries,
  ) {}

  async execute(page: Pagination, ctx: AuthenticatedContext): Promise<Page<MakeReadModel>> {
    this.policy.requireStaff(ctx);
    return this.queries.listMakes(page);
  }
}
