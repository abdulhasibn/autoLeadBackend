import { inject } from 'vitest';

export const BASE_URL = (process.env.API_BASE_URL ?? 'http://localhost:3000').replace(/\/+$/, '');

export interface ApiResult<T = any> {
  readonly status: number;
  readonly body: T;
}

export async function api<T = any>(
  method: string,
  path: string,
  options: { token?: string; body?: unknown } = {},
): Promise<ApiResult<T>> {
  const headers: Record<string, string> = {};
  if (options.token !== undefined) headers.authorization = `Bearer ${options.token}`;
  if (options.body !== undefined) headers['content-type'] = 'application/json';
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await res.text();
  let body: unknown = null;
  if (text.length > 0) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  return { status: res.status, body: body as T };
}

export async function login(email: string): Promise<string> {
  const { password } = inject('apiContext');
  const res = await api('POST', '/auth/login', { body: { email, password } });
  if (res.status !== 200) throw new Error(`login failed for test user (status ${res.status})`);
  return res.body.accessToken as string;
}

/** A unique E.164 phone per call, so leads never collide on contact phone. */
export function uniquePhone(): string {
  return `+918${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;
}
