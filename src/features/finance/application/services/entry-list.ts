import type { FinanceEntry } from '../../domain/finance-entry.entity';
import type { FinanceTag } from '../../domain/finance-tag.entity';
import type { EntryTotalsDto } from '../dtos/finance-entry.dto';
import type { EntrySort, ListFinanceEntriesQuery } from '../dtos/list-finance-entries-query';

type InMemoryFilters = Pick<
  ListFinanceEntriesQuery,
  'tagIds' | 'purposes' | 'minAmountPaise' | 'maxAmountPaise' | 'search'
>;

/**
 * Filters SQL can't apply because the fields are encrypted: tags (any of),
 * purposes, amount range and text search over party, note and tag names.
 */
export function filterEntries(
  entries: readonly FinanceEntry[],
  filters: InMemoryFilters,
  tagsById: ReadonlyMap<string, FinanceTag>,
): FinanceEntry[] {
  const needle = filters.search?.toLocaleLowerCase('en-IN');
  return entries.filter((entry) => {
    if (filters.tagIds !== undefined && filters.tagIds.length > 0) {
      if (!entry.tagIds.some((id) => filters.tagIds?.includes(id))) {
        return false;
      }
    }
    if (filters.purposes !== undefined && filters.purposes.length > 0) {
      if (!filters.purposes.includes(entry.purpose)) {
        return false;
      }
    }
    if (filters.minAmountPaise !== undefined && entry.amount.paise < filters.minAmountPaise) {
      return false;
    }
    if (filters.maxAmountPaise !== undefined && entry.amount.paise > filters.maxAmountPaise) {
      return false;
    }
    if (needle !== undefined) {
      const haystack = [
        entry.party ?? '',
        entry.note ?? '',
        ...entry.tagIds.map((id) => tagsById.get(id)?.name.value ?? ''),
      ]
        .join('\n')
        .toLocaleLowerCase('en-IN');
      if (!haystack.includes(needle)) {
        return false;
      }
    }
    return true;
  });
}

export function sortEntries(entries: readonly FinanceEntry[], sort: EntrySort): FinanceEntry[] {
  const byDate = (a: FinanceEntry, b: FinanceEntry): number =>
    a.entryDate.value.localeCompare(b.entryDate.value) ||
    a.createdAt.getTime() - b.createdAt.getTime();
  const byAmount = (a: FinanceEntry, b: FinanceEntry): number =>
    a.amount.paise - b.amount.paise || byDate(a, b);
  const compare: Record<EntrySort, (a: FinanceEntry, b: FinanceEntry) => number> = {
    date: (a, b) => byDate(b, a),
    '-date': byDate,
    amount: (a, b) => byAmount(b, a),
    '-amount': byAmount,
  };
  return [...entries].sort(compare[sort]);
}

/** Totals in rupees over the given entries. */
export function totalEntries(entries: readonly FinanceEntry[]): EntryTotalsDto {
  let income = 0;
  let expense = 0;
  for (const entry of entries) {
    if (entry.kind === 'income') {
      income += entry.amount.paise;
    } else {
      expense += entry.amount.paise;
    }
  }
  return { income: income / 100, expense: expense / 100, net: (income - expense) / 100 };
}
