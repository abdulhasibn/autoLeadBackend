import { describe, expect, it } from 'vitest';

import { NotFoundError } from '../../../domain/errors/not-found.error';
import { GetPublicFilterOptionsUseCase } from '../application/use-cases/get-public-filter-options.use-case';
import { GetPublicVehicleUseCase } from '../application/use-cases/get-public-vehicle.use-case';
import { ListPublicVehiclesUseCase } from '../application/use-cases/list-public-vehicles.use-case';
import { FakePublicVehicleQueries, FakeSigner, VEHICLE_ID, publicVehicle } from './fakes';

const MEDIA = {
  [VEHICLE_ID]: [
    { storagePath: `${VEHICLE_ID}/interior.jpg`, category: 'interior' },
    { storagePath: `${VEHICLE_ID}/front.jpg`, category: 'front' },
  ],
};

// The whole public contract. A new key here must be a deliberate decision.
const SUMMARY_KEYS = [
  'bodyType',
  'colour',
  'coverImageUrl',
  'fuelType',
  'id',
  'kmDriven',
  'listedPrice',
  'make',
  'model',
  'previousOwners',
  'transmission',
  'variant',
  'year',
];

describe('ListPublicVehiclesUseCase', () => {
  it('returns only whitelisted fields with a signed front cover', async () => {
    const useCase = new ListPublicVehiclesUseCase(
      new FakePublicVehicleQueries([publicVehicle()], MEDIA),
      new FakeSigner(),
    );

    const page = await useCase.execute({ sort: 'newest' }, { limit: 24, offset: 0 });

    expect(page.total).toBe(1);
    expect(Object.keys(page.items[0] ?? {}).sort()).toEqual(SUMMARY_KEYS);
    expect(page.items[0]).toMatchObject({
      bodyType: 'suv',
      coverImageUrl: `https://signed.test/${VEHICLE_ID}/front.jpg`,
      listedPrice: 1450000,
    });
  });

  it('leaves the cover empty when a vehicle has no photos', async () => {
    const useCase = new ListPublicVehiclesUseCase(new FakePublicVehicleQueries(), new FakeSigner());

    const page = await useCase.execute({ sort: 'newest' }, { limit: 24, offset: 0 });

    expect(page.items[0]?.coverImageUrl).toBeNull();
  });
});

describe('GetPublicVehicleUseCase', () => {
  it('returns every photo in order, with the description', async () => {
    const useCase = new GetPublicVehicleUseCase(
      new FakePublicVehicleQueries([publicVehicle()], MEDIA),
      new FakeSigner(),
    );

    const vehicle = await useCase.execute(VEHICLE_ID);

    expect(Object.keys(vehicle).sort()).toEqual([...SUMMARY_KEYS, 'description', 'photos'].sort());
    expect(vehicle.photos.map((photo) => photo.category)).toEqual(['interior', 'front']);
    expect(vehicle.coverImageUrl).toBe(`https://signed.test/${VEHICLE_ID}/front.jpg`);
  });

  it('answers not found for a vehicle that is not Listed', async () => {
    const useCase = new GetPublicVehicleUseCase(new FakePublicVehicleQueries([]), new FakeSigner());

    await expect(useCase.execute(VEHICLE_ID)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('GetPublicFilterOptionsUseCase', () => {
  it('builds choices from stock only', async () => {
    const useCase = new GetPublicFilterOptionsUseCase(
      new FakePublicVehicleQueries([
        publicVehicle(),
        publicVehicle({
          id: 'v2',
          modelId: 'model-i20',
          model: 'i20',
          bodyTypes: ['hatchback'],
          fuelType: 'diesel',
          year: 2019,
          listedPrice: null,
        }),
        publicVehicle({
          id: 'v3',
          makeId: 'make-tata',
          make: 'Tata',
          modelId: 'model-nexon',
          model: 'Nexon',
          bodyTypes: ['crossover', 'suv'],
          listedPrice: 900000,
        }),
      ]),
    );

    const options = await useCase.execute();

    expect(options.makes).toEqual([
      {
        id: 'make-hyundai',
        name: 'Hyundai',
        models: [
          { id: 'model-creta', name: 'Creta' },
          { id: 'model-i20', name: 'i20' },
        ],
      },
      { id: 'make-tata', name: 'Tata', models: [{ id: 'model-nexon', name: 'Nexon' }] },
    ]);
    expect(options.bodyTypes).toEqual(['crossover', 'hatchback', 'suv']);
    expect(options.fuelTypes).toEqual(['diesel', 'petrol']);
    expect(options.priceRange).toEqual({ min: 900000, max: 1450000 });
    expect(options.yearRange).toEqual({ min: 2019, max: 2022 });
  });
});
