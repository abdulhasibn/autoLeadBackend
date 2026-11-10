import { NotFoundError } from '../../../../domain/errors/not-found.error';
import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import { toVehicleId } from '../../../../domain/shared/vehicle-id';
import type { Clock } from '../../../../shared/clock/clock';
import type { IFinanceEntryQueries } from '../../domain/finance-entry.queries';
import type { IFinanceLeadLookup } from '../../domain/finance-lead-lookup.port';
import type { IFinanceTagQueries } from '../../domain/finance-tag.queries';
import type { IFinanceVehicleLookup } from '../../domain/finance-vehicle-lookup.port';
import { MAX_LEDGER_ROWS } from '../../domain/finance.constants';
import { VehicleDeal } from '../../domain/vehicle-deal.entity';
import type { IVehicleDealQueries } from '../../domain/vehicle-deal.queries';
import { calculateVehicleMoney } from '../../domain/vehicle-money';
import { compareQuotesNewestFirst } from '../../domain/vehicle-quote.entity';
import type { IVehicleQuoteQueries } from '../../domain/vehicle-quote.queries';
import { toVehicleFinanceDto, type VehicleFinanceDto } from '../dtos/vehicle-finance.dto';
import type { FinancePolicy } from '../policies/finance.policy';
import type { EntrySealer } from '../services/entry.sealer';
import type { FinanceSessionService } from '../services/finance-session.service';
import type { QuoteSealer } from '../services/quote.sealer';
import { leadsOf } from '../services/quote-leads';
import type { TagSealer } from '../services/tag.sealer';
import type { VehicleDealSealer } from '../services/vehicle-deal.sealer';

/** A car's money tab: deal, sale, quotes, landing cost, profit and dues. */
export class GetVehicleFinanceUseCase {
  constructor(
    private readonly policy: FinancePolicy,
    private readonly sessions: FinanceSessionService,
    private readonly vehicles: IFinanceVehicleLookup,
    private readonly deals: IVehicleDealQueries,
    private readonly entries: IFinanceEntryQueries,
    private readonly quotes: IVehicleQuoteQueries,
    private readonly leads: IFinanceLeadLookup,
    private readonly tags: IFinanceTagQueries,
    private readonly dealSealer: VehicleDealSealer,
    private readonly entrySealer: EntrySealer,
    private readonly quoteSealer: QuoteSealer,
    private readonly tagSealer: TagSealer,
    private readonly clock: Clock,
  ) {}

  async execute(
    query: { readonly sessionToken: string | null; readonly vehicleId: string },
    ctx: AuthenticatedContext,
  ): Promise<VehicleFinanceDto> {
    this.policy.requireAdmin(ctx);
    const { cipher } = await this.sessions.open(ctx, query.sessionToken);

    const vehicleId = toVehicleId(query.vehicleId);
    const [vehicle] = await this.vehicles.findMany([vehicleId]);
    if (vehicle === undefined) {
      throw new NotFoundError(`Vehicle not found for id ${query.vehicleId}`);
    }

    const sealedDeal = await this.deals.find(vehicleId);
    const deal =
      sealedDeal === null
        ? VehicleDeal.empty(vehicleId, null, this.clock.now())
        : this.dealSealer.open(sealedDeal, cipher);
    const page = await this.entries.list({ vehicleId, maxRows: MAX_LEDGER_ROWS });
    const entries = page.rows.map((row) => this.entrySealer.open(row, cipher));
    const quotes = (await this.quotes.listForVehicles([vehicleId]))
      .map((row) => this.quoteSealer.open(row, cipher))
      .sort(compareQuotesNewestFirst);
    const tags = this.tagSealer.openAll(await this.tags.listAll(), cipher);

    return toVehicleFinanceDto({
      vehicle,
      deal,
      money: calculateVehicleMoney({
        saleModel: vehicle.saleModel,
        terms: deal.terms,
        finalisedPrice: deal.sale?.finalisedPrice ?? null,
        entries,
      }),
      quotes,
      leadsById: await leadsOf(this.leads, quotes),
      tagsById: new Map(tags.map((tag) => [tag.id as string, tag])),
    });
  }
}
