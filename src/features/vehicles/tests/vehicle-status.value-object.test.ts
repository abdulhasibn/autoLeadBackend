import { describe, expect, it } from 'vitest';

import { VehicleStatus } from '../domain/vehicle-status.value-object';

const s = (value: string): VehicleStatus => VehicleStatus.create(value);

describe('VehicleStatus', () => {
  it('flips between open and linked', () => {
    expect(s('open').canTransitionTo(s('linked'))).toBe(true);
    expect(s('linked').canTransitionTo(s('open'))).toBe(true);
  });

  it('sells only a linked vehicle', () => {
    expect(s('linked').canTransitionTo(s('sold'))).toBe(true);
    expect(s('open').canTransitionTo(s('sold'))).toBe(false);
    expect(s('dropped').canTransitionTo(s('sold'))).toBe(false);
  });

  it('drops an open or linked vehicle and re-lists a dropped one', () => {
    expect(s('open').canTransitionTo(s('dropped'))).toBe(true);
    expect(s('linked').canTransitionTo(s('dropped'))).toBe(true);
    expect(s('dropped').canTransitionTo(s('open'))).toBe(true);
    expect(s('dropped').canTransitionTo(s('linked'))).toBe(false);
  });

  it('treats sold as terminal', () => {
    expect(s('sold').isTerminal()).toBe(true);
    expect(s('sold').canTransitionTo(s('open'))).toBe(false);
    expect(s('dropped').isTerminal()).toBe(false);
  });

  it('lets an admin set only open and dropped', () => {
    expect(s('open').isAdminSettable()).toBe(true);
    expect(s('dropped').isAdminSettable()).toBe(true);
    expect(s('linked').isAdminSettable()).toBe(false);
    expect(s('sold').isAdminSettable()).toBe(false);
  });

  it('accepts leads only while open or linked', () => {
    expect(s('open').isLinkable()).toBe(true);
    expect(s('linked').isLinkable()).toBe(true);
    expect(s('dropped').isLinkable()).toBe(false);
    expect(s('sold').isLinkable()).toBe(false);
  });

  it('rejects removed statuses', () => {
    expect(() => s('submitted')).toThrow('Invalid vehicle status');
    expect(() => s('available')).toThrow('Invalid vehicle status');
  });
});
