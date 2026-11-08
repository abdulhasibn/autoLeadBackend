import type { FinanceLeadFacts } from '../../domain/finance-lead-lookup.port';
import type { VehicleQuote } from '../../domain/vehicle-quote.entity';

export interface VehicleQuoteDto {
  readonly id: string;
  readonly vehicleId: string;
  /** Rupees. */
  readonly amount: number;
  readonly quotedOn: string;
  readonly leadId: string | null;
  /** The lead quoted (still shown if the lead was deleted later); null for quotes without a lead. */
  readonly lead: {
    readonly id: string;
    readonly name: string | null;
    readonly phone: string | null;
  } | null;
  readonly quotedTo: string | null;
  readonly note: string | null;
  readonly createdAt: string;
}

export function toVehicleQuoteDto(
  quote: VehicleQuote,
  leadsById: ReadonlyMap<string, FinanceLeadFacts>,
): VehicleQuoteDto {
  const lead = quote.leadId === null ? undefined : leadsById.get(quote.leadId);
  return {
    id: quote.id,
    vehicleId: quote.vehicleId,
    amount: quote.amount.rupees,
    quotedOn: quote.quotedOn.value,
    leadId: quote.leadId,
    lead:
      quote.leadId === null
        ? null
        : { id: quote.leadId, name: lead?.name ?? null, phone: lead?.phone ?? null },
    quotedTo: quote.quotedTo,
    note: quote.note,
    createdAt: quote.createdAt.toISOString(),
  };
}
