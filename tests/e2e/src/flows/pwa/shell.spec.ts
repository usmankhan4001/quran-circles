import { expect, test } from '@playwright/test';
import { localOnly } from '../../support/browser';
import { stack } from '../../support/env';
import { SEED } from '../../support/seed';

/**
 * Gate 3: "the PWA installs and its shell works offline", as far as a desktop Chromium can show
 * it. The install prompt itself, web push delivery and the home-screen icon need a real phone
 * (FINDINGS.md, manual checks).
 */
test.describe('PWA shell', () => {
  test.beforeEach(async ({ context }) => {
    if (!stack().pwaUrl)
      throw new Error(`The PWA did not build or start: ${stack().pwaError ?? ''}`);
    await localOnly(context);
  });

  test('the manifest makes it installable', async ({ page }) => {
    const base = stack().pwaUrl ?? '';
    await page.goto(`${base}/home`);
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(href).toBe('/manifest.webmanifest');
    const response = await page.request.get(`${base}/manifest.webmanifest`);
    expect(response.ok()).toBe(true);
    const manifest = (await response.json()) as {
      name?: string;
      start_url?: string;
      display?: string;
      icons?: { src: string; sizes: string; purpose?: string }[];
    };
    expect(manifest.name).toBe('Quran Circles');
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('/home');
    const sizes = (manifest.icons ?? []).map((i) => i.sizes);
    expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']));
    for (const icon of manifest.icons ?? []) {
      const image = await page.request.get(`${base}${icon.src}`);
      expect(image.ok(), `${icon.src} is served`).toBe(true);
      expect(image.headers()['content-type']).toContain('image/png');
    }
  });

  test('the service worker takes over and the shell opens offline', async ({ page, context }) => {
    const base = stack().pwaUrl ?? '';
    await page.goto(`${base}/home`);
    await expect(page.getByTestId('home-screen')).toBeVisible();
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    // The first load is not controlled yet; after a reload the worker serves the page.
    await page.reload();
    await expect
      .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
      .toBe(true);
    await expect(page.getByTestId('home-screen')).toBeVisible();

    await context.setOffline(true);
    try {
      await page.reload();
      // The page itself comes from the service worker; the data from the app's own cache.
      // Whether the offline banner shows depends on a call failing (FINDINGS.md, F-10).
      await expect(page.getByTestId('home-screen')).toBeVisible();
      await expect(page.getByTestId('tab-nearby')).toBeVisible();
    } finally {
      await context.setOffline(false);
    }
  });

  test('deep links open the right screen on a cold start', async ({ page }) => {
    const base = stack().pwaUrl ?? '';
    await page.goto(`${base}/session/${SEED.sessionTaraweehNoor}`);
    await expect(page.getByTestId('session-screen')).toBeVisible();
    await expect(page.getByText('Taraweeh with Dora (sample)').first()).toBeVisible();
    await page.goto(`${base}/venue/${SEED.venueNoor}`);
    await expect(page.getByText('Sample Masjid Al-Noor').first()).toBeVisible();
  });
});
