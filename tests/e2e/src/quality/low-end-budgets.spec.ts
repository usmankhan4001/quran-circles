import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { brotliCompressSync, gzipSync } from 'node:zlib';
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { localOnly } from '../support/browser';
import { stack } from '../support/env';
import {
  addManySessions,
  appearanceEntries,
  attendee,
  giveSession,
  nationalAdmin,
  venueCoordinator,
  type Account,
} from './accounts';
import { BUDGETS, type BudgetKey } from './budgets';
import {
  CPU_SLOWDOWN,
  LOW_END_DEVICE,
  median,
  SLOW_3G,
  SLOW_4G,
  throttle,
  worst,
  type NetworkProfile,
} from './lowend';
import {
  blocking,
  frameStats,
  instrument,
  quietAfter,
  readPerf,
  startFrames,
  stopFrames,
  waitForMark,
  type Watch,
} from './perf';
import { startProdLikeWeb, type ProdLikeWeb } from './prod-like-web';
import { stubQuranSource } from './quran-stub';
import { outPath, readResult, STRICT, writeResult } from './results';

/**
 * Deliverable 4 (docs/agents/briefs/quality.md): app start, Nearby scroll, map load, Quran reader
 * open and bundle size, on an emulated low-end Android phone (lowend.ts) against production-like
 * builds of the user and coordinator apps (prod-like-web.ts) fed by the stack's real API.
 * Every scenario runs several times; the median and the worst go to the results file and the
 * report (docs/quality/low-end-budgets.md). Results are provisional until measured on the phone.
 *
 * Budgets are reported, not enforced, unless QC_QUALITY_STRICT=1.
 */

const RUNS = Number(process.env.QC_QUALITY_RUNS ?? 5);
const LONG_LIST = 100;

const HOME_CONTENT =
  '[data-testid="home-lead-card"], [data-testid="home-near"], [data-testid="home-empty"]';

interface Series {
  values: number[];
  median: number;
  worst: number;
  budget: number | null;
  /** Median within budget (the worst run is reported beside it). */
  withinBudget: boolean | null;
}

function series(values: number[], budget: BudgetKey | null = null): Series {
  const limit = budget ? BUDGETS[budget] : null;
  const m = median(values);
  return {
    values: values.map((v) => Math.round(v * 10) / 10),
    median: Math.round(m * 10) / 10,
    worst: Math.round(worst(values) * 10) / 10,
    budget: limit,
    withinBudget: limit === null ? null : m <= limit,
  };
}

const DEVICE = {
  ...LOW_END_DEVICE,
  cpuSlowdown: CPU_SLOWDOWN,
  network: SLOW_4G,
  runs: RUNS,
  browser: 'Chromium (Playwright 1.56.1), headless',
};

const SCENARIOS = [
  'bundle',
  'coldStart',
  'coldStart3G',
  'warmStart',
  'adminColdStart',
  'nearbyScroll',
  'mapView',
  'quranReader',
] as const;
type Scenario = (typeof SCENARIOS)[number];

interface ScenarioResult {
  stackStartedAt: string;
  scenario: Scenario;
  values: Record<string, Series | number | string | null>;
  detail?: unknown;
  misses: string[];
}

/** Writes one scenario's numbers at once, so a failure later in the run loses nothing. */
function record(
  scenario: Scenario,
  values: Record<string, Series | number | string | null>,
  detail?: unknown,
): void {
  const misses: string[] = [];
  for (const [key, s] of Object.entries(values)) {
    if (typeof s === 'object' && s !== null && s.withinBudget === false) {
      misses.push(`${scenario}.${key}: median ${s.median} > budget ${s.budget}`);
    }
  }
  const result: ScenarioResult = {
    stackStartedAt: stack().startedAt,
    scenario,
    values,
    ...(detail === undefined ? {} : { detail }),
    misses,
  };
  writeResult(`budgets/${scenario}`, result);
}

async function lowEndContext(
  browser: Browser,
  options: { serviceWorkers?: 'allow' | 'block'; network?: NetworkProfile | null } = {},
): Promise<BrowserContext> {
  const context = await browser.newContext({
    ...LOW_END_DEVICE,
    serviceWorkers: options.serviceWorkers ?? 'block',
  });
  await localOnly(context);
  await stubQuranSource(context, options.network === undefined ? SLOW_4G : options.network);
  return context;
}

async function userPage(context: BrowserContext, person: Account, watch: Watch): Promise<Page> {
  await giveSession(context, 'user-app', person);
  await context.addInitScript(
    (entries) => {
      for (const [k, v] of Object.entries(entries)) {
        if (window.localStorage.getItem(k) === null) window.localStorage.setItem(k, v);
      }
    },
    appearanceEntries('user-app', { locale: 'en', textSize: 0, color: 'light' }),
  );
  await instrument(context, watch);
  return context.newPage();
}

interface PaintTimes {
  fcp: number;
  transfer: number;
  jsTransfer: number;
  fontTransfer: number;
  apiTransfer: number;
  /** Font files fetched before Home was ready, by file name. */
  fonts: string[];
}

async function paintTimes(page: Page): Promise<PaintTimes> {
  return page.evaluate(() => {
    const fcp =
      performance.getEntriesByType('paint').find((e) => e.name === 'first-contentful-paint')
        ?.startTime ?? Number.NaN;
    const nav = performance.getEntriesByType('navigation')[0] as
      PerformanceNavigationTiming | undefined;
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const sum = (list: PerformanceResourceTiming[]) => list.reduce((n, r) => n + r.transferSize, 0);
    const isFont = (r: PerformanceResourceTiming) => /\.(ttf|otf|woff2?)(\?|$)/.test(r.name);
    const fonts = resources.filter(isFont);
    return {
      fcp,
      transfer: sum(resources) + (nav?.transferSize ?? 0),
      jsTransfer: sum(resources.filter((r) => /\.js(\?|$)/.test(r.name))),
      fontTransfer: sum(fonts),
      apiTransfer: sum(resources.filter((r) => new URL(r.name).pathname.startsWith('/api/'))),
      fonts: fonts.map(
        (r) => (new URL(r.name).pathname.split('/').pop() ?? '').split('.')[0] ?? '',
      ),
    };
  });
}

function bundleSizes(root: string) {
  const html = readFileSync(join(root, 'index.html'), 'utf8');
  const initial = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1] ?? '');
  const size = (rel: string) => {
    const body = readFileSync(join(root, rel));
    return {
      file: rel.split('/').pop() ?? rel,
      raw: body.length,
      gzip: gzipSync(body, { level: 6 }).length,
      brotli: brotliCompressSync(body).length,
    };
  };
  const initialFiles = initial.map((src) => size(src.replace(/^\//, '')));
  const jsDir = join(root, '_expo', 'static', 'js', 'web');
  const all = readdirSync(jsDir).map((f) => size(join('_expo', 'static', 'js', 'web', f)));
  const sum = (list: { raw: number; gzip: number; brotli: number }[]) => ({
    raw: list.reduce((n, f) => n + f.raw, 0),
    gzip: list.reduce((n, f) => n + f.gzip, 0),
    brotli: list.reduce((n, f) => n + f.brotli, 0),
  });
  const fonts: { file: string; raw: number }[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(ttf|otf|woff2?)$/.test(name))
        fonts.push({ file: name, raw: statSync(full).size });
    }
  };
  walk(join(root, 'assets'));
  return {
    initial: { files: initialFiles, total: sum(initialFiles) },
    allJs: {
      files: all.length,
      total: sum(all),
      largest: [...all].sort((a, b) => b.raw - a.raw).slice(0, 5),
    },
    fonts,
  };
}

test.describe('low-end Android budgets (emulated)', () => {
  test.setTimeout(45 * 60_000);
  let userWeb: ProdLikeWeb;
  let adminWeb: ProdLikeWeb;
  let admin: Account;

  test.beforeAll(async () => {
    test.setTimeout(20 * 60_000);
    const { apiUrl } = stack();
    userWeb = await startProdLikeWeb('user-app', outPath(`web-${process.pid}`, 'user-app'), apiUrl);
    adminWeb = await startProdLikeWeb(
      'admin-app',
      outPath(`web-${process.pid}`, 'admin-app'),
      apiUrl,
    );
    admin = await nationalAdmin();
    await addManySessions(admin, LONG_LIST);
  });

  test.afterAll(async () => {
    await userWeb?.stop();
    await adminWeb?.stop();
  });

  test('JavaScript bundle size (production export, gzip as served)', () => {
    const user = bundleSizes(userWeb.root);
    const coordinator = bundleSizes(adminWeb.root);
    record(
      'bundle',
      {
        userInitialRaw: user.initial.total.raw,
        userInitialGzip: series([user.initial.total.gzip], 'initialJsGzipBytes'),
        userInitialBrotli: user.initial.total.brotli,
        userAllJsRaw: user.allJs.total.raw,
        userAllJsGzip: user.allJs.total.gzip,
        adminInitialRaw: coordinator.initial.total.raw,
        adminInitialGzip: series([coordinator.initial.total.gzip], 'initialJsGzipBytes'),
        adminAllJsGzip: coordinator.allJs.total.gzip,
      },
      { user, coordinator },
    );
    expect(user.initial.files.length).toBeGreaterThan(0);
  });

  async function coldStart(browser: Browser, network: NetworkProfile) {
    const person = await attendee();
    const context = await lowEndContext(browser, { network });
    try {
      const page = await userPage(context, person, {
        homeShell: '[data-testid="home-screen"]',
        homeContent: HOME_CONTENT,
        nearbyList: '[data-testid="nearby-list"]',
      });
      await throttle(page, { network });
      await page.goto(`${userWeb.url}/home`, { waitUntil: 'commit', timeout: 120_000 });
      const content = await waitForMark(page, 'homeContent', 120_000);
      const interactive = await quietAfter(page, content);
      const perf = await readPerf(page);
      const paint = await paintTimes(page);
      // First tap: Home's tab bar to the Nearby list.
      const tapAt = await page.evaluate(() => performance.now());
      await page.getByTestId('tab-nearby').click();
      const nearby = await waitForMark(page, 'nearbyList', 60_000);
      return {
        fcp: paint.fcp,
        lcp: perf.lcp,
        shell: perf.marks.homeShell ?? Number.NaN,
        content,
        interactive,
        tbt: blocking(perf, paint.fcp, interactive).totalBlockingMs,
        transfer: paint.transfer,
        jsTransfer: paint.jsTransfer,
        fontTransfer: paint.fontTransfer,
        apiTransfer: paint.apiTransfer,
        fonts: paint.fonts,
        firstTap: nearby - tapAt,
      };
    } finally {
      await context.close();
    }
  }

  test(`user app cold start on ${SLOW_4G.name}, ${RUNS} runs`, async ({ browser }) => {
    const runs = [];
    for (let i = 0; i < RUNS; i += 1) runs.push(await coldStart(browser, SLOW_4G));
    record('coldStart', {
      firstContentfulPaint: series(
        runs.map((r) => r.fcp),
        'startFirstPaintMs',
      ),
      largestContentfulPaint: series(runs.map((r) => r.lcp)),
      homeShell: series(runs.map((r) => r.shell)),
      homeContent: series(
        runs.map((r) => r.content),
        'startHomeContentMs',
      ),
      homeInteractive: series(
        runs.map((r) => r.interactive),
        'startHomeInteractiveMs',
      ),
      totalBlockingTime: series(runs.map((r) => r.tbt)),
      transferBytes: series(
        runs.map((r) => r.transfer),
        'startTransferBytes',
      ),
      jsTransferBytes: series(runs.map((r) => r.jsTransfer)),
      fontTransferBytes: series(runs.map((r) => r.fontTransfer)),
      apiTransferBytes: series(runs.map((r) => r.apiTransfer)),
      fontsAtStart: runs[0]?.fonts.join(', ') ?? null,
      firstTapToNearby: series(
        runs.map((r) => r.firstTap),
        'firstTapToNearbyMs',
      ),
    });
    expect(runs.every((r) => Number.isFinite(r.content))).toBe(true);
  });

  test(`user app cold start on ${SLOW_3G.name}, 3 runs`, async ({ browser }) => {
    const runs = [];
    for (let i = 0; i < 3; i += 1) runs.push(await coldStart(browser, SLOW_3G));
    record('coldStart3G', {
      firstContentfulPaint: series(runs.map((r) => r.fcp)),
      homeContent: series(runs.map((r) => r.content)),
      homeInteractive: series(runs.map((r) => r.interactive)),
    });
    expect(runs.every((r) => Number.isFinite(r.content))).toBe(true);
  });

  test(`user app warm start (installed, service worker), ${RUNS} runs`, async ({ browser }) => {
    const runs: { fcp: number; content: number; interactive: number }[] = [];
    for (let i = 0; i < RUNS; i += 1) {
      const person = await attendee();
      const context = await lowEndContext(browser, { serviceWorkers: 'allow' });
      try {
        const page = await userPage(context, person, { homeContent: HOME_CONTENT });
        // Install: first visit without throttling, wait for the worker to take control.
        await page.goto(`${userWeb.url}/home`);
        await waitForMark(page, 'homeContent');
        await page.evaluate(async () => {
          await navigator.serviceWorker.ready;
        });
        await page.reload();
        await expect
          .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null))
          .toBe(true);
        await waitForMark(page, 'homeContent');
        // The measured start: a fresh tab of the installed app on a slow phone and network.
        const warm = await context.newPage();
        await throttle(warm);
        await warm.goto(`${userWeb.url}/home`, { waitUntil: 'commit' });
        const content = await waitForMark(warm, 'homeContent');
        const interactive = await quietAfter(warm, content);
        const paint = await paintTimes(warm);
        runs.push({ fcp: paint.fcp, content, interactive });
      } finally {
        await context.close();
      }
    }
    record('warmStart', {
      firstContentfulPaint: series(runs.map((r) => r.fcp)),
      homeContent: series(
        runs.map((r) => r.content),
        'warmHomeContentMs',
      ),
      homeInteractive: series(runs.map((r) => r.interactive)),
    });
    expect(runs.length).toBe(RUNS);
  });

  test(`coordinator app cold start on ${SLOW_4G.name}, ${RUNS} runs`, async ({ browser }) => {
    const runs: { fcp: number; content: number; interactive: number; transfer: number }[] = [];
    for (let i = 0; i < RUNS; i += 1) {
      const coordinator = await venueCoordinator(admin);
      const context = await lowEndContext(browser);
      try {
        await giveSession(context, 'admin-app', coordinator);
        await context.addInitScript(
          (entries) => {
            for (const [k, v] of Object.entries(entries)) window.localStorage.setItem(k, v);
          },
          appearanceEntries('admin-app', { locale: 'en', textSize: 0, color: 'light' }),
        );
        await instrument(context, {
          today: '[data-testid="today-actions"], [data-testid="today-data"]',
        });
        const page = await context.newPage();
        await throttle(page);
        await page.goto(`${adminWeb.url}/`, { waitUntil: 'commit', timeout: 120_000 });
        const content = await waitForMark(page, 'today', 120_000);
        const interactive = await quietAfter(page, content);
        const paint = await paintTimes(page);
        runs.push({ fcp: paint.fcp, content, interactive, transfer: paint.transfer });
      } finally {
        await context.close();
      }
    }
    record('adminColdStart', {
      firstContentfulPaint: series(
        runs.map((r) => r.fcp),
        'startFirstPaintMs',
      ),
      todayContent: series(
        runs.map((r) => r.content),
        'adminStartContentMs',
      ),
      todayInteractive: series(runs.map((r) => r.interactive)),
      transferBytes: series(runs.map((r) => r.transfer)),
    });
    expect(runs.length).toBe(RUNS);
  });

  test(`Nearby: scroll a ${LONG_LIST}-row list, ${RUNS} runs`, async ({ browser }) => {
    const person = await attendee();
    const context = await lowEndContext(browser);
    const runs: ReturnType<typeof frameStats>[] = [];
    const longest: number[] = [];
    const longTasks: number[] = [];
    let rows: number;
    try {
      const page = await userPage(context, person, { nearbyList: '[data-testid="nearby-list"]' });
      await throttle(page);
      await page.goto(`${userWeb.url}/nearby`, { waitUntil: 'commit', timeout: 120_000 });
      await waitForMark(page, 'nearbyList', 120_000);
      // "Show more" pages of 20 until the list is long.
      for (let i = 0; i < 10; i += 1) {
        rows = await page.locator('[data-testid^="session-card-"]').count();
        if (rows >= LONG_LIST) break;
        const more = page.getByTestId('nearby-load-more');
        if (!(await more.isVisible().catch(() => false))) {
          await more.scrollIntoViewIfNeeded().catch(() => undefined);
        }
        if ((await more.count()) === 0) break;
        await more.click();
        await expect
          .poll(() => page.locator('[data-testid^="session-card-"]').count(), { timeout: 60_000 })
          .toBeGreaterThan(rows);
      }
      rows = await page.locator('[data-testid^="session-card-"]').count();
      const cdp = await context.newCDPSession(page);
      for (let i = 0; i < RUNS; i += 1) {
        await page
          .getByTestId('screen-scroll')
          .first()
          .evaluate((el) => el.scrollTo({ top: 0 }));
        await quietAfter(page, 0, 2_000);
        const from = await startFrames(page);
        // A finger fling down the list and back up, as Chromium's touch input would send it.
        await cdp.send('Input.synthesizeScrollGesture', {
          x: 180,
          y: 600,
          yDistance: -6000,
          speed: 2500,
          gestureSourceType: 'touch',
        });
        await cdp.send('Input.synthesizeScrollGesture', {
          x: 180,
          y: 200,
          yDistance: 6000,
          speed: 2500,
          gestureSourceType: 'touch',
        });
        const { frames, end } = await stopFrames(page);
        runs.push(frameStats(frames));
        const perf = await readPerf(page);
        const b = blocking(perf, from, end);
        longest.push(b.longestMs);
        longTasks.push(b.count);
      }
    } finally {
      await context.close();
    }
    record('nearbyScroll', {
      rows,
      droppedFramesPct: series(
        runs.map((r) => r.droppedPct),
        'scrollDroppedPct',
      ),
      framesOver50msPct: series(runs.map((r) => r.over50msPct)),
      p95FrameMs: series(runs.map((r) => r.p95FrameMs)),
      worstFrameMs: series(runs.map((r) => r.worstFrameMs)),
      longestTaskMs: series(longest, 'scrollLongestTaskMs'),
      longTasks: series(longTasks),
    });
    expect(rows).toBeGreaterThanOrEqual(LONG_LIST);
  });

  test(`Nearby: map view, ${RUNS} runs`, async ({ browser }) => {
    const ready: number[] = [];
    const tbt: number[] = [];
    for (let i = 0; i < RUNS; i += 1) {
      const person = await attendee();
      const context = await lowEndContext(browser);
      try {
        const page = await userPage(context, person, {
          nearbyList: '[data-testid="nearby-list"]',
          map: '[data-testid="map-list-only"], [data-testid="map-google"], [data-testid="map-nearest"]',
        });
        await throttle(page);
        await page.goto(`${userWeb.url}/nearby`, { waitUntil: 'commit', timeout: 120_000 });
        const listAt = await waitForMark(page, 'nearbyList', 120_000);
        await quietAfter(page, listAt, 2_000);
        const tapAt = await page.evaluate(() => performance.now());
        await page.getByTestId('nearby-view-map').click();
        const mapAt = await waitForMark(page, 'map', 60_000);
        const settled = await quietAfter(page, mapAt, 2_000);
        ready.push(mapAt - tapAt);
        tbt.push(blocking(await readPerf(page), tapAt, settled).totalBlockingMs);
      } finally {
        await context.close();
      }
    }
    record('mapView', {
      tapToMap: series(ready, 'mapReadyMs'),
      totalBlockingTime: series(tbt),
      note: 'Web fallback only (no Maps key, no internet): the list-only map. Google Maps tiles need the phone.',
    });
    expect(ready.length).toBe(RUNS);
  });

  test(`Quran reader: open Al-Baqarah from the Quran tab, ${RUNS} runs`, async ({ browser }) => {
    const first: number[] = [];
    const reopen: number[] = [];
    const tbt: number[] = [];
    for (let i = 0; i < RUNS; i += 1) {
      const person = await attendee();
      const context = await lowEndContext(browser);
      try {
        const page = await userPage(context, person, {
          index: '[data-testid="surah-row-2"]',
          verse: '[data-testid="verse-2-1"]',
        });
        await throttle(page);
        await page.goto(`${userWeb.url}/quran`, { waitUntil: 'commit', timeout: 120_000 });
        const indexAt = await waitForMark(page, 'index', 120_000);
        await quietAfter(page, indexAt, 2_000);
        const tapAt = await page.evaluate(() => performance.now());
        await page.getByTestId('surah-row-2').click();
        const verseAt = await waitForMark(page, 'verse', 60_000);
        const settled = await quietAfter(page, verseAt, 2_000);
        first.push(verseAt - tapAt);
        tbt.push(blocking(await readPerf(page), tapAt, settled).totalBlockingMs);
        // Back to the index and open it again: the surah now comes from the saved copy.
        await page.goto(`${userWeb.url}/quran`, { waitUntil: 'commit' });
        const again = await waitForMark(page, 'index', 120_000);
        await quietAfter(page, again, 2_000);
        const tap2 = await page.evaluate(() => performance.now());
        await page.getByTestId('surah-row-2').click();
        reopen.push((await waitForMark(page, 'verse', 60_000)) - tap2);
      } finally {
        await context.close();
      }
    }
    record('quranReader', {
      tapToFirstVerse: series(first, 'readerFirstVerseMs'),
      totalBlockingTime: series(tbt, 'readerBlockingMs'),
      reopenTapToFirstVerse: series(reopen, 'readerReopenMs'),
    });
    expect(first.length).toBe(RUNS);
  });

  test('summary against the proposed budgets', () => {
    const results = SCENARIOS.map((s) => readResult<ScenarioResult>(`budgets/${s}`)).filter(
      (r): r is ScenarioResult => r !== null && r.stackStartedAt === stack().startedAt,
    );
    const misses = results.flatMap((r) => r.misses);
    writeResult('budgets', {
      measuredAt: new Date().toISOString(),
      device: DEVICE,
      budgets: BUDGETS,
      scenarios: Object.fromEntries(results.map((r) => [r.scenario, r.values])),
      bundleDetail: results.find((r) => r.scenario === 'bundle')?.detail ?? null,
      misses,
    });
    expect(results.length, 'scenarios measured in this run').toBeGreaterThan(0);
    if (STRICT) expect(misses, 'budgets missed').toEqual([]);
  });
});
