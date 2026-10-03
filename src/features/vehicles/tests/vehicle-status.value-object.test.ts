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

  it('leaves listing statuses closed in this phase', () => {
    expect(
      VehicleStatus.create('approved').canTransitionTo(VehicleStatus.create('available')),
    ).toBe(false);
    expect(
      VehicleStatus.create('available').canTransitionTo(VehicleStatus.create('reserved')),
    ).toBe(false);
  });
});
