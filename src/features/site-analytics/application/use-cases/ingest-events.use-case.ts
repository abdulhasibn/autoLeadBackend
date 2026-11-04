import { classifyTouch, referrerHost, type RawTouch } from '../../domain/traffic-channel';
import { deviceOf, isBotUserAgent } from '../../domain/user-agent';
import type {
  IWebEventIngest,
  VisitorId,
  WebEventProps,
  WebEventType,
  WebSessionId,
} from '../../domain/web-event-ingest.port';

export interface IngestEventsCommand {
  readonly visitorId: VisitorId;
  readonly sessionId: WebSessionId;
  readonly touch: RawTouch;
  readonly events: readonly {
    readonly type: WebEventType;
    readonly at: string;
    readonly path: string;
    readonly vehicleId?: string;
    readonly props?: WebEventProps;
  }[];
  readonly userAgent: string | undefined;
  /** Visitor city from the edge (e.g. Vercel's geo header), if known. */
  readonly city: string | null;
  readonly ipHash: string;
}

/** Records a batch of website events; bot traffic is dropped without a trace. */
export class IngestEventsUseCase {
  constructor(private readonly ingest: IWebEventIngest) {}

  async execute(command: IngestEventsCommand): Promise<void> {
    const { touch, userAgent } = command;
    if (userAgent === undefined || isBotUserAgent(userAgent)) {
      return;
    }

    await this.ingest.record(
      {
        id: command.sessionId,
        visitorId: command.visitorId,
        channel: classifyTouch(touch),
        utmSource: touch.utmSource ?? null,
        utmMedium: touch.utmMedium ?? null,
        utmCampaign: touch.utmCampaign ?? null,
        utmContent: touch.utmContent ?? null,
        utmTerm: touch.utmTerm ?? null,
        hasFbclid: touch.hasFbclid,
        hasGclid: touch.hasGclid,
        referrerHost: referrerHost(touch.referrer),
        landingPath: touch.landingPath,
        device: deviceOf(userAgent),
        inAppBrowser: touch.inAppBrowser,
        city: command.city,
      },
      command.events.map((event) => ({
        type: event.type,
        occurredAt: new Date(event.at),
        path: event.path,
        vehicleId: event.vehicleId ?? null,
        props: event.props ?? {},
      })),
      command.ipHash,
    );
  }
}
