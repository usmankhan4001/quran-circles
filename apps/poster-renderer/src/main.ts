import { serve } from '@hono/node-server';
import { createApp } from './app';
import { BrowserPool } from './browser';
import { MemoryCache } from './cache';
import { parseRendererEnv } from './config';
import { fontFaceCss } from './fonts';
import { Limiter } from './limiter';
import { createConsoleLogger } from './logger';
import { PosterRenderer } from './renderer';

/** The renderer process: one headless Chromium behind a small HTTP interface on the internal network. */
export async function main(env: Record<string, string | undefined> = process.env): Promise<void> {
  const logger = createConsoleLogger();
  const config = parseRendererEnv(env);
  fontFaceCss(); // checks the bundled fonts' checksums before accepting work

  const pool = new BrowserPool({
    logger,
    heapMb: config.BROWSER_HEAP_MB,
    recycleAfter: config.BROWSER_RECYCLE_AFTER,
    ...(config.CHROMIUM_PATH ? { executablePath: config.CHROMIUM_PATH } : {}),
  });
  const limiter = new Limiter(config.RENDER_CONCURRENCY, config.RENDER_QUEUE_MAX);
  const renderer = new PosterRenderer({
    pages: pool,
    limiter,
    cache: new MemoryCache(config.RENDER_CACHE_BYTES),
    timeoutMs: config.RENDER_TIMEOUT_MS,
    logger,
    ...(config.PUBLIC_WEB_BASE ? { webBase: config.PUBLIC_WEB_BASE } : {}),
  });
  const app = createApp({
    renderer,
    limiter,
    logger,
    ...(config.RENDERER_TOKEN ? { token: config.RENDERER_TOKEN } : {}),
  });

  const server = serve(
    { fetch: app.fetch, port: config.RENDERER_PORT, hostname: config.RENDERER_HOST },
    (info) =>
      logger.info('renderer.ready', { port: info.port, concurrency: config.RENDER_CONCURRENCY }),
  );

  let stopping = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (stopping) return;
    stopping = true;
    logger.info('renderer.stopping', { signal });
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.close();
    logger.info('renderer.stopped');
  };
  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.once(signal, () => {
      shutdown(signal).then(
        () => process.exit(0),
        () => process.exit(1),
      );
    });
  }
}

main().catch((error: unknown) => {
  console.error(
    JSON.stringify({
      level: 'error',
      event: 'renderer.start_failed',
      error: (error as Error).name,
      message: (error as Error).message,
    }),
  );
  process.exit(1);
});
