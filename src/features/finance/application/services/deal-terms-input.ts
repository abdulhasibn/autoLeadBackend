import { BusinessRuleViolationError } from '../../../../domain/errors/business-rule-violation.error';
import { CalendarDate } from '../../../../domain/shared/calendar-date.value-object';
import { Money } from '../../domain/money.value-object';
import type { SaleModel } from '../../domain/sale-model';
import type { DealTerms } from '../../domain/vehicle-deal.entity';

/** Deal terms as a request sends them; amounts in paise. */
export interface DealTermsInput {
  readonly purchaseRatePaise: number | null;
  readonly commissionBasisPoints: number | null;
  readonly purchasedOn: string | null;
  readonly ownerExpectedPricePaise?: number | null;
  readonly minimumSellingPricePaise?: number | null;
  readonly note?: string | null;
}

/**
 * Builds the terms for a car's sale model (ADR-0017): a purchase car needs a
 * purchase rate, a commission car a commission %; the other one is dropped.
 */
export function dealTermsFor(saleModel: SaleModel, input: DealTermsInput): DealTerms {
  const commission = saleModel === 'commission';
  if (commission ? input.commissionBasisPoints === null : input.purchaseRatePaise === null) {
    throw new BusinessRuleViolationError(
      'INVALID_DEAL_TERMS',
      commission
        ? 'This car is sold for a commission: set commissionPercent'
        : 'This car is bought outright: set purchaseRate',
    );
  }
  const money = (paise: number | null | undefined): Money | null =>
    paise === null || paise === undefined ? null : Money.ofPaise(paise);
  return {
    purchaseRate: commission ? null : money(input.purchaseRatePaise),
    commissionBasisPoints: commission ? input.commissionBasisPoints : null,
    purchasedOn: input.purchasedOn === null ? null : CalendarDate.create(input.purchasedOn),
    ownerExpectedPrice: money(input.ownerExpectedPricePaise),
    minimumSellingPrice: money(input.minimumSellingPricePaise),
    note: input.note ?? null,
  };
}
