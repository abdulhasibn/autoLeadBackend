import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';

import { toOwnerId } from '../../../domain/shared/owner-id';
import type { Database } from '../../../infrastructure/supabase/database.types';
import { SupabaseOwnerVehicleCount } from '../infrastructure/supabase-owner-vehicle-count';

function stubDb(count: number) {
  const calls: Array<[string, ...unknown[]]> = [];
  const chain: Record<string, unknown> = {};
  for (const name of ['select', 'eq', 'in', 'neq', 'is']) {
    chain[name] = (...args: unknown[]) => {
      calls.push([name, ...args]);
      return name === 'is' ? Promise.resolve({ count, error: null }) : chain;
    };
  }
  const db = { from: () => chain } as unknown as SupabaseClient<Database>;
  return { db, calls };
}

describe('SupabaseOwnerVehicleCount', () => {
  it('counts only open and linked cars, so dropped and sold ones never block', async () => {
    const { db, calls } = stubDb(1);

    const result = await new SupabaseOwnerVehicleCount(db).countOpenOrLinked(toOwnerId('o-1'));

    expect(result).toBe(1);
    expect(calls).toContainEqual(['in', 'status', ['open', 'linked']]);
    expect(calls.some(([name]) => name === 'neq')).toBe(false);
    expect(calls).toContainEqual(['eq', 'owner_id', 'o-1']);
  });
});
