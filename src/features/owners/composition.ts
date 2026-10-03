import type { RequestHandler } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';

import { ConflictError } from '../../domain/errors/conflict.error';
import type { OwnerId } from '../../domain/shared/owner-id';
import type { Database } from '../../infrastructure/supabase/database.types';
import type { ErrorMapper } from '../../presentation/http/errors/error-mapping';
import type { Clock } from '../../shared/clock/clock';
import { UuidIdGenerator } from '../../shared/ids/id-generator';
import { OwnerManagementPolicy } from './application/policies/owner-management.policy';
import { CreateOwnerUseCase } from './application/use-cases/create-owner.use-case';
import { DeactivateOwnerUseCase } from './application/use-cases/deactivate-owner.use-case';
import { GetOwnerUseCase } from './application/use-cases/get-owner.use-case';
import { ListOwnersUseCase } from './application/use-cases/list-owners.use-case';
import { UpdateOwnerUseCase } from './application/use-cases/update-owner.use-case';
import { SupabaseOwnerQueries } from './infrastructure/supabase-owner.queries';
import { SupabaseOwnerRepository } from './infrastructure/supabase-owner.repository';
import { CreateOwnerController } from './presentation/controllers/create-owner.controller';
import { DeactivateOwnerController } from './presentation/controllers/deactivate-owner.controller';
import { GetOwnerController } from './presentation/controllers/get-owner.controller';
import { ListOwnersController } from './presentation/controllers/list-owners.controller';
import { UpdateOwnerController } from './presentation/controllers/update-owner.controller';
import { createOwnersRouter } from './presentation/owners.routes';

export interface OwnersComposition {
  readonly router: ReturnType<typeof createOwnersRouter>;
  readonly errorMapper: ErrorMapper;
  readonly isLiveOwner: (ownerId: OwnerId) => Promise<boolean>;
}

export interface OwnersCompositionDeps {
  readonly bearerMiddleware: RequestHandler;
  readonly clock: Clock;
}

/**
 * Constructs and wires the owners feature.
 * Called exclusively by src/app/composition-root.ts.
 */
export function composeOwners(
  infraClient: SupabaseClient<Database>,
  deps: OwnersCompositionDeps,
): OwnersComposition {
  const policy = new OwnerManagementPolicy();
  const repo = new SupabaseOwnerRepository(infraClient);
  const queries = new SupabaseOwnerQueries(infraClient);
  const ids = new UuidIdGenerator();

  const createOwnerUseCase = new CreateOwnerUseCase(policy, repo, deps.clock, ids);
  const updateOwnerUseCase = new UpdateOwnerUseCase(policy, repo, deps.clock);
  const deactivateOwnerUseCase = new DeactivateOwnerUseCase(policy, repo, deps.clock);
  const listOwnersUseCase = new ListOwnersUseCase(policy, queries);
  const getOwnerUseCase = new GetOwnerUseCase(policy, queries);

  const router = createOwnersRouter({
    bearerMiddleware: deps.bearerMiddleware,
    createOwnerController: new CreateOwnerController(createOwnerUseCase),
    listOwnersController: new ListOwnersController(listOwnersUseCase),
    getOwnerController: new GetOwnerController(getOwnerUseCase),
    updateOwnerController: new UpdateOwnerController(updateOwnerUseCase),
    deactivateOwnerController: new DeactivateOwnerController(deactivateOwnerUseCase),
  });

  const errorMapper: ErrorMapper = (err) => {
    if (err instanceof ConflictError) {
      return { status: 409, code: err.code, message: err.message };
    }
    return null;
  };

  return { router, errorMapper, isLiveOwner: (ownerId) => repo.isLive(ownerId) };
}
