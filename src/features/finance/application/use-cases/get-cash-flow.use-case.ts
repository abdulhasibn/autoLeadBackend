import type { AuthenticatedContext } from '../../../../domain/shared/auth-context';
import { CalendarDate } from '../../../../domain/shared/calendar-date.value-object';
import { toShowroomId } from '../../../../domain/shared/showroom-id';
import { buildCashFlow } from '../../domain/build-cash-flow';
import { ReportPeriod } from '../../domain/report-period.value-object';
import { rupeesOf, type CashFlowReportDto } from '../dtos/finance-report.dto';
import type { FinancePolicy } from '../policies/finance.policy';
import type { FinanceReportData } from '../services/finance-report-data';
import type { FinanceSessionService } from '../services/finance-session.service';
import type { ReportRangeQuery } from './get-profit-and-loss.use-case';

/** Money received and paid, by entry date. */
export class GetCashFlowUseCase {
  constructor(
    private readonly policy: FinancePolicy,
    private readonly sessions: FinanceSessionService,
    private readonly data: FinanceReportData,
  ) {}

  async execute(query: ReportRangeQuery, ctx: AuthenticatedContext): Promise<CashFlowReportDto> {
    this.policy.requireAdmin(ctx);
    const period = ReportPeriod.create(query.period);
    const from = CalendarDate.create(query.from);
    const to = CalendarDate.create(query.to);
    period.assertRange(from, to);
    const { cipher } = await this.sessions.open(ctx, query.sessionToken);
    const showroomId = query.showroomId === null ? null : toShowroomId(query.showroomId);

    const entries = await this.data.entriesBetween(cipher, from.value, to.value, showroomId);
    const report = buildCashFlow({
      buckets: period.bucketsBetween(from, to),
      entries: entries.rows,
    });

    return {
      period: period.value,
      from: from.value,
      to: to.value,
      buckets: report.buckets.map((b) => rupeesOf(b)),
      totals: rupeesOf(report.totals),
      truncated: entries.truncated,
    };
  }
}
