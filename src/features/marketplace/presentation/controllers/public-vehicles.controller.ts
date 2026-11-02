import type { RequestHandler } from 'express';

import type { GetPublicFilterOptionsUseCase } from '../../application/use-cases/get-public-filter-options.use-case';
import type { GetPublicVehicleUseCase } from '../../application/use-cases/get-public-vehicle.use-case';
import type { ListPublicVehiclesUseCase } from '../../application/use-cases/list-public-vehicles.use-case';
import {
  listPublicVehiclesQuerySchema,
  publicVehicleIdParamSchema,
} from '../schemas/public-marketplace.schemas';

// Lets a CDN or the website's fetch cache absorb repeat reads. Signed photo
// URLs live 24h, far longer than this.
const PUBLIC_CACHE_CONTROL = 'public, max-age=60, s-maxage=300, stale-while-revalidate=600';

export class PublicVehiclesController {
  constructor(
    private readonly listVehicles: ListPublicVehiclesUseCase,
    private readonly getVehicle: GetPublicVehicleUseCase,
    private readonly getFilterOptions: GetPublicFilterOptionsUseCase,
  ) {}

  list(): RequestHandler {
    return async (req, res, next) => {
      try {
        const query = listPublicVehiclesQuerySchema.parse(req.query);
        const page = await this.listVehicles.execute(
          {
            makeId: query.makeId,
            modelId: query.modelId,
            bodyTypes: query.bodyType,
            fuelTypes: query.fuelType,
            transmissions: query.transmission,
            priceMin: query.priceMin,
            priceMax: query.priceMax,
            yearMin: query.yearMin,
            kmMax: query.kmMax,
            sort: query.sort,
          },
          { limit: query.limit, offset: query.offset },
        );
        res.set('Cache-Control', PUBLIC_CACHE_CONTROL).status(200).json(page);
      } catch (err) {
        next(err);
      }
    };
  }

  get(): RequestHandler {
    return async (req, res, next) => {
      try {
        const { id } = publicVehicleIdParamSchema.parse(req.params);
        const vehicle = await this.getVehicle.execute(id);
        res.set('Cache-Control', PUBLIC_CACHE_CONTROL).status(200).json(vehicle);
      } catch (err) {
        next(err);
      }
    };
  }

  filters(): RequestHandler {
    return async (_req, res, next) => {
      try {
        const options = await this.getFilterOptions.execute();
        res.set('Cache-Control', PUBLIC_CACHE_CONTROL).status(200).json(options);
      } catch (err) {
        next(err);
      }
    };
  }
}
