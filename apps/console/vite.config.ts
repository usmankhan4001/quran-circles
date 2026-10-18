import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * Dev server proxies the API to the contract mock server (`pnpm --filter @qc/contracts mock`,
 * port 4010) unless CONSOLE_API_PROXY_TARGET points somewhere else. Only public configuration
 * (VITE_*) reaches the browser bundle. See docs/engineering/decisions/ for the console record.
 */
const target = process.env.CONSOLE_API_PROXY_TARGET ?? 'http://localhost:4010';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5180,
    proxy: {
      '/v1': { target, changeOrigin: true },
      '/health': { target, changeOrigin: true },
    },
  },
  build: { outDir: 'dist', sourcemap: true },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    restoreMocks: true,
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
