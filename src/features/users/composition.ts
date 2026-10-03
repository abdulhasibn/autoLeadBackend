import type { RequestHandler } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '../../infrastructure/supabase/database.types';
import type { ErrorMapper } from '../../presentation/http/errors/error-mapping';
import type { Clock } from '../../shared/clock/clock';
import { LastAdminProtectedError } from './application/errors/last-admin-protected.error';
import { AdminStaffPolicy } from './application/policies/admin-staff.policy';
import { CreateStaffUseCase } from './application/use-cases/create-staff.use-case';
import { DeactivateStaffUseCase } from './application/use-cases/deactivate-staff.use-case';
import { GetStaffUseCase } from './application/use-cases/get-staff.use-case';
import { ListStaffUseCase } from './application/use-cases/list-staff.use-case';
import { ReplaceStaffRolesUseCase } from './application/use-cases/replace-staff-roles.use-case';
import { UpdateStaffUseCase } from './application/use-cases/update-staff.use-case';
import { SupabaseAuthUserProvisioner } from './infrastructure/supabase-auth-user-provisioner';
import { SupabaseStaffQueries } from './infrastructure/supabase-staff.queries';
import { SupabaseUserRepository } from './infrastructure/supabase-user.repository';
import { CreateStaffController } from './presentation/controllers/create-staff.controller';
import { DeactivateStaffController } from './presentation/controllers/deactivate-staff.controller';
import { GetStaffController } from './presentation/controllers/get-staff.controller';
import { ListStaffController } from './presentation/controllers/list-staff.controller';
import { ReplaceStaffRolesController } from './presentation/controllers/replace-staff-roles.controller';
import { UpdateStaffController } from './presentation/controllers/update-staff.controller';
import { createUsersRouter } from './presentation/users.routes';

export interface UsersComposition {
  readonly router: ReturnType<typeof createUsersRouter>;
  readonly errorMapper: ErrorMapper;
}

export interface UsersCompositionDeps {
  readonly bearerMiddleware: RequestHandler;
  readonly clock: Clock;
}

/**
 * Constructs and wires the users feature.
 * Called exclusively by src/app/composition-root.ts.
 */
export function composeUsers(
  infraClient: SupabaseClient<Database>,
  deps: UsersCompositionDeps,
): UsersComposition {
  const policy = new AdminStaffPolicy();
  const repo = new SupabaseUserRepository(infraClient);
  const queries = new SupabaseStaffQueries(infraClient);
  const provisioner = new SupabaseAuthUserProvisioner(infraClient);

  const createStaffUseCase = new CreateStaffUseCase(policy, repo, provisioner, deps.clock);
  const updateStaffUseCase = new UpdateStaffUseCase(policy, repo, provisioner);
  const replaceStaffRolesUseCase = new ReplaceStaffRolesUseCase(policy, repo);
  const deactivateStaffUseCase = new DeactivateStaffUseCase(policy, repo, provisioner, deps.clock);
  const listStaffUseCase = new ListStaffUseCase(policy, queries);
  const getStaffUseCase = new GetStaffUseCase(policy, queries);

  const router = createUsersRouter({
    bearerMiddleware: deps.bearerMiddleware,
    createStaffController: new CreateStaffController(createStaffUseCase),
    listStaffController: new ListStaffController(listStaffUseCase),
    getStaffController: new GetStaffController(getStaffUseCase),
    updateStaffController: new UpdateStaffController(updateStaffUseCase),
    replaceStaffRolesController: new ReplaceStaffRolesController(replaceStaffRolesUseCase),
    deactivateStaffController: new DeactivateStaffController(deactivateStaffUseCase),
  });

  const errorMapper: ErrorMapper = (err) => {
    if (err instanceof LastAdminProtectedError) {
      return { status: 409, code: err.code, message: err.message };
    }
    return null;
  };

  return { router, errorMapper };
}
