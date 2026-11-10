import type { VehicleDeal } from '../../domain/vehicle-deal.entity';

/** Rupee amounts. */
export interface VehicleDealTermsDto {
  /** Purchase cars. */
  readonly purchaseRate: number | null;
  /** Commission cars: our % of the finalised price (e.g. 3.5). */
  readonly commissionPercent: number | null;
  readonly purchasedOn: string | null;
  readonly ownerExpectedPrice: number | null;
  readonly minimumSellingPrice: number | null;
  readonly note: string | null;
}

export interface VehicleSaleDto {
  readonly finalisedPrice: number;
  readonly soldOn: string;
  readonly soldBy: string;
}

export interface VehicleDealStateDto {
  readonly vehicleId: string;
  readonly deal: VehicleDealTermsDto | null;
  readonly sale: VehicleSaleDto | null;
  readonly listedPrice: number | null;
}

export function toVehicleDealStateDto(deal: VehicleDeal): VehicleDealStateDto {
  const terms = deal.terms;
  const sale = deal.sale;
  return {
    vehicleId: deal.vehicleId,
    deal:
      terms === null
        ? null
        : {
            purchaseRate: terms.purchaseRate?.rupees ?? null,
            commissionPercent:
              terms.commissionBasisPoints === null ? null : terms.commissionBasisPoints / 100,
            purchasedOn: terms.purchasedOn?.value ?? null,
            ownerExpectedPrice: terms.ownerExpectedPrice?.rupees ?? null,
            minimumSellingPrice: terms.minimumSellingPrice?.rupees ?? null,
            note: terms.note,
          },
    sale:
      sale === null
        ? null
        : {
            finalisedPrice: sale.finalisedPrice.rupees,
            soldOn: sale.soldOn.value,
            soldBy: sale.soldBy,
          },
    listedPrice: deal.listedPrice?.rupees ?? null,
  };
}
