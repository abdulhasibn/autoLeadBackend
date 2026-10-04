import type { RequestHandler } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '../../infrastructure/supabase/database.types';
import type { ErrorMapper } from '../../presentation/http/errors/error-mapping';
import type { Clock } from '../../shared/clock/clock';
import { UuidIdGenerator } from '../../shared/ids/id-generator';
import { InvalidLeadStatusTransitionError } from './domain/errors/invalid-lead-status-transition.error';
import type { ILiveVehicleLookup } from './domain/live-vehicle.port';
import type { IVehicleSale } from './domain/vehicle-sale.port';
import { LeadManagementPolicy } from './application/policies/lead-management.policy';
import { AssignLeadUseCase } from './application/use-cases/assign-lead.use-case';
import { AssociateLeadVehicleUseCase } from './application/use-cases/associate-lead-vehicle.use-case';
import { ChangeLeadStatusUseCase } from './application/use-cases/change-lead-status.use-case';
import { CreateLeadUseCase } from './application/use-cases/create-lead.use-case';
import { GetLeadUseCase } from './application/use-cases/get-lead.use-case';
import { ListLeadsUseCase } from './application/use-cases/list-leads.use-case';
import { ScheduleFollowUpUseCase } from './application/use-cases/schedule-follow-up.use-case';
import { SupabaseAssignableStaffLookup } from './infrastructure/supabase-assignable-staff.lookup';
import { SupabaseLeadQueries } from './infrastructure/supabase-lead.queries';
import { SupabaseLeadRepository } from './infrastructure/supabase-lead.repository';
import { AssignLeadController } from './presentation/controllers/assign-lead.controller';
import { AssociateLeadVehicleController } from './presentation/controllers/associate-lead-vehicle.controller';
import { ChangeLeadStatusController } from './presentation/controllers/change-lead-status.controller';
import { CreateLeadController } from './presentation/controllers/create-lead.controller';
import { GetLeadController } from './presentation/controllers/get-lead.controller';
import { ListLeadsController } from './presentation/controllers/list-leads.controller';
import { ScheduleFollowUpController } from './presentation/controllers/schedule-follow-up.controller';
import { createLeadsRouter } from './presentation/leads.routes';

export interface LeadsComposition {
  readonly router: ReturnType<typeof createLeadsRouter>;
  readonly errorMapper: ErrorMapper;
}

export interface LeadsCompositionDeps {
  readonly bearerMiddleware: RequestHandler;
  readonly clock: Clock;
  readonly liveVehicleLookup: ILiveVehicleLookup;
  readonly vehicleSale: IVehicleSale;
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

  const createLeadUseCase = new CreateLeadUseCase(
    policy,
    repo,
    deps.liveVehicleLookup,
    deps.clock,
    ids,
  );
  const associateLeadVehicleUseCase = new AssociateLeadVehicleUseCase(
    policy,
    repo,
    deps.liveVehicleLookup,
    deps.clock,
  );
  const changeLeadStatusUseCase = new ChangeLeadStatusUseCase(
    policy,
    repo,
    deps.vehicleSale,
    deps.clock,
  );
  const assignLeadUseCase = new AssignLeadUseCase(
    policy,
    repo,
    new SupabaseAssignableStaffLookup(infraClient),
    deps.clock,
  );
  const scheduleFollowUpUseCase = new ScheduleFollowUpUseCase(policy, repo, deps.clock, ids);
  const listLeadsUseCase = new ListLeadsUseCase(policy, queries);
  const getLeadUseCase = new GetLeadUseCase(policy, queries);

  const router = createLeadsRouter({
    bearerMiddleware: deps.bearerMiddleware,
    createLeadController: new CreateLeadController(createLeadUseCase),
    listLeadsController: new ListLeadsController(listLeadsUseCase),
    getLeadController: new GetLeadController(getLeadUseCase),
    associateLeadVehicleController: new AssociateLeadVehicleController(associateLeadVehicleUseCase),
    assignLeadController: new AssignLeadController(assignLeadUseCase),
    changeLeadStatusController: new ChangeLeadStatusController(changeLeadStatusUseCase),
    scheduleFollowUpController: new ScheduleFollowUpController(scheduleFollowUpUseCase),
  });

  const errorMapper: ErrorMapper = (err) => {
    if (err instanceof InvalidLeadStatusTransitionError) {
      return { status: 422, code: err.code, message: err.message };
    }
    return null;
  };

  return { router, errorMapper };
}
