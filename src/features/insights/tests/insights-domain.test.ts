import { describe, expect, it } from 'vitest';

import {
  budgetBandOf,
  lakhLabel,
  segmentOf,
  shareOfSearchesBelow,
  wholePercentages,
  zeroResultLabel,
} from '../domain/demand';
import { leadIntent } from '../domain/lead-intent';
import { rate } from '../domain/rate';
import { stockBaseline, vehicleSignal } from '../domain/vehicle-signal';
import {
  toDemandReadModel,
  toLeadJourneyReadModel,
  toVehicleStatsReadModel,
} from '../infrastructure/insights.mapper';

describe('demand rules', () => {
  it('bands a budget by its ceiling, so "under ₹6L" is a 4–6L search', () => {
    expect(budgetBandOf(399_999)).toBe('<4L');
    expect(budgetBandOf(400_000)).toBe('<4L');
    expect(budgetBandOf(400_001)).toBe('4-6L');
    expect(budgetBandOf(600_000)).toBe('4-6L');
    expect(budgetBandOf(1_200_000)).toBe('8-12L');
    expect(budgetBandOf(1_200_001)).toBe('12L+');
  });

  it('labels catalog body types, preferring SUV in a two-type cell', () => {
    expect(segmentOf('suv')).toBe('SUV');
    expect(segmentOf('crossover, suv')).toBe('SUV');
    expect(segmentOf('coupe, sedan')).toBe('Coupe');
    expect(segmentOf('mpv')).toBe('MUV / MPV');
    expect(segmentOf('muv')).toBe('MUV / MPV');
    expect(segmentOf(null)).toBe('Other');
    expect(segmentOf('spaceship')).toBe('Other');
  });

  it('rounds shares to whole percentages that add up to 100', () => {
    const shares = wholePercentages(
      new Map([
        ['a', 1],
        ['b', 1],
        ['c', 1],
      ]),
    );

    expect([...shares.values()].reduce((sum, n) => sum + n, 0)).toBe(100);
    expect([...shares.values()].sort()).toEqual([33, 33, 34]);
    expect([...wholePercentages(new Map([['a', 0]])).values()]).toEqual([0]);
  });

  it('measures the share of budgets below a price, null without a price or searches', () => {
    const searches = [
      { value: 500_000, count: 3 },
      { value: 900_000, count: 1 },
    ];

    expect(shareOfSearchesBelow(searches, 890_000)).toBe(75);
    expect(shareOfSearchesBelow(searches, null)).toBeNull();
    expect(shareOfSearchesBelow([], 890_000)).toBeNull();
  });

  it('writes budgets in lakh and names zero-result searches', () => {
    expect(lakhLabel(1_000_000)).toBe('₹10L');
    expect(lakhLabel(650_000)).toBe('₹6.5L');

    const none = {
      make: null,
      model: null,
      bodyType: null,
      fuelType: null,
      transmission: null,
      priceMax: null,
      count: 1,
    };
    expect(zeroResultLabel(none)).toBe('Any car');
    expect(zeroResultLabel({ ...none, priceMax: 300_000 })).toBe('Any car under ₹3L');
    expect(zeroResultLabel({ ...none, make: 'Hyundai' })).toBe('Hyundai');
    expect(zeroResultLabel({ ...none, bodyType: 'suv', fuelType: 'DIESEL' })).toBe('Diesel SUV');
  });
});

describe('vehicle signal', () => {
  const baseline = stockBaseline([
    { views: 100, leadRate: 0.02, daysInStock: 10 },
    { views: 200, leadRate: 0.04, daysInStock: 10 },
    { views: 10, leadRate: 0.5, daysInStock: 10 },
  ]);

  it('takes medians over cars with enough views only', () => {
    expect(baseline).toEqual({ medianViews: 150, medianLeadRate: 0.03 });
    expect(stockBaseline([])).toEqual({ medianViews: 0, medianLeadRate: 0 });
  });

  it('lets hot demand outrank ageing, and ageing outrank low visibility', () => {
    expect(vehicleSignal({ views: 200, leadRate: 0.05, daysInStock: 90 }, baseline).code).toBe(
      'hot',
    );
    expect(vehicleSignal({ views: 40, leadRate: 0.03, daysInStock: 90 }, baseline).code).toBe(
      'ageing_cooling',
    );
    expect(vehicleSignal({ views: 40, leadRate: 0.03, daysInStock: 5 }, baseline).code).toBe(
      'low_visibility',
    );
  });

  it('never calls a car hot when no car in stock has leads', () => {
    const cold = stockBaseline([{ views: 100, leadRate: 0, daysInStock: 1 }]);

    expect(vehicleSignal({ views: 100, leadRate: 0, daysInStock: 1 }, cold).code).toBe(
      'seen_not_enquired',
    );
  });
});

describe('lead intent and rates', () => {
  it('grades intent from return visits and how closely the car was studied', () => {
    expect(leadIntent({ visits: 3, viewsOfThisCar: 1, galleryOpens: 0 })).toBe('high');
    expect(leadIntent({ visits: 1, viewsOfThisCar: 4, galleryOpens: 0 })).toBe('high');
    expect(leadIntent({ visits: 1, viewsOfThisCar: 1, galleryOpens: 1 })).toBe('medium');
    expect(leadIntent({ visits: 1, viewsOfThisCar: 1, galleryOpens: 0 })).toBe('low');
    expect(leadIntent({ visits: 0, viewsOfThisCar: 0, galleryOpens: 0 })).toBe('low');
  });

  it('rounds rates to four places and answers null for an empty whole', () => {
    expect(rate(74, 3412)).toBe(0.0217);
    expect(rate(0, 19)).toBe(0);
    expect(rate(1, 0)).toBeNull();
  });
});

describe('insights mapper', () => {
  it('maps vehicle stats and normalises timestamps and numeric prices', () => {
    const row = toVehicleStatsReadModel({
      vehicle_id: 'v1',
      year: 2020,
      make: 'BMW',
      model: 'X1',
      variant: 'Sdrive20I',
      body_type: 'crossover, suv',
      listed_price: 890000.0,
      created_at: '2026-10-19T10:54:36.541699+05:30',
      views: 3,
      unique_viewers: 2,
      repeat_viewers: 1,
      test_drive_opens: 1,
      contact_clicks: 1,
      leads: 2,
      top_channel: 'direct',
    });

    expect(row).toMatchObject({
      vehicleId: 'v1',
      bodyType: 'crossover, suv',
      listedPrice: 890000,
      createdAt: '2026-10-19T05:24:36.541Z',
      uniqueViewers: 2,
      topChannel: 'direct',
    });
  });

  it('maps demand rows into value counts', () => {
    const demand = toDemandReadModel({
      search_prices: [{ price: 600000, count: 2 }],
      search_body_types: [{ body_type: 'suv', count: 1 }],
      stock_prices: [{ price: 550000.0, count: 1 }],
      stock_body_types: [{ body_type: 'sedan', count: 1 }],
      zero_result_count: 1,
      zero_result_top: [
        {
          make: null,
          model: null,
          body_type: 'suv',
          fuel_type: 'diesel',
          transmission: null,
          price_max: 600000,
          count: 1,
        },
      ],
    });

    expect(demand).toEqual({
      searchPrices: [{ value: 600000, count: 2 }],
      searchBodyTypes: [{ value: 'suv', count: 1 }],
      stockPrices: [{ value: 550000, count: 1 }],
      stockBodyTypes: [{ value: 'sedan', count: 1 }],
      zeroResultCount: 1,
      zeroResultTop: [
        {
          make: null,
          model: null,
          bodyType: 'suv',
          fuelType: 'diesel',
          transmission: null,
          priceMax: 600000,
          count: 1,
        },
      ],
    });
  });

  it('maps a lead journey without visits', () => {
    expect(
      toLeadJourneyReadModel({
        has_attribution: true,
        channel: 'direct',
        campaign: null,
        content: null,
        first_visit_at: null,
        visits: 0,
        views_of_this_car: 0,
        gallery_opens: 0,
        other_cars: [],
      }),
    ).toEqual({
      hasAttribution: true,
      channel: 'direct',
      campaign: null,
      content: null,
      firstVisitAt: null,
      visits: 0,
      viewsOfThisCar: 0,
      galleryOpens: 0,
      otherCars: [],
    });
  });
});
