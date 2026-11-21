import type { UserId } from '../../../domain/shared/user-id';
import type { VehicleId } from '../../../domain/shared/vehicle-id';
import type { Page, Pagination } from '../../../shared/pagination/pagination';
import { toPage } from '../../../shared/pagination/pagination';
import { PublicRateLimitedError } from '../domain/errors/public-rate-limited.error';
import type { IPublicMediaSigner } from '../domain/public-media-signer.port';
import type {
  IPublicVehicleQueries,
  PublicVehicleCriteria,
  PublicVehicleListing,
  PublicVehiclePhoto,
  PublicVehicleReadModel,
  PublicVehicleWithPhotos,
} from '../domain/public-vehicle.queries';
import type {
  IPreferenceIntake,
  PreferenceIntakeInput,
  PreferenceIntakeResult,
} from '../domain/preference-intake.port';
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
    status: 'available',
    soldOn: null,
    ...overrides,
  };
}

export class FakePublicVehicleQueries implements IPublicVehicleQueries {
  constructor(
    private readonly vehicles: PublicVehicleReadModel[] = [publicVehicle()],
    private readonly media: Record<string, PublicVehiclePhoto[]> = {},
  ) {}

  /** Supabase calls each test made; every call is a network round trip in production. */
  readonly calls: string[] = [];

  async list(
    _criteria: PublicVehicleCriteria,
    page: Pagination,
  ): Promise<Page<PublicVehicleListing>> {
    this.calls.push('list');
    return toPage(
      this.vehicles.slice(page.offset, page.offset + page.limit).map((vehicle) => {
        const photos = this.media[vehicle.id] ?? [];
        const cover = photos.find((photo) => photo.category === 'front') ?? photos[0];
        return { vehicle, coverPath: cover?.storagePath ?? null };
      }),
      this.vehicles.length,
      page,
    );
  }

  async get(id: string): Promise<PublicVehicleWithPhotos | null> {
    this.calls.push('get');
    const vehicle = this.vehicles.find((candidate) => candidate.id === id);
    return vehicle === undefined ? null : { vehicle, photos: this.media[id] ?? [] };
  }

  async listAll(): Promise<readonly PublicVehicleReadModel[]> {
    this.calls.push('listAll');
    return this.vehicles;
  }
}

export class FakeSigner implements IPublicMediaSigner {
  readonly calls: (readonly string[])[] = [];

  async sign(storagePaths: readonly string[]): Promise<ReadonlyMap<string, string>> {
    this.calls.push(storagePaths);
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

export class FakePreferenceIntake implements IPreferenceIntake {
  readonly submitted: PreferenceIntakeInput[] = [];
  rateLimited = false;

  constructor(private readonly result: Partial<PreferenceIntakeResult> = {}) {}

  async submit(input: PreferenceIntakeInput): Promise<PreferenceIntakeResult> {
    if (this.rateLimited) {
      throw new PublicRateLimitedError();
    }
    this.submitted.push(input);
    return {
      leadId: 'lead-1',
      outcome: 'created',
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
