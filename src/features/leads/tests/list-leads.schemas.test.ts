import { describe, expect, it } from 'vitest';

import { listLeadsQuerySchema } from '../presentation/schemas/list-leads.schemas';

describe('listLeadsQuerySchema', () => {
  it('parses the new filters', () => {
    const parsed = listLeadsQuerySchema.parse({
      search: '  rahul  ',
      budgetMin: '500000',
      budgetMax: '900000',
      source: 'walkin, referral,walkin',
      hasVehicle: 'false',
      financeRequired: 'true',
      createdFrom: '2026-10-01',
      createdTo: '2026-10-08T00:00:00+05:30',
    });

    expect(parsed).toMatchObject({
      search: 'rahul',
      budgetMin: 500000,
      budgetMax: 900000,
      source: ['walkin', 'referral'],
      hasVehicle: false,
      financeRequired: true,
      createdFrom: '2026-10-01T00:00:00.000Z',
      createdTo: '2026-10-07T18:30:00.000Z',
    });
  });

  it('treats a blank search as no search', () => {
    expect(listLeadsQuerySchema.parse({ search: '   ' }).search).toBeUndefined();
  });

  it('rejects an inverted budget range', () => {
    expect(listLeadsQuerySchema.safeParse({ budgetMin: '9', budgetMax: '1' }).success).toBe(false);
  });

  it('rejects an unknown source', () => {
    expect(listLeadsQuerySchema.safeParse({ source: 'walkin,billboard' }).success).toBe(false);
  });

  it('rejects a non-boolean hasVehicle', () => {
    expect(listLeadsQuerySchema.safeParse({ hasVehicle: 'yes' }).success).toBe(false);
  });
});
