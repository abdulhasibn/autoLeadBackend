import type { ShowroomId } from '../../../domain/shared/showroom-id';
import type { VehicleId } from '../../../domain/shared/vehicle-id';
import type { EntryKindValue } from './entry-kind.value-object';
import type { FinanceEntryId } from './finance-entry-id';
import type { SealedFinanceEntry } from './sealed-finance-records';

/** Filters SQL can apply on plaintext columns. Live entries only. */
export interface FinanceEntryCriteria {
  /** Inclusive YYYY-MM-DD bounds. */
  readonly from?: string;
  readonly to?: string;
  readonly kind?: EntryKindValue;
  readonly vehicleId?: VehicleId;
  /** Entries of any of these cars. Ignored when `vehicleId` is set. */
  readonly vehicleIds?: readonly VehicleId[];
  /** Only entries with no car. Ignored when `vehicleId` or `vehicleIds` is set. */
  readonly unlinked?: boolean;
  readonly showroomId?: ShowroomId;
  /** Most rows to return; `truncated` says more matched. */
  readonly maxRows: number;
}

export interface SealedEntryPage {
  readonly rows: readonly SealedFinanceEntry[];
  readonly truncated: boolean;
}

/** Read side of the ledger. Rows stay sealed; the application decrypts them. */
export interface IFinanceEntryQueries {
  list(criteria: FinanceEntryCriteria): Promise<SealedEntryPage>;
  findById(id: FinanceEntryId): Promise<SealedFinanceEntry | null>;
}
