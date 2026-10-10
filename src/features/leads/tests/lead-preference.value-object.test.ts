import { describe, expect, it } from 'vitest';

import { LeadPreference, type LeadPreferenceProps } from '../domain/lead-preference.value-object';
import { PreferredCatalog } from '../domain/preferred-catalog.value-object';

const EMPTY: LeadPreferenceProps = {
  catalog: PreferredCatalog.none(),
  colours: [],
  fuelTypes: [],
  transmissions: [],
  bodyTypes: [],
  yearMin: null,
  yearMax: null,
  kmMax: null,
  maxOwners: null,
};

describe('LeadPreference', () => {
  it('is empty when nothing is set', () => {
    expect(LeadPreference.none().isEmpty).toBe(true);
    expect(LeadPreference.create(EMPTY).isEmpty).toBe(true);
  });

  it('normalises colours and dedupes every list', () => {
    const pref = LeadPreference.create({
      ...EMPTY,
      colours: [' Pearl  White ', 'pearl white', 'Red', '  '],
      fuelTypes: ['petrol', 'petrol', 'diesel'],
      bodyTypes: ['SUV', 'suv'],
    });
    expect(pref.colours).toEqual(['pearl white', 'red']);
    expect(pref.fuelTypes).toEqual(['petrol', 'diesel']);
    expect(pref.bodyTypes).toEqual(['suv']);
    expect(pref.isEmpty).toBe(false);
  });

  it('rejects unknown fuel, transmission and body types', () => {
    expect(() => LeadPreference.create({ ...EMPTY, fuelTypes: ['steam'] })).toThrow();
    expect(() => LeadPreference.create({ ...EMPTY, transmissions: ['paddle'] })).toThrow();
    expect(() => LeadPreference.create({ ...EMPTY, bodyTypes: ['tank'] })).toThrow();
  });

  it('rejects a year window that runs backwards or out of range', () => {
    expect(() => LeadPreference.create({ ...EMPTY, yearMin: 2022, yearMax: 2018 })).toThrow(
      'cannot be after',
    );
    expect(() => LeadPreference.create({ ...EMPTY, yearMin: 1900 })).toThrow();
    expect(() => LeadPreference.create({ ...EMPTY, yearMax: 2020.5 })).toThrow();
  });

  it('rejects negative or fractional km and owner limits', () => {
    expect(() => LeadPreference.create({ ...EMPTY, kmMax: -1 })).toThrow();
    expect(() => LeadPreference.create({ ...EMPTY, maxOwners: 1.5 })).toThrow();
    expect(LeadPreference.create({ ...EMPTY, kmMax: 0, maxOwners: 0 }).kmMax).toBe(0);
  });

  it('compares lists as sets', () => {
    const a = LeadPreference.create({ ...EMPTY, colours: ['red', 'white'], yearMin: 2018 });
    const b = LeadPreference.create({ ...EMPTY, colours: ['white', 'red'], yearMin: 2018 });
    expect(a.equals(b)).toBe(true);
    expect(a.equals(LeadPreference.none())).toBe(false);
  });
});
