import { describe, expect, it } from 'vitest';

import { classifyTouch, referrerHost, type RawTouch } from '../domain/traffic-channel';

function touch(overrides: Partial<RawTouch> = {}): RawTouch {
  return { hasFbclid: false, hasGclid: false, landingPath: '/', inAppBrowser: null, ...overrides };
}

describe('classifyTouch', () => {
  it('treats the Instagram in-app browser with no UTM as organic Instagram', () => {
    expect(classifyTouch(touch({ inAppBrowser: 'instagram', hasFbclid: true }))).toBe(
      'instagram_organic',
    );
  });

  it('credits a UTM-tagged Instagram ad to instagram_ads', () => {
    expect(
      classifyTouch(
        touch({
          utmSource: 'instagram',
          utmMedium: 'paid_social',
          utmCampaign: 'diwali',
          utmContent: 'creta-reel',
          inAppBrowser: 'instagram',
        }),
      ),
    ).toBe('instagram_ads');
  });

  it('keeps an organic-social UTM organic', () => {
    expect(classifyTouch(touch({ utmSource: 'instagram', utmMedium: 'organic_social' }))).toBe(
      'instagram_organic',
    );
  });

  it.each([
    [touch({ utmSource: 'facebook', utmMedium: 'cpc' }), 'facebook_ads'],
    [
      touch({ utmSource: 'meta', utmMedium: 'paid_social', inAppBrowser: 'facebook' }),
      'facebook_ads',
    ],
    [touch({ utmSource: 'google', utmMedium: 'organic' }), 'google_organic'],
    [touch({ utmSource: 'whatsapp' }), 'whatsapp'],
    [touch({ utmSource: 'newsletter', utmMedium: 'email' }), 'other'],
  ])('classifies %o as %s', (raw, channel) => {
    expect(classifyTouch(raw)).toBe(channel);
  });

  it('credits a gclid without UTM to google_ads', () => {
    expect(classifyTouch(touch({ hasGclid: true, referrer: 'https://www.google.com' }))).toBe(
      'google_ads',
    );
  });

  it('classifies a WhatsApp referrer as whatsapp', () => {
    expect(classifyTouch(touch({ referrer: 'https://web.whatsapp.com' }))).toBe('whatsapp');
    expect(classifyTouch(touch({ referrer: 'https://wa.me' }))).toBe('whatsapp');
  });

  it('uses the referrer for Google search and other sites', () => {
    expect(classifyTouch(touch({ referrer: 'https://www.google.co.in' }))).toBe('google_organic');
    expect(classifyTouch(touch({ referrer: 'https://l.instagram.com' }))).toBe('instagram_organic');
    expect(classifyTouch(touch({ referrer: 'https://carblog.example' }))).toBe('referral');
  });

  it('calls a visit with no signal at all direct', () => {
    expect(classifyTouch(touch())).toBe('direct');
  });
});

describe('referrerHost', () => {
  it('strips www and rejects junk', () => {
    expect(referrerHost('https://www.google.com')).toBe('google.com');
    expect(referrerHost('not a url')).toBeNull();
    expect(referrerHost(undefined)).toBeNull();
  });
});
