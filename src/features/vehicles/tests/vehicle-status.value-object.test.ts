import { describe, expect, it } from 'vitest';

import { VehicleStatus } from '../domain/vehicle-status.value-object';

describe('VehicleStatus', () => {
  it('allows the inspection happy path', () => {
    expect(
      VehicleStatus.create('submitted').canTransitionTo(VehicleStatus.create('inspection_pending')),
    ).toBe(true);
    expect(
      VehicleStatus.create('inspection_pending').canTransitionTo(
        VehicleStatus.create('under_inspection'),
      ),
    ).toBe(true);
    expect(
      VehicleStatus.create('under_inspection').canTransitionTo(VehicleStatus.create('approved')),
    ).toBe(true);
  });

  it('blocks skipping a stage', () => {
    expect(
      VehicleStatus.create('submitted').canTransitionTo(VehicleStatus.create('approved')),
    ).toBe(false);
  });

  it('treats rejected and removed as terminal', () => {
    expect(VehicleStatus.create('rejected').isTerminal()).toBe(true);
    expect(VehicleStatus.create('removed').isTerminal()).toBe(true);
    expect(
      VehicleStatus.create('rejected').canTransitionTo(VehicleStatus.create('submitted')),
    ).toBe(false);
  });

  it('lets on_hold return to inspection states', () => {
    expect(VehicleStatus.create('on_hold').canTransitionTo(VehicleStatus.create('approved'))).toBe(
      true,
    );
    expect(VehicleStatus.create('approved').canTransitionTo(VehicleStatus.create('on_hold'))).toBe(
      true,
    );
  });

  it('lists an approved vehicle and walks it through reservation to sale', () => {
    const can = (from: string, to: string): boolean =>
      VehicleStatus.create(from).canTransitionTo(VehicleStatus.create(to));
    expect(can('approved', 'available')).toBe(true);
    expect(can('available', 'reserved')).toBe(true);
    expect(can('reserved', 'sold')).toBe(true);
    expect(can('available', 'sold')).toBe(true);
  });

  it('returns a reserved vehicle to available when the deal falls through', () => {
    expect(
      VehicleStatus.create('reserved').canTransitionTo(VehicleStatus.create('available')),
    ).toBe(true);
  });

  it('lets a listed vehicle go on hold and come back', () => {
    expect(VehicleStatus.create('available').canTransitionTo(VehicleStatus.create('on_hold'))).toBe(
      true,
    );
    expect(VehicleStatus.create('on_hold').canTransitionTo(VehicleStatus.create('available'))).toBe(
      true,
    );
  });

  it('treats sold as terminal and blocks listing before approval', () => {
    expect(VehicleStatus.sold().isTerminal()).toBe(true);
    expect(VehicleStatus.create('sold').canTransitionTo(VehicleStatus.create('available'))).toBe(
      false,
    );
    expect(
      VehicleStatus.create('under_inspection').canTransitionTo(VehicleStatus.create('available')),
    ).toBe(false);
    expect(VehicleStatus.create('reserved').canTransitionTo(VehicleStatus.create('removed'))).toBe(
      false,
    );
  });
});
