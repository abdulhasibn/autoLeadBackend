import { describe, expect, it } from 'vitest';

import { toOwnerId } from '../../../domain/shared/owner-id';
import { toShowroomId } from '../../../domain/shared/showroom-id';
import { toUserId } from '../../../domain/shared/user-id';
import { toVehicleId } from '../../../domain/shared/vehicle-id';
import { AcquisitionType } from '../domain/acquisition-type.value-object';
import { FuelType } from '../domain/fuel-type.value-object';
import { KilometersDriven } from '../domain/kilometers-driven.value-object';
import { PreviousOwners } from '../domain/previous-owners.value-object';
import { RegistrationNumber } from '../domain/registration-number.value-object';
import { Transmission } from '../domain/transmission.value-object';
import { toVariantId } from '../domain/variant-id';
import { Vehicle } from '../domain/vehicle.entity';
import { VehicleYear } from '../domain/vehicle-year.value-object';

const NOW = new Date('2026-10-03T00:00:00.000Z');

function makeVehicle(): Vehicle {
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
  });
}

describe('Vehicle entity', () => {
  it('creates a submitted vehicle and trims text', () => {
    const vehicle = makeVehicle();
    expect(vehicle.status.value).toBe('submitted');
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
});
