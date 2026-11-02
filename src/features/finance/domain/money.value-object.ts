/**
 * A non-negative amount of Indian rupees held as integer paise, so sums never
 * drift through floating point.
 */
export class Money {
  private constructor(readonly paise: number) {}

  static ofPaise(paise: number): Money {
    if (!Number.isSafeInteger(paise) || paise < 0) {
      throw new Error('Amount must be a non-negative whole number of paise');
    }
    return new Money(paise);
  }

  /** Accepts up to two decimal places (₹1,234.50). */
  static fromRupees(rupees: number): Money {
    const paise = Math.round(rupees * 100);
    if (!Number.isFinite(rupees) || Math.abs(rupees * 100 - paise) > 1e-6) {
      throw new Error('Amount can have at most two decimal places');
    }
    return Money.ofPaise(paise);
  }

  static zero(): Money {
    return new Money(0);
  }

  get rupees(): number {
    return this.paise / 100;
  }

  add(other: Money): Money {
    return Money.ofPaise(this.paise + other.paise);
  }

  /** Throws when the result would be negative; use `difference` for signed results. */
  subtract(other: Money): Money {
    return Money.ofPaise(this.paise - other.paise);
  }

  /** Signed difference in paise (this − other), e.g. profit that may be a loss. */
  difference(other: Money): number {
    return this.paise - other.paise;
  }

  equals(other: Money): boolean {
    return this.paise === other.paise;
  }
}
