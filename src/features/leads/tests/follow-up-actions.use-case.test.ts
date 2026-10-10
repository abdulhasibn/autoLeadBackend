import { beforeEach, describe, expect, it } from 'vitest';

import { BusinessRuleViolationError } from '../../../domain/errors/business-rule-violation.error';
import { NotFoundError } from '../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../domain/shared/auth-context';
import { toLeadId } from '../../../domain/shared/lead-id';
import { toShowroomId } from '../../../domain/shared/showroom-id';
import { toUserId } from '../../../domain/shared/user-id';
import { LeadManagementPolicy } from '../application/policies/lead-management.policy';
import { CancelFollowUpUseCase } from '../application/use-cases/cancel-follow-up.use-case';
import { CompleteFollowUpUseCase } from '../application/use-cases/complete-follow-up.use-case';
import { ScheduleFollowUpUseCase } from '../application/use-cases/schedule-follow-up.use-case';
import { toContactId } from '../domain/contact-id';
import { FollowUp } from '../domain/follow-up.entity';
import { toFollowUpId } from '../domain/follow-up-id';
import { FollowUpTaskType } from '../domain/follow-up-task-type.value-object';
import { Lead } from '../domain/lead.entity';
import { LeadSource } from '../domain/lead-source.value-object';
import { FakeClock, FakeIdGenerator, FakeLeadRepository } from './fakes';

const ADMIN: AuthenticatedContext = {
  userId: toUserId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  roles: ['admin'],
  showroomId: null,
};
const SALESPERSON: AuthenticatedContext = {
  userId: toUserId('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  roles: ['salesperson'],
  showroomId: null,
};

const LEAD_ID = '77777777-7777-4777-8777-777777777777';
const OTHER_LEAD_ID = '55555555-5555-4555-8555-555555555555';
const NOW = new Date('2026-10-03T00:00:00.000Z');

function seedLead(repo: FakeLeadRepository, id: string): void {
  repo.seedLead(
    Lead.create({
      id: toLeadId(id),
      showroomId: toShowroomId('b0000000-0000-4000-8000-000000000001'),
      contactId: toContactId('66666666-6666-4666-8666-666666666666'),
      vehicleId: null,
      assignedTo: null,
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
}

describe('follow-up actions', () => {
  let repo: FakeLeadRepository;
  let ids: FakeIdGenerator;
  let complete: CompleteFollowUpUseCase;
  let cancel: CancelFollowUpUseCase;
  let followUpId: string;

  beforeEach(async () => {
    repo = new FakeLeadRepository();
    seedLead(repo, LEAD_ID);
    seedLead(repo, OTHER_LEAD_ID);
    ids = new FakeIdGenerator();
    const policy = new LeadManagementPolicy();
    const clock = new FakeClock(NOW);
    const scheduled = await new ScheduleFollowUpUseCase(policy, repo, clock, ids).execute(
      { leadId: LEAD_ID, scheduledAt: '2026-10-05T10:00:00.000Z', taskType: 'call', notes: null },
      ADMIN,
    );
    followUpId = scheduled.id;
    complete = new CompleteFollowUpUseCase(policy, repo, clock, ids);
    cancel = new CancelFollowUpUseCase(policy, repo, clock);
  });

  it('completes a follow-up with its outcome', async () => {
    const result = await complete.execute(
      { leadId: LEAD_ID, followUpId, outcome: 'no_answer', notes: 'Phone off', next: null },
      ADMIN,
    );

    expect(result.followUp.status).toBe('completed');
    expect(result.followUp.outcome).toBe('no_answer');
    expect(result.followUp.completionNotes).toBe('Phone off');
    expect(result.followUp.completedAt).toBe(NOW.toISOString());
    expect(result.next).toBeNull();
    expect(repo.closedFollowUps).toHaveLength(1);
  });

  it('schedules the next follow-up in the same write', async () => {
    ids.ids = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'];
    const result = await complete.execute(
      {
        leadId: LEAD_ID,
        followUpId,
        outcome: 'rescheduled',
        notes: null,
        next: { scheduledAt: '2026-10-07T10:00:00.000Z', taskType: 'meeting', notes: 'Showroom' },
      },
      ADMIN,
    );

    expect(result.next?.status).toBe('open');
    expect(result.next?.taskType).toBe('meeting');
    expect(result.next?.dueAt).toBe('2026-10-07T10:00:00.000Z');
    expect(repo.followUps).toHaveLength(2);
  });

  it('cancels an open follow-up', async () => {
    const result = await cancel.execute({ leadId: LEAD_ID, followUpId }, ADMIN);
    expect(result.status).toBe('cancelled');
    expect(result.cancelledAt).toBe(NOW.toISOString());
  });

  it('refuses to close a follow-up twice', async () => {
    await cancel.execute({ leadId: LEAD_ID, followUpId }, ADMIN);
    await expect(
      complete.execute(
        { leadId: LEAD_ID, followUpId, outcome: 'done', notes: null, next: null },
        ADMIN,
      ),
    ).rejects.toBeInstanceOf(BusinessRuleViolationError);
  });

  it('404s a follow-up addressed through another lead', async () => {
    await expect(
      cancel.execute({ leadId: OTHER_LEAD_ID, followUpId }, ADMIN),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("hides another salesperson's lead", async () => {
    await expect(
      complete.execute(
        { leadId: LEAD_ID, followUpId, outcome: 'done', notes: null, next: null },
        SALESPERSON,
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(repo.closedFollowUps).toHaveLength(0);
  });

  it('rejects an unknown outcome before writing', async () => {
    await expect(
      complete.execute(
        { leadId: LEAD_ID, followUpId, outcome: 'maybe', notes: null, next: null },
        ADMIN,
      ),
    ).rejects.toThrow('Follow-up outcome must be');
    expect(repo.closedFollowUps).toHaveLength(0);
  });

  it('closes a stored follow-up that has no due reminder', async () => {
    const legacyId = '44444444-4444-4444-8444-444444444444';
    repo.followUps.push(
      FollowUp.reconstitute({
        id: toFollowUpId(legacyId),
        leadId: toLeadId(LEAD_ID),
        assignedTo: ADMIN.userId,
        taskType: FollowUpTaskType.create('whatsapp'),
        scheduledAt: new Date('2026-10-01T10:00:00.000Z'),
        notes: 'Imported',
        createdBy: ADMIN.userId,
        createdAt: NOW,
        notificationId: null,
        dueAt: null,
        completion: null,
        cancellation: null,
      }),
    );

    const result = await complete.execute(
      { leadId: LEAD_ID, followUpId: legacyId, outcome: 'reached', notes: null, next: null },
      ADMIN,
    );
    expect(result.followUp.status).toBe('completed');
    expect(result.followUp.notificationId).toBeNull();
    expect(result.followUp.dueAt).toBeNull();
  });
});
