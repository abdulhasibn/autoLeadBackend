import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import { toShowroomId } from '../../../../domain/shared/showroom-id';
import { hasDues } from '../../domain/vehicle-report-rows';
import type { DuesReportDto, DuesRowDto } from '../dtos/finance-report.dto';
import type { FinancePolicy } from '../policies/finance.policy';
import type { FinanceReportData } from '../services/finance-report-data';
import type { FinanceSessionService } from '../services/finance-session.service';

/** Cars where money is still owed to the seller or by the buyer (either sign). */
export class GetDuesReportUseCase {
  constructor(
    private readonly policy: FinancePolicy,
    private readonly sessions: FinanceSessionService,
    private readonly data: FinanceReportData,
  ) {}

  async execute(
    query: { readonly sessionToken: string | null; readonly showroomId: string | null },
    ctx: AuthenticatedContext,
  ): Promise<DuesReportDto> {
    this.policy.requireAdmin(ctx);
    const { cipher } = await this.sessions.open(ctx, query.sessionToken);
    const cars = await this.data.carsWithMoney(
      cipher,
      query.showroomId === null ? null : toShowroomId(query.showroomId),
    );

    const items: DuesRowDto[] = cars.rows
      .filter((car) => hasDues(car.money))
      .map(({ vehicle, deal, money }) => ({
        vehicle: { id: vehicle.id, label: vehicle.label },
        purchaseRate: deal?.terms?.purchaseRate.rupees ?? null,
        paidToSeller: money.paidToSeller / 100,
        owedToSeller: money.owedToSeller === null ? null : money.owedToSeller / 100,
        finalisedPrice: deal?.sale?.finalisedPrice.rupees ?? null,
        receivedFromBuyer: money.receivedFromBuyer / 100,
        owedByBuyer: money.owedByBuyer === null ? null : money.owedByBuyer / 100,
      }))
      .sort((a, b) => outstanding(b) - outstanding(a));

    return {
      items,
      totals: {
        owedToSellers: positiveSum(items.map((i) => i.owedToSeller)),
        owedByBuyers: positiveSum(items.map((i) => i.owedByBuyer)),
      },
      truncated: cars.truncated,
    };
  }
}

function outstanding(row: DuesRowDto): number {
  return Math.abs(row.owedToSeller ?? 0) + Math.abs(row.owedByBuyer ?? 0);
}

export function positiveSum(values: readonly (number | null)[]): number {
  return Math.round(values.reduce<number>((t, v) => t + Math.max(v ?? 0, 0), 0) * 100) / 100;
}
