/**
 * A visitor's raw landing touch as the website reports it. Mirrors the
 * site-analytics RawTouch; marketplace never interprets it itself.
 */
export interface VisitorTouch {
  readonly utmSource?: string;
  readonly utmMedium?: string;
  readonly utmCampaign?: string;
  readonly utmContent?: string;
  readonly utmTerm?: string;
  readonly hasFbclid: boolean;
  readonly hasGclid: boolean;
  readonly referrer?: string;
  readonly landingPath: string;
  readonly inAppBrowser: 'instagram' | 'facebook' | null;
}

export interface TouchClassification {
  /** A site-analytics channel, e.g. `instagram_ads`. */
  readonly channel: string;
  readonly referrerHost: string | null;
}

/**
 * Classifies a touch into a traffic channel. Implemented by site-analytics,
 * the only place channel rules live (ADR-0006, ADR-0016).
 */
export interface ITouchClassifier {
  classify(touch: VisitorTouch): TouchClassification;
}
