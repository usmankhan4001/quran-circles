import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // PGlite boots a real Postgres in-process; give migrations room on slow machines.
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
