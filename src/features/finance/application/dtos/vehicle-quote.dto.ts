import type { VehicleQuote } from '../../domain/vehicle-quote.entity';

export interface VehicleQuoteDto {
  readonly id: string;
  readonly vehicleId: string;
  /** Rupees. */
  readonly amount: number;
  readonly quotedOn: string;
  readonly leadId: string | null;
  readonly quotedTo: string | null;
  readonly note: string | null;
  readonly createdAt: string;
}

export function toVehicleQuoteDto(quote: VehicleQuote): VehicleQuoteDto {
  return {
    id: quote.id,
    vehicleId: quote.vehicleId,
    amount: quote.amount.rupees,
    quotedOn: quote.quotedOn.value,
    leadId: quote.leadId,
    quotedTo: quote.quotedTo,
    note: quote.note,
    createdAt: quote.createdAt.toISOString(),
  };
}
