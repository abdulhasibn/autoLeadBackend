import type { Brand } from '../../../shared/primitives/brand';
import type { Channel } from './traffic-channel';
import type { Device } from './user-agent';

/** Anonymous id the site keeps per browser; never linked to a name or phone. */
export type VisitorId = Brand<string, 'VisitorId'>;
export type WebSessionId = Brand<string, 'WebSessionId'>;

export const WEB_EVENT_TYPES = [
  'page_view',
  'car_view',
  'gallery_open',
  'filter_apply',
  'test_drive_open',
  'whatsapp_click',
  'call_click',
  'directions_click',
] as const;

export type WebEventType = (typeof WEB_EVENT_TYPES)[number];

export type WebEventProps = Readonly<Record<string, string | number | boolean | null>>;

/** A classified session: the landing touch plus what the server derived from the request. */
export interface WebSessionRecord {
  readonly id: WebSessionId;
  readonly visitorId: VisitorId;
  readonly channel: Channel;
  readonly utmSource: string | null;
  readonly utmMedium: string | null;
  readonly utmCampaign: string | null;
  readonly utmContent: string | null;
  readonly utmTerm: string | null;
  readonly hasFbclid: boolean;
  readonly hasGclid: boolean;
  readonly referrerHost: string | null;
  readonly landingPath: string;
  readonly device: Device;
  readonly inAppBrowser: 'instagram' | 'facebook' | null;
  readonly city: string | null;
}

export interface WebEventRecord {
  readonly type: WebEventType;
  readonly occurredAt: Date;
  readonly path: string;
  readonly vehicleId: string | null;
  readonly props: WebEventProps;
}

/**
 * Stores a batch: upserts the session (its landing touch is fixed by the first
 * batch) and appends events, dropping any beyond the per-session hourly cap.
 * Returns how many events were stored.
 */
export interface IWebEventIngest {
  record(
    session: WebSessionRecord,
    events: readonly WebEventRecord[],
    ipHash: string,
  ): Promise<number>;
}
