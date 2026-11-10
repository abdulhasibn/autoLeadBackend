/**
 * How the business makes money on a car (ADR-0017):
 * - `purchase`: bought outright from the owner and resold as our own;
 * - `commission`: marketed for the owner; we keep a % of the sale price.
 * Read from `vehicles.acquisition_type`; finance never imports the vehicles feature.
 */
export type SaleModel = 'purchase' | 'commission';

/** `intermediary_sale` is retired and reads as a commission sale. */
export function saleModelOf(acquisitionType: string | null): SaleModel {
  return acquisitionType === 'consignment' || acquisitionType === 'intermediary_sale'
    ? 'commission'
    : 'purchase';
}
