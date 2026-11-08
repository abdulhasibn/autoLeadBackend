import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import { CalendarDate } from '../../../../domain/shared/calendar-date.value-object';
import { toShowroomId } from '../../../../domain/shared/showroom-id';
import { ReportPeriod } from '../../domain/report-period.value-object';
import { calculateVehicleMoney } from '../../domain/vehicle-money';
import type { VehicleProfitReportDto, VehicleProfitRowDto } from '../dtos/finance-report.dto';
import type { FinancePolicy } from '../policies/finance.policy';
import type { FinanceReportData } from '../services/finance-report-data';
import type { FinanceSessionService } from '../services/finance-session.service';

export const VEHICLE_PROFIT_SORTS = ['profit', '-profit', 'date', '-date'] as const;
export type VehicleProfitSort = (typeof VEHICLE_PROFIT_SORTS)[number];

/** Profit per car sold in the range. `profit` = biggest first; `date` = newest first. */
export class GetVehicleProfitReportUseCase {
  constructor(
    private readonly policy: FinancePolicy,
    private readonly sessions: FinanceSessionService,
    private readonly data: FinanceReportData,
  ) {}

  async execute(
    query: {
      readonly sessionToken: string | null;
      readonly from: string;
      readonly to: string;
      readonly showroomId: string | null;
      readonly sort: VehicleProfitSort;
    },
    ctx: AuthenticatedContext,
  ): Promise<VehicleProfitReportDto> {
    this.policy.requireAdmin(ctx);
    const from = CalendarDate.create(query.from);
    const to = CalendarDate.create(query.to);
    ReportPeriod.create('month').assertRange(from, to);
    const { cipher } = await this.sessions.open(ctx, query.sessionToken);
    const showroomId = query.showroomId === null ? null : toShowroomId(query.showroomId);

    const sold = await this.data.soldCarsBetween(cipher, from.value, to.value, showroomId);
    const items: VehicleProfitRowDto[] = sold.rows.map((car) => {
      const money = calculateVehicleMoney({
        purchaseRate: car.purchaseRate,
        finalisedPrice: car.finalisedPrice,
        entries: car.entries,
      });
      return {
        vehicle: { id: car.vehicle.id, label: car.vehicle.label },
        soldOn: car.soldOn,
        purchaseRate: car.purchaseRate?.rupees ?? null,
        costs: money.costs / 100,
        landingCost: money.landingCost / 100,
        finalisedPrice: car.finalisedPrice.rupees,
        profit: money.profit === null ? null : money.profit / 100,
      };
    });
    items.sort(comparators[query.sort]);
    // Profit is unknown without a purchase rate, so those cars stay out of the money totals.
    const counted = items.filter((i) => i.purchaseRate !== null);

    return {
      from: from.value,
      to: to.value,
      items,
      totals: {
        cars: items.length,
        sales: sum(counted.map((i) => i.finalisedPrice)),
        landingCost: sum(counted.map((i) => i.landingCost)),
        profit: sum(counted.map((i) => i.profit ?? 0)),
        carsMissingPurchaseRate: items.length - counted.length,
        uncountedSales: sum(
          items.filter((i) => i.purchaseRate === null).map((i) => i.finalisedPrice),
        ),
      },
      truncated: sold.truncated,
    };
  }
}

const byProfit = (a: VehicleProfitRowDto, b: VehicleProfitRowDto): number =>
  (a.profit ?? Number.NEGATIVE_INFINITY) - (b.profit ?? Number.NEGATIVE_INFINITY);
const byDate = (a: VehicleProfitRowDto, b: VehicleProfitRowDto): number =>
  a.soldOn.localeCompare(b.soldOn);

const comparators: Record<
  VehicleProfitSort,
  (a: VehicleProfitRowDto, b: VehicleProfitRowDto) => number
> = {
  profit: (a, b) => byProfit(b, a) || byDate(b, a),
  '-profit': (a, b) => byProfit(a, b) || byDate(b, a),
  date: (a, b) => byDate(b, a),
  '-date': byDate,
};

function sum(values: readonly number[]): number {
  return Math.round(values.reduce((total, v) => total + v, 0) * 100) / 100;
}
