import type { Page, Pagination } from '../../../../shared/pagination/pagination';
import { toPage } from '../../../../shared/pagination/pagination';
import type { IPublicMediaSigner } from '../../domain/public-media-signer.port';
import type {
  IPublicVehicleQueries,
  PublicVehicleCriteria,
} from '../../domain/public-vehicle.queries';
import { toPublicVehicleSummary, type PublicVehicleSummaryDto } from '../dtos/public-vehicle.dto';

export class ListPublicVehiclesUseCase {
  constructor(
    private readonly queries: IPublicVehicleQueries,
    private readonly signer: IPublicMediaSigner,
  ) {}

  async execute(
    criteria: PublicVehicleCriteria,
    page: Pagination,
  ): Promise<Page<PublicVehicleSummaryDto>> {
    const vehicles = await this.queries.list(criteria, page);
    const covers = await this.queries.coverPaths(vehicles.items.map((vehicle) => vehicle.id));
    const urls = await this.signer.sign([...new Set(covers.values())]);

    const items = vehicles.items.map((vehicle) => {
      const path = covers.get(vehicle.id);
      return toPublicVehicleSummary(vehicle, (path && urls.get(path)) ?? null);
    });
    return toPage(items, vehicles.total, page);
  }
}
