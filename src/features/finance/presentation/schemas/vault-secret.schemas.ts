import { z } from 'zod';

import { FinanceKey, RecoveryKey } from '../../domain/vault-secret.value-object';

function secretSchema(field: string, create: (input: string) => { value: string }) {
  return z
    .string({ error: `${field} is required` })
    .superRefine((val, ctx) => {
      try {
        create(val);
      } catch (err) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: err instanceof Error ? err.message : `Invalid ${field}`,
        });
      }
    })
    .transform((val) => create(val).value);
}

export const unlockVaultBodySchema = z.object({
  financeKey: secretSchema('financeKey', (input) => FinanceKey.create(input)),
});

export const changeFinanceKeyBodySchema = z.object({
  currentKey: secretSchema('currentKey', (input) => FinanceKey.create(input)),
});

export const recoveryKeyBodySchema = z.object({
  recoveryKey: secretSchema('recoveryKey', (input) => RecoveryKey.create(input)),
});
