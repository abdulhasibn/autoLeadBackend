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
  const splits: { -readonly [K in keyof Split]: number }[] = input.buckets.map(() => emptySplit());

  for (const entry of input.entries) {
    const split = splits[bucketIndexOf(input.buckets, entry.entryDate.value)];
    if (split === undefined) continue;
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

  let cumulative = 0;
  const buckets = input.buckets.map((bucket, i) => {
    const line = toLine(splits[i] ?? emptySplit());
    cumulative += line.net;
    return { ...bucket, ...line, cumulative };
  });
  const total = splits.reduce(
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

function emptySplit(): { -readonly [K in keyof Split]: number } {
  return { inFromBuyers: 0, inOther: 0, outToSellers: 0, outCarCosts: 0, outBusiness: 0 };
}

function toLine(split: Split): CashFlowLine {
  const inTotal = split.inFromBuyers + split.inOther;
  const outTotal = split.outToSellers + split.outCarCosts + split.outBusiness;
  return { ...split, in: inTotal, out: outTotal, net: inTotal - outTotal };
}
