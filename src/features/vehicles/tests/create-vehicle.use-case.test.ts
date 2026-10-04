import { beforeEach, describe, expect, it } from 'vitest';

import { BusinessRuleViolationError } from '../../../domain/errors/business-rule-violation.error';
import { ForbiddenActionError } from '../../../domain/errors/forbidden-action.error';
import { NotFoundError } from '../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../domain/shared/auth-context';
import { toOwnerId } from '../../../domain/shared/owner-id';
import { toShowroomId } from '../../../domain/shared/showroom-id';
import { toUserId } from '../../../domain/shared/user-id';
import { VehicleManagementPolicy } from '../application/policies/vehicle-management.policy';
import { CreateVehicleUseCase } from '../application/use-cases/create-vehicle.use-case';
import { toVariantId } from '../domain/variant-id';
import {
  FakeActiveShowroomLookup,
  FakeClock,
  FakeIdGenerator,
  FakeLiveVariantLookup,
  FakeRegisteredOwnerLookup,
  FakeVehicleRepository,
} from './fakes';

const ADMIN: AuthenticatedContext = {
  userId: toUserId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  roles: ['admin'],
  showroomId: null,
};

const OWNER_ID = '22222222-2222-4222-8222-222222222222';
const VARIANT_ID = '44444444-4444-4444-8444-444444444444';
const SHOWROOM_ID = 'b0000000-0000-4000-8000-000000000001';

const COMMAND = {
  showroomId: SHOWROOM_ID,
  ownerId: OWNER_ID,
  variantId: VARIANT_ID,
  year: 2019,
  registrationNumber: 'KA01AB1234',
  fuelType: 'petrol',
  transmission: 'manual',
  kmDriven: 42000,
  numPreviousOwners: 1,
  colour: 'White',
  insuranceValidUntil: null,
  rcStatus: 'clear',
  serviceHistory: 'full',
  accidentHistory: false,
  loanStatus: 'clear',
  location: 'Bengaluru',
  description: null,
  acquisitionType: 'consignment',
};

describe('CreateVehicleUseCase', () => {
  let useCase: CreateVehicleUseCase;
  let repo: FakeVehicleRepository;
  let owners: FakeRegisteredOwnerLookup;
  let variants: FakeLiveVariantLookup;
  let showrooms: FakeActiveShowroomLookup;
  let ids: FakeIdGenerator;

  beforeEach(() => {
    repo = new FakeVehicleRepository();
    owners = new FakeRegisteredOwnerLookup();
    variants = new FakeLiveVariantLookup();
    showrooms = new FakeActiveShowroomLookup();
    ids = new FakeIdGenerator();
    owners.seed(toOwnerId(OWNER_ID));
    variants.seed(toVariantId(VARIANT_ID));
    showrooms.seed(toShowroomId(SHOWROOM_ID));
    useCase = new CreateVehicleUseCase(
      new VehicleManagementPolicy(),
      repo,
      owners,
      variants,
      showrooms,
      new FakeClock(new Date('2026-10-03T00:00:00.000Z')),
      ids,
    );
  });

  it('creates a submitted vehicle for an admin', async () => {
    const result = await useCase.execute(COMMAND, ADMIN);
    expect(result).toMatchObject({
      id: ids.nextId,
      registrationNumber: 'KA01AB1234',
      status: 'submitted',
      acquisitionType: 'consignment',
      submittedBy: ADMIN.userId,
    });
    expect(repo.store.has(ids.nextId)).toBe(true);
  });

  it('lets a salesperson create a vehicle in their home showroom', async () => {
    const result = await useCase.execute(
      { ...COMMAND, showroomId: null },
      { userId: toUserId('bbbb'), roles: ['salesperson'], showroomId: toShowroomId(SHOWROOM_ID) },
    );
    expect(result).toMatchObject({ showroomId: SHOWROOM_ID, submittedBy: 'bbbb' });
  });

  it('rejects a salesperson filing into another showroom', async () => {
    await expect(
      useCase.execute(
        { ...COMMAND, showroomId: SHOWROOM_ID },
        {
          userId: toUserId('bbbb'),
          roles: ['salesperson'],
          showroomId: toShowroomId('b0000000-0000-4000-8000-000000000009'),
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenActionError);
  });

  it('requires a showroom when the actor has no home showroom', async () => {
    await expect(useCase.execute({ ...COMMAND, showroomId: null }, ADMIN)).rejects.toBeInstanceOf(
      BusinessRuleViolationError,
    );
  });

  it('rejects a buyer', async () => {
    await expect(
      useCase.execute(COMMAND, { userId: toUserId('cccc'), roles: ['buyer'], showroomId: null }),
    ).rejects.toBeInstanceOf(ForbiddenActionError);
  });

  it('rejects an unknown owner', async () => {
    await expect(
      useCase.execute({ ...COMMAND, ownerId: '55555555-5555-4555-8555-555555555555' }, ADMIN),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('rejects catalog fuel that is not a vehicle fuel type', async () => {
    await expect(useCase.execute({ ...COMMAND, fuelType: 'cng_petrol' }, ADMIN)).rejects.toThrow(
      'petrol, diesel, cng, electric, or hybrid',
    );
  });
});
