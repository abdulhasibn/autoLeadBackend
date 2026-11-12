import { z } from 'zod';

// ExponentPushToken[...] (and the legacy ExpoPushToken[...]).
const EXPO_TOKEN = /^Expo(nent)?PushToken\[[^\]\s]+\]$/;

export const pushTokenSchema = z
  .string()
  .max(200)
  .regex(EXPO_TOKEN, 'token must be an Expo push token');

export const registerPushDeviceBodySchema = z.object({
  token: pushTokenSchema,
  platform: z.enum(['ios', 'android']),
  enabled: z.boolean().default(true),
});

export const unregisterPushDeviceQuerySchema = z.object({
  token: pushTokenSchema,
});
