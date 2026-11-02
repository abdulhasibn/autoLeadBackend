import type { EntryKindValue } from '../../domain/entry-kind.value-object';
import type { EntryPurposeValue } from '../../domain/entry-purpose.value-object';
import type { FinanceEntry } from '../../domain/finance-entry.entity';
import type { FinanceTag } from '../../domain/finance-tag.entity';
import type { FinanceVehicleFacts } from '../../domain/finance-vehicle-lookup.port';
import type { Page } from '../../../../shared/pagination/pagination';
import { toFinanceTagDto, type FinanceTagDto } from './finance-tag.dto';

export interface FinanceEntryDto {
  readonly id: string;
  readonly kind: EntryKindValue;
  /** Rupees, up to two decimals. */
  readonly amount: number;
  /** YYYY-MM-DD */
  readonly entryDate: string;
  readonly purpose: EntryPurposeValue;
  readonly tags: readonly FinanceTagDto[];
  readonly vehicle: { readonly id: string; readonly label: string } | null;
  readonly party: string | null;
  readonly note: string | null;
  readonly showroomId: string;
  readonly recordedBy: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface EntryTotalsDto {
  readonly income: number;
  readonly expense: number;
  /** income − expense; may be negative. */
  readonly net: number;
}

export interface FinanceEntryListDto extends Page<FinanceEntryDto> {
  /** More rows matched the date/car/kind filters than one read loads. */
  readonly truncated: boolean;
  /** Over every entry matching the filters, not just this page. */
  readonly totals: EntryTotalsDto;
}

export function toFinanceEntryDto(
  entry: FinanceEntry,
  tagsById: ReadonlyMap<string, FinanceTag>,
  vehiclesById: ReadonlyMap<string, FinanceVehicleFacts>,
): FinanceEntryDto {
  const vehicle = entry.vehicleId === null ? undefined : vehiclesById.get(entry.vehicleId);
  return {
    id: entry.id,
    kind: entry.kind,
    amount: entry.amount.rupees,
    entryDate: entry.entryDate.value,
    purpose: entry.purpose,
    tags: entry.tagIds.flatMap((id) => {
      const tag = tagsById.get(id);
      return tag === undefined ? [] : [toFinanceTagDto(tag)];
    }),
    vehicle:
      entry.vehicleId === null
        ? null
        : { id: entry.vehicleId, label: vehicle?.label ?? 'Unknown vehicle' },
    party: entry.party,
    note: entry.note,
    showroomId: entry.showroomId,
    recordedBy: entry.recordedBy,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  };
}
