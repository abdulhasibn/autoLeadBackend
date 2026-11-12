import { beforeEach, describe, expect, it } from 'vitest';

import { ForbiddenActionError } from '../../../domain/errors/forbidden-action.error';
import type { AuthenticatedContext } from '../../../domain/shared/auth-context';
import { toLeadId } from '../../../domain/shared/lead-id';
import { toShowroomId } from '../../../domain/shared/showroom-id';
import { toUserId } from '../../../domain/shared/user-id';
import { type VehicleId, toVehicleId } from '../../../domain/shared/vehicle-id';
import { LeadManagementPolicy } from '../application/policies/lead-management.policy';
import { LeadLinkService } from '../application/services/lead-link.service';
import { VehicleLinkRefresher } from '../application/services/vehicle-link-refresher';
import { ReopenConvertedLeadUseCase } from '../application/use-cases/reopen-converted-lead.use-case';
import { ScheduleFollowUpUseCase } from '../application/use-cases/schedule-follow-up.use-case';
import { toContactId } from '../domain/contact-id';
import { Lead } from '../domain/lead.entity';
import { LeadPreference } from '../domain/lead-preference.value-object';
import { LeadSource } from '../domain/lead-source.value-object';
import { LeadStatus } from '../domain/lead-status.value-object';
import { FakeClock, FakeIdGenerator, FakeLeadRepository, FakeVehicles } from './fakes';

const ADMIN: AuthenticatedContext = {
  userId: toUserId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  roles: ['admin'],
  showroomId: null,
};
const SALES: AuthenticatedContext = {
  userId: toUserId('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  roles: ['salesperson'],
  showroomId: null,
};
const CAR = toVehicleId('99999999-9999-4999-8999-999999999999');
const BOOKED = '88888888-8888-4888-8888-888888888888';
const BROWSING = '77777777-7777-4777-8777-777777777777';
const NOW = new Date('2026-11-12T10:00:00.000Z');

function lead(id: string, status: string, vehicleId: VehicleId | null): Lead {
  return Lead.reconstitute({
    id: toLeadId(id),
    showroomId: toShowroomId('b0000000-0000-4000-8000-000000000001'),
    contactId: toContactId('66666666-6666-4666-8666-666666666666'),
    vehicleId,
    assignedTo: SALES.userId,
    source: LeadSource.create('phone'),
    status: LeadStatus.create(status),
    budget: null,
    preferredVehicle: null,
    preference: LeadPreference.none(),
    purchaseTimeline: null,
    financeRequired: null,
    currentVehicle: null,
    tradeInRequired: null,
    notes: null,
    createdBy: ADMIN.userId,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
  });
}

describe('dropping a car (LeadLinkService.unlinkAll)', () => {
  it('turns a confirmed booking into vehicle_unavailable and only unlinks other leads', async () => {
    const repo = new FakeLeadRepository();
    repo.seedLead(lead(BOOKED, 'booking_confirmed', CAR));
    repo.seedLead(lead(BROWSING, 'new', CAR));

    await new LeadLinkService(repo, new FakeClock(NOW)).unlinkAll(CAR, ADMIN.userId);

    const booked = await repo.findById(toLeadId(BOOKED));
    expect(booked?.status.value).toBe('vehicle_unavailable');
    expect(booked?.vehicleId).toBeNull();
    const browsing = await repo.findById(toLeadId(BROWSING));
    expect(browsing?.status.value).toBe('new');
    expect(browsing?.vehicleId).toBeNull();
    expect(repo.writes.map((w) => w.statusNotes)).toEqual(['Car dropped', 'Car dropped']);
  });
});

describe('ReopenConvertedLeadUseCase', () => {
  let repo: FakeLeadRepository;
  let vehicles: FakeVehicles;
  let recorded: boolean;
  let useCase: ReopenConvertedLeadUseCase;

  beforeEach(async () => {
    repo = new FakeLeadRepository();
    vehicles = new FakeVehicles();
    vehicles.seed(CAR, 'linked');
    await vehicles.markSold(CAR, toLeadId(BOOKED));
    repo.seedLead(lead(BOOKED, 'converted', CAR));
    recorded = false;
    useCase = new ReopenConvertedLeadUseCase(
      new LeadManagementPolicy(),
      repo,
      vehicles,
      { hasRecordedSale: async () => recorded },
      new VehicleLinkRefresher(repo, vehicles),
      new FakeClock(NOW),
    );
  });

  it('puts the lead back to a confirmed booking and the car back to linked', async () => {
    const result = await useCase.execute({ leadId: BOOKED, notes: null }, ADMIN);

    expect(result).toEqual({ status: 'booking_confirmed' });
    const reopened = await repo.findById(toLeadId(BOOKED));
    expect(reopened?.status.value).toBe('booking_confirmed');
    expect(reopened?.vehicleId).toBe(CAR);
    expect(vehicles.statusOf(CAR)).toBe('linked');
    expect(vehicles.soldTo.has(CAR)).toBe(false);
    expect(repo.writes.at(-1)).toMatchObject({ actorId: ADMIN.userId, statusNotes: 'Sale undone' });
  });

  it('is refused while finance has the sale price, and changes nothing', async () => {
    recorded = true;
    await expect(useCase.execute({ leadId: BOOKED, notes: null }, ADMIN)).rejects.toMatchObject({
      code: 'SALE_PRICE_RECORDED',
    });
    expect(vehicles.statusOf(CAR)).toBe('sold');
    expect(repo.writes).toEqual([]);
  });

  it('refuses a lead that is not converted', async () => {
    repo.seedLead(lead(BROWSING, 'new', CAR));
    await expect(useCase.execute({ leadId: BROWSING, notes: null }, ADMIN)).rejects.toMatchObject({
      code: 'LEAD_NOT_CONVERTED',
    });
  });

  it('is admin-only', async () => {
    await expect(useCase.execute({ leadId: BOOKED, notes: null }, SALES)).rejects.toBeInstanceOf(
      ForbiddenActionError,
    );
  });

  it('a retry after a failed lead save finishes the job', async () => {
    repo.failNextSave = true;
    await expect(useCase.execute({ leadId: BOOKED, notes: null }, ADMIN)).rejects.toThrow(
      'save failed',
    );
    expect(vehicles.statusOf(CAR)).toBe('linked');

    // The fake kept the in-memory change; reload the stored (still converted) lead.
    repo.seedLead(lead(BOOKED, 'converted', CAR));
    await useCase.execute({ leadId: BOOKED, notes: null }, ADMIN);
    expect((await repo.findById(toLeadId(BOOKED)))?.status.value).toBe('booking_confirmed');
  });
});

describe('follow-ups on a closed lead', () => {
  it('are refused with LEAD_CLOSED', async () => {
    const repo = new FakeLeadRepository();
    repo.seedLead(lead(BOOKED, 'lost', null));
    const schedule = new ScheduleFollowUpUseCase(
      new LeadManagementPolicy(),
      repo,
      new FakeClock(NOW),
      new FakeIdGenerator(),
    );

    await expect(
      schedule.execute(
        {
          leadId: BOOKED,
          scheduledAt: '2026-11-20T10:00:00.000Z',
          taskType: 'call',
          notes: null,
        },
        ADMIN,
      ),
    ).rejects.toMatchObject({ code: 'LEAD_CLOSED' });
    expect(repo.followUps).toEqual([]);
  });
});
