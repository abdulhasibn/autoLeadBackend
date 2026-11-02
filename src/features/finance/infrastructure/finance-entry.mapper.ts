import { DataIntegrityError } from '../../../domain/errors/data-integrity.error';
import { toShowroomId } from '../../../domain/shared/showroom-id';
import { toUserId } from '../../../domain/shared/user-id';
import { toVehicleId } from '../../../domain/shared/vehicle-id';
import type { Database } from '../../../infrastructure/supabase/database.types';
import type { EntryKindValue } from '../domain/entry-kind.value-object';
import { toFinanceEntryId } from '../domain/finance-entry-id';
import type { SealedFinanceEntry } from '../domain/sealed-finance-records';

export type FinanceEntryRow = Database['public']['Tables']['finance_entries']['Row'];

export const FINANCE_ENTRY_COLUMNS =
  'id, showroom_id, kind, vehicle_id, entry_date, payload, key_version, recorded_by, created_at, updated_at, deleted_at';

export function toSealedFinanceEntry(row: FinanceEntryRow): SealedFinanceEntry {
  return {
    id: toFinanceEntryId(row.id),
    kind: parseKind(row.kind),
    vehicleId: row.vehicle_id === null ? null : toVehicleId(row.vehicle_id),
    showroomId: toShowroomId(row.showroom_id),
    entryDate: row.entry_date,
    payload: row.payload,
    keyVersion: row.key_version,
    recordedBy: toUserId(row.recorded_by),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    deletedAt: row.deleted_at === null ? null : new Date(row.deleted_at),
  };
}

export function toFinanceEntryRow(entry: SealedFinanceEntry): FinanceEntryRow {
  return {
    id: entry.id,
    showroom_id: entry.showroomId,
    kind: entry.kind,
    vehicle_id: entry.vehicleId,
    entry_date: entry.entryDate,
    payload: entry.payload,
    key_version: entry.keyVersion,
    recorded_by: entry.recordedBy,
    created_at: entry.createdAt.toISOString(),
    updated_at: entry.updatedAt.toISOString(),
    deleted_at: entry.deletedAt === null ? null : entry.deletedAt.toISOString(),
  };
}

function parseKind(value: string): EntryKindValue {
  if (value === 'income' || value === 'expense') {
    return value;
  }
  throw new DataIntegrityError(`Unknown finance entry kind: ${value}`);
}
