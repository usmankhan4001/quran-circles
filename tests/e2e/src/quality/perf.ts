import type { BrowserContext, Page } from '@playwright/test';

/**
 * In-page timing for the budgets. Installed before any app script runs; every time is
 * `performance.now()` in the page, so milliseconds since the navigation started.
 */
export interface PagePerf {
  longTasks: [number, number][];
  lcp: number;
  marks: Record<string, number>;
  frames: number[];
  recording: boolean;
}

export interface Watch {
  [mark: string]: string;
}

/** Records long tasks, the largest contentful paint and when each watched selector first shows. */
export async function instrument(context: BrowserContext, watch: Watch): Promise<void> {
  await context.addInitScript((selectors: Record<string, string>) => {
    const perf = { longTasks: [], lcp: 0, marks: {}, frames: [], recording: false } as {
      longTasks: [number, number][];
      lcp: number;
      marks: Record<string, number>;
      frames: number[];
      recording: boolean;
    };
    (window as unknown as { __qcPerf: typeof perf }).__qcPerf = perf;
    try {
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) perf.longTasks.push([e.startTime, e.duration]);
      }).observe({ type: 'longtask', buffered: true });
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) perf.lcp = e.startTime;
      }).observe({ type: 'largest-contentful-paint', buffered: true });
    } catch {
      // An old engine without these entry types: the marks below still work.
    }
    const check = (): void => {
      for (const [mark, selector] of Object.entries(selectors)) {
        if (perf.marks[mark] !== undefined) continue;
        const el = document.querySelector(selector);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) perf.marks[mark] = performance.now();
      }
    };
    const start = (): void => {
      new MutationObserver(check).observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
      });
      check();
    };
    if (document.documentElement) start();
    else document.addEventListener('DOMContentLoaded', start);
  }, watch);
}

export async function readPerf(page: Page): Promise<PagePerf> {
  return page.evaluate(() => (window as unknown as { __qcPerf: PagePerf }).__qcPerf);
}

export async function waitForMark(page: Page, mark: string, timeoutMs = 90_000): Promise<number> {
  const handle = await page.waitForFunction(
    (m) => (window as unknown as { __qcPerf?: PagePerf }).__qcPerf?.marks[m],
    mark,
    { timeout: timeoutMs, polling: 100 },
  );
  return Number(await handle.jsonValue());
}

/** Forgets a mark so it can be measured again in the same page (in-app navigation). */
export async function resetMark(page: Page, mark: string): Promise<void> {
  await page.evaluate((m) => {
    delete (window as unknown as { __qcPerf: PagePerf }).__qcPerf.marks[m];
  }, mark);
}

/**
 * Waits until the main thread has had no long task for `quietMs` (Lighthouse's time-to-interactive
 * idea, without the network part), and returns when the last long task before that ended.
 */
export async function quietAfter(page: Page, since: number, quietMs = 5_000): Promise<number> {
  const deadline = Date.now() + 60_000;
  for (;;) {
    const state = await page.evaluate(() => {
      const p = (window as unknown as { __qcPerf: PagePerf }).__qcPerf;
      const last = p.longTasks.reduce((end, [s, d]) => Math.max(end, s + d), 0);
      return { now: performance.now(), last };
    });
    const lastEnd = Math.max(state.last, since);
    if (state.now - lastEnd >= quietMs || Date.now() > deadline) return lastEnd;
    await page.waitForTimeout(500);
  }
}

/** Long tasks that started inside a window: count, longest and total blocking time (over 50 ms). */
export function blocking(perf: PagePerf, from: number, to: number) {
  const inside = perf.longTasks.filter(([s]) => s >= from && s <= to);
  return {
    count: inside.length,
    longestMs: inside.reduce((m, [, d]) => Math.max(m, d), 0),
    totalBlockingMs: inside.reduce((t, [, d]) => t + Math.max(0, d - 50), 0),
  };
}

/** Starts recording every animation frame's time, for the scroll measurement. */
export async function startFrames(page: Page): Promise<number> {
  return page.evaluate(() => {
    const p = (window as unknown as { __qcPerf: PagePerf }).__qcPerf;
    p.frames = [];
    p.recording = true;
    const tick = (t: number): void => {
      if (!p.recording) return;
      p.frames.push(t);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return performance.now();
  });
}

export async function stopFrames(page: Page): Promise<{ frames: number[]; end: number }> {
  return page.evaluate(() => {
    const p = (window as unknown as { __qcPerf: PagePerf }).__qcPerf;
    p.recording = false;
    return { frames: [...p.frames], end: performance.now() };
  });
}

/** Frame statistics at 60 Hz: dropped frames, frames over 50 ms and the worst gap. */
export function frameStats(frames: readonly number[]) {
  const gaps: number[] = [];
  for (let i = 1; i < frames.length; i += 1) gaps.push((frames[i] ?? 0) - (frames[i - 1] ?? 0));
  const budget = 1000 / 60;
  const dropped = gaps.reduce((n, g) => n + Math.max(0, Math.round(g / budget) - 1), 0);
  const expected = gaps.reduce((n, g) => n + Math.max(1, Math.round(g / budget)), 0);
  const sorted = [...gaps].sort((a, b) => a - b);
  return {
    frames: frames.length,
    droppedPct: expected ? (dropped / expected) * 100 : 0,
    over50msPct: gaps.length ? (gaps.filter((g) => g > 50).length / gaps.length) * 100 : 0,
    p95FrameMs: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
    worstFrameMs: sorted[sorted.length - 1] ?? 0,
  };
}
