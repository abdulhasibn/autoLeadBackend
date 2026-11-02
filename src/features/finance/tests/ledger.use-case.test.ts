import { beforeEach, describe, expect, it } from 'vitest';

import { BusinessRuleViolationError } from '../../../domain/errors/business-rule-violation.error';
import { ForbiddenActionError } from '../../../domain/errors/forbidden-action.error';
import { NotFoundError } from '../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../domain/shared/auth-context';
import type { CreateFinanceEntryCommand } from '../application/dtos/create-finance-entry-command';
import type { ListFinanceEntriesQuery } from '../application/dtos/list-finance-entries-query';
import { FinanceLockedError } from '../application/errors/finance-locked.error';
import { FinanceTagNameTakenError } from '../application/errors/finance-tag-name-taken.error';
import { ConfirmVaultUseCase } from '../application/use-cases/confirm-vault.use-case';
import { CreateFinanceEntryUseCase } from '../application/use-cases/create-finance-entry.use-case';
import { CreateFinanceTagUseCase } from '../application/use-cases/create-finance-tag.use-case';
import { DeleteFinanceEntryUseCase } from '../application/use-cases/delete-finance-entry.use-case';
import { GetFinanceEntryUseCase } from '../application/use-cases/get-finance-entry.use-case';
import { ListFinanceEntriesUseCase } from '../application/use-cases/list-finance-entries.use-case';
import { ListFinanceTagsUseCase } from '../application/use-cases/list-finance-tags.use-case';
import { SetupVaultUseCase } from '../application/use-cases/setup-vault.use-case';
import { UnlockVaultUseCase } from '../application/use-cases/unlock-vault.use-case';
import { UpdateFinanceEntryUseCase } from '../application/use-cases/update-finance-entry.use-case';
import { UpdateFinanceTagUseCase } from '../application/use-cases/update-finance-tag.use-case';
import { DEFAULT_FINANCE_TAGS } from '../domain/default-finance-tags';
import { MAX_LEDGER_ROWS } from '../domain/finance.constants';
import {
  ADMIN,
  CRETA,
  DELETED_CAR,
  SALESPERSON,
  SHOWROOM_A,
  SHOWROOM_B,
  SWIFT,
  TEST_KDF,
  createFinanceTestKit,
  type FinanceTestKit,
} from './fakes';

const ADMIN_IN_A: AuthenticatedContext = { ...ADMIN, showroomId: SHOWROOM_A };

describe('finance ledger', () => {
  let kit: FinanceTestKit;
  let token: string;
  let tagIds: Record<string, string>;
  let createEntry: CreateFinanceEntryUseCase;
  let updateEntry: UpdateFinanceEntryUseCase;
  let deleteEntry: DeleteFinanceEntryUseCase;
  let getEntry: GetFinanceEntryUseCase;
  let listEntries: ListFinanceEntriesUseCase;
  let listTags: ListFinanceTagsUseCase;
  let createTag: CreateFinanceTagUseCase;
  let updateTag: UpdateFinanceTagUseCase;
  let unlock: UnlockVaultUseCase;
  let financeKey: string;

  beforeEach(async () => {
    kit = createFinanceTestKit();
    const k = kit;
    const setup = new SetupVaultUseCase(
      k.policy,
      k.vaults,
      k.keyring,
      k.crypto,
      k.audit,
      k.clock,
      k.ids,
      TEST_KDF,
    );
    const confirm = new ConfirmVaultUseCase(k.policy, k.vaults, k.keyring, k.audit, k.clock);
    unlock = new UnlockVaultUseCase(
      k.policy,
      k.vaults,
      k.keyring,
      k.sessionService,
      k.audit,
      k.clock,
      k.tagSeeder,
    );
    createEntry = new CreateFinanceEntryUseCase(
      k.policy,
      k.sessionService,
      k.entries,
      k.tags,
      k.vehicles,
      k.entrySealer,
      k.tagSealer,
      k.clock,
      k.ids,
    );
    updateEntry = new UpdateFinanceEntryUseCase(
      k.policy,
      k.sessionService,
      k.entries,
      k.tags,
      k.vehicles,
      k.entrySealer,
      k.tagSealer,
      k.clock,
    );
    deleteEntry = new DeleteFinanceEntryUseCase(
      k.policy,
      k.sessionService,
      k.entries,
      k.entrySealer,
      k.clock,
    );
    getEntry = new GetFinanceEntryUseCase(
      k.policy,
      k.sessionService,
      k.entries,
      k.tags,
      k.vehicles,
      k.entrySealer,
      k.tagSealer,
    );
    listEntries = new ListFinanceEntriesUseCase(
      k.policy,
      k.sessionService,
      k.entries,
      k.tags,
      k.vehicles,
      k.entrySealer,
      k.tagSealer,
    );
    listTags = new ListFinanceTagsUseCase(k.policy, k.sessionService, k.tags, k.tagSealer);
    createTag = new CreateFinanceTagUseCase(
      k.policy,
      k.sessionService,
      k.tags,
      k.tagSealer,
      k.clock,
      k.ids,
    );
    updateTag = new UpdateFinanceTagUseCase(
      k.policy,
      k.sessionService,
      k.tags,
      k.tagSealer,
      k.clock,
    );

    const keys = await setup.execute(ADMIN);
    await confirm.execute({ recoveryKey: keys.recoveryKey }, ADMIN);
    financeKey = keys.financeKey;
    token = (await unlock.execute({ financeKey }, ADMIN_IN_A)).sessionToken;
    const tags = await listTags.execute({ sessionToken: token, includeArchived: false }, ADMIN);
    tagIds = Object.fromEntries(tags.map((t) => [t.name, t.id]));
  });

  function newEntry(overrides: Partial<CreateFinanceEntryCommand> = {}) {
    return createEntry.execute(
      {
        sessionToken: token,
        kind: 'expense',
        amountPaise: 500_000,
        entryDate: '2026-10-20',
        tagIds: [],
        vehicleId: null,
        purpose: null,
        party: null,
        note: null,
        showroomId: null,
        ...overrides,
      },
      ADMIN_IN_A,
    );
  }

  function list(overrides: Partial<ListFinanceEntriesQuery> = {}) {
    return listEntries.execute(
      {
        sessionToken: token,
        from: '2026-10-01',
        to: '2026-10-31',
        sort: 'date',
        limit: 20,
        offset: 0,
        ...overrides,
      },
      ADMIN,
    );
  }

  describe('tags', () => {
    it('seeds the default tags on first unlock, once', async () => {
      expect(Object.keys(tagIds).sort()).toEqual([...DEFAULT_FINANCE_TAGS].sort());

      await unlock.execute({ financeKey }, ADMIN);

      expect(kit.tags.rows.size).toBe(DEFAULT_FINANCE_TAGS.length);
    });

    it('stores tag names encrypted', () => {
      const stored = JSON.stringify([...kit.tags.rows.values()]);

      expect(stored).not.toContain('Mediator');
      expect(stored).not.toContain('Painting');
    });

    it('creates, renames and recolours tags with unique names', async () => {
      const created = await createTag.execute(
        { sessionToken: token, name: '  RTO   transfer ', color: '#43a047' },
        ADMIN,
      );
      expect(created).toMatchObject({ name: 'RTO transfer', color: '#43A047', archived: false });

      await expect(
        createTag.execute({ sessionToken: token, name: 'rto TRANSFER', color: null }, ADMIN),
      ).rejects.toBeInstanceOf(FinanceTagNameTakenError);
      await expect(
        updateTag.execute({ sessionToken: token, tagId: created.id, name: 'painting' }, ADMIN),
      ).rejects.toBeInstanceOf(FinanceTagNameTakenError);

      const renamed = await updateTag.execute(
        { sessionToken: token, tagId: created.id, name: 'RC transfer', color: null },
        ADMIN,
      );
      expect(renamed).toMatchObject({ name: 'RC transfer', color: null });
    });

    it('hides archived tags unless asked, and keeps their names taken', async () => {
      const food = tagIds['Food'] ?? '';
      await updateTag.execute({ sessionToken: token, tagId: food, archived: true }, ADMIN);

      const active = await listTags.execute({ sessionToken: token, includeArchived: false }, ADMIN);
      const all = await listTags.execute({ sessionToken: token, includeArchived: true }, ADMIN);
      expect(active.map((t) => t.name)).not.toContain('Food');
      expect(all.find((t) => t.name === 'Food')?.archived).toBe(true);
      await expect(
        createTag.execute({ sessionToken: token, name: 'Food', color: null }, ADMIN),
      ).rejects.toBeInstanceOf(FinanceTagNameTakenError);

      await updateTag.execute({ sessionToken: token, tagId: food, archived: false }, ADMIN);
      expect(
        (await listTags.execute({ sessionToken: token, includeArchived: false }, ADMIN)).map(
          (t) => t.name,
        ),
      ).toContain('Food');
    });
  });

  describe('entries', () => {
    it('records a business expense in the home showroom', async () => {
      const entry = await newEntry({ amountPaise: 8_500_000, party: 'Landlord', note: 'Rent' });

      expect(entry).toMatchObject({
        kind: 'expense',
        amount: 85000,
        purpose: 'general',
        vehicle: null,
        showroomId: SHOWROOM_A,
        party: 'Landlord',
      });
    });

    it('needs a showroom for a business entry when the admin has no home showroom', async () => {
      await expect(
        createEntry.execute(
          {
            sessionToken: token,
            kind: 'expense',
            amountPaise: 100,
            entryDate: '2026-10-20',
            tagIds: [],
            vehicleId: null,
            purpose: null,
            party: null,
            note: null,
            showroomId: null,
          },
          ADMIN,
        ),
      ).rejects.toMatchObject({ code: 'SHOWROOM_REQUIRED' });
    });

    it("from a car's screen: car showroom, car label and default purpose", async () => {
      const cost = await newEntry({ vehicleId: CRETA, tagIds: [tagIds['Painting'] ?? ''] });
      const payment = await newEntry({ kind: 'income', vehicleId: CRETA });

      expect(cost).toMatchObject({
        showroomId: SHOWROOM_B,
        purpose: 'cost',
        vehicle: { id: CRETA, label: 'Hyundai Creta · KA05CD5678' },
      });
      expect(cost.tags.map((t) => t.name)).toEqual(['Painting']);
      expect(payment.purpose).toBe('sale');
    });

    it('rejects a missing or deleted car, unknown or archived tags, wrong purposes', async () => {
      await expect(newEntry({ vehicleId: DELETED_CAR })).rejects.toBeInstanceOf(NotFoundError);
      await expect(
        newEntry({ tagIds: ['99999999-9999-4999-8999-999999999999'] }),
      ).rejects.toMatchObject({ code: 'FINANCE_TAG_NOT_FOUND' });
      await updateTag.execute(
        { sessionToken: token, tagId: tagIds['Fuel'] ?? '', archived: true },
        ADMIN,
      );
      await expect(newEntry({ tagIds: [tagIds['Fuel'] ?? ''] })).rejects.toMatchObject({
        code: 'FINANCE_TAG_ARCHIVED',
      });
      await expect(newEntry({ vehicleId: SWIFT, purpose: 'sale' })).rejects.toMatchObject({
        code: 'INVALID_ENTRY_PURPOSE',
      });
      await expect(newEntry({ purpose: 'purchase' })).rejects.toBeInstanceOf(
        BusinessRuleViolationError,
      );
      await expect(newEntry({ vehicleId: SWIFT, showroomId: SHOWROOM_B })).rejects.toMatchObject({
        code: 'ENTRY_SHOWROOM_FOLLOWS_VEHICLE',
      });
    });

    it('keeps a tag archived after it was added', async () => {
      const fuel = tagIds['Fuel'] ?? '';
      const created = await newEntry({ tagIds: [fuel] });
      await updateTag.execute({ sessionToken: token, tagId: fuel, archived: true }, ADMIN);

      const updated = await updateEntry.execute(
        { sessionToken: token, entryId: created.id, tagIds: [fuel], note: 'diesel' },
        ADMIN,
      );

      expect(updated.tags).toMatchObject([{ name: 'Fuel', archived: true }]);
    });

    it('links, moves and unlinks an entry; purpose follows unless sent', async () => {
      const created = await newEntry();

      const linked = await updateEntry.execute(
        { sessionToken: token, entryId: created.id, vehicleId: SWIFT, purpose: 'purchase' },
        ADMIN,
      );
      expect(linked).toMatchObject({ purpose: 'purchase', showroomId: SHOWROOM_A });

      const moved = await updateEntry.execute(
        { sessionToken: token, entryId: created.id, vehicleId: CRETA },
        ADMIN,
      );
      expect(moved).toMatchObject({
        purpose: 'cost',
        showroomId: SHOWROOM_B,
        vehicle: { id: CRETA },
      });

      const unlinked = await updateEntry.execute(
        { sessionToken: token, entryId: created.id, vehicleId: null, showroomId: SHOWROOM_A },
        ADMIN,
      );
      expect(unlinked).toMatchObject({ purpose: 'general', vehicle: null, showroomId: SHOWROOM_A });

      await expect(
        updateEntry.execute(
          { sessionToken: token, entryId: created.id, vehicleId: null, purpose: 'cost' },
          ADMIN,
        ),
      ).rejects.toMatchObject({ code: 'INVALID_ENTRY_PURPOSE' });
    });

    it('edits amount, date and text', async () => {
      const created = await newEntry({ note: 'old' });

      const updated = await updateEntry.execute(
        {
          sessionToken: token,
          entryId: created.id,
          amountPaise: 123_450,
          entryDate: '2026-10-25',
          note: null,
          party: 'Sharma Motors',
        },
        ADMIN,
      );

      expect(updated).toMatchObject({
        amount: 1234.5,
        entryDate: '2026-10-25',
        note: null,
        party: 'Sharma Motors',
      });
    });

    it('soft deletes an entry', async () => {
      const created = await newEntry();

      await deleteEntry.execute({ sessionToken: token, entryId: created.id }, ADMIN);

      await expect(
        getEntry.execute({ sessionToken: token, entryId: created.id }, ADMIN),
      ).rejects.toBeInstanceOf(NotFoundError);
      expect(kit.entries.rows.get(created.id)?.deletedAt).not.toBeNull();
      expect((await list()).total).toBe(0);
    });

    it('is locked without a session and admin-only', async () => {
      await expect(
        listTags.execute({ sessionToken: null, includeArchived: false }, ADMIN),
      ).rejects.toBeInstanceOf(FinanceLockedError);
      await expect(list({ sessionToken: null })).rejects.toBeInstanceOf(FinanceLockedError);
      await expect(
        listTags.execute({ sessionToken: token, includeArchived: false }, SALESPERSON),
      ).rejects.toBeInstanceOf(ForbiddenActionError);
      await expect(
        listEntries.execute(
          {
            sessionToken: token,
            from: '2026-10-01',
            to: '2026-10-31',
            sort: 'date',
            limit: 20,
            offset: 0,
          },
          SALESPERSON,
        ),
      ).rejects.toBeInstanceOf(ForbiddenActionError);
    });
  });

  describe('list', () => {
    it('needs a date range of at most 366 days unless scoped to a car', async () => {
      await expect(list({ from: undefined, to: undefined })).rejects.toMatchObject({
        code: 'DATE_RANGE_REQUIRED',
      });
      await expect(list({ from: '2025-01-01', to: '2026-01-02' })).rejects.toMatchObject({
        code: 'DATE_RANGE_TOO_LONG',
      });
      await expect(list({ from: '2026-10-31', to: '2026-10-01' })).rejects.toMatchObject({
        code: 'INVALID_DATE_RANGE',
      });
      await newEntry({ vehicleId: SWIFT, entryDate: '2024-01-01' });

      const car = await list({ from: undefined, to: undefined, vehicleId: SWIFT });

      expect(car.total).toBe(1);
    });

    it('filters by date, kind, car, tags, purpose, amount and text; totals the filtered set', async () => {
      const painting = tagIds['Painting'] ?? '';
      await newEntry({
        amountPaise: 500_000,
        vehicleId: SWIFT,
        tagIds: [painting],
        party: 'Ace Paints',
      });
      await newEntry({ amountPaise: 1_000_000, vehicleId: SWIFT, purpose: 'purchase' });
      await newEntry({ kind: 'income', amountPaise: 5_000_000, vehicleId: SWIFT });
      await newEntry({ amountPaise: 300_000, note: 'Electricity bill' });
      await newEntry({ amountPaise: 999_900, entryDate: '2026-09-30' });

      expect((await list()).total).toBe(4);
      expect((await list({ kind: 'income' })).total).toBe(1);
      expect((await list({ unlinked: true })).total).toBe(1);
      expect((await list({ tagIds: [painting] })).items.map((e) => e.party)).toEqual([
        'Ace Paints',
      ]);
      expect((await list({ purposes: ['purchase'] })).items[0]?.amount).toBe(10000);
      expect((await list({ minAmountPaise: 400_000, maxAmountPaise: 1_000_000 })).total).toBe(2);
      expect((await list({ search: 'painting' })).total).toBe(1);
      expect((await list({ search: 'ELECTRICITY' })).total).toBe(1);

      const car = await list({ vehicleId: SWIFT });
      expect(car.totals).toEqual({ income: 50000, expense: 15000, net: 35000 });
    });

    it('sorts and pages, with totals and total over every match', async () => {
      await newEntry({ amountPaise: 100, entryDate: '2026-10-05' });
      await newEntry({ amountPaise: 300, entryDate: '2026-10-01' });
      await newEntry({ amountPaise: 200, entryDate: '2026-10-09' });

      expect((await list()).items.map((e) => e.entryDate)).toEqual([
        '2026-10-09',
        '2026-10-05',
        '2026-10-01',
      ]);
      expect((await list({ sort: '-date' })).items[0]?.entryDate).toBe('2026-10-01');
      expect((await list({ sort: 'amount' })).items.map((e) => e.amount)).toEqual([3, 2, 1]);
      const page = await list({ sort: '-amount', limit: 2, offset: 1 });
      expect(page.items.map((e) => e.amount)).toEqual([2, 3]);
      expect(page.total).toBe(3);
      expect(page.totals.expense).toBe(6);
    });

    it('says truncated when more rows matched than one read loads', async () => {
      const seeded = await newEntry();
      const template = kit.entries.rows.get(seeded.id);
      if (template === undefined) {
        throw new Error('seed entry missing');
      }
      // Copies keep the original id so they decrypt; only the store key differs.
      for (let i = 0; i < MAX_LEDGER_ROWS; i++) {
        kit.entries.rows.set(`copy-${i}`, template);
      }

      const page = await list();

      expect(page.truncated).toBe(true);
      expect(page.total).toBe(MAX_LEDGER_ROWS);
    });
  });

  it("handles the client's worked example on one car", async () => {
    const t = (name: string) => [tagIds[name] ?? ''];
    const car = { vehicleId: SWIFT };
    await newEntry({ ...car, amountPaise: 20_000_000, purpose: 'purchase', tagIds: t('Purchase') });
    await newEntry({ ...car, amountPaise: 30_000_000, purpose: 'purchase', tagIds: t('Purchase') });
    await newEntry({ ...car, amountPaise: 1_000_000, tagIds: t('Mediator commission') });
    await newEntry({ ...car, amountPaise: 500_000, tagIds: t('Painting') });
    await newEntry({ ...car, amountPaise: 500_000, tagIds: t('Service') });
    await newEntry({ ...car, amountPaise: 500_000, tagIds: t('Rubbing polish') });
    await newEntry({ ...car, amountPaise: 1_500_000, tagIds: [...t('Insurance'), ...t('Tyres')] });
    await newEntry({ ...car, amountPaise: 500_000, tagIds: [...t('Travel'), ...t('Fuel')] });
    await newEntry({ ...car, kind: 'income', amountPaise: 5_000_000, note: 'Token' });
    await newEntry({ ...car, kind: 'income', amountPaise: 51_000_000, note: 'Balance' });

    const all = await list({ from: undefined, to: undefined, vehicleId: SWIFT, limit: 100 });
    const costs = await list({
      from: undefined,
      to: undefined,
      vehicleId: SWIFT,
      purposes: ['cost'],
    });

    expect(all.totals).toEqual({ income: 560000, expense: 545000, net: 15000 });
    expect(costs.totals.expense).toBe(45000);
  });
});
