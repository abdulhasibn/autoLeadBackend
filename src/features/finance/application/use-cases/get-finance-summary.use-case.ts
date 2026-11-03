import { daysBetween, localDate, monthStart } from '../../../../domain/shared/business-calendar';
import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import type { CalendarDate } from '../../../../domain/shared/calendar-date.value-object';
import { toShowroomId } from '../../../../domain/shared/showroom-id';
import type { VehicleId } from '../../../../domain/shared/vehicle-id';
import type { Clock } from '../../../../shared/clock/clock';
import { buildCashFlow } from '../../domain/build-cash-flow';
import { buildProfitAndLoss } from '../../domain/build-profit-and-loss';
import type { IFinanceVehicleLookup } from '../../domain/finance-vehicle-lookup.port';
import { hasDues, isInStock } from '../../domain/vehicle-report-rows';
import type { FinanceSummaryDto, SummaryWindowDto } from '../dtos/finance-report.dto';
import type { FinancePolicy } from '../policies/finance.policy';
import type { FinanceReportData, SoldCarRow } from '../services/finance-report-data';
import type { FinanceSessionService } from '../services/finance-session.service';
import type { FinanceEntry } from '../../domain/finance-entry.entity';
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

    const sold = await this.data.soldCarsBetween(cipher, lastFrom.value, today.value, showroomId);
    const entries = await this.data.entriesBetween(cipher, lastFrom.value, today.value, showroomId);
    const carIds = entries.rows.flatMap((e) => (e.vehicleId === null ? [] : [e.vehicleId]));
    const saleDates = await this.data.saleDates(carIds as VehicleId[]);
    const window = (from: CalendarDate, to: CalendarDate): SummaryWindowDto =>
      summarise(from, to, sold.rows, entries.rows, saleDates);

    const cars = await this.data.carsWithMoney(cipher, showroomId);
    const awaiting = (await this.vehicles.listSoldWithoutSale()).filter(
      (car) => showroomId === null || car.showroomId === showroomId,
    );

    return {
      thisMonth: window(thisFrom, today),
      lastMonth: window(lastFrom, lastTo),
      moneyInStock:
        cars.rows
          .filter((car) => isInStock(car.deal, car.vehicle.status, car.money))
          .reduce((t, car) => t + car.money.landingCost, 0) / 100,
      owedToSellers: positiveSum(
        cars.rows.filter((c) => hasDues(c.money)).map((c) => toRupees(c.money.owedToSeller)),
      ),
      owedByBuyers: positiveSum(
        cars.rows.filter((c) => hasDues(c.money)).map((c) => toRupees(c.money.owedByBuyer)),
      ),
      awaitingSalePrice: awaiting.length,
      truncated: sold.truncated || entries.truncated || cars.truncated,
    };
  }
}

function summarise(
  from: CalendarDate,
  to: CalendarDate,
  soldCars: readonly SoldCarRow[],
  entries: readonly FinanceEntry[],
  saleDates: ReadonlyMap<string, string>,
): SummaryWindowDto {
  const buckets = [{ start: from.value, end: to.value, label: from.value }];
  const pnl = buildProfitAndLoss({ buckets, soldCars, entries, saleDates }).totals;
  const cash = buildCashFlow({ buckets, entries }).totals;
  return {
    from: from.value,
    to: to.value,
    sales: pnl.sales / 100,
    netProfit: pnl.netProfit / 100,
    businessExpenses: pnl.businessExpenses / 100,
    cashIn: cash.in / 100,
    cashOut: cash.out / 100,
  };
}

function toRupees(paise: number | null): number | null {
  return paise === null ? null : paise / 100;
}
