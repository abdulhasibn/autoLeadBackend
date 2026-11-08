import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import { toVehicleId } from '../../../../domain/shared/vehicle-id';
import type { IFinanceLeadLookup } from '../../domain/finance-lead-lookup.port';
import { compareQuotesNewestFirst } from '../../domain/vehicle-quote.entity';
import type { IVehicleQuoteQueries } from '../../domain/vehicle-quote.queries';
import { toVehicleQuoteDto, type VehicleQuoteDto } from '../dtos/vehicle-quote.dto';
import type { FinancePolicy } from '../policies/finance.policy';
import type { FinanceSessionService } from '../services/finance-session.service';
import type { QuoteSealer } from '../services/quote.sealer';
import { leadsOf } from '../services/quote-leads';

/** A car's quotes, newest first; the first is the current quote. */
export class ListVehicleQuotesUseCase {
  constructor(
    private readonly policy: FinancePolicy,
    private readonly sessions: FinanceSessionService,
    private readonly quotes: IVehicleQuoteQueries,
    private readonly leads: IFinanceLeadLookup,
    private readonly sealer: QuoteSealer,
  ) {}

  async execute(
    query: { readonly sessionToken: string | null; readonly vehicleId: string },
    ctx: AuthenticatedContext,
  ): Promise<VehicleQuoteDto[]> {
    this.policy.requireAdmin(ctx);
    const { cipher } = await this.sessions.open(ctx, query.sessionToken);

    const quotes = (await this.quotes.listForVehicles([toVehicleId(query.vehicleId)]))
      .map((row) => this.sealer.open(row, cipher))
      .sort(compareQuotesNewestFirst);
    const leadsById = await leadsOf(this.leads, quotes);
    return quotes.map((quote) => toVehicleQuoteDto(quote, leadsById));
  }
}
