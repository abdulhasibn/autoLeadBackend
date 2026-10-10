import { describe, expect, it } from 'vitest';

import { changePasswordBodySchema } from '../presentation/schemas/change-password.schemas';
import { forgotPasswordBodySchema } from '../presentation/schemas/forgot-password.schemas';
import { logoutBodySchema } from '../presentation/schemas/logout.schemas';
import { resetPasswordBodySchema } from '../presentation/schemas/reset-password.schemas';

describe('logoutBodySchema', () => {
  it('defaults to local when the body is missing or empty', () => {
    expect(logoutBodySchema.parse(undefined)).toEqual({ scope: 'local' });
    expect(logoutBodySchema.parse({})).toEqual({ scope: 'local' });
  });

  it('accepts global and rejects other scopes', () => {
    expect(logoutBodySchema.parse({ scope: 'global' })).toEqual({ scope: 'global' });
    expect(logoutBodySchema.safeParse({ scope: 'others' }).success).toBe(false);
  });
});

describe('changePasswordBodySchema', () => {
  it('accepts any non-empty current password', () => {
    const body = { currentPassword: 'x', newPassword: 'new-secret-1' };
    expect(changePasswordBodySchema.safeParse(body).success).toBe(true);
  });

  it('rejects a short new password or a missing current one', () => {
    expect(
      changePasswordBodySchema.safeParse({ currentPassword: 'x', newPassword: 'short' }).success,
    ).toBe(false);
    expect(changePasswordBodySchema.safeParse({ newPassword: 'new-secret-1' }).success).toBe(false);
  });
});

describe('forgotPasswordBodySchema', () => {
  it('validates the email', () => {
    expect(forgotPasswordBodySchema.safeParse({ email: 'ada@example.com' }).success).toBe(true);
    expect(forgotPasswordBodySchema.safeParse({ email: 'nope' }).success).toBe(false);
  });
});

describe('resetPasswordBodySchema', () => {
  const valid = { email: 'ada@example.com', code: '123456', newPassword: 'new-secret-1' };

  it('accepts a well-formed body', () => {
    expect(resetPasswordBodySchema.safeParse(valid).success).toBe(true);
  });

  it.each([
    ['a 5-digit code', { ...valid, code: '12345' }],
    ['a non-numeric code', { ...valid, code: '12a456' }],
    ['a short password', { ...valid, newPassword: 'short' }],
    ['a bad email', { ...valid, email: 'nope' }],
  ])('rejects %s', (_label, body) => {
    expect(resetPasswordBodySchema.safeParse(body).success).toBe(false);
  });
});
