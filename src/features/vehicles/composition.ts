import type { RequestHandler } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';

import { ConflictError } from '../../domain/errors/conflict.error';
import type { VehicleId } from '../../domain/shared/vehicle-id';
import type { Database } from '../../infrastructure/supabase/database.types';
import type { ErrorMapper } from '../../presentation/http/errors/error-mapping';
import type { Clock } from '../../shared/clock/clock';
import { UuidIdGenerator } from '../../shared/ids/id-generator';
import { VehicleManagementPolicy } from './application/policies/vehicle-management.policy';
import { CreateVehicleUseCase } from './application/use-cases/create-vehicle.use-case';
import { GetVehicleUseCase } from './application/use-cases/get-vehicle.use-case';
import { ListMakesUseCase } from './application/use-cases/list-makes.use-case';
import { ListModelsUseCase } from './application/use-cases/list-models.use-case';
import { ListVariantsUseCase } from './application/use-cases/list-variants.use-case';
import { ListVehiclesUseCase } from './application/use-cases/list-vehicles.use-case';
import { UpdateVehicleUseCase } from './application/use-cases/update-vehicle.use-case';
import type { IRegisteredOwnerLookup } from './domain/registered-owner.port';
import { SupabaseActiveShowroomLookup } from './infrastructure/supabase-active-showroom.lookup';
import { SupabaseCatalogQueries } from './infrastructure/supabase-catalog.queries';
import { SupabaseLiveVariantLookup } from './infrastructure/supabase-live-variant.lookup';
import { SupabaseVehicleQueries } from './infrastructure/supabase-vehicle.queries';
import { SupabaseVehicleRepository } from './infrastructure/supabase-vehicle.repository';
import { createCatalogRouter } from './presentation/catalog.routes';
import { CreateVehicleController } from './presentation/controllers/create-vehicle.controller';
import { GetVehicleController } from './presentation/controllers/get-vehicle.controller';
import { ListMakesController } from './presentation/controllers/list-makes.controller';
import { ListModelsController } from './presentation/controllers/list-models.controller';
import { ListVariantsController } from './presentation/controllers/list-variants.controller';
import { ListVehiclesController } from './presentation/controllers/list-vehicles.controller';
import { UpdateVehicleController } from './presentation/controllers/update-vehicle.controller';
import { createVehiclesRouter } from './presentation/vehicles.routes';

export interface VehiclesComposition {
  readonly vehiclesRouter: ReturnType<typeof createVehiclesRouter>;
  readonly catalogRouter: ReturnType<typeof createCatalogRouter>;
  readonly errorMapper: ErrorMapper;
  readonly isLiveVehicle: (vehicleId: VehicleId) => Promise<boolean>;
}

export interface VehiclesCompositionDeps {
  readonly bearerMiddleware: RequestHandler;
  readonly clock: Clock;
  readonly registeredOwnerLookup: IRegisteredOwnerLookup;
}

/**
 * Constructs and wires the vehicles feature.
 * Called exclusively by src/app/composition-root.ts.
 */
export function composeVehicles(
  infraClient: SupabaseClient<Database>,
  deps: VehiclesCompositionDeps,
): VehiclesComposition {
  const policy = new VehicleManagementPolicy();
  const repo = new SupabaseVehicleRepository(infraClient);
  const queries = new SupabaseVehicleQueries(infraClient);
  const catalog = new SupabaseCatalogQueries(infraClient);
  const variants = new SupabaseLiveVariantLookup(infraClient);
  const showrooms = new SupabaseActiveShowroomLookup(infraClient);
  const ids = new UuidIdGenerator();

  const createVehicleUseCase = new CreateVehicleUseCase(
    policy,
    repo,
    deps.registeredOwnerLookup,
    variants,
    showrooms,
    deps.clock,
    ids,
  );
  const updateVehicleUseCase = new UpdateVehicleUseCase(policy, repo, deps.clock);
  const listVehiclesUseCase = new ListVehiclesUseCase(policy, queries);
  const getVehicleUseCase = new GetVehicleUseCase(policy, queries);
  const listMakesUseCase = new ListMakesUseCase(policy, catalog);
  const listModelsUseCase = new ListModelsUseCase(policy, catalog);
  const listVariantsUseCase = new ListVariantsUseCase(policy, catalog);

  const vehiclesRouter = createVehiclesRouter({
    bearerMiddleware: deps.bearerMiddleware,
    createVehicleController: new CreateVehicleController(createVehicleUseCase),
    listVehiclesController: new ListVehiclesController(listVehiclesUseCase),
    getVehicleController: new GetVehicleController(getVehicleUseCase),
    updateVehicleController: new UpdateVehicleController(updateVehicleUseCase),
  });

  const catalogRouter = createCatalogRouter({
    bearerMiddleware: deps.bearerMiddleware,
    listMakesController: new ListMakesController(listMakesUseCase),
    listModelsController: new ListModelsController(listModelsUseCase),
    listVariantsController: new ListVariantsController(listVariantsUseCase),
  });

  const errorMapper: ErrorMapper = (err) => {
    if (err instanceof ConflictError) {
      return { status: 409, code: err.code, message: err.message };
    }
    return null;
  };

  return {
    vehiclesRouter,
    catalogRouter,
    errorMapper,
    isLiveVehicle: (vehicleId) => repo.isLive(vehicleId),
  };
}
