import { describe, expect, it } from 'vitest';

import { registerPushDeviceBodySchema } from '../presentation/schemas/push-device.schemas';

describe('registerPushDeviceBodySchema', () => {
  it('accepts an Expo token and defaults to enabled', () => {
    const parsed = registerPushDeviceBodySchema.parse({
      token: 'ExponentPushToken[abc-123]',
      platform: 'ios',
    });
    expect(parsed.enabled).toBe(true);
  });

  it('rejects anything that is not an Expo token', () => {
    expect(() =>
      registerPushDeviceBodySchema.parse({ token: 'fcm:abc', platform: 'android' }),
    ).toThrow();
  });
});
