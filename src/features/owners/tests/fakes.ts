import type { UserId } from '../../../domain/shared/user-id';
import type { Clock } from '../../../shared/clock/clock';
import type { IdGenerator } from '../../../shared/ids/id-generator';
import type { Page, Pagination } from '../../../shared/pagination/pagination';
import { toPage } from '../../../shared/pagination/pagination';
import type { IOwnerQueries, OwnerListCriteria, OwnerReadModel } from '../domain/owner.queries';
import type { Owner } from '../domain/owner.entity';
import type { IOwnerRepository } from '../domain/owner.repository';
import type { OwnerId } from '../domain/owner-id';

export class FakeClock implements Clock {
  constructor(private current: Date) {}

  now(): Date {
    return this.current;
  }
}

export class FakeIdGenerator implements IdGenerator {
  nextId = '22222222-2222-4222-8222-222222222222';

  generate(): string {
    return this.nextId;
  }
}

export class FakeOwnerRepository implements IOwnerRepository {
  readonly store = new Map<string, Owner>();
  saveError: Error | null = null;

  seed(owner: Owner): void {
    this.store.set(owner.id, owner);
  }

  async findById(id: OwnerId): Promise<Owner | null> {
    const owner = this.store.get(id) ?? null;
    if (owner === null || owner.isDeactivated) {
      return null;
    }
    return owner;
  }

  async save(owner: Owner, _createdBy: UserId): Promise<void> {
    if (this.saveError !== null) {
      throw this.saveError;
    }
    this.store.set(owner.id, owner);
  }
}

export class FakeOwnerQueries implements IOwnerQueries {
  readonly owners: OwnerReadModel[] = [];

  seed(owner: OwnerReadModel): void {
    this.owners.push(owner);
  }

  async listOwners(criteria: OwnerListCriteria, page: Pagination): Promise<Page<OwnerReadModel>> {
    const filtered = this.owners.filter((owner) => {
      if (criteria.city !== undefined && owner.city !== criteria.city) {
        return false;
      }
      if (criteria.phone !== undefined && owner.phone !== criteria.phone) {
        return false;
      }
      return true;
    });
    return toPage(filtered.slice(page.offset, page.offset + page.limit), filtered.length, page);
  }

  async getOwner(id: OwnerId): Promise<OwnerReadModel | null> {
    return this.owners.find((owner) => owner.id === id) ?? null;
  }
}
