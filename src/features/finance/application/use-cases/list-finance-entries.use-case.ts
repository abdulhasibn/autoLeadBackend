import { BusinessRuleViolationError } from '../../../../domain/errors/business-rule-violation.error';
import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import { toShowroomId } from '../../../../domain/shared/showroom-id';
import { toVehicleId, type VehicleId } from '../../../../domain/shared/vehicle-id';
import type { IFinanceEntryQueries } from '../../domain/finance-entry.queries';
import type { IFinanceTagQueries } from '../../domain/finance-tag.queries';
import type { IFinanceVehicleLookup } from '../../domain/finance-vehicle-lookup.port';
import { MAX_LEDGER_RANGE_DAYS, MAX_LEDGER_ROWS } from '../../domain/finance.constants';
import { toFinanceEntryDto, type FinanceEntryListDto } from '../dtos/finance-entry.dto';
import type { ListFinanceEntriesQuery } from '../dtos/list-finance-entries-query';
import type { FinancePolicy } from '../policies/finance.policy';
import type { EntrySealer } from '../services/entry.sealer';
import { filterEntries, sortEntries, totalEntries } from '../services/entry-list';
import type { FinanceSessionService } from '../services/finance-session.service';
import type { TagSealer } from '../services/tag.sealer';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The ledger list. SQL narrows by date, car, kind and showroom; the rest
 * (tags, purpose, amount, search, sort, totals) runs after decryption, so a
 * date range is required unless the list is scoped to one car.
 */
export class ListFinanceEntriesUseCase {
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
    query: ListFinanceEntriesQuery,
    ctx: AuthenticatedContext,
  ): Promise<FinanceEntryListDto> {
    this.policy.requireAdmin(ctx);
    assertRange(query);
    const { cipher } = await this.sessions.open(ctx, query.sessionToken);

    const page = await this.entries.list({
      ...(query.from === undefined ? {} : { from: query.from }),
      ...(query.to === undefined ? {} : { to: query.to }),
      ...(query.kind === undefined ? {} : { kind: query.kind }),
      ...(query.vehicleId === undefined ? {} : { vehicleId: toVehicleId(query.vehicleId) }),
      ...(query.unlinked === undefined ? {} : { unlinked: query.unlinked }),
      ...(query.showroomId === undefined ? {} : { showroomId: toShowroomId(query.showroomId) }),
      maxRows: MAX_LEDGER_ROWS,
    });

    const tags = this.tagSealer.openAll(await this.tags.listAll(), cipher);
    const tagsById = new Map(tags.map((tag) => [tag.id as string, tag]));
    const opened = page.rows.map((row) => this.entrySealer.open(row, cipher));
    const matching = sortEntries(filterEntries(opened, query, tagsById), query.sort);
    const items = matching.slice(query.offset, query.offset + query.limit);

    const vehicleIds = [
      ...new Set(items.flatMap((e) => (e.vehicleId === null ? [] : [e.vehicleId]))),
    ] as VehicleId[];
    const vehicles = vehicleIds.length === 0 ? [] : await this.vehicles.findMany(vehicleIds);
    const vehiclesById = new Map(vehicles.map((v) => [v.id as string, v]));

    return {
      items: items.map((entry) => toFinanceEntryDto(entry, tagsById, vehiclesById)),
      total: matching.length,
      limit: query.limit,
      offset: query.offset,
      truncated: page.truncated,
      totals: totalEntries(matching),
    };
  }
}

function assertRange(query: ListFinanceEntriesQuery): void {
  if (query.from === undefined || query.to === undefined) {
    if (query.vehicleId === undefined) {
      throw new BusinessRuleViolationError(
        'DATE_RANGE_REQUIRED',
        'from and to are required unless the list is for one vehicle',
      );
    }
    return;
  }
  const days = (Date.parse(query.to) - Date.parse(query.from)) / DAY_MS + 1;
  if (days < 1) {
    throw new BusinessRuleViolationError('INVALID_DATE_RANGE', 'to must not be before from');
  }
  if (days > MAX_LEDGER_RANGE_DAYS) {
    throw new BusinessRuleViolationError(
      'DATE_RANGE_TOO_LONG',
      `A list can cover at most ${MAX_LEDGER_RANGE_DAYS} days`,
    );
  }
}
