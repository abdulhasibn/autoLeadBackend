import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import { CalendarDate } from '../../../../domain/shared/calendar-date.value-object';
import { toShowroomId } from '../../../../domain/shared/showroom-id';
import { ProfitAndLossTally } from '../../domain/build-profit-and-loss';
import { ReportPeriod } from '../../domain/report-period.value-object';
import {
  PNL_COUNT_FIELDS,
  rupeesOf,
  type ProfitAndLossReportDto,
} from '../dtos/finance-report.dto';
import type { FinancePolicy } from '../policies/finance.policy';
import type { FinanceReportData } from '../services/finance-report-data';
import type { FinanceSessionService } from '../services/finance-session.service';

export interface ReportRangeQuery {
  readonly sessionToken: string | null;
  readonly from: string;
  readonly to: string;
  readonly period: string;
  readonly showroomId: string | null;
}

/** Profit & loss in the profit view, bucketed by period (ADR-0015). */
export class GetProfitAndLossUseCase {
  constructor(
    private readonly policy: FinancePolicy,
    private readonly sessions: FinanceSessionService,
    private readonly data: FinanceReportData,
  ) {}

  async execute(
    query: ReportRangeQuery,
    ctx: AuthenticatedContext,
  ): Promise<ProfitAndLossReportDto> {
    this.policy.requireAdmin(ctx);
    const period = ReportPeriod.create(query.period);
    const from = CalendarDate.create(query.from);
    const to = CalendarDate.create(query.to);
    period.assertRange(from, to);
    const { cipher } = await this.sessions.open(ctx, query.sessionToken);
    const showroomId = query.showroomId === null ? null : toShowroomId(query.showroomId);

    const tally = new ProfitAndLossTally(period.bucketsBetween(from, to));
    for (const car of await this.data.soldCarsBetween(cipher, from.value, to.value, showroomId)) {
      tally.addSoldCar(car);
    }
    await this.data.foldEntriesBetween(cipher, from.value, to.value, showroomId, (entry, sale) =>
      tally.addEntry(entry, sale),
    );
    const report = tally.result();

    return {
      period: period.value,
      from: from.value,
      to: to.value,
      buckets: report.buckets.map((b) => rupeesOf(b, PNL_COUNT_FIELDS)),
      totals: rupeesOf(report.totals, PNL_COUNT_FIELDS),
      truncated: false,
    };
  }
}
