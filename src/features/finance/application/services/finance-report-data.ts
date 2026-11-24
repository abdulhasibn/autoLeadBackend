import type { ShowroomId } from '../../../../domain/shared/showroom-id';
import type { VehicleId } from '../../../../domain/shared/vehicle-id';
import type { SaleInfo, SoldCarFigures } from '../../domain/build-profit-and-loss';
import type { FinanceCipher } from '../../domain/finance-cipher.port';
import type { FinanceEntry } from '../../domain/finance-entry.entity';
import type { FinanceEntryFilter, IFinanceEntryQueries } from '../../domain/finance-entry.queries';
import type {
  FinanceVehicleFacts,
  IFinanceVehicleLookup,
} from '../../domain/finance-vehicle-lookup.port';
import type { VehicleDeal } from '../../domain/vehicle-deal.entity';
import type { IVehicleDealQueries } from '../../domain/vehicle-deal.queries';
import { hasDealTerms, VehicleMoneyTally, type VehicleMoney } from '../../domain/vehicle-money';
import { compareQuotesNewestFirst, type VehicleQuote } from '../../domain/vehicle-quote.entity';
import type { IVehicleQuoteQueries } from '../../domain/vehicle-quote.queries';
import type { FinanceLeadFacts } from '../../domain/finance-lead-lookup.port';
import { NO_CURRENT_BUYERS } from '../../domain/vehicle-money';
import type { CarBuyers } from './car-buyers';
import type { EntrySealer } from './entry.sealer';
import type { QuoteSealer } from './quote.sealer';
import type { VehicleDealSealer } from './vehicle-deal.sealer';

/** A car whose sale is dated in the range, with its numbers over every entry it has. */
export interface SoldCarRow extends SoldCarFigures {
  readonly vehicle: FinanceVehicleFacts;
  readonly deal: VehicleDeal;
  readonly money: VehicleMoney;
}

/** A live car with finance data, its decrypted deal, and its numbers. */
export interface CarMoneyRow {
  readonly vehicle: FinanceVehicleFacts;
  readonly deal: VehicleDeal | null;
  readonly money: VehicleMoney;
  /** Names for the leads in `money.refundsOwed`; shared by every row. */
  readonly leads: ReadonlyMap<string, FinanceLeadFacts>;
}

/**
 * Loads and decrypts what the reports need, so every report reads the data
 * the same way. Read side only: queries ports and the car lookup.
 *
 * Totals need every entry, and SQL can't sum encrypted amounts (ADR-0014), so
 * entries are streamed with `scan` and folded into running totals a page at a
 * time: nothing is capped, and memory grows with the number of cars, not
 * entries.
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
    private readonly carBuyers: CarBuyers,
  ) {}

  /** Cars whose sale is dated in the range, with numbers over all their entries (any date). */
  async soldCarsBetween(
    cipher: FinanceCipher,
    from: string,
    to: string,
    showroomId: ShowroomId | null,
  ): Promise<SoldCarRow[]> {
    const deals = (await this.deals.findSoldBetween(from, to)).map((row) =>
      this.dealSealer.open(row, cipher),
    );
    const facts = await this.factsById(deals.map((deal) => deal.vehicleId));
    const kept = deals.filter((deal) => {
      const car = facts.get(deal.vehicleId);
      return car !== undefined && (showroomId === null || car.showroomId === showroomId);
    });
    const tallies = new Map(
      kept.map((deal) => [
        deal.vehicleId as string,
        new VehicleMoneyTally(deal.sale?.soldOn.value ?? null),
      ]),
    );
    if (tallies.size > 0) {
      await this.foldEntries(
        cipher,
        { vehicleIds: kept.map((deal) => deal.vehicleId) },
        (entry) => {
          if (entry.vehicleId !== null) tallies.get(entry.vehicleId)?.add(entry);
        },
      );
    }
    const { buyers } = await this.carBuyers.resolve(
      kept.flatMap((deal) => {
        const vehicle = facts.get(deal.vehicleId);
        const tally = tallies.get(deal.vehicleId);
        return vehicle === undefined || tally === undefined ? [] : [{ vehicle, tally }];
      }),
    );
    return kept.flatMap((deal): SoldCarRow[] => {
      const vehicle = facts.get(deal.vehicleId);
      const tally = tallies.get(deal.vehicleId);
      const sale = deal.sale;
      if (vehicle === undefined || tally === undefined || sale === null) return [];
      return [
        {
          vehicleId: deal.vehicleId,
          soldOn: sale.soldOn.value,
          finalisedPrice: sale.finalisedPrice,
          saleModel: vehicle.saleModel,
          terms: deal.terms,
          costsUpToSale: tally.costsUpToSale,
          money: tally.finish({
            saleModel: vehicle.saleModel,
            terms: deal.terms,
            finalisedPrice: sale.finalisedPrice,
            buyers: buyers.get(deal.vehicleId) ?? NO_CURRENT_BUYERS,
          }),
          vehicle,
          deal,
        },
      ];
    });
  }

  /**
   * Hands every live entry dated in the range to `visit`, with the sale info
   * of its car when that car has a recorded sale (to tell later costs apart).
   */
  async foldEntriesBetween(
    cipher: FinanceCipher,
    from: string,
    to: string,
    showroomId: ShowroomId | null,
    visit: (entry: FinanceEntry, sale: SaleInfo | undefined) => void,
  ): Promise<void> {
    const sales = new Map<string, SaleInfo>();
    const looked = new Set<string>();
    const filter = { from, to, ...(showroomId === null ? {} : { showroomId }) };
    await this.foldPages(cipher, filter, async (page) => {
      const unseen = [
        ...new Set(page.flatMap((e) => (e.vehicleId === null ? [] : [e.vehicleId]))),
      ].filter((id) => !looked.has(id));
      if (unseen.length > 0) {
        unseen.forEach((id) => looked.add(id));
        for (const [id, info] of await this.saleInfo(cipher, unseen)) sales.set(id, info);
      }
      for (const entry of page) {
        visit(entry, entry.vehicleId === null ? undefined : sales.get(entry.vehicleId));
      }
    });
  }

  /**
   * Sale date and later-cost rule for these cars' recorded sales. The date is
   * plaintext; the terms need the deal opened.
   */
  async saleInfo(
    cipher: FinanceCipher,
    vehicleIds: readonly VehicleId[],
  ): Promise<Map<string, SaleInfo>> {
    const sales = new Map<string, SaleInfo>();
    const rows = (await this.deals.findMany([...new Set(vehicleIds)])).filter(
      (row) => row.soldOn !== null,
    );
    const facts = await this.factsById(rows.map((row) => row.vehicleId));
    for (const row of rows) {
      if (row.soldOn === null) continue;
      const deal = this.dealSealer.open(row, cipher);
      const saleModel = facts.get(row.vehicleId)?.saleModel ?? 'purchase';
      sales.set(row.vehicleId, {
        soldOn: row.soldOn,
        countsLaterCosts: saleModel === 'purchase' && hasDealTerms(saleModel, deal.terms),
      });
    }
    return sales;
  }

  /** Every live car holding a deal or entries, with its numbers over all its entries. */
  async carsWithMoney(
    cipher: FinanceCipher,
    showroomId: ShowroomId | null,
  ): Promise<CarMoneyRow[]> {
    const deals = new Map(
      (await this.deals.findWithData()).map((row) => [
        row.vehicleId as string,
        this.dealSealer.open(row, cipher),
      ]),
    );
    const tallies = new Map<string, VehicleMoneyTally>();
    await this.foldEntries(cipher, {}, (entry) => {
      if (entry.vehicleId === null) return;
      let tally = tallies.get(entry.vehicleId);
      if (tally === undefined) {
        tally = new VehicleMoneyTally();
        tallies.set(entry.vehicleId, tally);
      }
      tally.add(entry);
    });
    const ids = [...new Set([...deals.keys(), ...tallies.keys()])] as VehicleId[];
    const facts = await this.factsById(ids);

    const live = ids.flatMap((id) => {
      const vehicle = facts.get(id);
      if (vehicle === undefined || vehicle.deleted) return [];
      if (showroomId !== null && vehicle.showroomId !== showroomId) return [];
      return [{ vehicle, tally: tallies.get(id) ?? new VehicleMoneyTally() }];
    });
    const { buyers, leads } = await this.carBuyers.resolve(live);

    return live.map(({ vehicle, tally }): CarMoneyRow => {
      const deal = deals.get(vehicle.id) ?? null;
      return {
        vehicle,
        deal,
        leads,
        money: tally.finish({
          saleModel: vehicle.saleModel,
          terms: deal?.terms ?? null,
          finalisedPrice: deal?.sale?.finalisedPrice ?? null,
          buyers: buyers.get(vehicle.id) ?? NO_CURRENT_BUYERS,
        }),
      };
    });
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

  private async foldEntries(
    cipher: FinanceCipher,
    filter: FinanceEntryFilter,
    visit: (entry: FinanceEntry) => void,
  ): Promise<void> {
    await this.foldPages(cipher, filter, (page) => {
      page.forEach(visit);
    });
  }

  /** Decrypts one page at a time; a page is dropped before the next is read. */
  private async foldPages(
    cipher: FinanceCipher,
    filter: FinanceEntryFilter,
    visit: (page: readonly FinanceEntry[]) => void | Promise<void>,
  ): Promise<void> {
    for await (const sealed of this.entries.scan(filter)) {
      await visit(sealed.map((row) => this.entrySealer.open(row, cipher)));
    }
  }
}
