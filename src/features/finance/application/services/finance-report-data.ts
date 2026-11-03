import type { ShowroomId } from '../../../../domain/shared/showroom-id';
import type { VehicleId } from '../../../../domain/shared/vehicle-id';
import type { SoldCar } from '../../domain/build-profit-and-loss';
import type { FinanceCipher } from '../../domain/finance-cipher.port';
import type { FinanceEntry } from '../../domain/finance-entry.entity';
import type { IFinanceEntryQueries } from '../../domain/finance-entry.queries';
import type {
  FinanceVehicleFacts,
  IFinanceVehicleLookup,
} from '../../domain/finance-vehicle-lookup.port';
import { MAX_LEDGER_ROWS } from '../../domain/finance.constants';
import type { VehicleDeal } from '../../domain/vehicle-deal.entity';
import type { IVehicleDealQueries } from '../../domain/vehicle-deal.queries';
import { calculateVehicleMoney, type VehicleMoney } from '../../domain/vehicle-money';
import { compareQuotesNewestFirst, type VehicleQuote } from '../../domain/vehicle-quote.entity';
import type { IVehicleQuoteQueries } from '../../domain/vehicle-quote.queries';
import type { EntrySealer } from './entry.sealer';
import type { QuoteSealer } from './quote.sealer';
import type { VehicleDealSealer } from './vehicle-deal.sealer';

export interface SoldCarRow extends SoldCar {
  readonly vehicle: FinanceVehicleFacts;
  readonly deal: VehicleDeal;
}

/** A live car with finance data, its decrypted deal and entries, and its numbers. */
export interface CarMoneyRow {
  readonly vehicle: FinanceVehicleFacts;
  readonly deal: VehicleDeal | null;
  readonly entries: readonly FinanceEntry[];
  readonly money: VehicleMoney;
}

export interface Loaded<T> {
  readonly rows: T;
  /** A read hit MAX_LEDGER_ROWS; figures may be incomplete. */
  readonly truncated: boolean;
}

/**
 * Loads and decrypts what the reports need, so every report reads the data
 * the same way. Read side only: queries ports and the car lookup.
 */
export class FinanceReportData {
  constructor(
    private readonly deals: IVehicleDealQueries,
    private readonly entries: IFinanceEntryQueries,
    private readonly quotes: IVehicleQuoteQueries,
    private readonly vehicles: IFinanceVehicleLookup,
    private readonly dealSealer: VehicleDealSealer,
    private readonly entrySealer: EntrySealer,
    private readonly quoteSealer: QuoteSealer,
  ) {}

  /** Cars whose sale is dated in the range, with every entry they have (any date). */
  async soldCarsBetween(
    cipher: FinanceCipher,
    from: string,
    to: string,
    showroomId: ShowroomId | null,
  ): Promise<Loaded<SoldCarRow[]>> {
    const deals = (await this.deals.findSoldBetween(from, to)).map((row) =>
      this.dealSealer.open(row, cipher),
    );
    const facts = await this.factsById(deals.map((deal) => deal.vehicleId));
    const kept = deals.filter((deal) => {
      const car = facts.get(deal.vehicleId);
      return car !== undefined && (showroomId === null || car.showroomId === showroomId);
    });
    const { byCar, truncated } = await this.entriesOfCars(
      cipher,
      kept.map((deal) => deal.vehicleId),
    );
    const rows = kept.flatMap((deal): SoldCarRow[] => {
      const vehicle = facts.get(deal.vehicleId);
      const sale = deal.sale;
      if (vehicle === undefined || sale === null) return [];
      return [
        {
          vehicleId: deal.vehicleId,
          soldOn: sale.soldOn.value,
          finalisedPrice: sale.finalisedPrice,
          purchaseRate: deal.terms?.purchaseRate ?? null,
          entries: byCar.get(deal.vehicleId) ?? [],
          vehicle,
          deal,
        },
      ];
    });
    return { rows, truncated };
  }

  /** Every live entry dated in the range. */
  async entriesBetween(
    cipher: FinanceCipher,
    from: string,
    to: string,
    showroomId: ShowroomId | null,
  ): Promise<Loaded<FinanceEntry[]>> {
    const page = await this.entries.list({
      from,
      to,
      ...(showroomId === null ? {} : { showroomId }),
      maxRows: MAX_LEDGER_ROWS,
    });
    return {
      rows: page.rows.map((row) => this.entrySealer.open(row, cipher)),
      truncated: page.truncated,
    };
  }

  /** Recorded sale dates for these cars (plaintext; nothing to decrypt). */
  async saleDates(vehicleIds: readonly VehicleId[]): Promise<Map<string, string>> {
    const dates = new Map<string, string>();
    for (const deal of await this.deals.findMany([...new Set(vehicleIds)])) {
      if (deal.soldOn !== null) dates.set(deal.vehicleId, deal.soldOn);
    }
    return dates;
  }

  /** Every live car holding a deal or entries, with its numbers. */
  async carsWithMoney(
    cipher: FinanceCipher,
    showroomId: ShowroomId | null,
  ): Promise<Loaded<CarMoneyRow[]>> {
    const deals = new Map(
      (await this.deals.findWithData()).map((row) => [
        row.vehicleId as string,
        this.dealSealer.open(row, cipher),
      ]),
    );
    const page = await this.entries.list({ maxRows: MAX_LEDGER_ROWS });
    const byCar = new Map<string, FinanceEntry[]>();
    for (const row of page.rows) {
      if (row.vehicleId === null) continue;
      const entry = this.entrySealer.open(row, cipher);
      byCar.set(row.vehicleId, [...(byCar.get(row.vehicleId) ?? []), entry]);
    }
    const ids = [...new Set([...deals.keys(), ...byCar.keys()])] as VehicleId[];
    const facts = await this.factsById(ids);

    const rows = ids.flatMap((id): CarMoneyRow[] => {
      const vehicle = facts.get(id);
      if (vehicle === undefined || vehicle.deleted) return [];
      if (showroomId !== null && vehicle.showroomId !== showroomId) return [];
      const deal = deals.get(id) ?? null;
      const entries = byCar.get(id) ?? [];
      return [
        {
          vehicle,
          deal,
          entries,
          money: calculateVehicleMoney({
            purchaseRate: deal?.terms?.purchaseRate ?? null,
            finalisedPrice: deal?.sale?.finalisedPrice ?? null,
            entries,
          }),
        },
      ];
    });
    return { rows, truncated: page.truncated };
  }

  async latestQuotes(
    cipher: FinanceCipher,
    vehicleIds: readonly VehicleId[],
  ): Promise<Map<string, VehicleQuote>> {
    const latest = new Map<string, VehicleQuote>();
    for (const row of await this.quotes.listForVehicles(vehicleIds)) {
      const quote = this.quoteSealer.open(row, cipher);
      const current = latest.get(quote.vehicleId);
      if (current === undefined || compareQuotesNewestFirst(quote, current) < 0) {
        latest.set(quote.vehicleId, quote);
      }
    }
    return latest;
  }

  private async factsById(ids: readonly VehicleId[]): Promise<Map<string, FinanceVehicleFacts>> {
    const facts = ids.length === 0 ? [] : await this.vehicles.findMany(ids);
    return new Map(facts.map((car) => [car.id as string, car]));
  }

  private async entriesOfCars(
    cipher: FinanceCipher,
    vehicleIds: readonly VehicleId[],
  ): Promise<{ byCar: Map<string, FinanceEntry[]>; truncated: boolean }> {
    const byCar = new Map<string, FinanceEntry[]>();
    if (vehicleIds.length === 0) return { byCar, truncated: false };
    const page = await this.entries.list({ vehicleIds, maxRows: MAX_LEDGER_ROWS });
    for (const row of page.rows) {
      if (row.vehicleId === null) continue;
      byCar.set(row.vehicleId, [
        ...(byCar.get(row.vehicleId) ?? []),
        this.entrySealer.open(row, cipher),
      ]);
    }
    return { byCar, truncated: page.truncated };
  }
}
