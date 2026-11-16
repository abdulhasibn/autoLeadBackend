import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';

import type { Database } from '../../../infrastructure/supabase/database.types';
import type { FinanceEntryRow } from '../infrastructure/finance-entry.mapper';
import { SupabaseFinanceEntryQueries } from '../infrastructure/supabase-finance-entry.queries';

type Row = FinanceEntryRow;

/**
 * Just enough of the PostgREST builder for `scan`: equality / range / id
 * filters, `order('id')` and `limit`. Records every request it serves.
 */
class FakeEntriesTable {
  readonly requests: { after: string | null; limit: number }[] = [];

  constructor(readonly rows: Row[]) {}

  client(): SupabaseClient<Database> {
    return { from: () => new FakeQuery(this) } as unknown as SupabaseClient<Database>;
  }
}

class FakeQuery {
  private readonly tests: ((row: Row) => boolean)[] = [];
  private after: string | null = null;
  private max = Number.POSITIVE_INFINITY;

  constructor(private readonly table: FakeEntriesTable) {}

  select(): this {
    return this;
  }
  is(column: keyof Row, value: null): this {
    this.tests.push((row) => row[column] === value);
    return this;
  }
  eq(column: keyof Row, value: unknown): this {
    this.tests.push((row) => row[column] === value);
    return this;
  }
  in(column: keyof Row, values: unknown[]): this {
    this.tests.push((row) => values.includes(row[column]));
    return this;
  }
  gte(column: keyof Row, value: string): this {
    this.tests.push((row) => String(row[column]) >= value);
    return this;
  }
  lte(column: keyof Row, value: string): this {
    this.tests.push((row) => String(row[column]) <= value);
    return this;
  }
  gt(column: 'id', value: string): this {
    this.after = value;
    this.tests.push((row) => row[column] > value);
    return this;
  }
  order(): this {
    return this;
  }
  limit(count: number): this {
    this.max = count;
    return this;
  }
  then<T>(resolve: (result: { data: Row[]; error: null }) => T): T {
    this.table.requests.push({ after: this.after, limit: this.max });
    const data = this.table.rows
      .filter((row) => this.tests.every((test) => test(row)))
      .sort((a, b) => a.id.localeCompare(b.id))
      .slice(0, this.max);
    return resolve({ data, error: null });
  }
}

function row(n: number, overrides: Partial<Row> = {}): Row {
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    showroom_id: 'b0000000-0000-4000-8000-000000000001',
    kind: 'expense',
    vehicle_id: null,
    entry_date: '2026-10-01',
    payload: 'sealed',
    key_version: 1,
    recorded_by: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    created_at: '2026-10-01T00:00:00.000Z',
    updated_at: '2026-10-01T00:00:00.000Z',
    deleted_at: null,
    ...overrides,
  };
}

async function collect(
  pages: AsyncIterable<readonly { id: string }[]>,
): Promise<{ pages: number; ids: string[] }> {
  const ids: string[] = [];
  let count = 0;
  for await (const page of pages) {
    count += 1;
    ids.push(...page.map((r) => r.id));
  }
  return { pages: count, ids };
}

describe('SupabaseFinanceEntryQueries.scan', () => {
  it('reads every row past the list cap in keyset pages, each once', async () => {
    const rows = Array.from({ length: 5_432 }, (_, i) => row(i + 1));
    const table = new FakeEntriesTable(rows);

    const result = await collect(new SupabaseFinanceEntryQueries(table.client()).scan({}));

    expect(result.ids).toHaveLength(5_432);
    expect(new Set(result.ids).size).toBe(5_432);
    expect(result.pages).toBe(6);
    expect(table.requests[0]).toEqual({ after: null, limit: 1000 });
    expect(table.requests[1]?.after).toBe(rows[999]?.id);
  });

  it('applies filters and skips deleted rows', async () => {
    const table = new FakeEntriesTable([
      row(1, { entry_date: '2026-09-30' }),
      row(2),
      row(3, { deleted_at: '2026-10-02T00:00:00.000Z' }),
      row(4, { entry_date: '2026-11-01' }),
    ]);

    const result = await collect(
      new SupabaseFinanceEntryQueries(table.client()).scan({
        from: '2026-10-01',
        to: '2026-10-31',
      }),
    );

    expect(result.ids).toEqual([row(2).id]);
  });

  it('stops after one request when nothing matches', async () => {
    const table = new FakeEntriesTable([]);

    const result = await collect(new SupabaseFinanceEntryQueries(table.client()).scan({}));

    expect(result).toEqual({ pages: 0, ids: [] });
    expect(table.requests).toHaveLength(1);
  });
});
