import { defineConfig } from 'vitest/config';

// The tests boot an in-process Postgres (PGlite) and run every migration, which takes seconds.
export default defineConfig({
  test: { testTimeout: 30_000, hookTimeout: 120_000 },
});
