import { ROLE } from '../../../domain/shared/role';

export const STAFF_ROLE_NAMES = [ROLE.ADMIN, ROLE.SALESPERSON] as const;

export type StaffRoleName = (typeof STAFF_ROLE_NAMES)[number];

/**
 * A role that staff CRUD may assign. Owner and buyer are rejected here —
 * those roles are granted by their own features.
 */
export class StaffRole {
  private constructor(readonly name: StaffRoleName) {}

  static create(input: string): StaffRole {
    const normalized = input.trim().toLowerCase();
    if (normalized !== ROLE.ADMIN && normalized !== ROLE.SALESPERSON) {
      throw new Error('Role must be admin or salesperson');
    }
    return new StaffRole(normalized);
  }

  static admin(): StaffRole {
    return new StaffRole(ROLE.ADMIN);
  }

  static salesperson(): StaffRole {
    return new StaffRole(ROLE.SALESPERSON);
  }

  equals(other: StaffRole): boolean {
    return this.name === other.name;
  }

  get isAdmin(): boolean {
    return this.name === ROLE.ADMIN;
  }
}
