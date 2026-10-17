import { chromium, type Browser, type BrowserContext, type LaunchOptions } from 'playwright-core';
import { LATIN_FAMILY, URDU_FAMILY } from './fonts';
import { FIT_SCRIPT, FONTS_SCRIPT, type FitResult } from './fit';
import type { Logger } from './logger';

export class RenderTimeoutError extends Error {
  override name = 'RenderTimeoutError';
}
/** Text that does not fit its box even at its floor. `fields` name the boxes, e.g. `title.en`. */
export class TextTooLongError extends Error {
  override name = 'TextTooLongError';
  constructor(
    readonly fields: string[],
    readonly regions: string[],
  ) {
    super('text does not fit');
  }
}
export class FontLoadError extends Error {
  override name = 'FontLoadError';
}

export interface PageJob {
  html: string;
  width: number;
  height: number;
  output: { kind: 'png' } | { kind: 'pdf'; format: 'A4' | 'A3' };
  /** Pixels per design unit; when set, the fit step runs before capture. */
  fitUnit?: number;
}

export interface PageResult {
  bytes: Buffer;
  /** Requests the page tried to make, all refused. Scheme and host only, for tests and counters. */
  blocked: string[];
}

export interface BrowserPoolOptions {
  logger: Logger;
  executablePath?: string;
  heapMb: number;
  recycleAfter: number;
  /**
   * Refuse every request in Playwright as well as with the launch flags and the page's CSP. Only a
   * test turns this off, to prove the launch flags hold on their own.
   */
  interceptRequests?: boolean;
}

/**
 * Chromium flags. Network: every host name resolves to nothing and every request goes to a proxy
 * that does not exist, so even a request that slipped past the page's CSP and Playwright's
 * interception could not leave the browser. Memory: a heap cap per renderer process and no use of
 * `/dev/shm` (small in containers).
 */
export function launchArgs(heapMb: number): string[] {
  return [
    '--host-resolver-rules=MAP * ~NOTFOUND',
    '--proxy-server=http://127.0.0.1:9',
    '--proxy-bypass-list=<-loopback>',
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-default-apps',
    '--disable-domain-reliability',
    '--disable-sync',
    '--disable-extensions',
    '--disable-breakpad',
    '--no-first-run',
    '--no-pings',
    '--disable-features=Translate,MediaRouter,OptimizationHints,InterestFeedContentSuggestions,DialMediaRouteProvider',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--font-render-hinting=none',
    `--js-flags=--max-old-space-size=${heapMb}`,
  ];
}

const describe = (url: string): string => {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return 'invalid';
  }
};

/**
 * One browser, a fresh isolated context per page. The browser restarts after `recycleAfter`
 * renders, or when it crashed, so a leak or a bad page cannot affect later posters.
 */
export class BrowserPool {
  private browser: Promise<Browser> | null = null;
  private uses = 0;
  private launches = 0;

  constructor(private readonly options: BrowserPoolOptions) {}

  get launchCount(): number {
    return this.launches;
  }

  private async get(): Promise<Browser> {
    if (this.browser && this.uses >= this.options.recycleAfter) {
      const old = this.browser;
      this.browser = null;
      this.uses = 0;
      // In-flight pages on the old browser finish on their own contexts; close it once idle.
      void old.then((b) => setTimeout(() => void b.close().catch(() => {}), 30_000).unref());
      this.options.logger.info('browser.recycle', { launches: this.launches });
    }
    if (!this.browser) {
      const launch: LaunchOptions = {
        headless: true,
        args: launchArgs(this.options.heapMb),
        ...(this.options.executablePath ? { executablePath: this.options.executablePath } : {}),
      };
      this.launches += 1;
      const pending = chromium.launch(launch);
      this.browser = pending;
      pending.then(
        (b) =>
          b.on('disconnected', () => {
            if (this.browser !== pending) return; // closed on purpose (recycle or shutdown)
            this.browser = null;
            this.options.logger.warn('browser.disconnected');
          }),
        () => {
          if (this.browser === pending) this.browser = null;
        },
      );
    }
    this.uses += 1;
    return this.browser;
  }

  /** Renders one page. The caller's deadline closes the context, which aborts whatever is running. */
  async render(job: PageJob, deadline: number): Promise<PageResult> {
    const browser = await this.get();
    const remaining = (): number => Math.max(1, deadline - Date.now());
    let context: BrowserContext | null = null;
    let settled = false;
    const blocked: string[] = [];
    const work = async (): Promise<PageResult> => {
      const created = await browser.newContext({
        viewport: { width: job.width, height: job.height },
        deviceScaleFactor: 1,
        javaScriptEnabled: false,
        offline: true,
        serviceWorkers: 'block',
        acceptDownloads: false,
        bypassCSP: false,
        locale: 'en-GB',
        timezoneId: 'UTC',
      });
      context = created;
      // The deadline passed while the context was being made: close it here, nobody else will.
      if (settled) {
        await created.close().catch(() => {});
        throw new RenderTimeoutError('render timed out');
      }
      created.setDefaultTimeout(remaining());
      if (this.options.interceptRequests !== false) {
        await created.route('**/*', (route) => {
          blocked.push(describe(route.request().url()));
          return route.abort('blockedbyclient');
        });
      }
      const page = await created.newPage();
      page.on('requestfailed', (request) => {
        const where = describe(request.url());
        if (!blocked.includes(where)) blocked.push(where);
      });
      await page.setContent(job.html, { waitUntil: 'load', timeout: remaining() });
      const missing = (await page.evaluate(
        `(${FONTS_SCRIPT})(${JSON.stringify([LATIN_FAMILY, URDU_FAMILY])})`,
      )) as string[];
      if (missing.length > 0) throw new FontLoadError(`fonts did not load: ${missing.join(', ')}`);
      if (job.fitUnit !== undefined) {
        const fit = (await page.evaluate(`(${FIT_SCRIPT})(${job.fitUnit})`)) as FitResult;
        if (!fit.ok) throw new TextTooLongError(fit.fields, fit.regions);
      }
      const bytes =
        job.output.kind === 'png'
          ? await page.screenshot({ type: 'png', fullPage: false, timeout: remaining() })
          : await page.pdf({
              format: job.output.format,
              printBackground: true,
              preferCSSPageSize: true,
              margin: { top: '0', right: '0', bottom: '0', left: '0' },
            });
      return { bytes, blocked };
    };
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new RenderTimeoutError('render timed out')), remaining());
    });
    const running = work();
    running.catch(() => {}); // after a timeout its rejection is expected and already handled
    try {
      return await Promise.race([running, timeout]);
    } finally {
      settled = true;
      clearTimeout(timer);
      const open = context as BrowserContext | null;
      if (open) await open.close().catch(() => {});
    }
  }

  async close(): Promise<void> {
    const pending = this.browser;
    this.browser = null;
    if (pending) await (await pending.catch(() => null))?.close().catch(() => {});
  }
}
