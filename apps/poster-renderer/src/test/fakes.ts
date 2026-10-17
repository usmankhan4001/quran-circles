import type { PageJob, PageResult } from '../browser';
import { MemoryCache } from '../cache';
import { Limiter } from '../limiter';
import { silentLogger } from '../logger';
import { PosterRenderer, type PageRenderer } from '../renderer';

/** A page renderer that records jobs and returns small fake bytes (or what `behaviour` says). */
export class FakePages implements PageRenderer {
  readonly jobs: PageJob[] = [];
  behaviour: (job: PageJob) => Promise<PageResult> = async (job) => ({
    bytes: Buffer.from(`fake:${job.output.kind}:${job.width}x${job.height}:${this.jobs.length}`),
    blocked: [],
  });

  render(job: PageJob): Promise<PageResult> {
    this.jobs.push(job);
    return this.behaviour(job);
  }
}

export function fakeRenderer(
  options: { concurrency?: number; queue?: number; cacheBytes?: number; webBase?: string } = {},
) {
  const pages = new FakePages();
  const limiter = new Limiter(options.concurrency ?? 2, options.queue ?? 4);
  const renderer = new PosterRenderer({
    pages,
    limiter,
    cache: new MemoryCache(options.cacheBytes ?? 1024 * 1024),
    timeoutMs: 5_000,
    logger: silentLogger,
    ...(options.webBase ? { webBase: options.webBase } : {}),
  });
  return { pages, limiter, renderer };
}
