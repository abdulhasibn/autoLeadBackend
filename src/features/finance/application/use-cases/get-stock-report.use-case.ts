import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import { toShowroomId } from '../../../../domain/shared/showroom-id';
import type { VehicleId } from '../../../../domain/shared/vehicle-id';
import { isInStock } from '../../domain/vehicle-report-rows';
import type { StockReportDto, StockRowDto } from '../dtos/finance-report.dto';
import type { FinancePolicy } from '../policies/finance.policy';
import type { FinanceReportData } from '../services/finance-report-data';
import { commissionPercentOf } from '../dtos/vehicle-finance.dto';
import type { FinanceSessionService } from '../services/finance-session.service';

/** Money tied up in cars not yet sold, biggest first. */
export class GetStockReportUseCase {
  constructor(
    private readonly policy: FinancePolicy,
    private readonly sessions: FinanceSessionService,
    private readonly data: FinanceReportData,
  ) {}

  async execute(
    query: { readonly sessionToken: string | null; readonly showroomId: string | null },
    ctx: AuthenticatedContext,
  ): Promise<StockReportDto> {
    this.policy.requireAdmin(ctx);
    const { cipher } = await this.sessions.open(ctx, query.sessionToken);
    const cars = await this.data.carsWithMoney(
      cipher,
      query.showroomId === null ? null : toShowroomId(query.showroomId),
    );
    const stock = cars.rows.filter((car) => isInStock(car.deal, car.vehicle.status, car.money));
    const quotes = await this.data.latestQuotes(
      cipher,
      stock.map((car) => car.vehicle.id as VehicleId),
    );

    const items: StockRowDto[] = stock
      .map(({ vehicle, deal, money }) => ({
        vehicle: { id: vehicle.id, label: vehicle.label },
        status: vehicle.status,
        saleModel: vehicle.saleModel,
        purchaseRate: deal?.terms?.purchaseRate?.rupees ?? null,
        commissionPercent: commissionPercentOf(deal),
        costs: money.costs / 100,
        landingCost: money.landingCost / 100,
        currentQuote: quotes.get(vehicle.id)?.amount.rupees ?? null,
        listedPrice: deal?.listedPrice?.rupees ?? null,
      }))
      .sort((a, b) => b.landingCost - a.landingCost);

    return {
      items,
      totals: {
        cars: items.length,
        moneyInStock: Math.round(items.reduce((t, i) => t + i.landingCost, 0) * 100) / 100,
      },
      truncated: cars.truncated,
    };
  }
}
