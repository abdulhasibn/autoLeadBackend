import { Phone } from '../../../domain/shared/phone.value-object';
import type { UserId } from '../../../domain/shared/user-id';
import type { StaffRole } from './staff-role.value-object';

export interface StaffUserCreateProps {
  readonly id: UserId;
  readonly fullName: string;
  readonly phone: Phone;
  readonly email: string | null;
  readonly showroomId: string | null;
  readonly roles: readonly StaffRole[];
  readonly createdAt: Date;
}

export interface StaffUserReconstituteProps extends StaffUserCreateProps {
  readonly deletedAt: Date | null;
}

export interface StaffProfileUpdate {
  readonly fullName: string;
  readonly phone: Phone;
  readonly email: string | null;
  readonly showroomId: string | null;
}

/**
 * Staff member aggregate. Live staff must keep at least one staff role.
 * Deactivated staff may have an empty role set (all grants revoked).
 */
export class StaffUser {
  private constructor(
    readonly id: UserId,
    private fullNameValue: string,
    private phoneValue: Phone,
    private emailValue: string | null,
    private showroomIdValue: string | null,
    private rolesValue: StaffRole[],
    readonly createdAt: Date,
    private deletedAtValue: Date | null,
  ) {}

  static create(props: StaffUserCreateProps): StaffUser {
    const fullName = normalizeFullName(props.fullName);
    const email = normalizeEmail(props.email);
    assertLiveRoleSet(props.roles);
    return new StaffUser(
      props.id,
      fullName,
      props.phone,
      email,
      props.showroomId,
      [...props.roles],
      props.createdAt,
      null,
    );
  }

  static reconstitute(props: StaffUserReconstituteProps): StaffUser {
    return new StaffUser(
      props.id,
      props.fullName,
      props.phone,
      props.email,
      props.showroomId,
      [...props.roles],
      props.createdAt,
      props.deletedAt,
    );
  }

  get fullName(): string {
    return this.fullNameValue;
  }

  get phone(): Phone {
    return this.phoneValue;
  }

  get email(): string | null {
    return this.emailValue;
  }

  get showroomId(): string | null {
    return this.showroomIdValue;
  }

  get liveRoles(): readonly StaffRole[] {
    return this.rolesValue;
  }

  get deletedAt(): Date | null {
    return this.deletedAtValue;
  }

  get isDeactivated(): boolean {
    return this.deletedAtValue !== null;
  }

  get hasAdminRole(): boolean {
    return this.rolesValue.some((role) => role.isAdmin);
  }

  assignRole(role: StaffRole): void {
    this.assertActive();
    if (this.rolesValue.some((existing) => existing.equals(role))) {
      return;
    }
    this.rolesValue = [...this.rolesValue, role];
  }

  revokeRole(role: StaffRole): void {
    this.assertActive();
    const next = this.rolesValue.filter((existing) => !existing.equals(role));
    assertLiveRoleSet(next);
    this.rolesValue = next;
  }

  replaceRoles(roles: readonly StaffRole[]): void {
    this.assertActive();
    assertLiveRoleSet(roles);
    this.rolesValue = [...roles];
  }

  updateProfile(update: StaffProfileUpdate): void {
    this.assertActive();
    this.fullNameValue = normalizeFullName(update.fullName);
    this.phoneValue = update.phone;
    this.emailValue = normalizeEmail(update.email);
    this.showroomIdValue = update.showroomId;
  }

  deactivate(at: Date): void {
    this.assertActive();
    this.deletedAtValue = at;
    this.rolesValue = [];
  }

  private assertActive(): void {
    if (this.deletedAtValue !== null) {
      throw new Error('Cannot modify a deactivated staff user');
    }
  }
}

function normalizeFullName(input: string): string {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    throw new Error('Full name cannot be empty');
  }
  return trimmed;
}

function normalizeEmail(input: string | null): string | null {
  if (input === null) {
    return null;
  }
  const trimmed = input.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function assertLiveRoleSet(roles: readonly StaffRole[]): void {
  if (roles.length === 0) {
    throw new Error('Staff user must have at least one role');
  }
}
