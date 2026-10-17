import type { BrowserContext } from '@playwright/test';

/**
 * Keeps a browser test on this machine: anything not on the loopback interface is refused
 * (for example the Quran text service, maps or fonts on a CDN). Returns the refused URLs, so a
 * test can report what the app tried to reach.
 */
export async function localOnly(context: BrowserContext): Promise<string[]> {
  const refused: string[] = [];
  await context.route(
    (url) => url.hostname !== '127.0.0.1' && url.hostname !== 'localhost',
    async (route) => {
      refused.push(new URL(route.request().url()).host);
      await route.abort('blockedbyclient');
    },
  );
  return refused;
}
