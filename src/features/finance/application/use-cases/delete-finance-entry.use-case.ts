import { NotFoundError } from '../../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import type { Clock } from '../../../../shared/clock/clock';
import { toFinanceEntryId } from '../../domain/finance-entry-id';
import type { IFinanceEntryRepository } from '../../domain/finance-entry.repository';
import type { FinancePolicy } from '../policies/finance.policy';
import type { EntrySealer } from '../services/entry.sealer';
import type { FinanceSessionService } from '../services/finance-session.service';

/** Soft-deletes an entry (ADR-0005). */
export class DeleteFinanceEntryUseCase {
  constructor(
    private readonly policy: FinancePolicy,
    private readonly sessions: FinanceSessionService,
    private readonly entries: IFinanceEntryRepository,
    private readonly sealer: EntrySealer,
    private readonly clock: Clock,
  ) {}

  async execute(
    command: { readonly sessionToken: string | null; readonly entryId: string },
    ctx: AuthenticatedContext,
  ): Promise<void> {
    this.policy.requireAdmin(ctx);
    const { cipher } = await this.sessions.open(ctx, command.sessionToken);

    const sealed = await this.entries.findById(toFinanceEntryId(command.entryId));
    if (sealed === null) {
      throw new NotFoundError(`Finance entry not found for id ${command.entryId}`);
    }
    const entry = this.sealer.open(sealed, cipher);
    entry.softDelete(this.clock.now());
    await this.entries.save(this.sealer.seal(entry, cipher));
  }
}
