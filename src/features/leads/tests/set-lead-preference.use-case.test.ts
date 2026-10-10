import { beforeEach, describe, expect, it } from 'vitest';

import { NotFoundError } from '../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../domain/shared/auth-context';
import { toLeadId } from '../../../domain/shared/lead-id';
import { toShowroomId } from '../../../domain/shared/showroom-id';
import { type UserId, toUserId } from '../../../domain/shared/user-id';
import { LeadManagementPolicy } from '../application/policies/lead-management.policy';
import { SetLeadPreferenceUseCase } from '../application/use-cases/set-lead-preference.use-case';
import { toContactId } from '../domain/contact-id';
import { Lead } from '../domain/lead.entity';
import { LeadSource } from '../domain/lead-source.value-object';
import { LeadStatus } from '../domain/lead-status.value-object';
import { LeadPreference } from '../domain/lead-preference.value-object';
import { PreferredCatalog } from '../domain/preferred-catalog.value-object';
import {
  EMPTY_PREFERENCE_EXTRAS,
  FakeCatalogLineage,
  FakeClock,
  FakeLeadRepository,
} from './fakes';

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
const MAKE_ID = 'c0000000-0000-4000-8000-000000000001';
const MODEL_ID = 'c0000000-0000-4000-8000-000000000002';
const VARIANT_ID = 'c0000000-0000-4000-8000-000000000003';
const CREATED = new Date('2026-10-03T00:00:00.000Z');
const NOW = new Date('2026-10-06T00:00:00.000Z');

function seedLead(
  repo: FakeLeadRepository,
  options: {
    assignedTo?: UserId | null;
    status?: string;
    preferredCatalog?: PreferredCatalog;
  } = {},
): void {
  repo.seedLead(
    Lead.reconstitute({
      id: toLeadId(LEAD_ID),
      showroomId: toShowroomId('b0000000-0000-4000-8000-000000000001'),
      contactId: toContactId('66666666-6666-4666-8666-666666666666'),
      vehicleId: null,
      assignedTo: options.assignedTo ?? null,
      source: LeadSource.create('walkin'),
      status: LeadStatus.create(options.status ?? 'new'),
      budget: null,
      preferredVehicle: null,
      preference: LeadPreference.none().withCatalog(
        options.preferredCatalog ?? PreferredCatalog.none(),
      ),
      purchaseTimeline: null,
      financeRequired: null,
      currentVehicle: null,
      tradeInRequired: null,
      notes: null,
      createdBy: ADMIN.userId,
      createdAt: CREATED,
      updatedAt: CREATED,
      deletedAt: null,
    }),
  );
}

const NO_PREFERENCE = {
  preferredMakeId: null,
  preferredModelId: null,
  preferredVariantId: null,
  ...EMPTY_PREFERENCE_EXTRAS,
};

describe('SetLeadPreferenceUseCase', () => {
  let useCase: SetLeadPreferenceUseCase;
  let repo: FakeLeadRepository;

  beforeEach(() => {
    repo = new FakeLeadRepository();
    const catalog = new FakeCatalogLineage();
    catalog.seed(MAKE_ID, MODEL_ID, VARIANT_ID);
    useCase = new SetLeadPreferenceUseCase(
      new LeadManagementPolicy(),
      repo,
      catalog,
      new FakeClock(NOW),
    );
  });

  it('sets a model preference and fills in its make', async () => {
    seedLead(repo);

    const result = await useCase.execute(
      { leadId: LEAD_ID, ...NO_PREFERENCE, preferredModelId: MODEL_ID },
      ADMIN,
    );

    expect(result).toEqual({
      ...NO_PREFERENCE,
      preferredMakeId: MAKE_ID,
      preferredModelId: MODEL_ID,
    });
    const saved = repo.leads.get(LEAD_ID);
    expect(saved?.preferredCatalog.makeId).toBe(MAKE_ID);
    expect(saved?.updatedAt).toEqual(NOW);
  });

  it('clears the preference when every id is null', async () => {
    seedLead(repo, {
      preferredCatalog: PreferredCatalog.create({
        makeId: MAKE_ID,
        modelId: MODEL_ID,
        variantId: VARIANT_ID,
      }),
    });

    const result = await useCase.execute({ leadId: LEAD_ID, ...NO_PREFERENCE }, ADMIN);

    expect(result).toEqual(NO_PREFERENCE);
    expect(repo.leads.get(LEAD_ID)?.preferredCatalog.isEmpty).toBe(true);
  });

  it('lets the assigned salesperson change it', async () => {
    seedLead(repo, { assignedTo: SALES.userId });
    await expect(
      useCase.execute({ leadId: LEAD_ID, ...NO_PREFERENCE, preferredMakeId: MAKE_ID }, SALES),
    ).resolves.toMatchObject({ preferredMakeId: MAKE_ID });
  });

  it("hides another salesperson's lead", async () => {
    seedLead(repo, { assignedTo: ADMIN.userId });
    await expect(
      useCase.execute({ leadId: LEAD_ID, ...NO_PREFERENCE, preferredMakeId: MAKE_ID }, SALES),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('rejects a closed lead', async () => {
    seedLead(repo, { status: 'lost' });
    await expect(
      useCase.execute({ leadId: LEAD_ID, ...NO_PREFERENCE, preferredMakeId: MAKE_ID }, ADMIN),
    ).rejects.toMatchObject({ code: 'LEAD_CLOSED' });
  });

  it('rejects an unknown make', async () => {
    seedLead(repo);
    await expect(
      useCase.execute(
        {
          leadId: LEAD_ID,
          ...NO_PREFERENCE,
          preferredMakeId: 'c0000000-0000-4000-8000-0000000000aa',
        },
        ADMIN,
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(repo.writes).toHaveLength(0);
  });

  it('rejects a missing lead', async () => {
    await expect(
      useCase.execute({ leadId: LEAD_ID, ...NO_PREFERENCE }, ADMIN),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('stores the whole preference profile and replaces it wholesale', async () => {
    seedLead(repo);

    const result = await useCase.execute(
      {
        leadId: LEAD_ID,
        ...NO_PREFERENCE,
        preferredModelId: MODEL_ID,
        preferredColours: ['White', 'silver'],
        preferredFuelTypes: ['petrol'],
        preferredTransmissions: ['amt', 'manual'],
        preferredBodyTypes: ['hatchback'],
        preferredYearMin: 2018,
        preferredYearMax: 2022,
        preferredKmMax: 60000,
        preferredMaxOwners: 1,
      },
      ADMIN,
    );

    expect(result).toMatchObject({
      preferredMakeId: MAKE_ID,
      preferredColours: ['white', 'silver'],
      preferredTransmissions: ['amt', 'manual'],
      preferredYearMin: 2018,
      preferredKmMax: 60000,
    });
    expect(repo.leads.get(LEAD_ID)?.preference.maxOwners).toBe(1);

    await useCase.execute({ leadId: LEAD_ID, ...NO_PREFERENCE, preferredKmMax: 30000 }, ADMIN);
    const replaced = repo.leads.get(LEAD_ID)?.preference;
    expect(replaced?.kmMax).toBe(30000);
    expect(replaced?.colours).toEqual([]);
    expect(replaced?.catalog.isEmpty).toBe(true);
  });
});
