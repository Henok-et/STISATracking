import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const resolvePath = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@': resolvePath('./src'),
      // `server-only` throws outside a React Server Component build. That guard
      // is right in the app and meaningless in a test runner, where everything
      // already runs in Node. See tests/stubs/server-only.ts.
      'server-only': resolvePath('./tests/stubs/server-only.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    globalSetup: ['tests/global-setup.ts'],
    setupFiles: ['tests/setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 120_000,
    // Every database test shares one Postgres schema, so they must not run
    // concurrently or they would delete each other's fixtures.
    pool: 'forks',
    maxWorkers: 1,
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.ts'],
      exclude: ['src/lib/**/*.test.ts', 'src/generated/**'],
    },
  },
});
