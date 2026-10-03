import { beforeEach, describe, expect, it } from 'vitest';

import type { AuthenticatedContext } from '../../../domain/shared/auth-context';
import { toShowroomId } from '../../../domain/shared/showroom-id';
import { toUserId } from '../../../domain/shared/user-id';
import { LeadManagementPolicy } from '../application/policies/lead-management.policy';
import { ScheduleFollowUpUseCase } from '../application/use-cases/schedule-follow-up.use-case';
import { toContactId } from '../domain/contact-id';
import { Lead } from '../domain/lead.entity';
import { toLeadId } from '../domain/lead-id';
import { LeadSource } from '../domain/lead-source.value-object';
import { FakeClock, FakeIdGenerator, FakeLeadRepository } from './fakes';

const ADMIN: AuthenticatedContext = {
  userId: toUserId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  roles: ['admin'],
};

const LEAD_ID = '77777777-7777-4777-8777-777777777777';
const NOW = new Date('2026-10-03T00:00:00.000Z');

describe('ScheduleFollowUpUseCase', () => {
  let useCase: ScheduleFollowUpUseCase;
  let repo: FakeLeadRepository;

  beforeEach(() => {
    repo = new FakeLeadRepository();
    repo.seedLead(
      Lead.create({
        id: toLeadId(LEAD_ID),
        showroomId: toShowroomId('b0000000-0000-4000-8000-000000000001'),
        contactId: toContactId('66666666-6666-4666-8666-666666666666'),
        vehicleId: null,
        source: LeadSource.create('phone'),
        budget: null,
        preferredVehicle: null,
        purchaseTimeline: null,
        financeRequired: null,
        currentVehicle: null,
        tradeInRequired: null,
        notes: null,
        createdBy: ADMIN.userId,
        createdAt: NOW,
        updatedAt: NOW,
      }),
    );
    useCase = new ScheduleFollowUpUseCase(
      new LeadManagementPolicy(),
      repo,
      new FakeClock(NOW),
      new FakeIdGenerator(),
    );
  });

  it('schedules a follow-up with a matching due reminder', async () => {
    const result = await useCase.execute(
      {
        leadId: LEAD_ID,
        scheduledAt: '2026-10-10T10:00:00.000Z',
        taskType: 'call',
        notes: null,
      },
      ADMIN,
    );

    expect(result.scheduledAt).toBe('2026-10-10T10:00:00.000Z');
    expect(result.dueAt).toBe(result.scheduledAt);
    expect(result.notificationId).toBeTruthy();
    expect(repo.followUps).toHaveLength(1);
    expect(repo.followUps[0]?.dueAt.toISOString()).toBe(result.scheduledAt);
  });
});
