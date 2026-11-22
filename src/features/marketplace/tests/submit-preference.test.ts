import express from 'express';
import supertest from 'supertest';
import { describe, expect, it } from 'vitest';

import { createErrorHandlerMiddleware } from '../../../presentation/http/errors/error-handler.middleware';
import type { ErrorMapper } from '../../../presentation/http/errors/error-mapping';
import type { Logger } from '../../../shared/logging/logger.port';
import { GetPublicCatalogUseCase } from '../application/use-cases/get-public-catalog.use-case';
import { GetPublicFilterOptionsUseCase } from '../application/use-cases/get-public-filter-options.use-case';
import { GetPublicVehicleUseCase } from '../application/use-cases/get-public-vehicle.use-case';
import { ListPublicVehiclesUseCase } from '../application/use-cases/list-public-vehicles.use-case';
import { SubmitPreferenceUseCase } from '../application/use-cases/submit-preference.use-case';
import { SubmitTestDriveUseCase } from '../application/use-cases/submit-test-drive.use-case';
import { InvalidMobileError } from '../domain/errors/invalid-mobile.error';
import { PublicRateLimitedError } from '../domain/errors/public-rate-limited.error';
import { PublicCatalogController } from '../presentation/controllers/public-catalog.controller';
import { PublicVehiclesController } from '../presentation/controllers/public-vehicles.controller';
import { SubmitPreferenceController } from '../presentation/controllers/submit-preference.controller';
import { SubmitTestDriveController } from '../presentation/controllers/submit-test-drive.controller';
import { createMarketplaceRouter } from '../presentation/marketplace.routes';
import { submitPreferenceBodySchema } from '../presentation/schemas/public-marketplace.schemas';
import {
  FakePreferenceIntake,
  FakePublicCatalogQueries,
  FakePublicVehicleQueries,
  FakeSigner,
  FakeTestDriveIntake,
  FakeTouchClassifier,
  FakeVehicleLinkSync,
  SESSION_ID,
  VEHICLE_ID,
  VISITOR_ID,
  visitorTouch,
} from './fakes';

const SITE = 'https://wheelsexperts.in';
const base = { fullName: 'Asha Rao', phone: '9876543210' };

describe('submitPreferenceBodySchema', () => {
  it('accepts a contact alone and a full set of preferences', () => {
    expect(submitPreferenceBodySchema.safeParse(base).success).toBe(true);
    expect(
      submitPreferenceBodySchema.safeParse({
        ...base,
        budgetMax: 1_500_000,
        bodyTypes: ['suv', 'sedan'],
        fuelTypes: ['petrol'],
        transmissions: ['automatic', 'amt'],
        make: ' Hyundai ',
        model: 'Creta',
        referenceVehicleId: VEHICLE_ID,
      }).success,
    ).toBe(true);
  });

  it('trims make and model', () => {
    const parsed = submitPreferenceBodySchema.parse({ ...base, make: ' Tata ', model: ' Nexon ' });
    expect([parsed.make, parsed.model]).toEqual(['Tata', 'Nexon']);
  });

  it.each([
    ['budget below the floor', { budgetMax: 49_999 }],
    ['budget above the ceiling', { budgetMax: 10_000_001 }],
    ['a string budget', { budgetMax: '500000' }],
    ['an unknown body type', { bodyTypes: ['spaceship'] }],
    ['an unknown fuel', { fuelTypes: ['steam'] }],
    ['an unknown transmission', { transmissions: ['tiptronic'] }],
    ['more than 5 body types', { bodyTypes: Array.from({ length: 6 }, () => 'suv') }],
    ['an over-long make', { make: 'x'.repeat(61) }],
    ['an over-long model', { model: 'x'.repeat(61) }],
    ['a bad reference id', { referenceVehicleId: 'nope' }],
    ['a bad make id', { makeId: 'nope' }],
    ['a bad model id', { modelId: 'nope' }],
    ['a bad variant id', { variantId: 'nope' }],
    ['a short name', { fullName: 'A' }],
    ['a markup name', { fullName: '<script>' }],
  ])('rejects %s', (_label, extra) => {
    expect(submitPreferenceBodySchema.safeParse({ ...base, ...extra }).success).toBe(false);
  });
});

const MAKE_ID = '44444444-4444-4444-8444-444444444444';
const MODEL_ID = '55555555-5555-4555-8555-555555555555';
const VARIANT_ID = '66666666-6666-4666-8666-666666666666';

describe('SubmitPreferenceUseCase', () => {
  it('normalises name and phone and passes preferences to the intake', async () => {
    const intake = new FakePreferenceIntake();
    const useCase = new SubmitPreferenceUseCase(intake, new FakeTouchClassifier());

    const receipt = await useCase.execute({
      fullName: '  Asha   Rao ',
      phone: '98765 43210',
      ipHash: 'hash',
      budgetMax: 900_000,
      bodyTypes: ['suv'],
      make: '  ',
      model: 'Creta',
    });

    expect(intake.submitted[0]).toEqual({
      fullName: 'Asha Rao',
      phone: '+919876543210',
      ipHash: 'hash',
      attribution: null,
      budgetMax: 900_000,
      bodyTypes: ['suv'],
      fuelTypes: [],
      transmissions: [],
      make: null,
      model: 'Creta',
      makeId: null,
      modelId: null,
      variantId: null,
      referenceVehicleId: null,
    });
    expect(receipt.outcome).toBe('created');
    expect(receipt.showroom?.address).toBe('100 Feet Road');
  });

  it('passes catalog picks through to the intake', async () => {
    const intake = new FakePreferenceIntake();
    const useCase = new SubmitPreferenceUseCase(intake, new FakeTouchClassifier());

    await useCase.execute({
      ...base,
      ipHash: 'h',
      makeId: MAKE_ID,
      modelId: MODEL_ID,
      variantId: VARIANT_ID,
    });

    expect(intake.submitted[0]).toMatchObject({
      makeId: MAKE_ID,
      modelId: MODEL_ID,
      variantId: VARIANT_ID,
    });
  });

  it('classifies both touches', async () => {
    const intake = new FakePreferenceIntake();
    const classifier = new FakeTouchClassifier();
    const useCase = new SubmitPreferenceUseCase(intake, classifier);

    await useCase.execute({
      ...base,
      ipHash: 'h',
      attribution: {
        visitorId: VISITOR_ID,
        sessionId: SESSION_ID,
        firstTouch: visitorTouch(),
        lastTouch: visitorTouch({ utmSource: 'instagram' }),
      },
    });

    expect(classifier.classified).toHaveLength(2);
    expect(intake.submitted[0]?.attribution?.lastTouch.channel).toBe('instagram_ads');
  });

  it('rejects a number that is not an Indian mobile', async () => {
    const intake = new FakePreferenceIntake();
    const useCase = new SubmitPreferenceUseCase(intake, new FakeTouchClassifier());

    await expect(
      useCase.execute({ fullName: 'Asha', phone: '1234567890', ipHash: 'h' }),
    ).rejects.toBeInstanceOf(InvalidMobileError);
    expect(intake.submitted).toEqual([]);
  });

  it('reports a merge into an existing lead as updated', async () => {
    const useCase = new SubmitPreferenceUseCase(
      new FakePreferenceIntake({ outcome: 'updated' }),
      new FakeTouchClassifier(),
    );

    await expect(useCase.execute({ ...base, ipHash: 'h' })).resolves.toMatchObject({
      outcome: 'updated',
    });
  });
});

describe('POST /public/preference-requests', () => {
  const silent = {
    warn: () => {},
    error: () => {},
    info: () => {},
    debug: () => {},
  } as unknown as Logger;
  const mapper: ErrorMapper = (error) =>
    error instanceof PublicRateLimitedError
      ? { status: 429, code: error.code, message: error.message }
      : error instanceof InvalidMobileError
        ? { status: 422, code: error.code, message: error.message }
        : null;

  function app(intake = new FakePreferenceIntake(), testDrive = new FakeTestDriveIntake()) {
    const queries = new FakePublicVehicleQueries();
    const signer = new FakeSigner();
    const server = express();
    server.use(
      '/public',
      createMarketplaceRouter({
        allowedOrigins: [SITE],
        publicVehiclesController: new PublicVehiclesController(
          new ListPublicVehiclesUseCase(queries, signer),
          new GetPublicVehicleUseCase(queries, signer),
          new GetPublicFilterOptionsUseCase(queries),
        ),
        publicCatalogController: new PublicCatalogController(
          new GetPublicCatalogUseCase(new FakePublicCatalogQueries()),
        ),
        submitTestDriveController: new SubmitTestDriveController(
          new SubmitTestDriveUseCase(
            testDrive,
            new FakeVehicleLinkSync(),
            new FakeTouchClassifier(),
          ),
          'test-key',
        ),
        submitPreferenceController: new SubmitPreferenceController(
          new SubmitPreferenceUseCase(intake, new FakeTouchClassifier()),
          'test-key',
        ),
      }),
    );
    server.use(createErrorHandlerMiddleware(silent, [mapper]));
    return server;
  }

  it('answers 201 with the showroom and hashes the IP', async () => {
    const intake = new FakePreferenceIntake();
    const response = await supertest(app(intake))
      .post('/public/preference-requests')
      .set('Origin', SITE)
      .send({ ...base, budgetMax: 800_000, fuelTypes: ['diesel'] });

    expect(response.status).toBe(201);
    expect(response.headers['access-control-allow-origin']).toBe(SITE);
    expect(response.body).toEqual({ showroom: expect.objectContaining({ city: 'Bengaluru' }) });
    expect(intake.submitted[0]).toMatchObject({ budgetMax: 800_000, fuelTypes: ['diesel'] });
    expect(intake.submitted[0]?.ipHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('answers a merge exactly like a new lead, without the lead id', async () => {
    const response = await supertest(app(new FakePreferenceIntake({ outcome: 'updated' })))
      .post('/public/preference-requests')
      .send(base);

    expect(response.status).toBe(201);
    expect(response.body).not.toHaveProperty('outcome');
    expect(response.body).not.toHaveProperty('leadId');
  });

  it('rejects make/model text with markup or control characters', async () => {
    for (const make of ['<script>', 'Honda\nCity']) {
      const response = await supertest(app(new FakePreferenceIntake()))
        .post('/public/preference-requests')
        .send({ ...base, make });
      expect(response.status).toBe(422);
    }
  });

  it('answers a filled honeypot like a success and records nothing', async () => {
    const intake = new FakePreferenceIntake();
    const response = await supertest(app(intake))
      .post('/public/preference-requests')
      .send({ ...base, fax: 'http://spam.test' });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ showroom: null });
    expect(intake.submitted).toEqual([]);
  });

  it('answers 429 when rate limited', async () => {
    const intake = new FakePreferenceIntake();
    intake.rateLimited = true;
    const response = await supertest(app(intake)).post('/public/preference-requests').send(base);

    expect(response.status).toBe(429);
    expect(response.body).toMatchObject({ error: { code: 'RATE_LIMITED' } });
  });

  it.each([
    [{ ...base, phone: '12345 67890' }, 'INVALID_PHONE'],
    [{ ...base, budgetMax: 10 }, 'VALIDATION_ERROR'],
    [{ ...base, bodyTypes: ['boat'] }, 'VALIDATION_ERROR'],
  ])('rejects %o with %s', async (payload, code) => {
    const response = await supertest(app()).post('/public/preference-requests').send(payload);

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe(code);
  });

  it('rejects an oversized body', async () => {
    const response = await supertest(app())
      .post('/public/preference-requests')
      .send({ ...base, fax: 'x'.repeat(20_000) });

    expect(response.status).toBe(413);
  });

  it('keeps answering vehicleAvailable false on a test drive for a sold car', async () => {
    const testDrive = new FakeTestDriveIntake({ vehicleAvailable: false, linkedVehicleId: null });
    const response = await supertest(app(new FakePreferenceIntake(), testDrive))
      .post('/public/test-drive-requests')
      .send({ ...base, vehicleId: VEHICLE_ID });

    expect(response.status).toBe(201);
    expect(response.body.vehicleAvailable).toBe(false);
  });
});
