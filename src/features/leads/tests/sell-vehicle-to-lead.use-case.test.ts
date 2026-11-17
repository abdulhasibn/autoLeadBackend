import { beforeEach, describe, expect, it } from 'vitest';

import { NotFoundError } from '../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../domain/shared/auth-context';
import { toLeadId } from '../../../domain/shared/lead-id';
import { toShowroomId } from '../../../domain/shared/showroom-id';
import { type UserId, toUserId } from '../../../domain/shared/user-id';
import { type VehicleId, toVehicleId } from '../../../domain/shared/vehicle-id';
import { LeadManagementPolicy } from '../application/policies/lead-management.policy';
import { VehicleLinkRefresher } from '../application/services/vehicle-link-refresher';
import { AssociateLeadVehicleUseCase } from '../application/use-cases/associate-lead-vehicle.use-case';
import { ChangeLeadStatusUseCase } from '../application/use-cases/change-lead-status.use-case';
import { SellVehicleToLeadUseCase } from '../application/use-cases/sell-vehicle-to-lead.use-case';
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
const SALES: AuthenticatedContext = {
  userId: toUserId('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  roles: ['salesperson'],
  showroomId: null,
};

const LEAD_ID = '77777777-7777-4777-8777-777777777777';
const RIVAL_ID = '55555555-5555-4555-8555-555555555555';
const CAR = toVehicleId('99999999-9999-4999-8999-999999999999');
const OLD_CAR = toVehicleId('99999999-9999-4999-8999-000000000001');
const NOW = new Date('2026-11-17T00:00:00.000Z');

function lead(
  id: string,
  status: string,
  vehicleId: VehicleId | null,
  assignedTo: UserId | null = null,
): Lead {
  return Lead.reconstitute({
    id: toLeadId(id),
    showroomId: toShowroomId('b0000000-0000-4000-8000-000000000001'),
    contactId: toContactId('66666666-6666-4666-8666-666666666666'),
    vehicleId,
    assignedTo,
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

/** A copy of the stored state, the way a database read returns one. */
function copy(source: Lead): Lead {
  return Lead.reconstitute({
    id: source.id,
    showroomId: source.showroomId,
    contactId: source.contactId,
    vehicleId: source.vehicleId,
    assignedTo: source.assignedTo,
    source: source.source,
    status: source.status,
    budget: source.budget,
    preferredVehicle: source.preferredVehicle,
    preference: source.preference,
    purchaseTimeline: source.purchaseTimeline,
    financeRequired: source.financeRequired,
    currentVehicle: source.currentVehicle,
    tradeInRequired: source.tradeInRequired,
    notes: source.notes,
    createdBy: source.createdBy,
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
    deletedAt: source.deletedAt,
  });
}

/**
 * Stores and hands out copies, so a change made in memory before a failed
 * write is lost the way it would be with the real database.
 */
class StoredLeadRepository extends FakeLeadRepository {
  override async findById(id: Parameters<FakeLeadRepository['findById']>[0]) {
    const found = await super.findById(id);
    return found === null ? null : copy(found);
  }

  override async findActiveByVehicle(vehicleId: VehicleId) {
    return (await super.findActiveByVehicle(vehicleId)).map(copy);
  }

  override async save(...args: Parameters<FakeLeadRepository['save']>) {
    const [lead, write] = args;
    await super.save(copy(lead), write);
  }
}

describe('SellVehicleToLeadUseCase (#33)', () => {
  let repo: StoredLeadRepository;
  let vehicles: FakeVehicles;
  let sell: SellVehicleToLeadUseCase;

  const run = (leadId = LEAD_ID, ctx = ADMIN) =>
    sell.execute({ leadId, vehicleId: CAR, notes: 'Sold at the showroom' }, ctx);

  beforeEach(() => {
    repo = new StoredLeadRepository();
    vehicles = new FakeVehicles();
    vehicles.seed(CAR, 'open');
    vehicles.seed(OLD_CAR, 'linked');
    const policy = new LeadManagementPolicy();
    const links = new VehicleLinkRefresher(repo, vehicles);
    const clock = new FakeClock(NOW);
    sell = new SellVehicleToLeadUseCase(
      policy,
      repo,
      vehicles,
      new AssociateLeadVehicleUseCase(policy, repo, vehicles, links, clock),
      new ChangeLeadStatusUseCase(policy, repo, vehicles, links, clock),
      links,
      clock,
    );
  });

  it('links, books and converts a new lead in one request', async () => {
    repo.seedLead(lead(LEAD_ID, 'new', null));

    await expect(run()).resolves.toEqual({ status: 'converted', vehicleSold: true });

    const saved = repo.leads.get(LEAD_ID);
    expect(saved?.status.value).toBe('converted');
    expect(saved?.vehicleId).toBe(CAR);
    expect(vehicles.soldTo.get(CAR)).toBe(LEAD_ID);
  });

  it('moves a lead off its old car and frees the car’s other leads', async () => {
    repo.seedLead(lead(LEAD_ID, 'not_now', OLD_CAR));
    repo.seedLead(lead(RIVAL_ID, 'new', CAR));

    await run();

    expect(repo.leads.get(LEAD_ID)?.vehicleId).toBe(CAR);
    expect(repo.leads.get(RIVAL_ID)?.status.value).toBe('vehicle_unavailable');
    expect(vehicles.statusOf(CAR)).toBe('sold');
  });

  it('converts a lead already booked on the car', async () => {
    repo.seedLead(lead(LEAD_ID, 'booking_confirmed', CAR));
    vehicles.seed(CAR, 'linked');

    await run();

    expect(repo.leads.get(LEAD_ID)?.status.value).toBe('converted');
  });

  it('answers like a success when the lead is already converted on this car', async () => {
    repo.seedLead(lead(LEAD_ID, 'converted', CAR));
    vehicles.seed(CAR, 'sold');

    await expect(run()).resolves.toEqual({ status: 'converted', vehicleSold: true });
    expect(repo.writes).toHaveLength(0);
  });

  it('checks before writing: closed lead, car not linkable, impossible move', async () => {
    repo.seedLead(lead(LEAD_ID, 'lost', null));
    await expect(run()).rejects.toMatchObject({ code: 'LEAD_CLOSED' });

    repo.seedLead(lead(LEAD_ID, 'new', null));
    vehicles.seed(CAR, 'sold');
    await expect(run()).rejects.toMatchObject({ code: 'VEHICLE_NOT_LINKABLE' });

    expect(repo.writes).toHaveLength(0);
  });

  it('hides another salesperson’s lead', async () => {
    repo.seedLead(lead(LEAD_ID, 'new', null, ADMIN.userId));
    await expect(run(LEAD_ID, SALES)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('puts the lead back when the conversion fails before the car is sold', async () => {
    repo.seedLead(lead(LEAD_ID, 'not_now', OLD_CAR));
    vehicles.saleError = new Error('network blip');

    await expect(run()).rejects.toThrow('network blip');

    const restored = repo.leads.get(LEAD_ID);
    expect(restored?.status.value).toBe('not_now');
    expect(restored?.vehicleId).toBe(OLD_CAR);
    expect(vehicles.statusOf(CAR)).toBe('open');
    expect(repo.writes.at(-1)).toEqual({
      actorId: ADMIN.userId,
      statusNotes: 'Sale did not complete; lead restored',
    });
  });

  it('leaves the lead for a retry once the car is sold, and the retry finishes', async () => {
    repo.seedLead(lead(LEAD_ID, 'new', null));
    const original = repo.save.bind(repo);
    let failed = false;
    // Fail the converting lead's own save, which runs after markSold.
    repo.save = async (l, write) => {
      if (l.status.value === 'converted' && !failed) {
        failed = true;
        throw new Error('save failed');
      }
      return original(l, write);
    };

    await expect(run()).rejects.toThrow('save failed');
    expect(vehicles.statusOf(CAR)).toBe('sold');
    expect(repo.leads.get(LEAD_ID)?.status.value).toBe('booking_confirmed');

    await expect(run()).resolves.toEqual({ status: 'converted', vehicleSold: true });
    expect(repo.leads.get(LEAD_ID)?.status.value).toBe('converted');
  });
});
