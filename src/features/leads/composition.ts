import type { RequestHandler } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '../../infrastructure/supabase/database.types';
import type { ErrorMapper } from '../../presentation/http/errors/error-mapping';
import type { Clock } from '../../shared/clock/clock';
import { UuidIdGenerator } from '../../shared/ids/id-generator';
import { InvalidLeadStatusTransitionError } from './domain/errors/invalid-lead-status-transition.error';
import type { ICatalogLineageLookup } from './domain/catalog-lineage.port';
import type { ILeadQueries } from './domain/lead.queries';
import type { ILinkableVehicleLookup } from './domain/linkable-vehicle.port';
import type { IMatchableVehicleLookup } from './domain/matchable-vehicle.port';
import type { IVehicleLinkSync } from './domain/vehicle-link-sync.port';
import type { IVehicleSale } from './domain/vehicle-sale.port';
import { LeadManagementPolicy } from './application/policies/lead-management.policy';
import { LeadLinkService } from './application/services/lead-link.service';
import { VehicleLinkRefresher } from './application/services/vehicle-link-refresher';
import { AssignLeadUseCase } from './application/use-cases/assign-lead.use-case';
import { AssociateLeadVehicleUseCase } from './application/use-cases/associate-lead-vehicle.use-case';
import { ChangeLeadStatusUseCase } from './application/use-cases/change-lead-status.use-case';
import { CreateLeadUseCase } from './application/use-cases/create-lead.use-case';
import { GetLeadUseCase } from './application/use-cases/get-lead.use-case';
import { ListLeadStatusHistoryUseCase } from './application/use-cases/list-lead-status-history.use-case';
import { ListLeadsUseCase } from './application/use-cases/list-leads.use-case';
import { ListVehicleLeadMatchesUseCase } from './application/use-cases/list-vehicle-lead-matches.use-case';
import { RemoveLeadVehicleUseCase } from './application/use-cases/remove-lead-vehicle.use-case';
import { ScheduleFollowUpUseCase } from './application/use-cases/schedule-follow-up.use-case';
import { SetLeadPreferenceUseCase } from './application/use-cases/set-lead-preference.use-case';
import { UpdateLeadUseCase } from './application/use-cases/update-lead.use-case';
import { SupabaseAssignableStaffLookup } from './infrastructure/supabase-assignable-staff.lookup';
import { SupabaseLeadStatusHistoryQueries } from './infrastructure/supabase-lead-status-history.queries';
import { SupabaseLeadQueries } from './infrastructure/supabase-lead.queries';
import { SupabaseLeadRepository } from './infrastructure/supabase-lead.repository';
import { AssignLeadController } from './presentation/controllers/assign-lead.controller';
import { AssociateLeadVehicleController } from './presentation/controllers/associate-lead-vehicle.controller';
import { ChangeLeadStatusController } from './presentation/controllers/change-lead-status.controller';
import { CreateLeadController } from './presentation/controllers/create-lead.controller';
import { GetLeadController } from './presentation/controllers/get-lead.controller';
import { ListLeadStatusHistoryController } from './presentation/controllers/list-lead-status-history.controller';
import { ListLeadsController } from './presentation/controllers/list-leads.controller';
import { ListVehicleLeadMatchesController } from './presentation/controllers/list-vehicle-lead-matches.controller';
import { RemoveLeadVehicleController } from './presentation/controllers/remove-lead-vehicle.controller';
import { ScheduleFollowUpController } from './presentation/controllers/schedule-follow-up.controller';
import { SetLeadPreferenceController } from './presentation/controllers/set-lead-preference.controller';
import { UpdateLeadController } from './presentation/controllers/update-lead.controller';
import { createLeadsRouter } from './presentation/leads.routes';

export interface LeadsComposition {
  readonly router: ReturnType<typeof createLeadsRouter>;
  readonly errorMapper: ErrorMapper;
  readonly linkedLeads: LeadLinkService;
  readonly linkedLeadCounts: Pick<ILeadQueries, 'countActiveByVehicles'>;
}

export interface LeadsCompositionDeps {
  readonly bearerMiddleware: RequestHandler;
  readonly clock: Clock;
  readonly linkableVehicleLookup: ILinkableVehicleLookup;
  readonly vehicleLinkSync: IVehicleLinkSync;
  readonly vehicleSale: IVehicleSale;
  readonly catalogLineage: ICatalogLineageLookup;
  readonly matchableVehicles: IMatchableVehicleLookup;
}

/**
 * Constructs and wires the leads feature.
 * Called exclusively by src/app/composition-root.ts.
 */
export function composeLeads(
  infraClient: SupabaseClient<Database>,
  deps: LeadsCompositionDeps,
): LeadsComposition {
  const policy = new LeadManagementPolicy();
  const repo = new SupabaseLeadRepository(infraClient);
  const queries = new SupabaseLeadQueries(infraClient);
  const ids = new UuidIdGenerator();
  const vehicleLinks = new VehicleLinkRefresher(repo, deps.vehicleLinkSync);

  const createLeadUseCase = new CreateLeadUseCase(
    policy,
    repo,
    deps.linkableVehicleLookup,
    vehicleLinks,
    deps.catalogLineage,
    deps.clock,
    ids,
  );
  const associateLeadVehicleUseCase = new AssociateLeadVehicleUseCase(
    policy,
    repo,
    deps.linkableVehicleLookup,
    vehicleLinks,
    deps.clock,
  );
  const changeLeadStatusUseCase = new ChangeLeadStatusUseCase(
    policy,
    repo,
    deps.vehicleSale,
    vehicleLinks,
    deps.clock,
  );
  const assignLeadUseCase = new AssignLeadUseCase(
    policy,
    repo,
    new SupabaseAssignableStaffLookup(infraClient),
    deps.clock,
  );
  const setLeadPreferenceUseCase = new SetLeadPreferenceUseCase(
    policy,
    repo,
    deps.catalogLineage,
    deps.clock,
  );
  const scheduleFollowUpUseCase = new ScheduleFollowUpUseCase(policy, repo, deps.clock, ids);
  const listLeadsUseCase = new ListLeadsUseCase(policy, queries);
  const getLeadUseCase = new GetLeadUseCase(policy, queries);
  const updateLeadUseCase = new UpdateLeadUseCase(policy, repo, deps.clock, ids);
  const removeLeadVehicleUseCase = new RemoveLeadVehicleUseCase(
    policy,
    repo,
    vehicleLinks,
    deps.clock,
  );
  const listVehicleLeadMatchesUseCase = new ListVehicleLeadMatchesUseCase(
    policy,
    queries,
    deps.matchableVehicles,
  );
  const listLeadStatusHistoryUseCase = new ListLeadStatusHistoryUseCase(
    policy,
    queries,
    new SupabaseLeadStatusHistoryQueries(infraClient),
  );

  const router = createLeadsRouter({
    bearerMiddleware: deps.bearerMiddleware,
    createLeadController: new CreateLeadController(createLeadUseCase),
    listLeadsController: new ListLeadsController(listLeadsUseCase),
    getLeadController: new GetLeadController(getLeadUseCase),
    associateLeadVehicleController: new AssociateLeadVehicleController(associateLeadVehicleUseCase),
    assignLeadController: new AssignLeadController(assignLeadUseCase),
    changeLeadStatusController: new ChangeLeadStatusController(changeLeadStatusUseCase),
    scheduleFollowUpController: new ScheduleFollowUpController(scheduleFollowUpUseCase),
    setLeadPreferenceController: new SetLeadPreferenceController(setLeadPreferenceUseCase),
    updateLeadController: new UpdateLeadController(updateLeadUseCase),
    removeLeadVehicleController: new RemoveLeadVehicleController(removeLeadVehicleUseCase),
    listLeadStatusHistoryController: new ListLeadStatusHistoryController(
      listLeadStatusHistoryUseCase,
    ),
    listVehicleLeadMatchesController: new ListVehicleLeadMatchesController(
      listVehicleLeadMatchesUseCase,
    ),
  });

  const errorMapper: ErrorMapper = (err) => {
    if (err instanceof InvalidLeadStatusTransitionError) {
      return { status: 422, code: err.code, message: err.message };
    }
    return null;
  };

  return {
    router,
    errorMapper,
    linkedLeads: new LeadLinkService(repo, deps.clock),
    linkedLeadCounts: queries,
  };
}
