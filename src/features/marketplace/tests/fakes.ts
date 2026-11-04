import type { UserId } from '../../../domain/shared/user-id';
import type { VehicleId } from '../../../domain/shared/vehicle-id';
import type { Page, Pagination } from '../../../shared/pagination/pagination';
import { toPage } from '../../../shared/pagination/pagination';
import { PublicRateLimitedError } from '../domain/errors/public-rate-limited.error';
import type { IPublicMediaSigner } from '../domain/public-media-signer.port';
import type {
  IPublicVehicleQueries,
  PublicVehicleCriteria,
  PublicVehiclePhoto,
  PublicVehicleReadModel,
} from '../domain/public-vehicle.queries';
import type {
  ITestDriveIntake,
  IVehicleLinkSync,
  TestDriveIntakeInput,
  TestDriveIntakeResult,
} from '../domain/test-drive-intake.port';
import type {
  ITouchClassifier,
  TouchClassification,
  VisitorTouch,
} from '../domain/touch-classifier.port';

export const VEHICLE_ID = '11111111-1111-4111-8111-111111111111';
export const VISITOR_ID = '22222222-2222-4222-8222-222222222222';
export const SESSION_ID = '33333333-3333-4333-8333-333333333333';

export function visitorTouch(overrides: Partial<VisitorTouch> = {}): VisitorTouch {
  return {
    hasFbclid: false,
    hasGclid: false,
    landingPath: '/cars/x',
    inAppBrowser: null,
    ...overrides,
  };
}

export function publicVehicle(
  overrides: Partial<PublicVehicleReadModel> = {},
): PublicVehicleReadModel {
  return {
    id: VEHICLE_ID,
    makeId: 'make-hyundai',
    modelId: 'model-creta',
    make: 'Hyundai',
    model: 'Creta',
    variant: 'SX (O)',
    bodyTypes: ['suv'],
    year: 2022,
    fuelType: 'petrol',
    transmission: 'automatic',
    kmDriven: 21000,
    previousOwners: 1,
    colour: 'White',
    description: 'One owner, full service history',
    listedPrice: 1450000,
    ...overrides,
  };
}

export class FakePublicVehicleQueries implements IPublicVehicleQueries {
  constructor(
    private readonly vehicles: PublicVehicleReadModel[] = [publicVehicle()],
    private readonly media: Record<string, PublicVehiclePhoto[]> = {},
  ) {}

  async list(
    _criteria: PublicVehicleCriteria,
    page: Pagination,
  ): Promise<Page<PublicVehicleReadModel>> {
    return toPage(
      this.vehicles.slice(page.offset, page.offset + page.limit),
      this.vehicles.length,
      page,
    );
  }

  async get(id: string): Promise<PublicVehicleReadModel | null> {
    return this.vehicles.find((vehicle) => vehicle.id === id) ?? null;
  }

  async listAll(): Promise<readonly PublicVehicleReadModel[]> {
    return this.vehicles;
  }

  async coverPaths(vehicleIds: readonly string[]): Promise<ReadonlyMap<string, string>> {
    const covers = new Map<string, string>();
    for (const id of vehicleIds) {
      const photos = this.media[id] ?? [];
      const cover = photos.find((photo) => photo.category === 'front') ?? photos[0];
      if (cover !== undefined) {
        covers.set(id, cover.storagePath);
      }
    }
    return covers;
  }

  async photos(vehicleId: string): Promise<readonly PublicVehiclePhoto[]> {
    return this.media[vehicleId] ?? [];
  }
}

export class FakeSigner implements IPublicMediaSigner {
  async sign(storagePaths: readonly string[]): Promise<ReadonlyMap<string, string>> {
    return new Map(storagePaths.map((path) => [path, `https://signed.test/${path}`]));
  }
}

export class FakeTestDriveIntake implements ITestDriveIntake {
  readonly submitted: TestDriveIntakeInput[] = [];
  rateLimited = false;

  constructor(private readonly result: Partial<TestDriveIntakeResult> = {}) {}

  async submit(input: TestDriveIntakeInput): Promise<TestDriveIntakeResult> {
    if (this.rateLimited) {
      throw new PublicRateLimitedError();
    }
    this.submitted.push(input);
    return {
      leadId: 'lead-1',
      outcome: 'created',
      vehicleAvailable: true,
      linkedVehicleId: input.vehicleId as VehicleId,
      showroom: {
        name: 'Wheels Experts',
        address: '100 Feet Road',
        city: 'Bengaluru',
        phone: '+918888000000',
        openingHours: null,
        googleMapsUrl: null,
      },
      ...this.result,
    };
  }
}

export class FakeVehicleLinkSync implements IVehicleLinkSync {
  readonly calls: { vehicleId: VehicleId; actorId: UserId }[] = [];

  async syncLinkState(
    vehicleId: VehicleId,
    _hasActiveLeads: boolean,
    actorId: UserId,
  ): Promise<void> {
    this.calls.push({ vehicleId, actorId });
  }
}

/** Stand-in for site-analytics: enough rules to tell touches apart in tests. */
export class FakeTouchClassifier implements ITouchClassifier {
  readonly classified: VisitorTouch[] = [];

  classify(touch: VisitorTouch): TouchClassification {
    this.classified.push(touch);
    if (touch.utmSource === 'instagram') {
      return { channel: 'instagram_ads', referrerHost: null };
    }
    if (touch.referrer !== undefined) {
      return {
        channel: 'google_organic',
        referrerHost: new URL(touch.referrer).host.replace(/^www\./, ''),
      };
    }
    return { channel: 'direct', referrerHost: null };
  }
}
