export type Device = 'mobile' | 'desktop';

// Crawlers, link unfurlers (WhatsApp/Meta previews), uptime checks and
// scripted clients. Real in-app browsers (Instagram, FBAN/FBAV) do not match.
const BOT_PATTERN =
  /bot|crawl|spider|slurp|facebookexternalhit|facebookcatalog|meta-externalagent|whatsapp\/|headless|lighthouse|pingdom|uptime|curl\/|wget|python-requests|python-urllib|axios|node-fetch|go-http-client|okhttp|java\//i;

const MOBILE_PATTERN = /mobi|android|iphone|ipad|ipod|instagram|fban|fbav/i;

/** A blank user agent is treated as a bot: every browser sends one. */
export function isBotUserAgent(userAgent: string): boolean {
  return userAgent.trim() === '' || BOT_PATTERN.test(userAgent);
}

export function deviceOf(userAgent: string): Device {
  return MOBILE_PATTERN.test(userAgent) ? 'mobile' : 'desktop';
}
