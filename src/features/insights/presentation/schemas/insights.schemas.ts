import { z } from 'zod';

import { REPORTING_PERIODS } from '../../../../domain/shared/reporting-period';

export const insightsQuerySchema = z.object({
  period: z.enum(REPORTING_PERIODS).default('month'),
  showroomId: z.string().uuid('showroomId must be a UUID').optional(),
});

export const vehicleIdParamsSchema = z.object({
  vehicleId: z.string().uuid('vehicleId must be a UUID'),
});

export const leadIdParamsSchema = z.object({
  leadId: z.string().uuid('leadId must be a UUID'),
});
