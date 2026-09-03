import { AsyncLocalStorage } from 'node:async_hooks';

export const REQUEST_SPAN_ORDER = ['auth', 'policy', 'query', 'total'] as const;

export type RequestSpanName = (typeof REQUEST_SPAN_ORDER)[number] | string;

export interface RequestSpanStore {
  readonly spans: Record<string, number>;
}

const storage = new AsyncLocalStorage<RequestSpanStore>();

export function enterRequestSpans(): RequestSpanStore {
  const store: RequestSpanStore = { spans: {} };
  storage.enterWith(store);
  return store;
}

export function getRequestSpans(): Readonly<Record<string, number>> {
  return storage.getStore()?.spans ?? {};
}

export async function measureSpan<T>(name: RequestSpanName, work: () => Promise<T>): Promise<T> {
  const store = storage.getStore();
  const startedAt = performance.now();
  try {
    return await work();
  } finally {
    if (store !== undefined) {
      store.spans[name] = Math.round(performance.now() - startedAt);
    }
  }
}

export function formatServerTimingHeader(spans: Readonly<Record<string, number>>): string {
  const seen = new Set<string>();
  const parts: string[] = [];

  for (const name of REQUEST_SPAN_ORDER) {
    const duration = spans[name];
    if (duration === undefined) {
      continue;
    }
    seen.add(name);
    parts.push(`${name};dur=${duration}`);
  }

  for (const [name, duration] of Object.entries(spans)) {
    if (seen.has(name)) {
      continue;
    }
    parts.push(`${name};dur=${duration}`);
  }

  return parts.join(', ');
}
