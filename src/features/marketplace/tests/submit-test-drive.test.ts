import express from 'express';
import supertest from 'supertest';
import { describe, expect, it } from 'vitest';

import { createErrorHandlerMiddleware } from '../../../presentation/http/errors/error-handler.middleware';
import type { ErrorMapper } from '../../../presentation/http/errors/error-mapping';
import type { Logger } from '../../../shared/logging/logger.port';
import { GetPublicFilterOptionsUseCase } from '../application/use-cases/get-public-filter-options.use-case';
import { GetPublicVehicleUseCase } from '../application/use-cases/get-public-vehicle.use-case';
import { ListPublicVehiclesUseCase } from '../application/use-cases/list-public-vehicles.use-case';
import { SubmitTestDriveUseCase } from '../application/use-cases/submit-test-drive.use-case';
import { InvalidMobileError } from '../domain/errors/invalid-mobile.error';
import { PublicRateLimitedError } from '../domain/errors/public-rate-limited.error';
import { WEBSITE_SYSTEM_USER_ID } from '../domain/test-drive-intake.port';
import { PublicVehiclesController } from '../presentation/controllers/public-vehicles.controller';
import { SubmitTestDriveController } from '../presentation/controllers/submit-test-drive.controller';
import { createMarketplaceRouter } from '../presentation/marketplace.routes';
import {
  FakePublicVehicleQueries,
  FakeSigner,
  FakeTestDriveIntake,
  FakeTouchClassifier,
  FakeVehicleLinkSync,
  VEHICLE_ID,
  VISITOR_ID,
  SESSION_ID,
  visitorTouch,
} from './fakes';

const SITE = 'https://wheelsexperts.in';

describe('SubmitTestDriveUseCase', () => {
  it('normalises the phone and links the vehicle as the website user', async () => {
    const intake = new FakeTestDriveIntake();
    const linkSync = new FakeVehicleLinkSync();
    const useCase = new SubmitTestDriveUseCase(intake, linkSync, new FakeTouchClassifier());

    const receipt = await useCase.execute({
      vehicleId: VEHICLE_ID,
      fullName: '  Asha   Rao ',
      phone: '98765 43210',
      ipHash: 'hash',
    });

    expect(intake.submitted[0]).toMatchObject({ fullName: 'Asha Rao', phone: '+919876543210' });
    expect(linkSync.calls).toEqual([{ vehicleId: VEHICLE_ID, actorId: WEBSITE_SYSTEM_USER_ID }]);
    expect(receipt).toMatchObject({ outcome: 'created', vehicleAvailable: true });
    expect(receipt.showroom?.address).toBe('100 Feet Road');
  });

  it('does not touch the vehicle when an existing lead was updated', async () => {
    const linkSync = new FakeVehicleLinkSync();
    const useCase = new SubmitTestDriveUseCase(
      new FakeTestDriveIntake({ outcome: 'updated' }),
      linkSync,
      new FakeTouchClassifier(),
    );

    const receipt = await useCase.execute({
      vehicleId: VEHICLE_ID,
      fullName: 'Asha',
      phone: '9876543210',
      ipHash: 'hash',
    });

    expect(receipt.outcome).toBe('updated');
    expect(linkSync.calls).toEqual([]);
  });

  it('still returns the location when the car sold in the meantime', async () => {
    const linkSync = new FakeVehicleLinkSync();
    const useCase = new SubmitTestDriveUseCase(
      new FakeTestDriveIntake({ vehicleAvailable: false, linkedVehicleId: null }),
      linkSync,
      new FakeTouchClassifier(),
    );

    const receipt = await useCase.execute({
      vehicleId: VEHICLE_ID,
      fullName: 'Asha',
      phone: '9876543210',
      ipHash: 'hash',
    });

    expect(receipt.vehicleAvailable).toBe(false);
    expect(receipt.showroom).not.toBeNull();
    expect(linkSync.calls).toEqual([]);
  });

  it('classifies both touches and passes the attribution to the intake', async () => {
    const intake = new FakeTestDriveIntake();
    const classifier = new FakeTouchClassifier();
    const useCase = new SubmitTestDriveUseCase(intake, new FakeVehicleLinkSync(), classifier);

    await useCase.execute({
      vehicleId: VEHICLE_ID,
      fullName: 'Asha',
      phone: '9876543210',
      ipHash: 'hash',
      attribution: {
        visitorId: VISITOR_ID,
        sessionId: SESSION_ID,
        firstTouch: visitorTouch({ referrer: 'https://www.google.com' }),
        lastTouch: visitorTouch({
          utmSource: 'instagram',
          utmMedium: 'paid_social',
          utmCampaign: 'diwali',
          utmContent: 'creta-reel',
        }),
      },
    });

    expect(classifier.classified).toHaveLength(2);
    expect(intake.submitted[0]?.attribution).toEqual({
      visitorId: VISITOR_ID,
      sessionId: SESSION_ID,
      firstTouch: {
        channel: 'google_organic',
        utmSource: null,
        utmMedium: null,
        utmCampaign: null,
        utmContent: null,
        utmTerm: null,
        referrerHost: 'google.com',
        landingPath: '/cars/x',
      },
      lastTouch: {
        channel: 'instagram_ads',
        utmSource: 'instagram',
        utmMedium: 'paid_social',
        utmCampaign: 'diwali',
        utmContent: 'creta-reel',
        utmTerm: null,
        referrerHost: null,
        landingPath: '/cars/x',
      },
    });
  });

  it('passes no attribution when an older client omits it', async () => {
    const intake = new FakeTestDriveIntake();
    const classifier = new FakeTouchClassifier();
    const useCase = new SubmitTestDriveUseCase(intake, new FakeVehicleLinkSync(), classifier);

    await useCase.execute({
      vehicleId: VEHICLE_ID,
      fullName: 'Asha',
      phone: '9876543210',
      ipHash: 'h',
    });

    expect(intake.submitted[0]?.attribution).toBeNull();
    expect(classifier.classified).toEqual([]);
  });

  it('rejects a number that is not an Indian mobile', async () => {
    const intake = new FakeTestDriveIntake();
    const useCase = new SubmitTestDriveUseCase(
      intake,
      new FakeVehicleLinkSync(),
      new FakeTouchClassifier(),
    );

    await expect(
      useCase.execute({
        vehicleId: VEHICLE_ID,
        fullName: 'Asha',
        phone: '1234567890',
        ipHash: 'h',
      }),
    ).rejects.toBeInstanceOf(InvalidMobileError);
    expect(intake.submitted).toEqual([]);
  });
});

describe('marketplace routes', () => {
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

  function app(intake = new FakeTestDriveIntake()) {
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
        submitTestDriveController: new SubmitTestDriveController(
          new SubmitTestDriveUseCase(intake, new FakeVehicleLinkSync(), new FakeTouchClassifier()),
          'test-key',
        ),
      }),
    );
    server.use(createErrorHandlerMiddleware(silent, [mapper]));
    return server;
  }

  const body = { vehicleId: VEHICLE_ID, fullName: 'Asha Rao', phone: '9876543210' };

  it('lists vehicles without a token and allows only the site origin', async () => {
    const allowed = await supertest(app()).get('/public/vehicles').set('Origin', SITE);
    const other = await supertest(app()).get('/public/vehicles').set('Origin', 'https://evil.test');

    expect(allowed.status).toBe(200);
    expect(allowed.headers['access-control-allow-origin']).toBe(SITE);
    expect(allowed.headers['cache-control']).toContain('s-maxage');
    expect(other.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('creates a lead and returns the showroom location', async () => {
    const intake = new FakeTestDriveIntake();
    const response = await supertest(app(intake)).post('/public/test-drive-requests').send(body);

    expect(response.status).toBe(201);
    expect(response.body.showroom.address).toBe('100 Feet Road');
    expect(intake.submitted[0]?.ipHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('accepts attribution from the site and rejects a malformed one', async () => {
    const intake = new FakeTestDriveIntake();
    const attribution = {
      visitorId: VISITOR_ID,
      sessionId: SESSION_ID,
      firstTouch: visitorTouch(),
      lastTouch: visitorTouch({ utmSource: 'instagram', utmMedium: 'paid_social' }),
    };

    const ok = await supertest(app(intake))
      .post('/public/test-drive-requests')
      .send({ ...body, attribution });
    const bad = await supertest(app())
      .post('/public/test-drive-requests')
      .send({ ...body, attribution: { ...attribution, visitorId: 'nope' } });

    expect(ok.status).toBe(201);
    expect(intake.submitted[0]?.attribution?.lastTouch.channel).toBe('instagram_ads');
    expect(bad.status).toBe(422);
  });

  it('answers a filled honeypot like a success and records nothing', async () => {
    const intake = new FakeTestDriveIntake();
    const response = await supertest(app(intake))
      .post('/public/test-drive-requests')
      .send({ ...body, fax: 'http://spam.test' });

    expect(response.status).toBe(201);
    expect(response.body.showroom).toBeNull();
    expect(intake.submitted).toEqual([]);
  });

  it('answers 429 when the intake is rate limited', async () => {
    const intake = new FakeTestDriveIntake();
    intake.rateLimited = true;
    const response = await supertest(app(intake)).post('/public/test-drive-requests').send(body);

    expect(response.status).toBe(429);
    expect(response.body).toMatchObject({ error: { code: 'RATE_LIMITED' } });
  });

  it.each([
    [{ ...body, phone: '12345 67890' }, 'INVALID_PHONE'],
    [{ ...body, fullName: 'A' }, 'VALIDATION_ERROR'],
    [{ ...body, fullName: '<script>' }, 'VALIDATION_ERROR'],
    [{ ...body, vehicleId: 'nope' }, 'VALIDATION_ERROR'],
  ])('rejects %o with %s', async (payload, code) => {
    const response = await supertest(app()).post('/public/test-drive-requests').send(payload);

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe(code);
  });

  it('rejects an oversized body', async () => {
    const response = await supertest(app())
      .post('/public/test-drive-requests')
      .send({ ...body, fax: 'x'.repeat(20_000) });

    expect(response.status).toBe(413);
  });
});
