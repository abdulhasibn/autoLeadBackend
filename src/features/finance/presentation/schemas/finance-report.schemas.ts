import { z } from 'zod';

import { VEHICLE_PROFIT_SORTS } from '../../application/use-cases/get-vehicle-profit-report.use-case';
import { REPORT_PERIODS } from '../../domain/report-period.value-object';
import { calendarDateSchema, uuidSchema } from './finance-fields.schemas';

const showroomIdSchema = uuidSchema('showroomId').optional();

export const reportRangeQuerySchema = z.object({
  from: calendarDateSchema,
  to: calendarDateSchema,
  period: z
    .enum(REPORT_PERIODS, { error: `period must be one of: ${REPORT_PERIODS.join(', ')}` })
    .default('month'),
  showroomId: showroomIdSchema,
});

export const vehicleProfitQuerySchema = z.object({
  from: calendarDateSchema,
  to: calendarDateSchema,
  showroomId: showroomIdSchema,
  sort: z.enum(VEHICLE_PROFIT_SORTS).default('profit'),
});

export const showroomQuerySchema = z.object({ showroomId: showroomIdSchema });
