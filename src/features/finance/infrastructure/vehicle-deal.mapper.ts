import { toUserId } from '../../../domain/shared/user-id';
import { toVehicleId } from '../../../domain/shared/vehicle-id';
import type { Database } from '../../../infrastructure/supabase/database.types';
import type { SealedVehicleDeal } from '../domain/sealed-finance-records';

type VehicleFinancialsRow = Database['public']['Tables']['vehicle_financials']['Row'];

export type VehicleDealRow = Pick<
  VehicleFinancialsRow,
  'vehicle_id' | 'payload' | 'key_version' | 'listed_price' | 'sold_on' | 'sold_by' | 'updated_at'
>;

export const VEHICLE_DEAL_COLUMNS =
  'vehicle_id, payload, key_version, listed_price, sold_on, sold_by, updated_at';

export function toSealedVehicleDeal(row: VehicleDealRow): SealedVehicleDeal {
  return {
    vehicleId: toVehicleId(row.vehicle_id),
    payload: row.payload,
    keyVersion: row.key_version,
    listedPrice: row.listed_price === null ? null : Number(row.listed_price),
    soldOn: row.sold_on,
    soldBy: row.sold_by === null ? null : toUserId(row.sold_by),
    updatedAt: new Date(row.updated_at),
  };
}

export function toVehicleDealRow(deal: SealedVehicleDeal): VehicleDealRow {
  return {
    vehicle_id: deal.vehicleId,
    payload: deal.payload,
    key_version: deal.keyVersion,
    listed_price: deal.listedPrice,
    sold_on: deal.soldOn,
    sold_by: deal.soldBy,
    updated_at: deal.updatedAt.toISOString(),
  };
}
