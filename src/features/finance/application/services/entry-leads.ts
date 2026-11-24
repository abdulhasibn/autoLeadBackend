import type { LeadId } from '../../../../domain/shared/lead-id';
import type { FinanceEntry } from '../../domain/finance-entry.entity';
import type { FinanceLeadFacts, IFinanceLeadLookup } from '../../domain/finance-lead-lookup.port';

/** The leads named on these entries (one batched read), keyed by lead id. */
export async function leadsOfEntries(
  leads: Pick<IFinanceLeadLookup, 'findMany'>,
  entries: readonly FinanceEntry[],
): Promise<Map<string, FinanceLeadFacts>> {
  const ids = [
    ...new Set(entries.flatMap((entry) => (entry.leadId === null ? [] : [entry.leadId]))),
  ] as LeadId[];
  const facts = ids.length === 0 ? [] : await leads.findMany(ids);
  return new Map(facts.map((lead) => [lead.id as string, lead]));
}
