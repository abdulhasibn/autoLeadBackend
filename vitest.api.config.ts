import { defineConfig } from 'vitest/config';

// API contract suite. Talks to a running API over HTTP (API_BASE_URL) and
// provisions its own users through the Supabase admin API (SUPABASE_URL +
// SUPABASE_SERVICE_ROLE_KEY). Kept apart from vitest.config.ts so `pnpm test`
// never picks it up.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/api/**/*.api.test.ts'],
    globalSetup: ['tests/api/support/global-setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 120_000,
    fileParallelism: false,
    reporters: ['default'],
  },
});
