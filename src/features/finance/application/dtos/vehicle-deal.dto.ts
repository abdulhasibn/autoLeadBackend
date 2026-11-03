import type { VehicleDeal } from '../../domain/vehicle-deal.entity';

/** Rupee amounts. */
export interface VehicleDealTermsDto {
  readonly purchaseRate: number;
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
            purchaseRate: terms.purchaseRate.rupees,
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
