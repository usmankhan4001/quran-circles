import { defineConfig } from 'vitest/config';

// The self-check only: no network, no database, no stack. The scope and load runs are separate
// commands (`scope`, `load`, `local`) because they need a running API.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    testTimeout: 10_000,
  },
});
