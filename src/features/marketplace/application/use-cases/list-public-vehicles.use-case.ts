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
    const listings = await this.queries.list(criteria, page);
    const paths = listings.items.flatMap(({ coverPath }) =>
      coverPath === null ? [] : [coverPath],
    );
    const urls = await this.signer.sign([...new Set(paths)]);

    const items = listings.items.map(({ vehicle, coverPath }) =>
      toPublicVehicleSummary(
        vehicle,
        (coverPath === null ? undefined : urls.get(coverPath)) ?? null,
      ),
    );
    return toPage(items, listings.total, page);
  }
}
