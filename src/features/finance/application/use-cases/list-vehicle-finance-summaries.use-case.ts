import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import { toVehicleId } from '../../../../domain/shared/vehicle-id';
import type { Clock } from '../../../../shared/clock/clock';
import type { FinanceEntry } from '../../domain/finance-entry.entity';
import type { IFinanceEntryQueries } from '../../domain/finance-entry.queries';
import type { IFinanceVehicleLookup } from '../../domain/finance-vehicle-lookup.port';
import { MAX_LEDGER_ROWS } from '../../domain/finance.constants';
import { VehicleDeal } from '../../domain/vehicle-deal.entity';
import type { IVehicleDealQueries } from '../../domain/vehicle-deal.queries';
import { calculateVehicleMoney } from '../../domain/vehicle-money';
import { compareQuotesNewestFirst, type VehicleQuote } from '../../domain/vehicle-quote.entity';
import type { IVehicleQuoteQueries } from '../../domain/vehicle-quote.queries';
import {
  toVehicleFinanceSummaryDto,
  type VehicleFinanceSummaryDto,
} from '../dtos/vehicle-finance.dto';
import type { FinancePolicy } from '../policies/finance.policy';
import type { EntrySealer } from '../services/entry.sealer';
import type { FinanceSessionService } from '../services/finance-session.service';
import type { QuoteSealer } from '../services/quote.sealer';
import type { VehicleDealSealer } from '../services/vehicle-deal.sealer';

/** Money columns for a page of the car list (up to 100 cars), in the order asked. */
export class ListVehicleFinanceSummariesUseCase {
  constructor(
    private readonly policy: FinancePolicy,
    private readonly sessions: FinanceSessionService,
    private readonly deals: IVehicleDealQueries,
    private readonly entries: IFinanceEntryQueries,
    private readonly quotes: IVehicleQuoteQueries,
    private readonly vehicles: IFinanceVehicleLookup,
    private readonly dealSealer: VehicleDealSealer,
    private readonly entrySealer: EntrySealer,
    private readonly quoteSealer: QuoteSealer,
    private readonly clock: Clock,
  ) {}

  async execute(
    query: { readonly sessionToken: string | null; readonly vehicleIds: readonly string[] },
    ctx: AuthenticatedContext,
  ): Promise<VehicleFinanceSummaryDto[]> {
    this.policy.requireAdmin(ctx);
    const { cipher } = await this.sessions.open(ctx, query.sessionToken);

    const ids = [...new Set(query.vehicleIds)].map(toVehicleId);
    if (ids.length === 0) {
      return [];
    }
    const deals = new Map(
      (await this.deals.findMany(ids)).map((row) => [
        row.vehicleId as string,
        this.dealSealer.open(row, cipher),
      ]),
    );
    const entriesByCar = new Map<string, FinanceEntry[]>();
    const page = await this.entries.list({ vehicleIds: ids, maxRows: MAX_LEDGER_ROWS });
    for (const row of page.rows) {
      const entry = this.entrySealer.open(row, cipher);
      if (entry.vehicleId !== null) {
        entriesByCar.set(entry.vehicleId, [...(entriesByCar.get(entry.vehicleId) ?? []), entry]);
      }
    }
    const latestQuote = new Map<string, VehicleQuote>();
    for (const row of await this.quotes.listForVehicles(ids)) {
      const quote = this.quoteSealer.open(row, cipher);
      const current = latestQuote.get(quote.vehicleId);
      if (current === undefined || compareQuotesNewestFirst(quote, current) < 0) {
        latestQuote.set(quote.vehicleId, quote);
      }
    }

    const saleModels = new Map(
      (await this.vehicles.findMany(ids)).map((car) => [car.id as string, car.saleModel]),
    );
    const now = this.clock.now();
    return ids.map((vehicleId) => {
      const deal = deals.get(vehicleId) ?? VehicleDeal.empty(vehicleId, null, now);
      const saleModel = saleModels.get(vehicleId) ?? 'purchase';
      return toVehicleFinanceSummaryDto({
        vehicleId,
        saleModel,
        deal,
        money: calculateVehicleMoney({
          saleModel,
          terms: deal.terms,
          finalisedPrice: deal.sale?.finalisedPrice ?? null,
          entries: entriesByCar.get(vehicleId) ?? [],
        }),
        currentQuote: latestQuote.get(vehicleId) ?? null,
      });
    });
  }
}
