import { BusinessRuleViolationError } from '../../../domain/errors/business-rule-violation.error';
import type { CalendarDate } from '../../../domain/shared/calendar-date.value-object';
import type { UserId } from '../../../domain/shared/user-id';
import type { VehicleId } from '../../../domain/shared/vehicle-id';
import type { Money } from './money.value-object';

export const MAX_DEAL_NOTE_LENGTH = 1000;
/** 100% in basis points (1 bp = 0.01%). */
export const MAX_COMMISSION_BASIS_POINTS = 10_000;

/**
 * The terms agreed with the owner. Exactly one of `purchaseRate` (bought
 * outright) or `commissionBasisPoints` (sold for a commission) is set,
 * matching the car's sale model (ADR-0017).
 */
export interface DealTerms {
  readonly purchaseRate: Money | null;
  /** Our cut of the finalised price, in basis points (350 = 3.5%). */
  readonly commissionBasisPoints: number | null;
  readonly purchasedOn: CalendarDate | null;
  readonly ownerExpectedPrice: Money | null;
  readonly minimumSellingPrice: Money | null;
  readonly note: string | null;
}

export interface VehicleSale {
  readonly finalisedPrice: Money;
  readonly soldOn: CalendarDate;
  readonly soldBy: UserId;
}

export interface VehicleDealProps {
  readonly vehicleId: VehicleId;
  /** Null until the purchase terms are entered (a sale may be recorded first). */
  readonly terms: DealTerms | null;
  readonly sale: VehicleSale | null;
  /** Public asking price (plaintext by design, ADR-0014). */
  readonly listedPrice: Money | null;
  readonly updatedAt: Date;
}

/**
 * A car's buy-and-sell terms (ADR-0015): the purchase rate agreed with the
 * seller and the finalised price agreed with the buyer. Payments against
 * them are ledger entries.
 */
export class VehicleDeal {
  private constructor(private props: VehicleDealProps) {}

  static empty(vehicleId: VehicleId, listedPrice: Money | null, now: Date): VehicleDeal {
    return new VehicleDeal({ vehicleId, terms: null, sale: null, listedPrice, updatedAt: now });
  }

  static reconstitute(props: VehicleDealProps): VehicleDeal {
    return new VehicleDeal(props);
  }

  get vehicleId(): VehicleId {
    return this.props.vehicleId;
  }
  get terms(): DealTerms | null {
    return this.props.terms;
  }
  get sale(): VehicleSale | null {
    return this.props.sale;
  }
  get listedPrice(): Money | null {
    return this.props.listedPrice;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }
  /** True when there is something to seal (terms or a sale). */
  get hasPrivateData(): boolean {
    return this.props.terms !== null || this.props.sale !== null;
  }

  setTerms(terms: DealTerms, now: Date): void {
    if ((terms.purchaseRate === null) === (terms.commissionBasisPoints === null)) {
      throw new BusinessRuleViolationError(
        'INVALID_DEAL_TERMS',
        'Set either a purchase rate or a commission percentage',
      );
    }
    if (terms.purchaseRate !== null) requirePositive(terms.purchaseRate, 'purchaseRate');
    if (terms.commissionBasisPoints !== null) {
      requireCommission(terms.commissionBasisPoints);
    }
    if (terms.ownerExpectedPrice !== null)
      requirePositive(terms.ownerExpectedPrice, 'ownerExpectedPrice');
    if (terms.minimumSellingPrice !== null) {
      requirePositive(terms.minimumSellingPrice, 'minimumSellingPrice');
    }
    const note = terms.note?.trim() ?? '';
    if (note.length > MAX_DEAL_NOTE_LENGTH) {
      throw new BusinessRuleViolationError(
        'TEXT_TOO_LONG',
        `note can be at most ${MAX_DEAL_NOTE_LENGTH} characters`,
      );
    }
    this.props = {
      ...this.props,
      terms: { ...terms, note: note.length === 0 ? null : note },
      updatedAt: now,
    };
  }

  setListedPrice(listedPrice: Money | null, now: Date): void {
    if (listedPrice !== null) requirePositive(listedPrice, 'listedPrice');
    this.props = { ...this.props, listedPrice, updatedAt: now };
  }

  recordSale(finalisedPrice: Money, soldOn: CalendarDate, soldBy: UserId, now: Date): void {
    requirePositive(finalisedPrice, 'finalisedPrice');
    this.props = { ...this.props, sale: { finalisedPrice, soldOn, soldBy }, updatedAt: now };
  }

  clearSale(now: Date): void {
    this.props = { ...this.props, sale: null, updatedAt: now };
  }
}

function requireCommission(basisPoints: number): void {
  if (
    !Number.isInteger(basisPoints) ||
    basisPoints <= 0 ||
    basisPoints > MAX_COMMISSION_BASIS_POINTS
  ) {
    throw new BusinessRuleViolationError(
      'INVALID_COMMISSION',
      'Commission must be more than 0% and at most 100%, to two decimals',
    );
  }
}

function requirePositive(amount: Money, field: string): void {
  if (amount.paise <= 0) {
    throw new BusinessRuleViolationError('INVALID_AMOUNT', `${field} must be greater than zero`);
  }
}
