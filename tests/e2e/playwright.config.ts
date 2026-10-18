import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { CACHE_DIR } from './src/stack/paths';
import { localOnlyLaunchArgs, QURAN_SOURCE_HOST, quranStubPort } from './src/support/network';

/**
 * Chromium comes from PLAYWRIGHT_BROWSERS_PATH (this Playwright version expects build 1194).
 * When only a bare executable is provided, set E2E_CHROMIUM to its path.
 */
const chromium = process.env.E2E_CHROMIUM
  ? process.env.E2E_CHROMIUM
  : !process.env.PLAYWRIGHT_BROWSERS_PATH && existsSync('/opt/pw-browsers/chromium')
    ? '/opt/pw-browsers/chromium'
    : undefined;

/**
 * Browser projects never reach the internet: Chromium resolves nothing but loopback and uses no
 * proxy (src/support/network.ts). This replaces request routing, which delayed requests made
 * while a page's main thread was busy. The quality project also points the Quran text service at
 * its local stand-in (src/quality/quran-stub.ts).
 */
const browserWith = (maps: Record<string, string> = {}) => ({
  ...devices['Desktop Chrome'],
  launchOptions: {
    args: localOnlyLaunchArgs(maps),
    ...(chromium ? { executablePath: chromium } : {}),
  },
});
const browser = browserWith();

export default defineConfig({
  testDir: './src/flows',
  outputDir: join(CACHE_DIR, 'test-results'),
  globalSetup: './src/global-setup.ts',
  // One worker: the flows share one database and one worker process, and some wait for the
  // worker's per-minute reminder run. Order inside a file matters; files are independent.
  workers: 1,
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  timeout: 180_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  use: { trace: 'retain-on-failure', actionTimeout: 15_000, navigationTimeout: 30_000 },
  projects: [
    { name: 'api', testDir: './src/flows/api' },
    {
      name: 'pwa',
      testDir: './src/flows/pwa',
      use: { ...browser, viewport: { width: 412, height: 915 } },
    },
    { name: 'console', testDir: './src/flows/console', use: browser },
    {
      name: 'admin-app',
      testDir: './src/flows/admin-app',
      use: { ...browser, viewport: { width: 412, height: 915 } },
    },
    // Opt-in: low-end budgets and the accessibility/right-to-left audit (quality lane, WP12).
    // Long-running and report-producing, so not part of the default run. See docs/quality/.
    //   QC_QUALITY=1 pnpm --filter @qc/e2e exec playwright test --project=quality
    ...(process.env.QC_QUALITY === '1'
      ? [
          {
            name: 'quality',
            testDir: './src/quality',
            timeout: 60 * 60_000,
            use: browserWith({ [QURAN_SOURCE_HOST]: `127.0.0.1:${quranStubPort()}` }),
          },
        ]
      : []),
  ],
});
