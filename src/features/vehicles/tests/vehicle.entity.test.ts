import { describe, expect, it } from 'vitest';

import { toLeadId } from '../../../domain/shared/lead-id';
import { toOwnerId } from '../../../domain/shared/owner-id';
import { toShowroomId } from '../../../domain/shared/showroom-id';
import { toUserId } from '../../../domain/shared/user-id';
import { toVehicleId } from '../../../domain/shared/vehicle-id';
import { CalendarDate } from '../../../domain/shared/calendar-date.value-object';
import { AcquisitionType } from '../domain/acquisition-type.value-object';
import { FuelType } from '../../../domain/shared/fuel-type.value-object';
import { KilometersDriven } from '../domain/kilometers-driven.value-object';
import { PreviousOwners } from '../domain/previous-owners.value-object';
import { RegistrationNumber } from '../domain/registration-number.value-object';
import { Transmission } from '../../../domain/shared/transmission.value-object';
import { toVariantId } from '../domain/variant-id';
import { InvalidVehicleStatusTransitionError } from '../domain/errors/invalid-vehicle-status-transition.error';
import { Vehicle } from '../domain/vehicle.entity';
import { VehicleStatus } from '../domain/vehicle-status.value-object';
import { VehicleYear } from '../domain/vehicle-year.value-object';

const NOW = new Date('2026-10-03T00:00:00.000Z');

function makeVehicle(
  insurance: { insuranceValidUntil?: CalendarDate | null; insuranceNil?: boolean } = {},
): Vehicle {
  return Vehicle.create({
    id: toVehicleId('33333333-3333-4333-8333-333333333333'),
    showroomId: toShowroomId('b0000000-0000-4000-8000-000000000001'),
    ownerId: toOwnerId('22222222-2222-4222-8222-222222222222'),
    variantId: toVariantId('44444444-4444-4444-8444-444444444444'),
    year: VehicleYear.create(2019),
    registrationNumber: RegistrationNumber.create('KA01AB1234'),
    fuelType: FuelType.create('petrol'),
    transmission: Transmission.create('manual'),
    kmDriven: KilometersDriven.create(42000),
    numPreviousOwners: PreviousOwners.create(1),
    colour: '  White  ',
    insuranceValidUntil: null,
    insuranceNil: false,
    rcStatus: 'clear',
    serviceHistory: 'full',
    accidentHistory: false,
    loanStatus: 'clear',
    location: '  Bengaluru  ',
    description: '  clean  ',
    acquisitionType: AcquisitionType.create('consignment'),
    submittedBy: toUserId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
    createdAt: NOW,
    updatedAt: NOW,
    ...insurance,
  });
}

describe('Vehicle entity', () => {
  it('creates an open vehicle and trims text', () => {
    const vehicle = makeVehicle();
    expect(vehicle.status.value).toBe('open');
    expect(vehicle.soldLeadId).toBeNull();
    expect(vehicle.colour).toBe('White');
    expect(vehicle.location).toBe('Bengaluru');
    expect(vehicle.description).toBe('clean');
  });

  it('updates second-hand details', () => {
    const vehicle = makeVehicle();
    const at = new Date('2026-10-03T12:00:00.000Z');
    vehicle.updateDetails({
      year: VehicleYear.create(2020),
      registrationNumber: RegistrationNumber.create('KA01AB9999'),
      fuelType: FuelType.create('diesel'),
      transmission: Transmission.create('automatic'),
      kmDriven: KilometersDriven.create(50000),
      numPreviousOwners: PreviousOwners.create(2),
      colour: 'Black',
      insuranceValidUntil: null,
      insuranceNil: false,
      rcStatus: null,
      serviceHistory: null,
      accidentHistory: true,
      loanStatus: null,
      location: null,
      description: null,
      updatedAt: at,
    });
    expect(vehicle.year.value).toBe(2020);
    expect(vehicle.registrationNumber.value).toBe('KA01AB9999');
    expect(vehicle.accidentHistory).toBe(true);
    expect(vehicle.updatedAt).toEqual(at);
  });

  describe('insurance Nil', () => {
    const details = (insurance: {
      insuranceValidUntil: CalendarDate | null;
      insuranceNil?: boolean;
    }) => ({
      year: VehicleYear.create(2019),
      registrationNumber: RegistrationNumber.create('KA01AB1234'),
      fuelType: FuelType.create('petrol'),
      transmission: Transmission.create('manual'),
      kmDriven: KilometersDriven.create(42000),
      numPreviousOwners: PreviousOwners.create(1),
      colour: 'White',
      rcStatus: null,
      serviceHistory: null,
      accidentHistory: false,
      loanStatus: null,
      location: null,
      description: null,
      updatedAt: NOW,
      ...insurance,
    });

    it('records Nil apart from not filled in', () => {
      expect(makeVehicle().insuranceNil).toBe(false);
      const nil = makeVehicle({ insuranceNil: true });
      expect(nil.insuranceNil).toBe(true);
      expect(nil.insuranceValidUntil).toBeNull();
    });

    it('refuses Nil together with a date', () => {
      expect(() =>
        makeVehicle({ insuranceNil: true, insuranceValidUntil: CalendarDate.create('2027-01-01') }),
      ).toThrow(expect.objectContaining({ code: 'INSURANCE_NIL_WITH_DATE' }));
      const vehicle = makeVehicle();
      expect(() =>
        vehicle.updateDetails(
          details({ insuranceNil: true, insuranceValidUntil: CalendarDate.create('2027-01-01') }),
        ),
      ).toThrow(expect.objectContaining({ code: 'INSURANCE_NIL_WITH_DATE' }));
    });

    it('keeps Nil when an update omits it, and clears it when a date is set', () => {
      const vehicle = makeVehicle({ insuranceNil: true });
      vehicle.updateDetails(details({ insuranceValidUntil: null }));
      expect(vehicle.insuranceNil).toBe(true);
      vehicle.updateDetails(details({ insuranceValidUntil: CalendarDate.create('2027-01-01') }));
      expect(vehicle.insuranceNil).toBe(false);
      expect(vehicle.insuranceValidUntil?.value).toBe('2027-01-01');
    });

    it('turns Nil off explicitly', () => {
      const vehicle = makeVehicle({ insuranceNil: true });
      vehicle.updateDetails(details({ insuranceValidUntil: null, insuranceNil: false }));
      expect(vehicle.insuranceNil).toBe(false);
    });
  });

  it('lets an admin drop and re-list a vehicle with a reason', () => {
    const vehicle = makeVehicle();
    const at = new Date('2026-10-03T12:00:00.000Z');
    vehicle.changeStatusByAdmin(VehicleStatus.create('dropped'), at, '  owner withdrew  ');
    expect(vehicle.status.value).toBe('dropped');
    expect(vehicle.statusChangeReason).toBe('owner withdrew');
    expect(vehicle.updatedAt).toEqual(at);
    expect(vehicle.isLinkable).toBe(false);
    vehicle.changeStatusByAdmin(VehicleStatus.create('open'), at, null);
    expect(vehicle.status.value).toBe('open');
  });

  it('refuses admin changes to lead-driven statuses', () => {
    const vehicle = makeVehicle();
    for (const status of ['linked', 'sold']) {
      expect(() => vehicle.changeStatusByAdmin(VehicleStatus.create(status), NOW, null)).toThrow(
        expect.objectContaining({ code: 'VEHICLE_STATUS_SYSTEM_MANAGED' }),
      );
    }
  });

  it('follows its active leads between open and linked', () => {
    const vehicle = makeVehicle();
    vehicle.syncLinkState(true, NOW);
    expect(vehicle.status.value).toBe('linked');
    vehicle.syncLinkState(true, NOW);
    expect(vehicle.status.value).toBe('linked');
    vehicle.syncLinkState(false, NOW);
    expect(vehicle.status.value).toBe('open');
  });

  it('ignores link sync once dropped', () => {
    const vehicle = makeVehicle();
    vehicle.changeStatusByAdmin(VehicleStatus.create('dropped'), NOW, null);
    vehicle.syncLinkState(true, NOW);
    expect(vehicle.status.value).toBe('dropped');
  });

  it('sells a linked vehicle to a lead, idempotently', () => {
    const vehicle = makeVehicle();
    const lead = toLeadId('77777777-7777-4777-8777-777777777777');
    vehicle.syncLinkState(true, NOW);
    vehicle.markSold(lead, NOW, 'Sold through lead');
    expect(vehicle.status.value).toBe('sold');
    expect(vehicle.soldLeadId).toBe(lead);
    vehicle.markSold(lead, NOW, 'again');
    expect(vehicle.soldLeadId).toBe(lead);
  });

  it('refuses to sell a vehicle twice to different leads', () => {
    const vehicle = makeVehicle();
    vehicle.syncLinkState(true, NOW);
    vehicle.markSold(toLeadId('77777777-7777-4777-8777-777777777777'), NOW, 'first');
    expect(() =>
      vehicle.markSold(toLeadId('88888888-8888-4888-8888-888888888888'), NOW, 'second'),
    ).toThrow(expect.objectContaining({ code: 'VEHICLE_ALREADY_SOLD' }));
  });

  it('undoes a sale for its lead, idempotently, and refuses another lead', () => {
    const vehicle = makeVehicle();
    const lead = toLeadId('77777777-7777-4777-8777-777777777777');
    vehicle.syncLinkState(true, NOW);
    vehicle.markSold(lead, NOW, 'sold');

    expect(() =>
      vehicle.unmarkSold(toLeadId('88888888-8888-4888-8888-888888888888'), NOW, 'undo'),
    ).toThrow(expect.objectContaining({ code: 'VEHICLE_SOLD_TO_ANOTHER_LEAD' }));

    vehicle.unmarkSold(lead, NOW, '  Sale undone  ');
    expect(vehicle.status.value).toBe('linked');
    expect(vehicle.soldLeadId).toBeNull();
    expect(vehicle.statusChangeReason).toBe('Sale undone');

    vehicle.unmarkSold(lead, NOW, 'again');
    expect(vehicle.status.value).toBe('linked');
  });

  it('corrects the acquisition type until the car is sold', () => {
    const vehicle = makeVehicle();
    const update = (acquisitionType?: AcquisitionType) =>
      vehicle.updateDetails({
        year: vehicle.year,
        registrationNumber: vehicle.registrationNumber,
        fuelType: vehicle.fuelType,
        transmission: vehicle.transmission,
        kmDriven: vehicle.kmDriven,
        numPreviousOwners: vehicle.numPreviousOwners,
        colour: vehicle.colour,
        insuranceValidUntil: null,
        insuranceNil: false,
        rcStatus: null,
        serviceHistory: null,
        accidentHistory: false,
        loanStatus: null,
        location: null,
        description: null,
        updatedAt: NOW,
        ...(acquisitionType === undefined ? {} : { acquisitionType }),
      });

    update(AcquisitionType.create('dealership_purchase'));
    expect(vehicle.acquisitionType.value).toBe('dealership_purchase');
    update();
    expect(vehicle.acquisitionType.value).toBe('dealership_purchase');

    vehicle.syncLinkState(true, NOW);
    vehicle.markSold(toLeadId('77777777-7777-4777-8777-777777777777'), NOW, 'sold');
    expect(() => update(AcquisitionType.create('consignment'))).toThrow(
      expect.objectContaining({ code: 'VEHICLE_SOLD' }),
    );
    update(AcquisitionType.create('dealership_purchase'));
    expect(vehicle.acquisitionType.value).toBe('dealership_purchase');
  });

  it('refuses to sell a vehicle without a linked lead', () => {
    const vehicle = makeVehicle();
    expect(() =>
      vehicle.markSold(toLeadId('77777777-7777-4777-8777-777777777777'), NOW, 'sold'),
    ).toThrow(InvalidVehicleStatusTransitionError);
  });
});
