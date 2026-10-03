import { describe, expect, it } from 'vitest';

import { StaffRole } from '../domain/staff-role.value-object';

describe('StaffRole value object', () => {
  it('accepts admin and salesperson', () => {
    expect(StaffRole.create('admin').name).toBe('admin');
    expect(StaffRole.create('salesperson').name).toBe('salesperson');
  });

  it('normalises casing and surrounding whitespace', () => {
    expect(StaffRole.create('  Admin  ').name).toBe('admin');
  });

  it('rejects owner and buyer', () => {
    expect(() => StaffRole.create('owner')).toThrow('admin or salesperson');
    expect(() => StaffRole.create('buyer')).toThrow('admin or salesperson');
  });

  it('rejects an empty string', () => {
    expect(() => StaffRole.create('')).toThrow('admin or salesperson');
  });

  it('considers two roles with the same name equal', () => {
    expect(StaffRole.create('admin').equals(StaffRole.admin())).toBe(true);
    expect(StaffRole.create('admin').equals(StaffRole.salesperson())).toBe(false);
  });
});
