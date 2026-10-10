import type { RequestHandler } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';

import { ConflictError } from '../../domain/errors/conflict.error';
import type { Database } from '../../infrastructure/supabase/database.types';
import type { ErrorMapper } from '../../presentation/http/errors/error-mapping';
import type { Clock } from '../../shared/clock/clock';
import { UuidIdGenerator } from '../../shared/ids/id-generator';
import { VehicleManagementPolicy } from './application/policies/vehicle-management.policy';
import { VehicleFrontImages } from './application/services/vehicle-front-images';
import { VehicleLeadLinkService } from './application/services/vehicle-lead-link.service';
import { ChangeVehicleStatusUseCase } from './application/use-cases/change-vehicle-status.use-case';
import { ConfirmVehicleDocumentUseCase } from './application/use-cases/confirm-vehicle-document.use-case';
import { ConfirmVehicleMediaUseCase } from './application/use-cases/confirm-vehicle-media.use-case';
import { CreateVehicleUseCase } from './application/use-cases/create-vehicle.use-case';
import { CreateVehicleDocumentUploadUseCase } from './application/use-cases/create-vehicle-document-upload.use-case';
import { CreateVehicleMediaUploadUseCase } from './application/use-cases/create-vehicle-media-upload.use-case';
import { DeleteVehicleDocumentUseCase } from './application/use-cases/delete-vehicle-document.use-case';
import { DeleteVehicleMediaUseCase } from './application/use-cases/delete-vehicle-media.use-case';
import { GetVehicleUseCase } from './application/use-cases/get-vehicle.use-case';
import { ListMakesUseCase } from './application/use-cases/list-makes.use-case';
import { ListModelsUseCase } from './application/use-cases/list-models.use-case';
import { ListVariantsUseCase } from './application/use-cases/list-variants.use-case';
import { ListVehicleDocumentsUseCase } from './application/use-cases/list-vehicle-documents.use-case';
import { ListVehicleMediaUseCase } from './application/use-cases/list-vehicle-media.use-case';
import { ListVehicleStatusHistoryUseCase } from './application/use-cases/list-vehicle-status-history.use-case';
import { ListVehiclesUseCase } from './application/use-cases/list-vehicles.use-case';
import { UpdateVehicleUseCase } from './application/use-cases/update-vehicle.use-case';
import { InvalidVehicleObjectPathError } from './domain/errors/invalid-vehicle-object-path.error';
import { InvalidVehicleStatusTransitionError } from './domain/errors/invalid-vehicle-status-transition.error';
import type { IVehicleMatchProfiles } from './domain/vehicle-match-profile.queries';
import type { ICatalogLineage } from './domain/catalog-lineage.port';
import type { ILinkedLeads } from './domain/linked-leads.port';
import type { ILinkedLeadCounts } from './domain/linked-lead-counts.port';
import type { IRegisteredOwnerLookup } from './domain/registered-owner.port';
import { SupabaseActiveShowroomLookup } from './infrastructure/supabase-active-showroom.lookup';
import { SupabaseVehicleMatchProfiles } from './infrastructure/supabase-vehicle-match-profiles';
import { SupabaseCatalogLineageLookup } from './infrastructure/supabase-catalog-lineage.lookup';
import { SupabaseCatalogQueries } from './infrastructure/supabase-catalog.queries';
import { SupabaseLiveVariantLookup } from './infrastructure/supabase-live-variant.lookup';
import { SupabaseObjectStorage } from './infrastructure/supabase-object-storage';
import { SupabaseVehicleDocumentQueries } from './infrastructure/supabase-vehicle-document.queries';
import { SupabaseVehicleDocumentRepository } from './infrastructure/supabase-vehicle-document.repository';
import { SupabaseVehicleMediaQueries } from './infrastructure/supabase-vehicle-media.queries';
import { SupabaseVehicleMediaRepository } from './infrastructure/supabase-vehicle-media.repository';
import { SupabaseVehicleQueries } from './infrastructure/supabase-vehicle.queries';
import { SupabaseVehicleRepository } from './infrastructure/supabase-vehicle.repository';
import { SupabaseVehicleStatusHistoryQueries } from './infrastructure/supabase-vehicle-status-history.queries';
import { createCatalogRouter } from './presentation/catalog.routes';
import { ChangeVehicleStatusController } from './presentation/controllers/change-vehicle-status.controller';
import { ConfirmVehicleDocumentController } from './presentation/controllers/confirm-vehicle-document.controller';
import { ConfirmVehicleMediaController } from './presentation/controllers/confirm-vehicle-media.controller';
import { CreateVehicleController } from './presentation/controllers/create-vehicle.controller';
import { CreateVehicleDocumentUploadController } from './presentation/controllers/create-vehicle-document-upload.controller';
import { CreateVehicleMediaUploadController } from './presentation/controllers/create-vehicle-media-upload.controller';
import { DeleteVehicleDocumentController } from './presentation/controllers/delete-vehicle-document.controller';
import { DeleteVehicleMediaController } from './presentation/controllers/delete-vehicle-media.controller';
import { GetVehicleController } from './presentation/controllers/get-vehicle.controller';
import { ListMakesController } from './presentation/controllers/list-makes.controller';
import { ListModelsController } from './presentation/controllers/list-models.controller';
import { ListVariantsController } from './presentation/controllers/list-variants.controller';
import { ListVehicleDocumentsController } from './presentation/controllers/list-vehicle-documents.controller';
import { ListVehicleMediaController } from './presentation/controllers/list-vehicle-media.controller';
import { ListVehicleStatusHistoryController } from './presentation/controllers/list-vehicle-status-history.controller';
import { ListVehiclesController } from './presentation/controllers/list-vehicles.controller';
import { UpdateVehicleController } from './presentation/controllers/update-vehicle.controller';
import { createVehiclesRouter } from './presentation/vehicles.routes';

export interface VehiclesComposition {
  readonly vehiclesRouter: ReturnType<typeof createVehiclesRouter>;
  readonly catalogRouter: ReturnType<typeof createCatalogRouter>;
  readonly errorMapper: ErrorMapper;
  readonly vehicleLeadLink: VehicleLeadLinkService;
  /** Read-only catalog lineage for features that reference catalog ids (leads). */
  readonly catalogLineage: ICatalogLineage;
  /** Vehicle attributes for scoring buyer preferences (leads). */
  readonly matchableVehicles: IVehicleMatchProfiles;
}

export interface VehiclesCompositionDeps {
  readonly bearerMiddleware: RequestHandler;
  readonly clock: Clock;
  readonly registeredOwnerLookup: IRegisteredOwnerLookup;
  readonly linkedLeads: ILinkedLeads;
  readonly linkedLeadCounts: ILinkedLeadCounts;
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
  const historyQueries = new SupabaseVehicleStatusHistoryQueries(infraClient);
  const mediaRepo = new SupabaseVehicleMediaRepository(infraClient);
  const mediaQueries = new SupabaseVehicleMediaQueries(infraClient);
  const documentRepo = new SupabaseVehicleDocumentRepository(infraClient);
  const documentQueries = new SupabaseVehicleDocumentQueries(infraClient);
  const storage = new SupabaseObjectStorage(infraClient);
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
  const changeVehicleStatusUseCase = new ChangeVehicleStatusUseCase(
    policy,
    repo,
    deps.linkedLeads,
    deps.clock,
  );
  const frontImages = new VehicleFrontImages(mediaQueries, storage, deps.clock);
  const listVehiclesUseCase = new ListVehiclesUseCase(
    policy,
    queries,
    frontImages,
    deps.linkedLeadCounts,
  );
  const getVehicleUseCase = new GetVehicleUseCase(
    policy,
    queries,
    frontImages,
    deps.linkedLeadCounts,
  );
  const listVehicleStatusHistoryUseCase = new ListVehicleStatusHistoryUseCase(
    policy,
    queries,
    historyQueries,
  );
  const createVehicleMediaUploadUseCase = new CreateVehicleMediaUploadUseCase(
    policy,
    repo,
    storage,
    deps.clock,
    ids,
  );
  const confirmVehicleMediaUseCase = new ConfirmVehicleMediaUseCase(
    policy,
    repo,
    mediaRepo,
    storage,
    deps.clock,
    ids,
  );
  const listVehicleMediaUseCase = new ListVehicleMediaUseCase(
    policy,
    queries,
    mediaQueries,
    storage,
    deps.clock,
  );
  const deleteVehicleMediaUseCase = new DeleteVehicleMediaUseCase(policy, repo, mediaRepo, storage);
  const createVehicleDocumentUploadUseCase = new CreateVehicleDocumentUploadUseCase(
    policy,
    repo,
    storage,
    deps.clock,
    ids,
  );
  const confirmVehicleDocumentUseCase = new ConfirmVehicleDocumentUseCase(
    policy,
    repo,
    documentRepo,
    storage,
    deps.clock,
    ids,
  );
  const listVehicleDocumentsUseCase = new ListVehicleDocumentsUseCase(
    policy,
    queries,
    documentQueries,
    storage,
    deps.clock,
  );
  const deleteVehicleDocumentUseCase = new DeleteVehicleDocumentUseCase(
    policy,
    repo,
    documentRepo,
    storage,
  );
  const listMakesUseCase = new ListMakesUseCase(policy, catalog);
  const listModelsUseCase = new ListModelsUseCase(policy, catalog);
  const listVariantsUseCase = new ListVariantsUseCase(policy, catalog);

  const vehiclesRouter = createVehiclesRouter({
    bearerMiddleware: deps.bearerMiddleware,
    createVehicleController: new CreateVehicleController(createVehicleUseCase),
    listVehiclesController: new ListVehiclesController(listVehiclesUseCase),
    getVehicleController: new GetVehicleController(getVehicleUseCase),
    updateVehicleController: new UpdateVehicleController(updateVehicleUseCase),
    changeVehicleStatusController: new ChangeVehicleStatusController(changeVehicleStatusUseCase),
    listVehicleStatusHistoryController: new ListVehicleStatusHistoryController(
      listVehicleStatusHistoryUseCase,
    ),
    createVehicleMediaUploadController: new CreateVehicleMediaUploadController(
      createVehicleMediaUploadUseCase,
    ),
    confirmVehicleMediaController: new ConfirmVehicleMediaController(confirmVehicleMediaUseCase),
    listVehicleMediaController: new ListVehicleMediaController(listVehicleMediaUseCase),
    deleteVehicleMediaController: new DeleteVehicleMediaController(deleteVehicleMediaUseCase),
    createVehicleDocumentUploadController: new CreateVehicleDocumentUploadController(
      createVehicleDocumentUploadUseCase,
    ),
    confirmVehicleDocumentController: new ConfirmVehicleDocumentController(
      confirmVehicleDocumentUseCase,
    ),
    listVehicleDocumentsController: new ListVehicleDocumentsController(listVehicleDocumentsUseCase),
    deleteVehicleDocumentController: new DeleteVehicleDocumentController(
      deleteVehicleDocumentUseCase,
    ),
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
    if (err instanceof InvalidVehicleStatusTransitionError) {
      return { status: 422, code: err.code, message: err.message };
    }
    if (err instanceof InvalidVehicleObjectPathError) {
      return { status: 422, code: err.code, message: err.message };
    }
    return null;
  };

  return {
    vehiclesRouter,
    catalogRouter,
    errorMapper,
    vehicleLeadLink: new VehicleLeadLinkService(repo, deps.clock),
    catalogLineage: new SupabaseCatalogLineageLookup(infraClient),
    matchableVehicles: new SupabaseVehicleMatchProfiles(infraClient),
  };
}
