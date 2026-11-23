import { daysBetween, localDate, monthStart } from '../../../../domain/shared/business-calendar';
import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import type { CalendarDate } from '../../../../domain/shared/calendar-date.value-object';
import { toShowroomId } from '../../../../domain/shared/showroom-id';
import type { Clock } from '../../../../shared/clock/clock';
import { CashFlowTally } from '../../domain/build-cash-flow';
import { ProfitAndLossTally } from '../../domain/build-profit-and-loss';
import type { IFinanceVehicleLookup } from '../../domain/finance-vehicle-lookup.port';
import { hasDues, isInStock } from '../../domain/vehicle-report-rows';
import type { FinanceSummaryDto, SummaryWindowDto } from '../dtos/finance-report.dto';
import type { FinancePolicy } from '../policies/finance.policy';
import type { FinanceReportData } from '../services/finance-report-data';
import type { FinanceSessionService } from '../services/finance-session.service';
import { positiveSum } from './get-dues-report.use-case';

/**
 * Dashboard money tiles: month to date against the same span of last month,
 * plus stock, dues and sold cars awaiting a price. "Today" is taken in the
 * business timezone.
 */
export class GetFinanceSummaryUseCase {
  constructor(
    private readonly policy: FinancePolicy,
    private readonly sessions: FinanceSessionService,
    private readonly data: FinanceReportData,
    private readonly vehicles: IFinanceVehicleLookup,
    private readonly clock: Clock,
    private readonly timeZone: string,
  ) {}

  async execute(
    query: { readonly sessionToken: string | null; readonly showroomId: string | null },
    ctx: AuthenticatedContext,
  ): Promise<FinanceSummaryDto> {
    this.policy.requireAdmin(ctx);
    const { cipher } = await this.sessions.open(ctx, query.sessionToken);
    const showroomId = query.showroomId === null ? null : toShowroomId(query.showroomId);

    const today = localDate(this.clock.now(), this.timeZone);
    const thisFrom = monthStart(today, 0);
    const lastFrom = monthStart(today, -1);
    const lastMonthEnd = thisFrom.addDays(-1);
    const sameSpan = lastFrom.addDays(daysBetween(thisFrom, today));
    const lastTo = sameSpan.value > lastMonthEnd.value ? lastMonthEnd : sameSpan;

    const thisMonth = new SummaryWindow(thisFrom, today);
    const lastMonth = new SummaryWindow(lastFrom, lastTo);
    const windows = [thisMonth, lastMonth];
    for (const car of await this.data.soldCarsBetween(
      cipher,
      lastFrom.value,
      today.value,
      showroomId,
    )) {
      windows.forEach((w) => w.pnl.addSoldCar(car));
    }
    await this.data.foldEntriesBetween(
      cipher,
      lastFrom.value,
      today.value,
      showroomId,
      (entry, sale) => {
        for (const w of windows) {
          w.pnl.addEntry(entry, sale);
          w.cash.add(entry);
        }
      },
    );

    const cars = await this.data.carsWithMoney(cipher, showroomId);
    const awaiting = (await this.vehicles.listSoldWithoutSale()).filter(
      (car) => showroomId === null || car.showroomId === showroomId,
    );

    return {
      thisMonth: thisMonth.result(),
      lastMonth: lastMonth.result(),
      moneyInStock:
        cars
          .filter((car) => isInStock(car.deal, car.vehicle.status, car.money))
          .reduce((t, car) => t + car.money.landingCost, 0) / 100,
      owedToSellers: positiveSum(
        cars.filter((c) => hasDues(c.money)).map((c) => toRupees(c.money.owedToSeller)),
      ),
      owedByBuyers: positiveSum(
        cars.filter((c) => hasDues(c.money)).map((c) => toRupees(c.money.owedByBuyer)),
      ),
      awaitingSalePrice: awaiting.length,
      truncated: false,
    };
  }
}

/** One dashboard window: P&L and cash flow over a single bucket, folded entry by entry. */
class SummaryWindow {
  readonly pnl: ProfitAndLossTally;
  readonly cash: CashFlowTally;

  constructor(
    private readonly from: CalendarDate,
    private readonly to: CalendarDate,
  ) {
    const buckets = [{ start: from.value, end: to.value, label: from.value }];
    this.pnl = new ProfitAndLossTally(buckets);
    this.cash = new CashFlowTally(buckets);
  }

  result(): SummaryWindowDto {
    const pnl = this.pnl.result().totals;
    const cash = this.cash.result().totals;
    return {
      from: this.from.value,
      to: this.to.value,
      sales: pnl.sales / 100,
      commissions: pnl.commissions / 100,
      commissionSalesValue: pnl.commissionSalesValue / 100,
      netProfit: pnl.netProfit / 100,
      businessExpenses: pnl.businessExpenses / 100,
      cashIn: cash.in / 100,
      cashOut: cash.out / 100,
      carsMissingPurchaseRate: pnl.carsMissingPurchaseRate,
      uncountedSales: pnl.uncountedSales / 100,
    };
  }
}

function toRupees(paise: number | null): number | null {
  return paise === null ? null : paise / 100;
}
