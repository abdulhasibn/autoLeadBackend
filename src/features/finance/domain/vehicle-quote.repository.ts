import type { SealedVehicleQuote } from './sealed-finance-records';
import type { VehicleQuoteId } from './vehicle-quote-id';

/** Command-side persistence for quotes (sealed). */
export interface IVehicleQuoteRepository {
  /** Live quote, or null. */
  findById(id: VehicleQuoteId): Promise<SealedVehicleQuote | null>;
  save(quote: SealedVehicleQuote): Promise<void>;
}
