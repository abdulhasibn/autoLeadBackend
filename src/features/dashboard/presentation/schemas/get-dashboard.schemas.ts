import { z } from 'zod';

import { DASHBOARD_PERIODS } from '../../domain/dashboard-window';

export const getDashboardQuerySchema = z.object({
  period: z.enum(DASHBOARD_PERIODS).default('month'),
  showroomId: z.string().uuid('showroomId must be a UUID').optional(),
});
