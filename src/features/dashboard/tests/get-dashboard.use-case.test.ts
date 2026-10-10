import { beforeEach, describe, expect, it } from 'vitest';

import { ForbiddenActionError } from '../../../domain/errors/forbidden-action.error';
import type { AuthenticatedContext } from '../../../domain/shared/auth-context';
import { toUserId } from '../../../domain/shared/user-id';
import type { Clock } from '../../../shared/clock/clock';
import { DashboardPolicy } from '../application/policies/dashboard.policy';
import {
  AGED_STOCK_DAYS,
  DASHBOARD_LIST_LIMIT,
  GetDashboardUseCase,
} from '../application/use-cases/get-dashboard.use-case';
import type {
  DashboardRange,
  DashboardScope,
  DashboardSummaryReadModel,
  IDashboardQueries,
} from '../domain/dashboard.queries';

const ADMIN: AuthenticatedContext = {
  userId: toUserId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  roles: ['admin'],
  showroomId: null,
};

const SHOWROOM = '11111111-1111-4111-8111-111111111111';
const NOW = new Date('2026-10-05T09:30:00.000Z');

const SWIFT = {
  year: 2019,
  make: 'Maruti',
  model: 'Swift',
  variant: 'VXi',
  registrationNumber: 'KA01AB1234',
};

function summary(overrides: Partial<DashboardSummaryReadModel> = {}): DashboardSummaryReadModel {
  return {
    carsSold: { current: 7, previous: 5 },
    newLeads: { current: 42, previous: 38 },
    converted: { current: 2, previous: 1 },
    lost: { current: 1, previous: 2 },
    inventory: { open: 19, linked: 12 },
    pipeline: { new: 12, not_now: 9, booking_confirmed: 4 },
    overdueFollowUps: {
      total: 6,
      items: [
        {
          followUpId: 'f1',
          leadId: 'l1',
          taskType: 'call',
          scheduledAt: '2026-10-04T05:00:00.000Z',
          contactName: 'Asha',
          contactPhone: '+919800000001',
          vehicle: SWIFT,
        },
      ],
    },
    todayFollowUps: { total: 0, items: [] },
    leadsWithoutFollowUp: {
      total: 1,
      items: [
        {
          leadId: 'l2',
          status: 'new',
          source: 'walkin',
          contactName: 'Vikram',
          contactPhone: null,
          vehicle: null,
          createdAt: '2026-10-01T05:00:00.000Z',
        },
      ],
    },
    agedStock: {
      total: 1,
      items: [
        {
          vehicleId: 'v1',
          status: 'open',
          activeLeads: 0,
          createdAt: '2026-08-01T09:30:00.000Z',
          vehicle: SWIFT,
        },
      ],
    },
    ...overrides,
  };
}

class FakeDashboardQueries implements IDashboardQueries {
  lastScope: DashboardScope | null = null;
  lastRange: DashboardRange | null = null;

  constructor(private readonly result: DashboardSummaryReadModel) {}

  async getSummary(
    scope: DashboardScope,
    range: DashboardRange,
  ): Promise<DashboardSummaryReadModel> {
    this.lastScope = scope;
    this.lastRange = range;
    return this.result;
  }
}

class FakeClock implements Clock {
  now(): Date {
    return NOW;
  }
}

function useCaseWith(queries: IDashboardQueries): GetDashboardUseCase {
  return new GetDashboardUseCase(new DashboardPolicy(), queries, new FakeClock(), {
    timeZone: 'Asia/Kolkata',
  });
}

describe('GetDashboardUseCase', () => {
  let queries: FakeDashboardQueries;

  beforeEach(() => {
    queries = new FakeDashboardQueries(summary());
  });

  it('shapes the summary into KPIs, attention lists and today', async () => {
    const dashboard = await useCaseWith(queries).execute({ period: 'month' }, ADMIN);

    expect(dashboard).toMatchObject({
      generatedAt: NOW.toISOString(),
      scope: 'all',
      period: { key: 'month', from: '2026-10-01', to: '2026-10-31', timezone: 'Asia/Kolkata' },
      kpis: {
        carsSold: { value: 7, previous: 5 },
        newLeads: { value: 42, previous: 38 },
        conversionRate: { value: 0.667, previous: 0.333 },
        inStock: { value: 31 },
      },
      today: { total: 0, items: [] },
      pipeline: { new: 12, not_now: 9, booking_confirmed: 4 },
      inventory: { open: 19, linked: 12 },
    });
    expect(dashboard.attention.overdueFollowUps.items[0]).toEqual({
      followUpId: 'f1',
      leadId: 'l1',
      taskType: 'call',
      scheduledAt: '2026-10-04T05:00:00.000Z',
      contactName: 'Asha',
      contactPhone: '+919800000001',
      vehicleLabel: '2019 Maruti Swift VXi · KA01AB1234',
    });
    expect(dashboard.attention.leadsWithoutFollowUp.items[0]?.vehicleLabel).toBeNull();
    expect(dashboard.attention.agedStock?.items[0]).toMatchObject({
      vehicleId: 'v1',
      daysListed: 65,
      activeLeads: 0,
    });
  });

  it('reports a null conversion rate when no lead closed', async () => {
    queries = new FakeDashboardQueries(
      summary({ converted: { current: 0, previous: 0 }, lost: { current: 0, previous: 0 } }),
    );

    const dashboard = await useCaseWith(queries).execute({ period: 'week' }, ADMIN);

    expect(dashboard.kpis.conversionRate).toEqual({ value: null, previous: null });
  });

  it('passes the period window, aged cut-off and list limit to the query', async () => {
    await useCaseWith(queries).execute({ period: 'month' }, ADMIN);

    expect(queries.lastRange).toEqual({
      from: new Date('2026-09-30T18:30:00.000Z'),
      now: NOW,
      previousFrom: new Date('2026-08-31T18:30:00.000Z'),
      previousUntil: new Date('2026-09-05T09:30:00.000Z'),
      todayEnd: new Date('2026-10-05T18:30:00.000Z'),
      agedBefore: new Date(NOW.getTime() - AGED_STOCK_DAYS * 24 * 60 * 60 * 1000),
      listLimit: DASHBOARD_LIST_LIMIT,
    });
  });

  it('covers all showrooms unless the admin names one', async () => {
    await useCaseWith(queries).execute({ period: 'month' }, ADMIN);
    expect(queries.lastScope).toEqual({ showroomId: null, assigneeId: null });

    await useCaseWith(queries).execute({ period: 'month', showroomId: SHOWROOM }, ADMIN);
    expect(queries.lastScope).toEqual({ showroomId: SHOWROOM, assigneeId: null });
  });

  it('scopes a salesperson to their own leads and leaves out showroom stock', async () => {
    const salesperson = { userId: toUserId('bbbb'), roles: ['salesperson'], showroomId: null };

    const dashboard = await useCaseWith(queries).execute(
      { period: 'month', showroomId: SHOWROOM },
      salesperson,
    );

    expect(queries.lastScope).toEqual({ showroomId: null, assigneeId: 'bbbb' });
    expect(dashboard).toMatchObject({
      scope: 'mine',
      kpis: { carsSold: { value: 7, previous: 5 }, inStock: null },
      pipeline: { new: 12, not_now: 9, booking_confirmed: 4 },
      inventory: null,
    });
    expect(dashboard.attention.agedStock).toBeNull();
    expect(dashboard.attention.overdueFollowUps.total).toBeGreaterThan(0);
  });

  it.each([['owner'], ['buyer']])('rejects a %s', async (role) => {
    await expect(
      useCaseWith(queries).execute(
        { period: 'month' },
        { userId: toUserId('bbbb'), roles: [role], showroomId: null },
      ),
    ).rejects.toBeInstanceOf(ForbiddenActionError);
    expect(queries.lastRange).toBeNull();
  });
});
