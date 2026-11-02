import { beforeEach, describe, expect, it } from 'vitest';

import { ForbiddenActionError } from '../../../domain/errors/forbidden-action.error';
import { FinanceAlreadyInitializedError } from '../application/errors/finance-already-initialized.error';
import { FinanceLockedError } from '../application/errors/finance-locked.error';
import { FinanceNotInitializedError } from '../application/errors/finance-not-initialized.error';
import { FinanceUnlockBlockedError } from '../application/errors/finance-unlock-blocked.error';
import { FinanceVaultNotConfirmedError } from '../application/errors/finance-vault-not-confirmed.error';
import { InvalidFinanceKeyError } from '../application/errors/invalid-finance-key.error';
import { ChangeFinanceKeyUseCase } from '../application/use-cases/change-finance-key.use-case';
import { ConfirmVaultUseCase } from '../application/use-cases/confirm-vault.use-case';
import { GetVaultStatusUseCase } from '../application/use-cases/get-vault-status.use-case';
import { LockVaultUseCase } from '../application/use-cases/lock-vault.use-case';
import { RecoverVaultUseCase } from '../application/use-cases/recover-vault.use-case';
import { SetupVaultUseCase } from '../application/use-cases/setup-vault.use-case';
import { UnlockVaultUseCase } from '../application/use-cases/unlock-vault.use-case';
import { FinanceKey, RecoveryKey } from '../domain/vault-secret.value-object';
import {
  ADMIN,
  OTHER_ADMIN,
  SALESPERSON,
  TEST_KDF,
  createFinanceTestKit,
  type FinanceTestKit,
} from './fakes';

function wrongFinanceKey(): string {
  return FinanceKey.fromBytes(new Uint8Array(15)).value;
}

function wrongRecoveryKey(): string {
  return RecoveryKey.fromBytes(new Uint8Array(32)).value;
}

describe('finance vault lifecycle', () => {
  let kit: FinanceTestKit;
  let setup: SetupVaultUseCase;
  let confirm: ConfirmVaultUseCase;
  let unlock: UnlockVaultUseCase;
  let lock: LockVaultUseCase;
  let status: GetVaultStatusUseCase;
  let changeKey: ChangeFinanceKeyUseCase;
  let recover: RecoverVaultUseCase;

  beforeEach(() => {
    kit = createFinanceTestKit();
    const {
      policy,
      vaults,
      vaultQueries,
      keyring,
      crypto,
      audit,
      clock,
      ids,
      sessions,
      sessionService,
    } = kit;
    setup = new SetupVaultUseCase(policy, vaults, keyring, crypto, audit, clock, ids, TEST_KDF);
    confirm = new ConfirmVaultUseCase(policy, vaults, keyring, audit, clock);
    unlock = new UnlockVaultUseCase(policy, vaults, keyring, sessionService, audit, clock);
    lock = new LockVaultUseCase(policy, vaults, sessionService, audit, clock);
    status = new GetVaultStatusUseCase(policy, vaultQueries, sessionService);
    changeKey = new ChangeFinanceKeyUseCase(
      policy,
      vaults,
      keyring,
      sessionService,
      sessions,
      crypto,
      audit,
      clock,
    );
    recover = new RecoverVaultUseCase(policy, vaults, keyring, sessions, crypto, audit, clock);
  });

  async function activeVault(): Promise<{ financeKey: string; recoveryKey: string }> {
    const keys = await setup.execute(ADMIN);
    await confirm.execute({ recoveryKey: keys.recoveryKey }, ADMIN);
    return keys;
  }

  describe('setup and confirm', () => {
    it('returns both keys once and stores only salts and wrapped keys', async () => {
      const keys = await setup.execute(ADMIN);

      const stored = JSON.stringify(kit.vaults.stored);
      expect(keys.financeKey).toMatch(/^FK-/);
      expect(keys.recoveryKey).toMatch(/^RK-/);
      expect(stored).not.toContain(keys.financeKey);
      expect(stored).not.toContain(keys.recoveryKey);
      expect(kit.vaults.stored?.status).toBe('pending');
      expect(await status.execute(null, ADMIN)).toEqual({
        initialized: true,
        confirmed: false,
        unlocked: false,
        expiresAt: null,
      });
    });

    it('refuses to unlock until the recovery key is confirmed', async () => {
      const keys = await setup.execute(ADMIN);

      await expect(unlock.execute({ financeKey: keys.financeKey }, ADMIN)).rejects.toBeInstanceOf(
        FinanceVaultNotConfirmedError,
      );
    });

    it('confirms only with the right recovery key', async () => {
      const keys = await setup.execute(ADMIN);

      await expect(
        confirm.execute({ recoveryKey: wrongRecoveryKey() }, ADMIN),
      ).rejects.toBeInstanceOf(InvalidFinanceKeyError);
      const result = await confirm.execute({ recoveryKey: keys.recoveryKey }, ADMIN);

      expect(result.confirmed).toBe(true);
      expect(kit.audit.actions).toEqual([
        'finance.setup',
        'finance.unlock_failed',
        'finance.confirm',
      ]);
    });

    it('lets a pending vault be set up again, invalidating the first keys', async () => {
      const first = await setup.execute(ADMIN);
      const second = await setup.execute(ADMIN);

      await expect(
        confirm.execute({ recoveryKey: first.recoveryKey }, ADMIN),
      ).rejects.toBeInstanceOf(InvalidFinanceKeyError);
      await expect(
        confirm.execute({ recoveryKey: second.recoveryKey }, ADMIN),
      ).resolves.toMatchObject({ confirmed: true });
    });

    it('refuses setup once the vault is active', async () => {
      await activeVault();

      await expect(setup.execute(ADMIN)).rejects.toBeInstanceOf(FinanceAlreadyInitializedError);
    });

    it('reports a missing vault', async () => {
      expect(await status.execute(null, ADMIN)).toMatchObject({ initialized: false });
      await expect(unlock.execute({ financeKey: wrongFinanceKey() }, ADMIN)).rejects.toBeInstanceOf(
        FinanceNotInitializedError,
      );
    });
  });

  describe('unlock, sessions and lock', () => {
    it('unlocks with the finance key and opens a cipher for that session', async () => {
      const keys = await activeVault();

      const session = await unlock.execute({ financeKey: keys.financeKey }, ADMIN);
      const opened = await kit.sessionService.open(ADMIN, session.sessionToken);
      const sealed = opened.cipher.seal('{"amount":1500000}', 'finance_entries:row-1');

      expect(session.sessionToken).toMatch(/^[0-9a-f-]{36}\.[A-Za-z0-9_-]+$/);
      expect(opened.cipher.open(sealed, 'finance_entries:row-1')).toBe('{"amount":1500000}');
      expect(await status.execute(session.sessionToken, ADMIN)).toMatchObject({ unlocked: true });
    });

    it('opens the same data key across sessions', async () => {
      const keys = await activeVault();
      const first = await unlock.execute({ financeKey: keys.financeKey }, ADMIN);
      const second = await unlock.execute({ financeKey: keys.financeKey }, ADMIN);

      const sealed = (await kit.sessionService.open(ADMIN, first.sessionToken)).cipher.seal(
        'hello',
        'aad',
      );
      const reopened = await kit.sessionService.open(ADMIN, second.sessionToken);

      expect(reopened.cipher.open(sealed, 'aad')).toBe('hello');
    });

    it('keeps the database alone from unwrapping a session', async () => {
      const keys = await activeVault();
      const session = await unlock.execute({ financeKey: keys.financeKey }, ADMIN);
      const [sessionId] = session.sessionToken.split('.');
      const forged = `${sessionId}.${kit.crypto.newSessionSecret()}`;

      await expect(kit.sessionService.open(ADMIN, forged)).rejects.toBeInstanceOf(
        FinanceLockedError,
      );
      expect(JSON.stringify([...kit.sessions.store.values()])).not.toContain(
        session.sessionToken.split('.')[1],
      );
    });

    it('treats a missing, malformed or other admin token as locked', async () => {
      const keys = await activeVault();
      const session = await unlock.execute({ financeKey: keys.financeKey }, ADMIN);

      for (const token of [null, 'garbage', 'not-a-uuid.secret']) {
        await expect(kit.sessionService.open(ADMIN, token)).rejects.toBeInstanceOf(
          FinanceLockedError,
        );
      }
      await expect(
        kit.sessionService.open(OTHER_ADMIN, session.sessionToken),
      ).rejects.toBeInstanceOf(FinanceLockedError);
    });

    it('locks after 30 idle minutes and slides on use', async () => {
      const keys = await activeVault();
      const session = await unlock.execute({ financeKey: keys.financeKey }, ADMIN);

      kit.clock.advanceMinutes(20);
      await kit.sessionService.open(ADMIN, session.sessionToken);
      kit.clock.advanceMinutes(20);
      await expect(kit.sessionService.open(ADMIN, session.sessionToken)).resolves.toBeDefined();
      kit.clock.advanceMinutes(31);

      await expect(kit.sessionService.open(ADMIN, session.sessionToken)).rejects.toBeInstanceOf(
        FinanceLockedError,
      );
      expect(kit.sessions.store.size).toBe(0);
    });

    it('locks after 8 hours however active the session is', async () => {
      const keys = await activeVault();
      const session = await unlock.execute({ financeKey: keys.financeKey }, ADMIN);

      for (let i = 0; i < 16; i++) {
        kit.clock.advanceMinutes(29);
        await kit.sessionService.open(ADMIN, session.sessionToken);
      }
      kit.clock.advanceMinutes(17);

      await expect(kit.sessionService.open(ADMIN, session.sessionToken)).rejects.toBeInstanceOf(
        FinanceLockedError,
      );
    });

    it('status does not extend the session', async () => {
      const keys = await activeVault();
      const session = await unlock.execute({ financeKey: keys.financeKey }, ADMIN);

      kit.clock.advanceMinutes(20);
      await status.execute(session.sessionToken, ADMIN);
      kit.clock.advanceMinutes(11);

      expect(await status.execute(session.sessionToken, ADMIN)).toMatchObject({ unlocked: false });
    });

    it('locks idempotently', async () => {
      const keys = await activeVault();
      const session = await unlock.execute({ financeKey: keys.financeKey }, ADMIN);

      await lock.execute(session.sessionToken, ADMIN);
      await lock.execute(session.sessionToken, ADMIN);
      await lock.execute(null, ADMIN);

      await expect(kit.sessionService.open(ADMIN, session.sessionToken)).rejects.toBeInstanceOf(
        FinanceLockedError,
      );
      expect(kit.audit.actions.filter((a) => a === 'finance.lock')).toHaveLength(1);
    });
  });

  describe('lockout', () => {
    it('blocks unlock for 15 minutes after five wrong keys, even with the right key', async () => {
      const keys = await activeVault();
      for (let i = 0; i < 5; i++) {
        await expect(
          unlock.execute({ financeKey: wrongFinanceKey() }, ADMIN),
        ).rejects.toBeInstanceOf(InvalidFinanceKeyError);
      }

      await expect(unlock.execute({ financeKey: keys.financeKey }, ADMIN)).rejects.toBeInstanceOf(
        FinanceUnlockBlockedError,
      );
      kit.clock.advanceMinutes(15);
      await expect(unlock.execute({ financeKey: keys.financeKey }, ADMIN)).resolves.toBeDefined();
    });

    it('applies the same lockout to recovery', async () => {
      await activeVault();
      for (let i = 0; i < 5; i++) {
        await expect(
          recover.execute({ recoveryKey: wrongRecoveryKey() }, ADMIN),
        ).rejects.toBeInstanceOf(InvalidFinanceKeyError);
      }

      await expect(
        recover.execute({ recoveryKey: wrongRecoveryKey() }, ADMIN),
      ).rejects.toBeInstanceOf(FinanceUnlockBlockedError);
    });

    it('resets the count after a successful unlock', async () => {
      const keys = await activeVault();
      for (let i = 0; i < 4; i++) {
        await unlock.execute({ financeKey: wrongFinanceKey() }, ADMIN).catch(() => undefined);
      }
      await unlock.execute({ financeKey: keys.financeKey }, ADMIN);

      await unlock.execute({ financeKey: wrongFinanceKey() }, ADMIN).catch(() => undefined);

      await expect(unlock.execute({ financeKey: keys.financeKey }, ADMIN)).resolves.toBeDefined();
    });
  });

  describe('change key and recover', () => {
    it('changes the finance key, keeps data readable, and ends other sessions', async () => {
      const keys = await activeVault();
      const mine = await unlock.execute({ financeKey: keys.financeKey }, ADMIN);
      const elsewhere = await unlock.execute({ financeKey: keys.financeKey }, ADMIN);
      const sealed = (await kit.sessionService.open(ADMIN, mine.sessionToken)).cipher.seal(
        'kept',
        'aad',
      );

      const changed = await changeKey.execute(
        { sessionToken: mine.sessionToken, currentKey: keys.financeKey },
        ADMIN,
      );

      expect(changed.financeKey).not.toBe(keys.financeKey);
      await expect(kit.sessionService.open(ADMIN, elsewhere.sessionToken)).rejects.toBeInstanceOf(
        FinanceLockedError,
      );
      await expect(kit.sessionService.open(ADMIN, mine.sessionToken)).resolves.toBeDefined();
      await expect(unlock.execute({ financeKey: keys.financeKey }, ADMIN)).rejects.toBeInstanceOf(
        InvalidFinanceKeyError,
      );
      const next = await unlock.execute({ financeKey: changed.financeKey }, ADMIN);
      const reopened = await kit.sessionService.open(ADMIN, next.sessionToken);
      expect(reopened.cipher.open(sealed, 'aad')).toBe('kept');
    });

    it('needs an unlocked session and the current key to change it', async () => {
      const keys = await activeVault();
      const session = await unlock.execute({ financeKey: keys.financeKey }, ADMIN);

      await expect(
        changeKey.execute({ sessionToken: null, currentKey: keys.financeKey }, ADMIN),
      ).rejects.toBeInstanceOf(FinanceLockedError);
      await expect(
        changeKey.execute(
          { sessionToken: session.sessionToken, currentKey: wrongFinanceKey() },
          ADMIN,
        ),
      ).rejects.toBeInstanceOf(InvalidFinanceKeyError);
    });

    it('recovers with the recovery key: both keys rotate, sessions end, data stays', async () => {
      const keys = await activeVault();
      const session = await unlock.execute({ financeKey: keys.financeKey }, ADMIN);
      const sealed = (await kit.sessionService.open(ADMIN, session.sessionToken)).cipher.seal(
        'kept',
        'aad',
      );

      const recovered = await recover.execute({ recoveryKey: keys.recoveryKey }, ADMIN);

      expect(kit.sessions.store.size).toBe(0);
      await expect(
        recover.execute({ recoveryKey: keys.recoveryKey }, ADMIN),
      ).rejects.toBeInstanceOf(InvalidFinanceKeyError);
      await expect(unlock.execute({ financeKey: keys.financeKey }, ADMIN)).rejects.toBeInstanceOf(
        InvalidFinanceKeyError,
      );
      const next = await unlock.execute({ financeKey: recovered.financeKey }, ADMIN);
      const reopened = await kit.sessionService.open(ADMIN, next.sessionToken);
      expect(reopened.cipher.open(sealed, 'aad')).toBe('kept');
      await expect(
        recover.execute({ recoveryKey: recovered.recoveryKey }, ADMIN),
      ).resolves.toBeDefined();
    });
  });

  it('is admin-only for every action', async () => {
    const attempts: ReadonlyArray<() => Promise<unknown>> = [
      () => setup.execute(SALESPERSON),
      () => confirm.execute({ recoveryKey: wrongRecoveryKey() }, SALESPERSON),
      () => unlock.execute({ financeKey: wrongFinanceKey() }, SALESPERSON),
      () => lock.execute(null, SALESPERSON),
      () => status.execute(null, SALESPERSON),
      () => changeKey.execute({ sessionToken: null, currentKey: wrongFinanceKey() }, SALESPERSON),
      () => recover.execute({ recoveryKey: wrongRecoveryKey() }, SALESPERSON),
    ];

    for (const attempt of attempts) {
      await expect(attempt()).rejects.toBeInstanceOf(ForbiddenActionError);
    }
  });
});
