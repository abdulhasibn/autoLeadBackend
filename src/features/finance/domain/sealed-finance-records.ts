import type { ShowroomId } from '../../../domain/shared/showroom-id';
import type { UserId } from '../../../domain/shared/user-id';
import type { LeadId } from '../../../domain/shared/lead-id';
import type { VehicleId } from '../../../domain/shared/vehicle-id';
import type { EntryKindValue } from './entry-kind.value-object';
import type { FinanceEntryId } from './finance-entry-id';
import type { FinanceTagId } from './finance-tag-id';
import type { VehicleQuoteId } from './vehicle-quote-id';

/**
 * Finance rows as stored: plaintext columns SQL filters on, plus the sealed
 * `payload`. Repositories and queries only ever see these; sealers in the
 * application layer turn them into entities and back (ADR-0014).
 */
export interface SealedFinanceEntry {
  readonly id: FinanceEntryId;
  readonly kind: EntryKindValue;
  readonly vehicleId: VehicleId | null;
  readonly showroomId: ShowroomId;
  /** YYYY-MM-DD */
  readonly entryDate: string;
  readonly payload: string;
  readonly keyVersion: number;
  readonly recordedBy: UserId;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;
}

export interface SealedFinanceTag {
  readonly id: FinanceTagId;
  readonly payload: string;
  readonly keyVersion: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly archivedAt: Date | null;
}

/** A car's `vehicle_financials` row. `payload` is null until terms or a sale exist. */
export interface SealedVehicleDeal {
  readonly vehicleId: VehicleId;
  readonly payload: string | null;
  readonly keyVersion: number | null;
  /** Rupees, plaintext. */
  readonly listedPrice: number | null;
  /** YYYY-MM-DD, set when a sale is recorded. */
  readonly soldOn: string | null;
  readonly soldBy: UserId | null;
  readonly updatedAt: Date;
}

export interface SealedVehicleQuote {
  readonly id: VehicleQuoteId;
  readonly vehicleId: VehicleId;
  readonly leadId: LeadId | null;
  /** YYYY-MM-DD */
  readonly quotedOn: string;
  readonly payload: string;
  readonly keyVersion: number;
  readonly createdBy: UserId;
  readonly createdAt: Date;
  readonly deletedAt: Date | null;
}
