import { defineConfig } from 'vitest/config';

// The browser tests start headless Chromium and render real posters, which takes seconds.
export default defineConfig({
  test: { testTimeout: 60_000, hookTimeout: 60_000 },
});
