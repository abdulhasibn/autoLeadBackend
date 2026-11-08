import type { LeadId } from '../../../../domain/shared/lead-id';
import type { FinanceLeadFacts, IFinanceLeadLookup } from '../../domain/finance-lead-lookup.port';
import type { VehicleQuote } from '../../domain/vehicle-quote.entity';

/** One batched lookup of the leads named on these quotes, keyed by lead id. */
export async function leadsOf(
  lookup: IFinanceLeadLookup,
  quotes: readonly VehicleQuote[],
): Promise<Map<string, FinanceLeadFacts>> {
  const ids = [
    ...new Set(quotes.flatMap((q) => (q.leadId === null ? [] : [q.leadId]))),
  ] as LeadId[];
  const leads = ids.length === 0 ? [] : await lookup.findMany(ids);
  return new Map(leads.map((lead) => [lead.id as string, lead]));
}
