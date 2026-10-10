import { beforeEach, describe, expect, it } from 'vitest';

import { NotFoundError } from '../../../domain/errors/not-found.error';
import { toLeadId } from '../../../domain/shared/lead-id';
import { toOwnerId } from '../../../domain/shared/owner-id';
import { toShowroomId } from '../../../domain/shared/showroom-id';
import { toUserId } from '../../../domain/shared/user-id';
import { toVehicleId } from '../../../domain/shared/vehicle-id';
import { VehicleLeadLinkService } from '../application/services/vehicle-lead-link.service';
import { AcquisitionType } from '../domain/acquisition-type.value-object';
import { FuelType } from '../../../domain/shared/fuel-type.value-object';
import { KilometersDriven } from '../domain/kilometers-driven.value-object';
import { PreviousOwners } from '../domain/previous-owners.value-object';
import { RegistrationNumber } from '../domain/registration-number.value-object';
import { Transmission } from '../../../domain/shared/transmission.value-object';
import { toVariantId } from '../domain/variant-id';
import { Vehicle } from '../domain/vehicle.entity';
import { VehicleStatus } from '../domain/vehicle-status.value-object';
import { VehicleYear } from '../domain/vehicle-year.value-object';
import { FakeClock, FakeVehicleRepository } from './fakes';

const VEHICLE_ID = toVehicleId('33333333-3333-4333-8333-333333333333');
const LEAD_ID = toLeadId('77777777-7777-4777-8777-777777777777');
const ACTOR = toUserId('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
const NOW = new Date('2026-10-03T00:00:00.000Z');

function openVehicle(): Vehicle {
  return Vehicle.create({
    id: VEHICLE_ID,
    showroomId: toShowroomId('b0000000-0000-4000-8000-000000000001'),
    ownerId: toOwnerId('22222222-2222-4222-8222-222222222222'),
    variantId: toVariantId('44444444-4444-4444-8444-444444444444'),
    year: VehicleYear.create(2019),
    registrationNumber: RegistrationNumber.create('KA01AB1234'),
    fuelType: FuelType.create('petrol'),
    transmission: Transmission.create('manual'),
    kmDriven: KilometersDriven.create(42000),
    numPreviousOwners: PreviousOwners.create(1),
    colour: 'White',
    insuranceValidUntil: null,
    rcStatus: null,
    serviceHistory: null,
    accidentHistory: false,
    loanStatus: null,
    location: null,
    description: null,
    acquisitionType: AcquisitionType.create('consignment'),
    submittedBy: ACTOR,
    createdAt: NOW,
    updatedAt: NOW,
  });
}

describe('VehicleLeadLinkService', () => {
  let repo: FakeVehicleRepository;
  let service: VehicleLeadLinkService;

  beforeEach(() => {
    repo = new FakeVehicleRepository();
    service = new VehicleLeadLinkService(repo, new FakeClock(NOW));
  });

  async function statusOf(): Promise<string | undefined> {
    return (await repo.findById(VEHICLE_ID))?.status.value;
  }

  it('reports linkability', async () => {
    expect(await service.linkability(VEHICLE_ID)).toBe('not_found');
    repo.seed(openVehicle());
    expect(await service.linkability(VEHICLE_ID)).toBe('linkable');
    const dropped = openVehicle();
    dropped.changeStatusByAdmin(VehicleStatus.dropped(), NOW, null);
    repo.seed(dropped);
    expect(await service.linkability(VEHICLE_ID)).toBe('unavailable');
  });

  it('syncs open and linked from the active-lead flag', async () => {
    repo.seed(openVehicle());
    await service.syncLinkState(VEHICLE_ID, true, ACTOR);
    expect(await statusOf()).toBe('linked');
    await service.syncLinkState(VEHICLE_ID, false, ACTOR);
    expect(await statusOf()).toBe('open');
  });

  it('skips the write when nothing changes', async () => {
    repo.seed(openVehicle());
    repo.saveError = new Error('should not save');
    await expect(service.syncLinkState(VEHICLE_ID, false, ACTOR)).resolves.toBeUndefined();
  });

  it('sells the vehicle to the lead and records it', async () => {
    const vehicle = openVehicle();
    vehicle.syncLinkState(true, NOW);
    repo.seed(vehicle);
    await service.markSold(VEHICLE_ID, LEAD_ID, ACTOR, 'Sold through lead');
    const sold = await repo.findById(VEHICLE_ID);
    expect(sold?.status.value).toBe('sold');
    expect(sold?.soldLeadId).toBe(LEAD_ID);
  });

  it('heals a stale open vehicle before selling it', async () => {
    repo.seed(openVehicle());
    await service.markSold(VEHICLE_ID, LEAD_ID, ACTOR, 'Sold through lead');
    expect(await statusOf()).toBe('sold');
  });

  it('is a no-op when already sold to the same lead', async () => {
    repo.seed(openVehicle());
    await service.markSold(VEHICLE_ID, LEAD_ID, ACTOR, 'first');
    repo.saveError = new Error('should not save again');
    await expect(service.markSold(VEHICLE_ID, LEAD_ID, ACTOR, 'retry')).resolves.toBeUndefined();
  });

  it('refuses to sell a dropped vehicle', async () => {
    const vehicle = openVehicle();
    vehicle.changeStatusByAdmin(VehicleStatus.dropped(), NOW, null);
    repo.seed(vehicle);
    await expect(service.markSold(VEHICLE_ID, LEAD_ID, ACTOR, 'x')).rejects.toMatchObject({
      code: 'INVALID_VEHICLE_STATUS_TRANSITION',
    });
  });

  it('throws when the vehicle is missing', async () => {
    await expect(service.markSold(VEHICLE_ID, LEAD_ID, ACTOR, 'x')).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});
