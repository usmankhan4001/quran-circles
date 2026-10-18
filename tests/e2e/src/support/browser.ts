import type { Browser, BrowserContext } from '@playwright/test';
import { LOOPBACK_HOSTS } from './network';

const checked = new WeakSet<Browser>();

/** Where a page navigation to `url` ends: "loaded", or the network error's text. */
async function outcome(browser: Browser, url: string): Promise<string> {
  const probe = await browser.newContext({ ignoreHTTPSErrors: true });
  try {
    const page = await probe.newPage();
    return await page
      .goto(url, { timeout: 10_000 })
      .then(() => 'loaded')
      .catch((error: unknown) => String(error).split('\n')[0] ?? '');
  } finally {
    await probe.close();
  }
}

/**
 * Makes sure the browser cannot reach anything off this machine: Chromium was launched with the
 * outside-host block from `localOnlyLaunchArgs` (playwright.config.ts). Two probes, neither of
 * which can leave the machine whatever the outcome:
 * - a loopback address that is not one of the allowed names must be unresolvable (without the
 *   resolver rule it would be tried, and refused, on this machine);
 * - an https address under the reserved `.invalid` name must fail in this browser's own resolver,
 *   not at a proxy (a proxy from the environment would resolve outside names itself).
 */
async function assertOutsideHostsBlocked(browser: Browser): Promise<void> {
  if (checked.has(browser)) return;
  for (const url of ['http://127.0.0.2:8999/', 'https://qc-outside-check.invalid/']) {
    const result = await outcome(browser, url);
    if (!result.includes('ERR_NAME_NOT_RESOLVED')) {
      throw new Error(
        'The browser was launched without the outside-host block (localOnlyLaunchArgs in ' +
          `src/support/network.ts), so a test could reach the internet. Probe ${url}: ${result}`,
      );
    }
  }
  checked.add(browser);
}

/**
 * Keeps a browser test on this machine: anything not on the loopback interface is refused
 * (for example the Quran text service, maps or fonts on a CDN). The refusal happens in Chromium's
 * host resolver (see support/network.ts), not by intercepting requests; this checks that the block
 * is in place and returns the refused hosts as they happen, so a test can report what the app
 * tried to reach.
 */
export async function localOnly(context: BrowserContext): Promise<string[]> {
  const browser = context.browser();
  if (browser) await assertOutsideHostsBlocked(browser);
  const refused: string[] = [];
  context.on('requestfailed', (request) => {
    const url = new URL(request.url());
    const local = (LOOPBACK_HOSTS as readonly string[]).includes(url.hostname);
    if (!local && request.failure()?.errorText.includes('ERR_NAME_NOT_RESOLVED')) {
      refused.push(url.host);
    }
  });
  return refused;
}
