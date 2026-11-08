/** The dashboard's period rules, shared with insights (`domain/shared/reporting-period`). */
export {
  REPORTING_PERIODS as DASHBOARD_PERIODS,
  resolveReportingWindow as resolveDashboardWindow,
  type ReportingPeriodKey as DashboardPeriodKey,
  type ReportingWindow as DashboardWindow,
} from '../../../domain/shared/reporting-period';
