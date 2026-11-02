import type { SupabaseClient } from '@supabase/supabase-js';

import { DatabaseUnavailableError } from '../../../domain/errors/database-unavailable.error';
import type { Database } from '../../../infrastructure/supabase/database.types';
import type { SealedVehicleQuote } from '../domain/sealed-finance-records';
import type { VehicleQuoteId } from '../domain/vehicle-quote-id';
import type { IVehicleQuoteRepository } from '../domain/vehicle-quote.repository';
import { translateFinanceWriteError } from './translate-finance-write-error';
import {
  VEHICLE_QUOTE_COLUMNS,
  toSealedVehicleQuote,
  toVehicleQuoteRow,
} from './vehicle-quote.mapper';

export class SupabaseVehicleQuoteRepository implements IVehicleQuoteRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async findById(id: VehicleQuoteId): Promise<SealedVehicleQuote | null> {
    const { data, error } = await this.db
      .from('vehicle_quotes')
      .select(VEHICLE_QUOTE_COLUMNS)
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();
    if (error !== null) {
      throw new DatabaseUnavailableError(`Failed to load quote: ${error.message}`);
    }
    return data === null ? null : toSealedVehicleQuote(data);
  }

  async save(quote: SealedVehicleQuote): Promise<void> {
    const { error } = await this.db
      .from('vehicle_quotes')
      .upsert(toVehicleQuoteRow(quote), { onConflict: 'id' });
    if (error !== null) {
      translateFinanceWriteError(error, 'Failed to save quote');
    }
  }
}
