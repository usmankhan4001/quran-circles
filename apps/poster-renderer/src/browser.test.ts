import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  BrowserPool,
  FontLoadError,
  launchArgs,
  RenderTimeoutError,
  type PageJob,
} from './browser';
import { MemoryCache } from './cache';
import { fontFaceCss } from './fonts';
import { Limiter } from './limiter';
import { silentLogger } from './logger';
import { PosterRenderer } from './renderer';
import { sampleRequest } from './sample';
import { Inspector } from './test/inspect';

/**
 * The renderer must not fetch arbitrary URLs or read local files (brief, definition of done), and
 * must keep to its time and memory limits.
 */
let server: Server;
let hits: string[] = [];
let origin = '';
let scratch = '';
let inspector: Inspector;

beforeAll(async () => {
  server = createServer((req, res) => {
    hits.push(req.url ?? '');
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('body{background:#ff0000}');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  scratch = mkdtempSync(join(tmpdir(), 'qc-renderer-'));
  writeFileSync(
    join(scratch, 'red.svg'),
    '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#ff0000"/></svg>',
  );
  writeFileSync(join(scratch, 'red.css'), 'body{background:#ff0000 !important}');
  inspector = await Inspector.start();
});
afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  rmSync(scratch, { recursive: true, force: true });
  await inspector.close();
});
beforeEach(() => {
  hits = [];
});

/** A page that tries every way HTML and CSS have of loading something. No CSP: the browser layer alone must hold. */
const hostile = () => `<!doctype html><html><head><meta charset="utf-8">
<style>${fontFaceCss()}
@import url("${origin}/import.css");
body{margin:0;background:#ffffff url("${origin}/bg.png")}
@font-face{font-family:Remote;src:url("${origin}/font.ttf")}
p{font-family:Remote,Figtree}
</style>
<link rel="stylesheet" href="${origin}/style.css">
<link rel="stylesheet" href="file://${scratch}/red.css">
<link rel="prefetch" href="${origin}/prefetch">
<script src="${origin}/script.js"></script>
<script>fetch("${origin}/fetch"); new Image().src = "${origin}/js-image";</script>
</head><body>
<img src="file://${scratch}/red.svg" style="display:block;width:200px;height:200px">
<img src="${origin}/img.png"><img src="http://example.org/remote.png">
<iframe src="${origin}/frame.html"></iframe><iframe src="file:///etc/hostname"></iframe>
<object data="${origin}/object"></object><embed src="${origin}/embed">
<video poster="${origin}/poster.png" src="${origin}/video.mp4" autoplay></video>
<audio src="${origin}/audio.mp3" autoplay></audio>
<form action="${origin}/form" method="post"><input name="q" value="x" autofocus></form>
<svg width="10" height="10"><image href="${origin}/svg-image.png" width="10" height="10"/></svg>
<p>Text</p></body></html>`;

const job = (html: string): PageJob => ({ html, width: 400, height: 400, output: { kind: 'png' } });
const settle = () => new Promise((r) => setTimeout(r, 500));

describe('network and file isolation', () => {
  it('control: the test server is reachable from an ordinary browser page', async () => {
    await inspector.page.goto(`${origin}/control`);
    expect(hits).toEqual(['/control']);
  });

  it('blocks every request a page makes, with all layers on', async () => {
    const pool = new BrowserPool({ logger: silentLogger, heapMb: 128, recycleAfter: 10 });
    try {
      const { bytes, blocked } = await pool.render(job(hostile()), Date.now() + 20_000);
      await settle();
      expect(hits).toEqual([]);
      expect(blocked.length).toBeGreaterThan(0);
      expect(
        blocked.every((b) => b === origin || b === 'http://example.org' || b.startsWith('file:')),
      ).toBe(true);
      // Neither the local SVG nor the local stylesheet painted anything red.
      const [img, page] = await inspector.pixels(bytes, [
        [100, 100],
        [390, 390],
      ]);
      expect(img).toEqual([255, 255, 255]);
      expect(page).toEqual([255, 255, 255]);
    } finally {
      await pool.close();
    }
  });

  it('still blocks everything with Playwright interception off: the launch flags hold on their own', async () => {
    const pool = new BrowserPool({
      logger: silentLogger,
      heapMb: 128,
      recycleAfter: 10,
      interceptRequests: false,
    });
    try {
      const { bytes } = await pool.render(job(hostile()), Date.now() + 20_000);
      await settle();
      expect(hits).toEqual([]);
      const [img] = await inspector.pixels(bytes, [[100, 100]]);
      expect(img).toEqual([255, 255, 255]);
    } finally {
      await pool.close();
    }
  });

  it('fails closed when a page tries to navigate away, and the navigation reaches nothing', async () => {
    const pool = new BrowserPool({ logger: silentLogger, heapMb: 128, recycleAfter: 10 });
    try {
      const page = `<!doctype html><style>${fontFaceCss()}</style><meta http-equiv="refresh" content="0;url=${origin}/refresh"><p>x</p>`;
      await pool.render(job(page), Date.now() + 20_000).catch(() => undefined);
      await settle();
      expect(hits).toEqual([]);
    } finally {
      await pool.close();
    }
  });

  it('cannot be steered by field values: hostile text is printed as text', async () => {
    const pool = new BrowserPool({ logger: silentLogger, heapMb: 128, recycleAfter: 10 });
    const renderer = new PosterRenderer({
      pages: pool,
      limiter: new Limiter(1, 1),
      cache: new MemoryCache(0),
      timeoutMs: 20_000,
      logger: silentLogger,
    });
    try {
      const details = `<img src="${origin}/t"> <link rel=stylesheet href="file:///etc/passwd"> <style>*{}</style>`;
      const result = await renderer.render(
        sampleRequest({
          language: 'en',
          fields: { title: { en: 'Sample' }, details: { en: details } },
          formats: ['story'],
        }),
      );
      await settle();
      expect(result.files).toHaveLength(1);
      expect(hits).toEqual([]);
    } finally {
      await pool.close();
    }
  });

  it('launches Chromium with no working DNS, a dead proxy for every host including loopback, and a heap cap', () => {
    const args = launchArgs(96);
    expect(args).toContain('--host-resolver-rules=MAP * ~NOTFOUND');
    expect(args).toContain('--proxy-server=http://127.0.0.1:9');
    expect(args).toContain('--proxy-bypass-list=<-loopback>');
    expect(args).toContain('--js-flags=--max-old-space-size=96');
    expect(args).toContain('--disable-dev-shm-usage');
  });
});

describe('limits', () => {
  it('applies the heap cap to the page', async () => {
    const browser = await chromium.launch({ headless: true, args: launchArgs(96) });
    try {
      const page = await browser.newPage();
      const limit = (await page.evaluate('performance.memory.jsHeapSizeLimit')) as number;
      expect(limit).toBeLessThan(256 * 1024 * 1024);
    } finally {
      await browser.close();
    }
  });

  it('times out a render, closes its page and keeps working', async () => {
    const pool = new BrowserPool({ logger: silentLogger, heapMb: 128, recycleAfter: 10 });
    try {
      // A page heavy enough to need more than the deadline.
      const heavy =
        `<!doctype html><style>${fontFaceCss()}</style>` +
        '<p style="font:40px Figtree">x</p>'.repeat(20_000);
      await expect(pool.render(job(heavy), Date.now() + 50)).rejects.toBeInstanceOf(
        RenderTimeoutError,
      );
      const ok = await pool.render(
        job(`<!doctype html><style>${fontFaceCss()}</style><p>ok</p>`),
        Date.now() + 20_000,
      );
      expect(ok.bytes.length).toBeGreaterThan(0);
    } finally {
      await pool.close();
    }
  });

  it('times out through the renderer with its configured limit', async () => {
    const pool = new BrowserPool({ logger: silentLogger, heapMb: 128, recycleAfter: 10 });
    const renderer = new PosterRenderer({
      pages: pool,
      limiter: new Limiter(1, 0),
      cache: new MemoryCache(0),
      timeoutMs: 1,
      logger: silentLogger,
    });
    try {
      await expect(
        renderer.render(sampleRequest({ formats: ['story', 'print_a4'] })),
      ).rejects.toBeInstanceOf(RenderTimeoutError);
    } finally {
      await pool.close();
    }
  });

  it('refuses to draw when the bundled fonts are missing', async () => {
    const pool = new BrowserPool({ logger: silentLogger, heapMb: 128, recycleAfter: 10 });
    try {
      await expect(
        pool.render(job('<!doctype html><p>no fonts</p>'), Date.now() + 20_000),
      ).rejects.toBeInstanceOf(FontLoadError);
    } finally {
      await pool.close();
    }
  });

  it('restarts the browser after the configured number of renders', async () => {
    const pool = new BrowserPool({ logger: silentLogger, heapMb: 128, recycleAfter: 1 });
    try {
      const page = job(`<!doctype html><style>${fontFaceCss()}</style><p>x</p>`);
      await pool.render(page, Date.now() + 20_000);
      await pool.render(page, Date.now() + 20_000);
      expect(pool.launchCount).toBe(2);
    } finally {
      await pool.close();
    }
  });

  it('runs at most the configured number of renders at once and refuses the overflow', async () => {
    const pool = new BrowserPool({ logger: silentLogger, heapMb: 128, recycleAfter: 50 });
    const renderer = new PosterRenderer({
      pages: pool,
      limiter: new Limiter(1, 1),
      cache: new MemoryCache(0),
      timeoutMs: 30_000,
      logger: silentLogger,
    });
    try {
      const results = await Promise.allSettled([
        renderer.render(sampleRequest({ formats: ['story'] })),
        renderer.render(sampleRequest({ formats: ['link_preview'] })),
        renderer.render(sampleRequest({ formats: ['print_a4'] })),
      ]);
      expect(results.map((r) => r.status)).toEqual(['fulfilled', 'fulfilled', 'rejected']);
      expect((results[2] as PromiseRejectedResult).reason).toMatchObject({ name: 'BusyError' });
    } finally {
      await pool.close();
    }
  });
});
