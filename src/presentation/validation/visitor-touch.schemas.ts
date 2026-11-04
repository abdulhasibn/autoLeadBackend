import { z } from 'zod';

const utm = z.string().max(120).optional();

/**
 * A website visitor's raw landing touch (§2.1 of the analytics contract). The
 * site reports it as-is; the backend classifies the channel.
 */
export const visitorTouchSchema = z.object({
  utmSource: utm,
  utmMedium: utm,
  utmCampaign: utm,
  utmContent: utm,
  utmTerm: utm,
  hasFbclid: z.boolean(),
  hasGclid: z.boolean(),
  // The referring origin only, never a full URL.
  referrer: z.string().max(300).optional(),
  landingPath: z.string().max(300),
  inAppBrowser: z.enum(['instagram', 'facebook']).nullable(),
});
