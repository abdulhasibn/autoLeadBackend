import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '../../infrastructure/supabase/database.types';
import type { ErrorMapper } from '../../presentation/http/errors/error-mapping';
import { GetPublicFilterOptionsUseCase } from './application/use-cases/get-public-filter-options.use-case';
import { GetPublicVehicleUseCase } from './application/use-cases/get-public-vehicle.use-case';
import { ListPublicVehiclesUseCase } from './application/use-cases/list-public-vehicles.use-case';
import { SubmitTestDriveUseCase } from './application/use-cases/submit-test-drive.use-case';
import { InvalidMobileError } from './domain/errors/invalid-mobile.error';
import { PublicRateLimitedError } from './domain/errors/public-rate-limited.error';
import type { IVehicleLinkSync } from './domain/test-drive-intake.port';
import type { ITouchClassifier } from './domain/touch-classifier.port';
import { SupabasePublicMediaSigner } from './infrastructure/supabase-public-media-signer';
import { SupabasePublicVehicleQueries } from './infrastructure/supabase-public-vehicle.queries';
import { SupabaseTestDriveIntake } from './infrastructure/supabase-test-drive-intake';
import { PublicVehiclesController } from './presentation/controllers/public-vehicles.controller';
import { SubmitTestDriveController } from './presentation/controllers/submit-test-drive.controller';
import { createMarketplaceRouter } from './presentation/marketplace.routes';

export interface MarketplaceComposition {
  readonly router: ReturnType<typeof createMarketplaceRouter>;
  readonly errorMapper: ErrorMapper;
}

export interface MarketplaceCompositionDeps {
  readonly allowedOrigins: readonly string[];
  readonly ipHashKey: string;
  readonly vehicleLinkSync: IVehicleLinkSync;
  readonly touchClassifier: ITouchClassifier;
}

/**
 * Constructs and wires the public marketplace (ADR-0010).
 * Called exclusively by src/app/composition-root.ts.
 */
export function composeMarketplace(
  infraClient: SupabaseClient<Database>,
  deps: MarketplaceCompositionDeps,
): MarketplaceComposition {
  const queries = new SupabasePublicVehicleQueries(infraClient);
  const signer = new SupabasePublicMediaSigner(infraClient);

  const router = createMarketplaceRouter({
    allowedOrigins: deps.allowedOrigins,
    publicVehiclesController: new PublicVehiclesController(
      new ListPublicVehiclesUseCase(queries, signer),
      new GetPublicVehicleUseCase(queries, signer),
      new GetPublicFilterOptionsUseCase(queries),
    ),
    submitTestDriveController: new SubmitTestDriveController(
      new SubmitTestDriveUseCase(
        new SupabaseTestDriveIntake(infraClient),
        deps.vehicleLinkSync,
        deps.touchClassifier,
      ),
      deps.ipHashKey,
    ),
  });

  const errorMapper: ErrorMapper = (error) => {
    if (error instanceof PublicRateLimitedError) {
      return { status: 429, code: error.code, message: error.message };
    }
    if (error instanceof InvalidMobileError) {
      return { status: 422, code: error.code, message: error.message };
    }
    return null;
  };

  return { router, errorMapper };
}
