import type { UserId } from '../../../domain/shared/user-id';
import { toUserId } from '../../../domain/shared/user-id';
import type { Clock } from '../../../shared/clock/clock';
import type { Page, Pagination } from '../../../shared/pagination/pagination';
import { toPage } from '../../../shared/pagination/pagination';
import type { IAuthUserProvisioner } from '../application/ports/auth-user-provisioner.port';
import type {
  IStaffQueries,
  StaffListCriteria,
  StaffMemberReadModel,
} from '../domain/staff.queries';
import type { StaffRole } from '../domain/staff-role.value-object';
import type { StaffUser } from '../domain/staff-user.entity';
import type { IUserRepository } from '../domain/user.repository';

export class FakeClock implements Clock {
  constructor(private current: Date) {}

  now(): Date {
    return this.current;
  }
}

export class FakeUserRepository implements IUserRepository {
  readonly store = new Map<string, StaffUser>();
  saveError: Error | null = null;
  roleCountOverride: Map<string, number> | null = null;

  seed(user: StaffUser): void {
    this.store.set(user.id, user);
  }

  async findById(id: UserId): Promise<StaffUser | null> {
    return this.store.get(id) ?? null;
  }

  async save(user: StaffUser, _grantedBy: UserId): Promise<void> {
    if (this.saveError !== null) {
      throw this.saveError;
    }
    this.store.set(user.id, user);
  }

  async countLiveWithRole(role: StaffRole): Promise<number> {
    if (this.roleCountOverride !== null) {
      return this.roleCountOverride.get(role.name) ?? 0;
    }
    return [...this.store.values()].filter(
      (user) => !user.isDeactivated && user.liveRoles.some((item) => item.equals(role)),
    ).length;
  }
}

export class FakeAuthUserProvisioner implements IAuthUserProvisioner {
  nextId = '11111111-1111-4111-8111-111111111111';
  provisionError: Error | null = null;
  readonly provisioned: Array<{ email: string; password: string }> = [];
  readonly deleted: string[] = [];
  readonly disabled: string[] = [];
  readonly updatedEmails: Array<{ id: string; email: string }> = [];

  async provision(command: { email: string; password: string }): Promise<UserId> {
    if (this.provisionError !== null) {
      throw this.provisionError;
    }
    this.provisioned.push({ email: command.email, password: command.password });
    return toUserId(this.nextId);
  }

  async updateEmail(userId: UserId, email: string): Promise<void> {
    this.updatedEmails.push({ id: userId, email });
  }

  async disable(userId: UserId): Promise<void> {
    this.disabled.push(userId);
  }

  async delete(userId: UserId): Promise<void> {
    this.deleted.push(userId);
  }
}

export class FakeStaffQueries implements IStaffQueries {
  readonly members: StaffMemberReadModel[] = [];

  seed(member: StaffMemberReadModel): void {
    this.members.push(member);
  }

  async listStaff(
    criteria: StaffListCriteria,
    page: Pagination,
  ): Promise<Page<StaffMemberReadModel>> {
    const roleFilter = criteria.role;
    const filtered =
      roleFilter === undefined
        ? this.members
        : this.members.filter((member) => member.roles.includes(roleFilter));
    return toPage(filtered.slice(page.offset, page.offset + page.limit), filtered.length, page);
  }

  async getStaff(id: UserId): Promise<StaffMemberReadModel | null> {
    return this.members.find((member) => member.id === id) ?? null;
  }
}
