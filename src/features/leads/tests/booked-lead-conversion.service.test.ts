import { beforeEach, describe, expect, it } from 'vitest';

import { BusinessRuleViolationError } from '../../../domain/errors/business-rule-violation.error';
import { NotFoundError } from '../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../domain/shared/auth-context';
import { toLeadId } from '../../../domain/shared/lead-id';
import { toShowroomId } from '../../../domain/shared/showroom-id';
import { toUserId } from '../../../domain/shared/user-id';
import { type VehicleId, toVehicleId } from '../../../domain/shared/vehicle-id';
import { LeadManagementPolicy } from '../application/policies/lead-management.policy';
import { BookedLeadConversionService } from '../application/services/booked-lead-conversion.service';
import { VehicleLinkRefresher } from '../application/services/vehicle-link-refresher';
import { ChangeLeadStatusUseCase } from '../application/use-cases/change-lead-status.use-case';
import { toContactId } from '../domain/contact-id';
import { Lead } from '../domain/lead.entity';
import { LeadPreference } from '../domain/lead-preference.value-object';
import { LeadSource } from '../domain/lead-source.value-object';
import { LeadStatus } from '../domain/lead-status.value-object';
import { FakeClock, FakeLeadRepository, FakeVehicles } from './fakes';

const ADMIN: AuthenticatedContext = {
  userId: toUserId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  roles: ['admin'],
  showroomId: null,
};
const CAR = toVehicleId('99999999-9999-4999-8999-999999999999');
const OTHER_CAR = toVehicleId('99999999-9999-4999-8999-999999999998');
const BOOKED = toLeadId('88888888-8888-4888-8888-888888888888');
const RIVAL = toLeadId('55555555-5555-4555-8555-555555555555');
const NEW_LEAD = toLeadId('77777777-7777-4777-8777-777777777777');
const NOW = new Date('2026-11-12T10:00:00.000Z');

function lead(id: string, status: string, vehicleId: VehicleId | null): Lead {
  return Lead.reconstitute({
    id: toLeadId(id),
    showroomId: toShowroomId('b0000000-0000-4000-8000-000000000001'),
    contactId: toContactId('66666666-6666-4666-8666-666666666666'),
    vehicleId,
    assignedTo: null,
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

describe('BookedLeadConversionService', () => {
  let repo: FakeLeadRepository;
  let vehicles: FakeVehicles;
  let service: BookedLeadConversionService;

  beforeEach(() => {
    repo = new FakeLeadRepository();
    vehicles = new FakeVehicles();
    vehicles.seed(CAR, 'linked');
    vehicles.seed(OTHER_CAR, 'linked');
    repo.seedLead(lead(BOOKED, 'booking_confirmed', CAR));
    repo.seedLead(lead(RIVAL, 'new', CAR));
    repo.seedLead(lead(NEW_LEAD, 'new', CAR));
    const changeStatus = new ChangeLeadStatusUseCase(
      new LeadManagementPolicy(),
      repo,
      vehicles,
      new VehicleLinkRefresher(repo, vehicles),
      new FakeClock(NOW),
    );
    service = new BookedLeadConversionService(repo, changeStatus);
  });

  it('converts the booked lead, sells the car and frees its other leads', async () => {
    await service.convertBookedLead(CAR, BOOKED, ADMIN);

    expect((await repo.findById(BOOKED))?.status.value).toBe('converted');
    expect(vehicles.statusOf(CAR)).toBe('sold');
    expect(vehicles.soldTo.get(CAR)).toBe(BOOKED);
    const rival = await repo.findById(RIVAL);
    expect(rival?.status.value).toBe('vehicle_unavailable');
    expect(rival?.vehicleId).toBeNull();
  });

  it('refuses a lead whose booking is not confirmed, and changes nothing', async () => {
    await expect(service.convertBookedLead(CAR, NEW_LEAD, ADMIN)).rejects.toMatchObject({
      code: 'SALE_LEAD_NOT_BOOKED',
    });
    expect((await repo.findById(NEW_LEAD))?.status.value).toBe('new');
    expect(vehicles.statusOf(CAR)).toBe('linked');
  });

  it('refuses a booked lead on another car', async () => {
    await expect(service.convertBookedLead(OTHER_CAR, BOOKED, ADMIN)).rejects.toBeInstanceOf(
      BusinessRuleViolationError,
    );
    expect(vehicles.statusOf(OTHER_CAR)).toBe('linked');
  });

  it('reports a missing lead', async () => {
    await expect(
      service.convertBookedLead(CAR, toLeadId('11111111-1111-4111-8111-111111111111'), ADMIN),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
