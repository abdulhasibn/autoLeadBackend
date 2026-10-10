import { describe, expect, it } from 'vitest';

import {
  type MatchPreference,
  type MatchVehicle,
  scoreLeadAgainstVehicle,
} from '../domain/lead-vehicle-match';

const MAKE = 'make-1';
const MODEL = 'model-1';
const VARIANT = 'variant-1';

const VEHICLE: MatchVehicle = {
  makeId: MAKE,
  modelId: MODEL,
  variantId: VARIANT,
  listedPrice: 600000,
  colour: 'Pearl White',
  fuelType: 'petrol',
  transmission: 'manual',
  bodyTypes: ['hatchback'],
  year: 2019,
  kmDriven: 40000,
  numPreviousOwners: 1,
};

const NOTHING: MatchPreference = {
  makeId: null,
  modelId: null,
  variantId: null,
  budget: null,
  colours: [],
  fuelTypes: [],
  transmissions: [],
  bodyTypes: [],
  yearMin: null,
  yearMax: null,
  kmMax: null,
  maxOwners: null,
};

function outcome(pref: Partial<MatchPreference>, vehicle: Partial<MatchVehicle> = {}) {
  const match = scoreLeadAgainstVehicle({ ...NOTHING, ...pref }, { ...VEHICLE, ...vehicle });
  return match?.breakdown[0];
}

describe('scoreLeadAgainstVehicle', () => {
  it('returns null when the lead has no preference', () => {
    expect(scoreLeadAgainstVehicle(NOTHING, VEHICLE)).toBeNull();
  });

  it('scores a perfect fit at 100 across every criterion', () => {
    const match = scoreLeadAgainstVehicle(
      {
        makeId: MAKE,
        modelId: MODEL,
        variantId: VARIANT,
        budget: 650000,
        colours: ['white'],
        fuelTypes: ['petrol'],
        transmissions: ['manual'],
        bodyTypes: ['hatchback'],
        yearMin: 2018,
        yearMax: 2021,
        kmMax: 50000,
        maxOwners: 1,
      },
      VEHICLE,
    );
    expect(match?.score).toBe(100);
    expect(match?.evaluatedCriteria).toBe(9);
  });

  it('leaves blank criteria out of the score', () => {
    const match = scoreLeadAgainstVehicle(
      { ...NOTHING, fuelTypes: ['petrol'], transmissions: ['automatic'] },
      VEHICLE,
    );
    expect(match?.evaluatedCriteria).toBe(2);
    expect(match?.score).toBe(50);
  });

  describe('catalog', () => {
    it('gives partial credit down the make → model → variant chain', () => {
      const wantVariant = { makeId: MAKE, modelId: MODEL, variantId: 'other-variant' };
      expect(outcome(wantVariant)?.earned).toBeCloseTo(20);
      expect(outcome(wantVariant, { modelId: 'm2' })?.earned).toBeCloseTo(8);
      expect(outcome(wantVariant, { modelId: 'm2', makeId: 'mk2' })?.outcome).toBe('miss');
      expect(outcome({ makeId: MAKE, modelId: 'other-model' })?.earned).toBeCloseTo(10);
      expect(outcome({ makeId: MAKE })?.outcome).toBe('match');
    });
  });

  describe('budget', () => {
    it('is full within budget and fades to nothing at 15% over', () => {
      expect(outcome({ budget: 600000 })?.outcome).toBe('match');
      const slightlyOver = outcome({ budget: 600000 }, { listedPrice: 645000 });
      expect(slightlyOver?.outcome).toBe('partial');
      expect(slightlyOver?.earned).toBeCloseTo(12.5);
      expect(outcome({ budget: 600000 }, { listedPrice: 700000 })?.outcome).toBe('miss');
    });

    it('is skipped when the vehicle has no price', () => {
      const match = scoreLeadAgainstVehicle(
        { ...NOTHING, budget: 500000, fuelTypes: ['petrol'] },
        { ...VEHICLE, listedPrice: null },
      );
      expect(match?.breakdown[0]?.outcome).toBe('unknown');
      expect(match?.evaluatedCriteria).toBe(1);
      expect(match?.score).toBe(100);
    });
  });

  it('loses a third of the year credit per year outside the window', () => {
    expect(outcome({ yearMin: 2019, yearMax: 2019 })?.outcome).toBe('match');
    expect(outcome({ yearMin: 2020 })?.earned).toBeCloseTo(6.67);
    expect(outcome({ yearMax: 2016 })?.outcome).toBe('miss');
  });

  it('fades km credit to nothing at 25% over the ceiling', () => {
    expect(outcome({ kmMax: 40000 })?.outcome).toBe('match');
    expect(outcome({ kmMax: 40000 }, { kmDriven: 45000 })?.earned).toBeCloseTo(5);
    expect(outcome({ kmMax: 30000 }, { kmDriven: 40000 })?.outcome).toBe('miss');
  });

  it('gives half credit for one owner too many', () => {
    expect(outcome({ maxOwners: 1 })?.outcome).toBe('match');
    expect(outcome({ maxOwners: 0 })?.earned).toBe(2);
    expect(outcome({ maxOwners: 0 }, { numPreviousOwners: 2 })?.outcome).toBe('miss');
  });

  it('matches colours on whole words of the free-text colour', () => {
    expect(outcome({ colours: ['white'] })?.outcome).toBe('match');
    expect(outcome({ colours: ['pearl white'] })?.outcome).toBe('match');
    expect(outcome({ colours: ['red'] }, { colour: 'Redwood Brown' })?.outcome).toBe('miss');
  });

  it('matches any of the body types a catalog variant lists, unknown when it lists none', () => {
    expect(outcome({ bodyTypes: ['suv'] }, { bodyTypes: ['crossover', 'suv'] })?.outcome).toBe(
      'match',
    );
    expect(outcome({ bodyTypes: ['sedan'] })?.outcome).toBe('miss');
    const unknownOnly = scoreLeadAgainstVehicle(
      { ...NOTHING, bodyTypes: ['sedan'] },
      { ...VEHICLE, bodyTypes: [] },
    );
    expect(unknownOnly).toBeNull();
  });

  it('weights a model match above a colour miss', () => {
    const match = scoreLeadAgainstVehicle(
      { ...NOTHING, makeId: MAKE, modelId: MODEL, colours: ['red'] },
      VEHICLE,
    );
    expect(match?.score).toBe(91);
  });
});
