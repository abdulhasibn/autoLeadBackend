import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import type { Page, Pagination } from '../../../../shared/pagination/pagination';
import type { VehicleManagementPolicy } from '../policies/vehicle-management.policy';
import type { ICatalogQueries, ModelReadModel } from '../../domain/catalog.queries';
import { toMakeId } from '../../domain/make-id';

export class ListModelsUseCase {
  constructor(
    private readonly policy: VehicleManagementPolicy,
    private readonly queries: ICatalogQueries,
  ) {}

  async execute(
    makeIdRaw: string,
    page: Pagination,
    ctx: AuthenticatedContext,
  ): Promise<Page<ModelReadModel>> {
    this.policy.requireAdmin(ctx);
    return this.queries.listModels(toMakeId(makeIdRaw), page);
  }
}
