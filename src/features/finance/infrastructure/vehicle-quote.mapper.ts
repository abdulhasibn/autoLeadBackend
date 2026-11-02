import { toLeadId } from '../../../domain/shared/lead-id';
import { toUserId } from '../../../domain/shared/user-id';
import { toVehicleId } from '../../../domain/shared/vehicle-id';
import type { Database } from '../../../infrastructure/supabase/database.types';
import type { SealedVehicleQuote } from '../domain/sealed-finance-records';
import { toVehicleQuoteId } from '../domain/vehicle-quote-id';

export type VehicleQuoteRow = Database['public']['Tables']['vehicle_quotes']['Row'];

export const VEHICLE_QUOTE_COLUMNS =
  'id, vehicle_id, lead_id, quoted_on, payload, key_version, created_by, created_at, deleted_at';

export function toSealedVehicleQuote(row: VehicleQuoteRow): SealedVehicleQuote {
  return {
    id: toVehicleQuoteId(row.id),
    vehicleId: toVehicleId(row.vehicle_id),
    leadId: row.lead_id === null ? null : toLeadId(row.lead_id),
    quotedOn: row.quoted_on,
    payload: row.payload,
    keyVersion: row.key_version,
    createdBy: toUserId(row.created_by),
    createdAt: new Date(row.created_at),
    deletedAt: row.deleted_at === null ? null : new Date(row.deleted_at),
  };
}

export function toVehicleQuoteRow(quote: SealedVehicleQuote): VehicleQuoteRow {
  return {
    id: quote.id,
    vehicle_id: quote.vehicleId,
    lead_id: quote.leadId,
    quoted_on: quote.quotedOn,
    payload: quote.payload,
    key_version: quote.keyVersion,
    created_by: quote.createdBy,
    created_at: quote.createdAt.toISOString(),
    deleted_at: quote.deletedAt === null ? null : quote.deletedAt.toISOString(),
  };
}
