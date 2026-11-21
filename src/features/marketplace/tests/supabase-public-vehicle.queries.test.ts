import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';

import type { Database } from '../../../infrastructure/supabase/database.types';
import { SupabasePublicVehicleQueries } from '../infrastructure/supabase-public-vehicle.queries';

/**
 * Records every PostgREST request the adapter builds and answers each with a
 * canned result. Each `from()` is one network round trip in production.
 */
class RecordingClient {
  readonly requests: { table: string; calls: [string, ...unknown[]][] }[] = [];

  constructor(private readonly result: { data: unknown; error: null; count?: number }) {}

  client(): SupabaseClient<Database> {
    return {
      from: (table: string) => {
        const request = { table, calls: [] as [string, ...unknown[]][] };
        this.requests.push(request);
        const builder: Record<string, unknown> = {
          then: (resolve: (value: unknown) => unknown) => resolve(this.result),
        };
        for (const method of ['select', 'eq', 'order', 'limit', 'range', 'maybeSingle']) {
          builder[method] = (...args: unknown[]) => {
            request.calls.push([method, ...args]);
            return builder;
          };
        }
        builder['overrideTypes'] = () => builder;
        return builder;
      },
    } as unknown as SupabaseClient<Database>;
  }
}

function viewRow(id: string): Record<string, unknown> {
  return {
    id,
    make_id: 'make-1',
    model_id: 'model-1',
    make_name: 'Hyundai',
    model_name: 'Creta',
    variant_name: 'SX',
    body_types: ['suv'],
    year: 2022,
    fuel_type: 'petrol',
    transmission: 'manual',
    km_driven: 1000,
    num_previous_owners: 1,
    colour: null,
    description: null,
    listed_price: '1450000',
    public_status: 'available',
    sold_on: null,
  };
}

describe('SupabasePublicVehicleQueries', () => {
  it('lists vehicles with their cover in one request, preferring a front photo', async () => {
    const db = new RecordingClient({
      data: [
        {
          ...viewRow('a'),
          front: [{ storage_path: 'a/front.jpg' }],
          first: [{ storage_path: 'a/1.jpg' }],
        },
        { ...viewRow('b'), front: [], first: [{ storage_path: 'b/1.jpg' }] },
        { ...viewRow('c'), front: [], first: [] },
      ],
      error: null,
      count: 3,
    });

    const page = await new SupabasePublicVehicleQueries(db.client()).list(
      { sort: 'newest' },
      { limit: 24, offset: 0 },
    );

    expect(page.items.map((item) => [item.vehicle.id, item.coverPath])).toEqual([
      ['a', 'a/front.jpg'],
      ['b', 'b/1.jpg'],
      ['c', null],
    ]);
    expect(page.total).toBe(3);
    expect(db.requests).toHaveLength(1);
    const calls = db.requests[0]?.calls ?? [];
    expect(String(calls.find(([method]) => method === 'select')?.[1])).toContain(
      'front:vehicle_media(storage_path), first:vehicle_media(storage_path)',
    );
    expect(calls).toContainEqual(['eq', 'front.category', 'front']);
    expect(calls).toContainEqual(['limit', 1, { referencedTable: 'front' }]);
    expect(calls).toContainEqual(['limit', 1, { referencedTable: 'first' }]);
  });

  it('orders available cars first, then sold cars by newest sale, then the requested sort', async () => {
    const db = new RecordingClient({
      data: [
        { ...viewRow('a'), front: [], first: [] },
        {
          ...viewRow('b'),
          public_status: 'sold',
          sold_on: '2026-11-01',
          front: [],
          first: [],
        },
      ],
      error: null,
      count: 2,
    });

    const page = await new SupabasePublicVehicleQueries(db.client()).list(
      { sort: 'price_asc' },
      { limit: 24, offset: 0 },
    );

    expect(page.items.map((item) => [item.vehicle.status, item.vehicle.soldOn])).toEqual([
      ['available', null],
      ['sold', '2026-11-01'],
    ]);
    const orders = (db.requests[0]?.calls ?? [])
      .filter(([method, column]) => method === 'order' && !String(column).includes('sort_order'))
      .map(([, column]) => column)
      .filter((column) => !['uploaded_at'].includes(String(column)));
    expect(orders).toEqual(['public_status', 'sold_on', 'listed_price', 'created_at', 'id']);
  });

  it('lists only available cars for the filter options', async () => {
    const db = new RecordingClient({ data: [viewRow('a')], error: null });

    const all = await new SupabasePublicVehicleQueries(db.client()).listAll();

    expect(all.map((vehicle) => vehicle.status)).toEqual(['available']);
    expect(db.requests[0]?.calls).toContainEqual(['eq', 'public_status', 'available']);
  });

  it('loads a vehicle with its photos in one request', async () => {
    const db = new RecordingClient({
      data: {
        ...viewRow('a'),
        vehicle_media: [
          { storage_path: 'a/1.jpg', category: 'interior' },
          { storage_path: 'a/2.jpg', category: null },
        ],
      },
      error: null,
    });

    const found = await new SupabasePublicVehicleQueries(db.client()).get('a');

    expect(found?.vehicle.id).toBe('a');
    expect(found?.photos).toEqual([
      { storagePath: 'a/1.jpg', category: 'interior' },
      { storagePath: 'a/2.jpg', category: 'other' },
    ]);
    expect(db.requests).toHaveLength(1);
    expect(db.requests[0]?.calls).toContainEqual([
      'order',
      'sort_order',
      { ascending: true, referencedTable: 'vehicle_media' },
    ]);
  });

  it('answers null for a vehicle that is not Listed', async () => {
    const db = new RecordingClient({ data: null, error: null });

    await expect(new SupabasePublicVehicleQueries(db.client()).get('a')).resolves.toBeNull();
  });
});
