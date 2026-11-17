import type { FinanceEntry } from './finance-entry.entity';
import { bucketIndexOf, type ReportBucket } from './report-period.value-object';

/** Paise. */
export interface CashFlowLine {
  readonly in: number;
  readonly out: number;
  readonly net: number;
  readonly inFromBuyers: number;
  readonly inOther: number;
  readonly outToSellers: number;
  readonly outCarCosts: number;
  readonly outBusiness: number;
}

export interface CashFlow {
  /** `cumulative` = running net from the first bucket. */
  readonly buckets: readonly (ReportBucket & CashFlowLine & { readonly cumulative: number })[];
  readonly totals: CashFlowLine;
}

type Split = Omit<CashFlowLine, 'in' | 'out' | 'net'>;

/**
 * Money actually received and paid, by entry date: every entry counts,
 * including payments to sellers and from buyers. Entries outside the buckets
 * are ignored.
 */
export function buildCashFlow(input: {
  readonly buckets: readonly ReportBucket[];
  readonly entries: readonly FinanceEntry[];
}): CashFlow {
  const tally = new CashFlowTally(input.buckets);
  for (const entry of input.entries) tally.add(entry);
  return tally.result();
}

/** {@link buildCashFlow} one entry at a time, so a report can fold the ledger page by page. */
export class CashFlowTally {
  private readonly splits: { -readonly [K in keyof Split]: number }[];

  constructor(private readonly buckets: readonly ReportBucket[]) {
    this.splits = buckets.map(() => emptySplit());
  }

  add(entry: FinanceEntry): void {
    const split = this.splits[bucketIndexOf(this.buckets, entry.entryDate.value)];
    if (split === undefined) return;
    const paise = entry.amount.paise;
    if (entry.kind === 'income') {
      if (entry.purpose === 'sale') split.inFromBuyers += paise;
      else split.inOther += paise;
    } else if (entry.purpose === 'purchase') {
      split.outToSellers += paise;
    } else if (entry.purpose === 'cost') {
      split.outCarCosts += paise;
    } else {
      split.outBusiness += paise;
    }
  }

  result(): CashFlow {
    let cumulative = 0;
    const buckets = this.buckets.map((bucket, i) => {
      const line = toLine(this.splits[i] ?? emptySplit());
      cumulative += line.net;
      return { ...bucket, ...line, cumulative };
    });
    const total = this.splits.reduce(
      (a, b) => ({
        inFromBuyers: a.inFromBuyers + b.inFromBuyers,
        inOther: a.inOther + b.inOther,
        outToSellers: a.outToSellers + b.outToSellers,
        outCarCosts: a.outCarCosts + b.outCarCosts,
        outBusiness: a.outBusiness + b.outBusiness,
      }),
      emptySplit(),
    );
    return { buckets, totals: toLine(total) };
  }
}

function emptySplit(): { -readonly [K in keyof Split]: number } {
  return { inFromBuyers: 0, inOther: 0, outToSellers: 0, outCarCosts: 0, outBusiness: 0 };
}

function toLine(split: Split): CashFlowLine {
  const inTotal = split.inFromBuyers + split.inOther;
  const outTotal = split.outToSellers + split.outCarCosts + split.outBusiness;
  return { ...split, in: inTotal, out: outTotal, net: inTotal - outTotal };
}
