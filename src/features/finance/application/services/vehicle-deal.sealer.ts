import { DataIntegrityError } from '../../../../domain/errors/data-integrity.error';
import { CalendarDate } from '../../../../domain/shared/calendar-date.value-object';
import type { FinanceCipher } from '../../domain/finance-cipher.port';
import { Money } from '../../domain/money.value-object';
import type { SealedVehicleDeal } from '../../domain/sealed-finance-records';
import { VehicleDeal, type DealTerms } from '../../domain/vehicle-deal.entity';

interface DealPayload {
  readonly purchaseRate: number | null;
  /** Missing on payloads sealed before commission sales (ADR-0017). */
  readonly commissionBasisPoints?: number | null;
  readonly purchasedOn: string | null;
  readonly ownerExpectedPrice: number | null;
  readonly minimumSellingPrice: number | null;
  readonly note: string | null;
  readonly finalisedPrice: number | null;
}

/**
 * Seals a car's deal (purchase terms and finalised price) into the
 * `vehicle_financials` payload bound to `vehicle_financials:<vehicleId>`.
 * The listed price and sale date stay plaintext by design.
 */
export class VehicleDealSealer {
  seal(deal: VehicleDeal, cipher: FinanceCipher): SealedVehicleDeal {
    const base = {
      vehicleId: deal.vehicleId,
      listedPrice: deal.listedPrice?.rupees ?? null,
      soldOn: deal.sale?.soldOn.value ?? null,
      soldBy: deal.sale?.soldBy ?? null,
      updatedAt: deal.updatedAt,
    };
    if (!deal.hasPrivateData) {
      return { ...base, payload: null, keyVersion: null };
    }
    const terms = deal.terms;
    const payload: DealPayload = {
      purchaseRate: terms?.purchaseRate?.paise ?? null,
      commissionBasisPoints: terms?.commissionBasisPoints ?? null,
      purchasedOn: terms?.purchasedOn?.value ?? null,
      ownerExpectedPrice: terms?.ownerExpectedPrice?.paise ?? null,
      minimumSellingPrice: terms?.minimumSellingPrice?.paise ?? null,
      note: terms?.note ?? null,
      finalisedPrice: deal.sale?.finalisedPrice.paise ?? null,
    };
    return {
      ...base,
      payload: cipher.seal(JSON.stringify(payload), aad(deal.vehicleId)),
      keyVersion: cipher.keyVersion,
    };
  }

  open(record: SealedVehicleDeal, cipher: FinanceCipher): VehicleDeal {
    const listedPrice = record.listedPrice === null ? null : Money.fromRupees(record.listedPrice);
    if (record.payload === null) {
      if (record.soldOn !== null) {
        throw new DataIntegrityError(
          `Vehicle deal ${record.vehicleId} has a sale date but no payload`,
        );
      }
      return VehicleDeal.reconstitute({
        vehicleId: record.vehicleId,
        terms: null,
        sale: null,
        listedPrice,
        updatedAt: record.updatedAt,
      });
    }

    const p = parsePayload(cipher.open(record.payload, aad(record.vehicleId)), record.vehicleId);
    const commissionBasisPoints = p.commissionBasisPoints ?? null;
    const terms: DealTerms | null =
      p.purchaseRate === null && commissionBasisPoints === null
        ? null
        : {
            purchaseRate: p.purchaseRate === null ? null : Money.ofPaise(p.purchaseRate),
            commissionBasisPoints,
            purchasedOn: p.purchasedOn === null ? null : CalendarDate.create(p.purchasedOn),
            ownerExpectedPrice:
              p.ownerExpectedPrice === null ? null : Money.ofPaise(p.ownerExpectedPrice),
            minimumSellingPrice:
              p.minimumSellingPrice === null ? null : Money.ofPaise(p.minimumSellingPrice),
            note: p.note,
          };
    const hasSale = p.finalisedPrice !== null;
    if (hasSale !== (record.soldOn !== null) || (hasSale && record.soldBy === null)) {
      throw new DataIntegrityError(`Vehicle deal ${record.vehicleId} has an inconsistent sale`);
    }
    return VehicleDeal.reconstitute({
      vehicleId: record.vehicleId,
      terms,
      sale:
        p.finalisedPrice !== null && record.soldOn !== null && record.soldBy !== null
          ? {
              finalisedPrice: Money.ofPaise(p.finalisedPrice),
              soldOn: CalendarDate.create(record.soldOn),
              soldBy: record.soldBy,
            }
          : null,
      listedPrice,
      updatedAt: record.updatedAt,
    });
  }
}

function aad(vehicleId: string): string {
  return `vehicle_financials:${vehicleId}`;
}

function parsePayload(json: string, vehicleId: string): DealPayload {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    throw new DataIntegrityError(`Vehicle deal ${vehicleId} has an unreadable payload`);
  }
  const p = value as Partial<Record<keyof DealPayload, unknown>>;
  const amount = (v: unknown): boolean =>
    v === null || (typeof v === 'number' && Number.isSafeInteger(v) && v > 0);
  const text = (v: unknown): boolean => v === null || typeof v === 'string';
  const basisPoints = (v: unknown): boolean =>
    v === undefined || v === null || (typeof v === 'number' && Number.isSafeInteger(v) && v > 0);
  if (
    typeof value !== 'object' ||
    value === null ||
    !amount(p.purchaseRate) ||
    !basisPoints(p.commissionBasisPoints) ||
    !amount(p.ownerExpectedPrice) ||
    !amount(p.minimumSellingPrice) ||
    !amount(p.finalisedPrice) ||
    !text(p.purchasedOn) ||
    !text(p.note)
  ) {
    throw new DataIntegrityError(`Vehicle deal ${vehicleId} has an invalid payload`);
  }
  return value as DealPayload;
}
