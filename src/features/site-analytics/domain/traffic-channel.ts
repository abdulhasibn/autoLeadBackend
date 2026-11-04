/**
 * Where a website visit came from. The one place a raw touch is turned into a
 * channel: the site only reports UTM tags, click ids, referrer and in-app
 * browser, so the rules can change without shipping a new client.
 */
export const CHANNELS = [
  'instagram_ads',
  'instagram_organic',
  'facebook_ads',
  'facebook_organic',
  'google_ads',
  'google_organic',
  'whatsapp',
  'direct',
  'referral',
  'other',
] as const;

export type Channel = (typeof CHANNELS)[number];

export interface RawTouch {
  readonly utmSource?: string;
  readonly utmMedium?: string;
  readonly utmCampaign?: string;
  readonly utmContent?: string;
  readonly utmTerm?: string;
  readonly hasFbclid: boolean;
  readonly hasGclid: boolean;
  /** Referring origin, e.g. `https://l.instagram.com`. */
  readonly referrer?: string;
  readonly landingPath: string;
  readonly inAppBrowser: 'instagram' | 'facebook' | null;
}

type Network = 'instagram' | 'facebook' | 'google' | 'whatsapp';

// Ad links follow docs/ad-links.md (utm_medium=paid_social); the rest are the
// common spellings other tools and agencies use for paid traffic.
const PAID_MEDIUMS = new Set(['cpc', 'ppc', 'cpm', 'cpv', 'display', 'ad', 'ads', 'paid']);

const SOURCE_NETWORKS: Readonly<Record<string, Network>> = {
  instagram: 'instagram',
  ig: 'instagram',
  facebook: 'facebook',
  fb: 'facebook',
  google: 'google',
  whatsapp: 'whatsapp',
  wa: 'whatsapp',
};

/** Host of a referrer origin without `www.`, or null when absent or malformed. */
export function referrerHost(referrer: string | undefined): string | null {
  if (referrer === undefined || referrer.trim() === '') {
    return null;
  }
  try {
    const host = new URL(referrer).host.toLowerCase();
    return host === '' ? null : host.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function networkOfHost(host: string): Network | null {
  // Also matches app referrers such as `android-app://com.instagram.android`.
  if (host.includes('instagram')) return 'instagram';
  if (host.includes('facebook') || host === 'fb.com' || host.endsWith('.fb.com')) return 'facebook';
  if (host.includes('whatsapp') || host === 'wa.me') return 'whatsapp';
  if (/(^|\.)google\.[a-z.]+$/.test(host) || host.includes('googlequicksearchbox')) return 'google';
  return null;
}

function isPaidMedium(medium: string | undefined): boolean {
  if (medium === undefined) return false;
  const value = medium.trim().toLowerCase();
  return value.includes('paid') || PAID_MEDIUMS.has(value);
}

function channelOf(network: Network, paid: boolean): Channel {
  switch (network) {
    case 'instagram':
      return paid ? 'instagram_ads' : 'instagram_organic';
    case 'facebook':
      return paid ? 'facebook_ads' : 'facebook_organic';
    case 'google':
      return paid ? 'google_ads' : 'google_organic';
    case 'whatsapp':
      return 'whatsapp';
  }
}

/**
 * Classifies a landing touch. UTM tags win, because we write them on our own
 * links; without them a gclid means a Google ad, and the in-app browser or
 * referrer names the network. An fbclid alone does not mean paid: Meta adds it
 * to every outbound link, organic posts included.
 */
export function classifyTouch(touch: RawTouch): Channel {
  const source = touch.utmSource?.trim().toLowerCase();
  const host = referrerHost(touch.referrer);

  if (source !== undefined && source !== '') {
    const paid = isPaidMedium(touch.utmMedium) || touch.hasGclid;
    // Meta's {{site_source_name}} macro can also resolve to `meta`.
    if (source === 'meta') {
      return channelOf(touch.inAppBrowser === 'facebook' ? 'facebook' : 'instagram', paid);
    }
    const network = SOURCE_NETWORKS[source];
    if (network !== undefined) {
      return channelOf(network, paid);
    }
    return touch.utmMedium?.trim().toLowerCase() === 'referral' ? 'referral' : 'other';
  }

  if (touch.hasGclid) {
    return 'google_ads';
  }
  if (touch.inAppBrowser !== null) {
    return channelOf(touch.inAppBrowser, false);
  }
  if (host !== null) {
    const network = networkOfHost(host);
    return network === null ? 'referral' : channelOf(network, false);
  }
  return 'direct';
}
