import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import type { Page, Pagination } from '../../../../shared/pagination/pagination';
import type { VehicleManagementPolicy } from '../policies/vehicle-management.policy';
import type { ICatalogQueries, VariantReadModel } from '../../domain/catalog.queries';
import { toModelId } from '../../domain/model-id';

export class ListVariantsUseCase {
  constructor(
    private readonly policy: VehicleManagementPolicy,
    private readonly queries: ICatalogQueries,
  ) {}

  async execute(
    modelIdRaw: string,
    page: Pagination,
    ctx: AuthenticatedContext,
  ): Promise<Page<VariantReadModel>> {
    this.policy.requireStaff(ctx);
    return this.queries.listVariants(toModelId(modelIdRaw), page);
  }
}
