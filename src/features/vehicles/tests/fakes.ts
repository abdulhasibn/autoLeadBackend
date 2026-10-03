import type { OwnerId } from '../../../domain/shared/owner-id';
import type { UserId } from '../../../domain/shared/user-id';
import type { VehicleId } from '../../../domain/shared/vehicle-id';
import type { Clock } from '../../../shared/clock/clock';
import type { IdGenerator } from '../../../shared/ids/id-generator';
import type { Page, Pagination } from '../../../shared/pagination/pagination';
import { toPage } from '../../../shared/pagination/pagination';
import type { DocumentId } from '../domain/document-id';
import type {
  ObjectStoragePort,
  SignedReadUrl,
  SignedUploadTicket,
  VehicleStorageKind,
} from '../domain/object-storage.port';
import type { MediaId } from '../domain/media-id';
import type { VehicleDocument } from '../domain/vehicle-document.entity';
import type { IVehicleDocumentRepository } from '../domain/vehicle-document.repository';
import type { VehicleMedia } from '../domain/vehicle-media.entity';
import type { IVehicleMediaRepository } from '../domain/vehicle-media.repository';
import type { IActiveShowroomLookup } from '../domain/active-showroom.port';
import type {
  ICatalogQueries,
  MakeReadModel,
  ModelReadModel,
  VariantReadModel,
} from '../domain/catalog.queries';
import type { ILiveVariantLookup } from '../domain/live-variant.port';
import type { MakeId } from '../domain/make-id';
import type { ModelId } from '../domain/model-id';
import type { IRegisteredOwnerLookup } from '../domain/registered-owner.port';
import type { ShowroomId } from '../../../domain/shared/showroom-id';
import type { VariantId } from '../domain/variant-id';
import type { Vehicle } from '../domain/vehicle.entity';
import type {
  IVehicleQueries,
  VehicleListCriteria,
  VehicleReadModel,
} from '../domain/vehicle.queries';
import type { IVehicleRepository } from '../domain/vehicle.repository';

export class FakeClock implements Clock {
  constructor(private current: Date) {}

  now(): Date {
    return this.current;
  }
}

export class FakeIdGenerator implements IdGenerator {
  nextId = '33333333-3333-4333-8333-333333333333';

  generate(): string {
    return this.nextId;
  }
}

export class FakeVehicleRepository implements IVehicleRepository {
  readonly store = new Map<string, Vehicle>();
  saveError: Error | null = null;

  seed(vehicle: Vehicle): void {
    this.store.set(vehicle.id, vehicle);
  }

  async findById(id: VehicleId): Promise<Vehicle | null> {
    const vehicle = this.store.get(id) ?? null;
    if (vehicle === null || vehicle.isDeleted) {
      return null;
    }
    return vehicle;
  }

  async isLive(id: VehicleId): Promise<boolean> {
    return (await this.findById(id)) !== null;
  }

  async save(vehicle: Vehicle, _actorId: UserId): Promise<void> {
    if (this.saveError !== null) {
      throw this.saveError;
    }
    this.store.set(vehicle.id, vehicle);
  }
}

export class FakeVehicleMediaRepository implements IVehicleMediaRepository {
  readonly store = new Map<string, VehicleMedia>();

  seed(media: VehicleMedia): void {
    this.store.set(media.id, media);
  }

  async findById(id: MediaId): Promise<VehicleMedia | null> {
    return this.store.get(id) ?? null;
  }

  async save(media: VehicleMedia): Promise<void> {
    this.store.set(media.id, media);
  }

  async delete(id: MediaId): Promise<void> {
    this.store.delete(id);
  }
}

export class FakeVehicleDocumentRepository implements IVehicleDocumentRepository {
  readonly store = new Map<string, VehicleDocument>();

  async findById(id: DocumentId): Promise<VehicleDocument | null> {
    return this.store.get(id) ?? null;
  }

  async save(document: VehicleDocument): Promise<void> {
    this.store.set(document.id, document);
  }

  async delete(id: DocumentId): Promise<void> {
    this.store.delete(id);
  }
}

export class FakeObjectStorage implements ObjectStoragePort {
  readonly objects = new Set<string>();

  seed(kind: VehicleStorageKind, storagePath: string): void {
    this.objects.add(`${kind}:${storagePath}`);
  }

  async createSignedUpload(input: {
    readonly kind: VehicleStorageKind;
    readonly storagePath: string;
    readonly expiresInSeconds: number;
  }): Promise<SignedUploadTicket> {
    return {
      uploadUrl: `https://storage.example/${input.kind}/${input.storagePath}`,
      token: 'upload-token',
    };
  }

  async exists(kind: VehicleStorageKind, storagePath: string): Promise<boolean> {
    return this.objects.has(`${kind}:${storagePath}`);
  }

  async createSignedReadUrl(input: {
    readonly kind: VehicleStorageKind;
    readonly storagePath: string;
    readonly expiresInSeconds: number;
  }): Promise<SignedReadUrl> {
    return { url: `https://storage.example/read/${input.kind}/${input.storagePath}` };
  }

  async remove(kind: VehicleStorageKind, storagePath: string): Promise<void> {
    this.objects.delete(`${kind}:${storagePath}`);
  }
}

export class FakeRegisteredOwnerLookup implements IRegisteredOwnerLookup {
  live = new Set<string>();

  seed(ownerId: OwnerId): void {
    this.live.add(ownerId);
  }

  async isLive(ownerId: OwnerId): Promise<boolean> {
    return this.live.has(ownerId);
  }
}

export class FakeLiveVariantLookup implements ILiveVariantLookup {
  live = new Set<string>();

  seed(variantId: VariantId): void {
    this.live.add(variantId);
  }

  async isLive(variantId: VariantId): Promise<boolean> {
    return this.live.has(variantId);
  }
}

export class FakeActiveShowroomLookup implements IActiveShowroomLookup {
  live = new Set<string>();

  seed(showroomId: ShowroomId): void {
    this.live.add(showroomId);
  }

  async isActive(showroomId: ShowroomId): Promise<boolean> {
    return this.live.has(showroomId);
  }
}

export class FakeVehicleQueries implements IVehicleQueries {
  readonly vehicles: VehicleReadModel[] = [];

  seed(vehicle: VehicleReadModel): void {
    this.vehicles.push(vehicle);
  }

  async listVehicles(
    criteria: VehicleListCriteria,
    page: Pagination,
  ): Promise<Page<VehicleReadModel>> {
    const filtered = this.vehicles.filter((vehicle) => {
      if (criteria.status !== undefined && vehicle.status !== criteria.status) {
        return false;
      }
      if (criteria.ownerId !== undefined && vehicle.ownerId !== criteria.ownerId) {
        return false;
      }
      if (criteria.showroomId !== undefined && vehicle.showroomId !== criteria.showroomId) {
        return false;
      }
      if (
        criteria.registration !== undefined &&
        vehicle.registrationNumber !== criteria.registration
      ) {
        return false;
      }
      return true;
    });
    return toPage(filtered.slice(page.offset, page.offset + page.limit), filtered.length, page);
  }

  async getVehicle(id: VehicleId): Promise<VehicleReadModel | null> {
    return this.vehicles.find((vehicle) => vehicle.id === id) ?? null;
  }
}

export class FakeCatalogQueries implements ICatalogQueries {
  readonly makes: MakeReadModel[] = [];
  readonly models: ModelReadModel[] = [];
  readonly variants: VariantReadModel[] = [];

  async listMakes(page: Pagination): Promise<Page<MakeReadModel>> {
    return toPage(this.makes.slice(page.offset, page.offset + page.limit), this.makes.length, page);
  }

  async listModels(makeId: MakeId, page: Pagination): Promise<Page<ModelReadModel>> {
    const filtered = this.models.filter((model) => model.makeId === makeId);
    return toPage(filtered.slice(page.offset, page.offset + page.limit), filtered.length, page);
  }

  async listVariants(modelId: ModelId, page: Pagination): Promise<Page<VariantReadModel>> {
    const filtered = this.variants.filter((variant) => variant.modelId === modelId);
    return toPage(filtered.slice(page.offset, page.offset + page.limit), filtered.length, page);
  }
}
