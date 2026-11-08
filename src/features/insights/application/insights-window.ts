import { zonedDateTimeString } from '../../../domain/shared/business-calendar';
import { CalendarDate } from '../../../domain/shared/calendar-date.value-object';
import {
  resolveReportingWindow,
  type ReportingPeriodKey,
  type ReportingWindow,
} from '../../../domain/shared/reporting-period';
import type { InsightsRange } from '../domain/insights.queries';
import type { InsightsPeriodDto } from './dtos/insights.dto';

export interface InsightsSettings {
  readonly timeZone: string;
}

export interface InsightsWindow {
  readonly window: ReportingWindow;
  /** Period to date: [period start, now). */
  readonly range: InsightsRange;
  /** The same elapsed span of the previous period. */
  readonly previous: InsightsRange;
  readonly period: InsightsPeriodDto;
}

/** The dashboard's period rules (business timezone, period to date). */
export function insightsWindow(
  key: ReportingPeriodKey,
  now: Date,
  timeZone: string,
): InsightsWindow {
  const window = resolveReportingWindow(key, now, timeZone);
  return {
    window,
    range: { from: window.from, until: now },
    previous: { from: window.previousFrom, until: window.previousUntil },
    period: {
      from: zonedDateTimeString(CalendarDate.create(window.startDate), '00:00:00', timeZone),
      to: zonedDateTimeString(CalendarDate.create(window.endDate), '23:59:59', timeZone),
    },
  };
}

export interface VehicleTitleParts {
  readonly year: number;
  readonly make: string;
  readonly model: string;
  readonly variant: string;
}

/** "2021 Hyundai Creta SX". */
export function vehicleTitle(parts: VehicleTitleParts): string {
  return `${parts.year} ${parts.make} ${parts.model} ${parts.variant}`;
}
