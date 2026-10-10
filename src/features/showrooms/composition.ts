import type { RequestHandler } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '../../infrastructure/supabase/database.types';
import type { ErrorMapper } from '../../presentation/http/errors/error-mapping';
import { ShowroomDirectoryPolicy } from './application/policies/showroom-directory.policy';
import { ListShowroomsUseCase } from './application/use-cases/list-showrooms.use-case';
import { SupabaseShowroomQueries } from './infrastructure/supabase-showroom.queries';
import { ListShowroomsController } from './presentation/controllers/list-showrooms.controller';
import { createShowroomsRouter } from './presentation/showrooms.routes';

export interface ShowroomsComposition {
  readonly router: ReturnType<typeof createShowroomsRouter>;
  readonly errorMapper: ErrorMapper;
}

export interface ShowroomsCompositionDeps {
  readonly bearerMiddleware: RequestHandler;
}

/**
 * Constructs and wires the read-only showroom directory.
 * Called exclusively by src/app/composition-root.ts.
 */
export function composeShowrooms(
  infraClient: SupabaseClient<Database>,
  deps: ShowroomsCompositionDeps,
): ShowroomsComposition {
  const router = createShowroomsRouter({
    bearerMiddleware: deps.bearerMiddleware,
    listShowroomsController: new ListShowroomsController(
      new ListShowroomsUseCase(
        new ShowroomDirectoryPolicy(),
        new SupabaseShowroomQueries(infraClient),
      ),
    ),
  });

  const errorMapper: ErrorMapper = () => null;

  return { router, errorMapper };
}
