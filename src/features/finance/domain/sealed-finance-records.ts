import type { ShowroomId } from '../../../domain/shared/showroom-id';
import type { UserId } from '../../../domain/shared/user-id';
import type { VehicleId } from '../../../domain/shared/vehicle-id';
import type { EntryKindValue } from './entry-kind.value-object';
import type { FinanceEntryId } from './finance-entry-id';
import type { FinanceTagId } from './finance-tag-id';

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
