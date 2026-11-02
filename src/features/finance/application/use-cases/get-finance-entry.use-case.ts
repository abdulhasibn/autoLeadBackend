import { NotFoundError } from '../../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import { toFinanceEntryId } from '../../domain/finance-entry-id';
import type { IFinanceEntryQueries } from '../../domain/finance-entry.queries';
import type { IFinanceTagQueries } from '../../domain/finance-tag.queries';
import type { IFinanceVehicleLookup } from '../../domain/finance-vehicle-lookup.port';
import { toFinanceEntryDto, type FinanceEntryDto } from '../dtos/finance-entry.dto';
import type { FinancePolicy } from '../policies/finance.policy';
import type { EntrySealer } from '../services/entry.sealer';
import type { FinanceSessionService } from '../services/finance-session.service';
import type { TagSealer } from '../services/tag.sealer';

export class GetFinanceEntryUseCase {
  constructor(
    private readonly policy: FinancePolicy,
    private readonly sessions: FinanceSessionService,
    private readonly entries: IFinanceEntryQueries,
    private readonly tags: IFinanceTagQueries,
    private readonly vehicles: IFinanceVehicleLookup,
    private readonly entrySealer: EntrySealer,
    private readonly tagSealer: TagSealer,
  ) {}

  async execute(
    query: { readonly sessionToken: string | null; readonly entryId: string },
    ctx: AuthenticatedContext,
  ): Promise<FinanceEntryDto> {
    this.policy.requireAdmin(ctx);
    const { cipher } = await this.sessions.open(ctx, query.sessionToken);

    const sealed = await this.entries.findById(toFinanceEntryId(query.entryId));
    if (sealed === null) {
      throw new NotFoundError(`Finance entry not found for id ${query.entryId}`);
    }
    const entry = this.entrySealer.open(sealed, cipher);
    const tags = this.tagSealer.openAll(await this.tags.listAll(), cipher);
    const vehicles =
      entry.vehicleId === null ? [] : await this.vehicles.findMany([entry.vehicleId]);
    return toFinanceEntryDto(
      entry,
      new Map(tags.map((tag) => [tag.id as string, tag])),
      new Map(vehicles.map((v) => [v.id as string, v])),
    );
  }
}
