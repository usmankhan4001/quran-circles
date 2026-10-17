import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import {
  POSTER_FAILURE_CODES,
  POSTER_FAILURE_RETRYABLE,
  posterStorageKey,
  type PosterFailureCode,
} from '@qc/contracts';
import { createMemoryLogger, type MemoryLogger } from '@qc/messaging';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { tables } from '../db';
import { createTestDb, type TestDb } from '../test/db';
import { FAKE_RENDERER_TOKEN, FakeRenderer, type FakeAnswer } from '../test/fake-renderer';
import { seedPoster, seedPosterTemplate, seedWorld, type World } from '../test/seed';
import {
  renderPosters,
  snapshotOfSessionRow,
  type PosterRenderAttempt,
  type PosterRenderDeps,
} from './render';
import { LocalDiskPosterStorage, type PosterStorage } from './storage';

/** The poster job against PGlite, a loopback fake renderer and a temporary directory. */

let test: TestDb;
let fake: FakeRenderer;
let dir: string;
let storage: LocalDiskPosterStorage;
let logger: MemoryLogger;
let world: World;
let templateId: string;

const FINAL: PosterRenderAttempt = { finalAttempt: true };
const FIRST: PosterRenderAttempt = { finalAttempt: false, attempt: 0 };

beforeAll(async () => {
  test = await createTestDb();
  fake = await new FakeRenderer().start();
}, 120_000);

afterAll(async () => {
  await fake.stop();
  await test.pg.close();
});

beforeEach(async () => {
  await test.reset();
  fake.reset();
  if (dir) await rm(dir, { recursive: true, force: true });
  dir = await mkdtemp(path.join(tmpdir(), 'qc-posters-'));
  storage = new LocalDiskPosterStorage(dir);
  logger = createMemoryLogger();
  world = await seedWorld(test.db);
  templateId = (await seedPosterTemplate(test.db, { key: 'cloud' })).id;
});

const deps = (over: Partial<PosterRenderDeps> = {}): PosterRenderDeps => ({
  db: test.db,
  logger,
  renderer: { url: fake.url, token: FAKE_RENDERER_TOKEN, timeoutMs: 5_000 },
  storage,
  missing: [],
  ...over,
});

const poster = (over: Partial<Parameters<typeof seedPoster>[1]> = {}) =>
  seedPoster(test.db, { sessionId: world.session.id, templateId, ...over });

const row = async (id: string) => {
  const [r] = await test.db.select().from(tables.posters).where(eq(tables.posters.id, id));
  return r;
};

const files = async (): Promise<string[]> => {
  const out: string[] = [];
  const walk = async (d: string): Promise<void> => {
    for (const entry of await readdir(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) await walk(full);
      else out.push(path.relative(dir, full).split(path.sep).join('/'));
    }
  };
  await walk(dir);
  return out.sort();
};

const renderLines = () => logger.lines.filter((l) => l.event === 'posters.render');

describe('rendering queued posters', () => {
  it('renders every format of a job in one call, stores the files and marks the rows ready', async () => {
    const story = await poster({ format: 'story' });
    const a4 = await poster({ format: 'print_a4' });
    const summary = await renderPosters(deps(), { posterIds: [story.id, a4.id] }, FIRST);

    expect(summary).toMatchObject({
      posters: 2,
      skipped: 0,
      ready: 2,
      failed: 0,
      retrying: 0,
      renderCalls: 1,
      retry: false,
      notConfigured: false,
      failure: null,
    });
    expect(fake.requests).toHaveLength(1);
    const sent = fake.requests[0]!;
    expect(sent.authorization).toBe(`Bearer ${FAKE_RENDERER_TOKEN}`);
    expect(sent.path).toBe('/render');
    const [session] = await test.db
      .select()
      .from(tables.sessions)
      .where(eq(tables.sessions.id, world.session.id));
    expect(sent.body).toEqual({
      templateId: 'cloud',
      formats: ['story', 'print_a4'],
      language: 'en_ur',
      fields: {
        title: { en: 'Weekly tafsir', ur: 'ہفتہ وار تفسیر' },
        accent: 'tanzeem',
        qrTarget: 'register',
      },
      session: {
        sessionId: world.session.id,
        sessionVersion: session!.updatedAt.toISOString(),
        localStartTime: '19:30',
        durationMinutes: 60,
        daysOfWeek: [5],
        startsOn: '2026-03-01',
        endsOn: null,
        timezone: 'Asia/Karachi',
        venue: {
          id: world.venue.id,
          name: { en: 'Test Masjid', ur: 'ٹیسٹ مسجد' },
          area: { en: 'Test Area', ur: 'ٹیسٹ علاقہ' },
        },
      },
    });

    for (const [id, ext] of [
      [story.id, 'png'],
      [a4.id, 'pdf'],
    ] as const) {
      const r = (await row(id))!;
      expect(r.status).toBe('ready');
      expect(r.failureCode).toBeNull();
      expect(r.altText).toEqual({
        en: 'Synthetic poster alt text (en).',
        ur: 'Synthetic poster alt text (ur).',
      });
      expect(r.sourceSnapshot).toEqual(sent.body.session);
      expect(r.storageKey).toMatch(
        new RegExp(`^posters/${world.session.id}/[0-9a-f]{64}\\.${ext}$`),
      );
      const bytes = await storage.get(r.storageKey!);
      expect(Buffer.from(bytes!).toString()).toContain(ext === 'pdf' ? '%PDF' : 'PNG');
    }
    expect(await files()).toHaveLength(2);
  });

  it('keeps the storage key layout of posterStorageKey', async () => {
    const story = await poster({ format: 'link_preview' });
    await renderPosters(deps(), { posterIds: [story.id] }, FINAL);
    const r = (await row(story.id))!;
    const cacheKey = r.storageKey!.split('/')[2]!.replace(/\.png$/, '');
    expect(r.storageKey).toBe(posterStorageKey(world.session.id, cacheKey, 'image/png'));
    expect(await files()).toEqual([r.storageKey]);
  });

  it('logs one counts-only line: no title, venue, area, alt text or token', async () => {
    const story = await poster({ format: 'story' });
    await renderPosters(deps(), { posterIds: [story.id] }, FINAL);
    expect(renderLines()).toHaveLength(1);
    expect(renderLines()[0]).toMatchObject({
      level: 'info',
      fields: { posters: 1, ready: 1, failed: 0, skipped: 0, retry: false },
    });
    const dump = logger.dump();
    for (const secret of [
      'Weekly tafsir',
      'ہفتہ وار',
      'Test Masjid',
      'Test Area',
      'alt text',
      FAKE_RENDERER_TOKEN,
      world.session.id,
      story.id,
    ]) {
      expect(dump).not.toContain(secret);
    }
  });

  it('does nothing on a duplicate run after success: no renderer call, no row or file change', async () => {
    const story = await poster({ format: 'story' });
    await renderPosters(deps(), { posterIds: [story.id] }, FINAL);
    const before = await row(story.id);
    const filesBefore = await files();

    const again = await renderPosters(deps(), { posterIds: [story.id, story.id] }, FINAL);
    expect(again).toMatchObject({ posters: 1, skipped: 1, ready: 0, failed: 0, renderCalls: 0 });
    expect(fake.requests).toHaveLength(1);
    expect(await row(story.id)).toEqual(before);
    expect(await files()).toEqual(filesBefore);
  });

  it('does nothing for a failed row or an id that does not exist', async () => {
    const failed = await poster({ status: 'failed' });
    const summary = await renderPosters(
      deps(),
      { posterIds: [failed.id, '00000000-0000-4000-8000-000000000999'] },
      FINAL,
    );
    expect(summary).toMatchObject({ posters: 2, skipped: 2, renderCalls: 0 });
    expect(fake.requests).toHaveLength(0);
  });

  it('renders a row made before migration 0010 (no language) in its locale', async () => {
    const old = await poster({
      language: null,
      locale: 'ur',
      fields: { title: { ur: 'ہفتہ وار تفسیر' } },
    });
    await renderPosters(deps(), { posterIds: [old.id] }, FINAL);
    expect(fake.requests[0]!.body.language).toBe('ur');
    expect((await row(old.id))!.status).toBe('ready');
  });

  it('prints the session as it is when the job runs, not as it was queued', async () => {
    const story = await poster();
    await test.db
      .update(tables.sessions)
      .set({ localStartTime: '20:15', updatedAt: new Date('2026-11-01T00:00:00Z') })
      .where(eq(tables.sessions.id, world.session.id));
    await renderPosters(deps(), { posterIds: [story.id] }, FINAL);
    expect(fake.requests[0]!.body.session).toMatchObject({
      localStartTime: '20:15',
      sessionVersion: '2026-11-01T00:00:00.000Z',
    });
    expect((await row(story.id))!.sourceSnapshot).toMatchObject({ localStartTime: '20:15' });
  });

  it('sends one call per group when a job mixes different requests', async () => {
    const a = await poster({ format: 'story' });
    const b = await poster({
      format: 'story',
      fields: { title: { en: 'Other', ur: 'دوسرا' }, accent: 'night', qrTarget: 'session' },
    });
    const summary = await renderPosters(deps(), { posterIds: [a.id, b.id] }, FINAL);
    expect(summary).toMatchObject({ ready: 2, renderCalls: 2 });
    expect((await row(a.id))!.storageKey).not.toBe((await row(b.id))!.storageKey);
  });
});

describe('renderer failures', () => {
  const cases: Array<{ name: string; answer: FakeAnswer; failure: PosterFailureCode }> = [
    {
      name: '400 validation_failed',
      answer: {
        kind: 'status',
        status: 400,
        body: { error: { code: 'validation_failed', issues: [{ path: 'fields', code: 'x' }] } },
      },
      failure: 'invalid_request',
    },
    {
      name: '413 payload_too_large',
      answer: { kind: 'status', status: 413, body: { error: { code: 'payload_too_large' } } },
      failure: 'invalid_request',
    },
    {
      name: '422 text_too_long',
      answer: {
        kind: 'status',
        status: 422,
        body: { error: { code: 'text_too_long', fields: ['title.en'], regions: ['title'] } },
      },
      failure: 'text_too_long',
    },
    {
      name: '503 busy',
      answer: { kind: 'status', status: 503, body: { error: { code: 'busy' } } },
      failure: 'busy',
    },
    {
      name: '504 render_timeout',
      answer: { kind: 'status', status: 504, body: { error: { code: 'render_timeout' } } },
      failure: 'render_timeout',
    },
    {
      name: '500 render_failed',
      answer: { kind: 'status', status: 500, body: { error: { code: 'render_failed' } } },
      failure: 'render_failed',
    },
    {
      name: '500 with an unreadable body',
      answer: { kind: 'raw', status: 500, text: '<html>oops</html>' },
      failure: 'render_failed',
    },
    {
      name: '200 that is not JSON',
      answer: { kind: 'raw', status: 200, text: 'not json' },
      failure: 'render_failed',
    },
    {
      name: '200 that does not match the response schema',
      answer: { kind: 'status', status: 200, body: { files: [] } },
      failure: 'render_failed',
    },
    {
      name: '200 whose file bytes do not match the hash',
      answer: { kind: 'corrupt' },
      failure: 'render_failed',
    },
    {
      name: '200 missing a requested format',
      answer: { kind: 'drop_format' },
      failure: 'render_failed',
    },
  ];

  it('covers every failure code the contract has', () => {
    expect(new Set(cases.map((c) => c.failure))).toEqual(new Set(POSTER_FAILURE_CODES));
  });

  for (const c of cases) {
    const retryable = POSTER_FAILURE_RETRYABLE[c.failure];

    it(`${c.name}: on the last attempt the rows fail with ${c.failure}`, async () => {
      const story = await poster({ format: 'story' });
      const a4 = await poster({ format: 'print_a4' });
      fake.next(c.answer);
      const summary = await renderPosters(deps(), { posterIds: [story.id, a4.id] }, FINAL);
      expect(summary).toMatchObject({ failed: 2, retrying: 0, retry: false, failure: c.failure });
      for (const id of [story.id, a4.id]) {
        expect(await row(id)).toMatchObject({
          status: 'failed',
          failureCode: c.failure,
          storageKey: null,
          altText: null,
        });
      }
      expect(await files()).toEqual([]);
      expect(renderLines()).toHaveLength(1);
      expect(renderLines()[0]).toMatchObject({ level: 'warn', fields: { failure: c.failure } });
    });

    it(`${c.name}: with attempts left it is ${retryable ? 'retried' : 'not retried'}`, async () => {
      const story = await poster();
      fake.next(c.answer);
      const summary = await renderPosters(deps(), { posterIds: [story.id] }, FIRST);
      if (retryable) {
        expect(summary).toMatchObject({ retry: true, retrying: 1, failed: 0, failure: c.failure });
        expect(await row(story.id)).toMatchObject({ status: 'queued', failureCode: null });
      } else {
        expect(summary).toMatchObject({ retry: false, retrying: 0, failed: 1 });
        expect(await row(story.id)).toMatchObject({ status: 'failed', failureCode: c.failure });
      }
    });
  }

  it('a 401 (wrong token) is render_failed, and the token is never logged', async () => {
    const story = await poster();
    const summary = await renderPosters(
      deps({ renderer: { url: fake.url, token: 'wrong-test-token', timeoutMs: 5_000 } }),
      { posterIds: [story.id] },
      FINAL,
    );
    expect(summary.failure).toBe('render_failed');
    expect(fake.requests).toHaveLength(0);
    expect(logger.dump()).not.toContain('wrong-test-token');
  });

  it('times out a renderer that does not answer: render_timeout, retried with attempts left', async () => {
    const story = await poster();
    fake.next({ kind: 'hang' }, { kind: 'hang' });
    const slow = deps({ renderer: { url: fake.url, token: FAKE_RENDERER_TOKEN, timeoutMs: 300 } });
    expect(await renderPosters(slow, { posterIds: [story.id] }, FIRST)).toMatchObject({
      retry: true,
      failure: 'render_timeout',
    });
    expect((await row(story.id))!.status).toBe('queued');
    expect(await renderPosters(slow, { posterIds: [story.id] }, FINAL)).toMatchObject({
      failed: 1,
      failure: 'render_timeout',
    });
    expect((await row(story.id))!.failureCode).toBe('render_timeout');
  });

  it('stops when pg-boss aborts the job (expiry): render_timeout', async () => {
    const story = await poster();
    fake.next({ kind: 'hang' });
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 100);
    const summary = await renderPosters(
      deps(),
      { posterIds: [story.id] },
      { finalAttempt: false, signal: controller.signal },
    );
    expect(summary).toMatchObject({ retry: true, failure: 'render_timeout' });
  });

  it('a renderer that cannot be reached is render_failed, retried with attempts left', async () => {
    const gone = await new FakeRenderer().start();
    const url = gone.url;
    await gone.stop();
    const story = await poster();
    const summary = await renderPosters(
      deps({ renderer: { url, token: FAKE_RENDERER_TOKEN, timeoutMs: 2_000 } }),
      { posterIds: [story.id] },
      FIRST,
    );
    expect(summary).toMatchObject({ retry: true, failure: 'render_failed' });
  });

  it('retries a busy renderer and then fills the rows', async () => {
    const story = await poster();
    fake.next({ kind: 'status', status: 503, body: { error: { code: 'busy' } } });
    expect((await renderPosters(deps(), { posterIds: [story.id] }, FIRST)).retry).toBe(true);
    const second = await renderPosters(
      deps(),
      { posterIds: [story.id] },
      { finalAttempt: false, attempt: 1 },
    );
    expect(second).toMatchObject({ ready: 1, retry: false });
    expect(await row(story.id)).toMatchObject({ status: 'ready', failureCode: null });
    expect(fake.requests).toHaveLength(2);
  });

  it('fails a row whose fields cannot make a request, without calling the renderer', async () => {
    // A two-language poster with only an English title.
    const story = await poster({ fields: { title: { en: 'Weekly tafsir' } } });
    const broken = await poster({ fields: { title: 'not an object' } });
    const summary = await renderPosters(deps(), { posterIds: [story.id, broken.id] }, FIRST);
    expect(summary).toMatchObject({ failed: 2, retry: false, renderCalls: 0 });
    expect((await row(story.id))!.failureCode).toBe('invalid_request');
    expect((await row(broken.id))!.failureCode).toBe('invalid_request');
    expect(fake.requests).toHaveLength(0);
  });

  it('leaves the rows queued and throws when storage fails, so pg-boss retries the job', async () => {
    const story = await poster();
    const failing: PosterStorage = {
      put: () => Promise.reject(new Error('disk full')),
      get: () => Promise.resolve(null),
      delete: () => Promise.resolve(),
    };
    await expect(
      renderPosters(deps({ storage: failing }), { posterIds: [story.id] }, FIRST),
    ).rejects.toThrow('disk full');
    expect((await row(story.id))!.status).toBe('queued');
  });
});

describe('regenerated posters', () => {
  const OLD_KEY = (sessionId: string) => `posters/${sessionId}/${'a'.repeat(64)}.png`;

  it('deletes the old row and its file once the new one is ready', async () => {
    const oldKey = OLD_KEY(world.session.id);
    await storage.put(oldKey, new TextEncoder().encode('old poster'), 'image/png');
    const old = await poster({ status: 'ready', storageKey: oldKey });
    const fresh = await poster({ replacesPosterId: old.id });

    const summary = await renderPosters(deps(), { posterIds: [fresh.id] }, FINAL);
    expect(summary).toMatchObject({ ready: 1, replaced: 1, filesDeleted: 1 });
    expect(await row(old.id)).toBeUndefined();
    expect(await storage.get(oldKey)).toBeNull();
    const now = (await row(fresh.id))!;
    expect(now.status).toBe('ready');
    expect(await files()).toEqual([now.storageKey]);
  });

  it('keeps the file when the regeneration rendered to the same key', async () => {
    const first = await poster();
    await renderPosters(deps(), { posterIds: [first.id] }, FINAL);
    const sameKey = (await row(first.id))!.storageKey!;
    const again = await poster({ replacesPosterId: first.id });

    const summary = await renderPosters(deps(), { posterIds: [again.id] }, FINAL);
    expect(summary).toMatchObject({ ready: 1, replaced: 1, filesDeleted: 0 });
    expect(await row(first.id)).toBeUndefined();
    expect((await row(again.id))!.storageKey).toBe(sameKey);
    expect(await storage.get(sameKey)).not.toBeNull();
  });

  it('keeps the old row and file when the regeneration fails', async () => {
    const oldKey = OLD_KEY(world.session.id);
    await storage.put(oldKey, new TextEncoder().encode('old poster'), 'image/png');
    const old = await poster({ status: 'ready', storageKey: oldKey });
    const fresh = await poster({ replacesPosterId: old.id });
    fake.next({ kind: 'status', status: 422, body: { error: { code: 'text_too_long' } } });

    const summary = await renderPosters(deps(), { posterIds: [fresh.id] }, FINAL);
    expect(summary).toMatchObject({ failed: 1, replaced: 0, filesDeleted: 0 });
    expect((await row(old.id))!.status).toBe('ready');
    expect(await storage.get(oldKey)).not.toBeNull();
  });

  it('a duplicate run after a replacement deletes nothing more', async () => {
    const oldKey = OLD_KEY(world.session.id);
    await storage.put(oldKey, new TextEncoder().encode('old poster'), 'image/png');
    const old = await poster({ status: 'ready', storageKey: oldKey });
    const fresh = await poster({ replacesPosterId: old.id });
    await renderPosters(deps(), { posterIds: [fresh.id] }, FINAL);
    const filesBefore = await files();
    expect(await renderPosters(deps(), { posterIds: [fresh.id] }, FINAL)).toMatchObject({
      skipped: 1,
      replaced: 0,
      filesDeleted: 0,
      renderCalls: 0,
    });
    expect(await files()).toEqual(filesBefore);
  });

  it('never deletes a poster of another session', async () => {
    const other = await seedWorld(test.db);
    const foreign = await seedPoster(test.db, {
      sessionId: other.session.id,
      templateId,
      status: 'ready',
    });
    const fresh = await poster({ replacesPosterId: foreign.id });
    const summary = await renderPosters(deps(), { posterIds: [fresh.id] }, FINAL);
    expect(summary).toMatchObject({ ready: 1, replaced: 0 });
    expect(await row(foreign.id)).toBeDefined();
  });

  it('logs a failed file delete without failing the job', async () => {
    const oldKey = OLD_KEY(world.session.id);
    const old = await poster({ status: 'ready', storageKey: oldKey });
    const fresh = await poster({ replacesPosterId: old.id });
    const flaky: PosterStorage = {
      put: (k, b, t) => storage.put(k, b, t),
      get: (k) => storage.get(k),
      delete: () => Promise.reject(new Error('busy disk')),
    };
    const summary = await renderPosters(deps({ storage: flaky }), { posterIds: [fresh.id] }, FINAL);
    expect(summary).toMatchObject({ ready: 1, replaced: 1, filesDeleted: 0 });
    expect(logger.lines.some((l) => l.event === 'posters.file_delete_failed')).toBe(true);
  });
});

describe('missing configuration', () => {
  for (const [name, over, missing] of [
    ['renderer', { renderer: null }, ['RENDERER_URL', 'RENDERER_TOKEN']],
    ['storage', { storage: null }, ['POSTER_STORAGE_DIR']],
  ] as const) {
    it(`without ${name} settings the rows fail clearly and nothing is called`, async () => {
      const story = await poster();
      const summary = await renderPosters(
        deps({ ...over, missing }),
        { posterIds: [story.id] },
        FIRST,
      );
      expect(summary).toMatchObject({
        notConfigured: true,
        failed: 1,
        failure: 'render_failed',
        renderCalls: 0,
      });
      expect(await row(story.id)).toMatchObject({ status: 'failed', failureCode: 'render_failed' });
      expect(fake.requests).toHaveLength(0);
      expect(renderLines()[0]).toMatchObject({
        level: 'error',
        fields: { notConfigured: true, missing: missing.join(',') },
      });
    });
  }

  it('still reports not configured on a later attempt with nothing left to fail', async () => {
    const story = await poster();
    await renderPosters(deps({ renderer: null }), { posterIds: [story.id] }, FIRST);
    const again = await renderPosters(deps({ renderer: null }), { posterIds: [story.id] }, FINAL);
    expect(again).toMatchObject({ notConfigured: true, failed: 0, skipped: 1 });
  });
});

describe('snapshotOfSessionRow', () => {
  const base = {
    id: '00000000-0000-4000-8000-0000000000c2',
    localStartTime: '19:30:00',
    durationMinutes: 60,
    daysOfWeek: [5],
    startsOn: '2026-03-01',
    endsOn: null,
    timezone: 'Asia/Karachi',
    updatedAt: new Date('2026-10-01T10:00:00Z'),
    venueId: '00000000-0000-4000-8000-0000000000d1',
    venueNameEn: 'Sample Masjid',
    venueNameUr: 'نمونہ مسجد',
    areaNameEn: 'Sample Area',
    areaNameUr: 'نمونہ علاقہ',
  };

  it('trims seconds off the start time and uses updated_at as the version', () => {
    expect(snapshotOfSessionRow(base)).toMatchObject({
      localStartTime: '19:30',
      sessionVersion: '2026-10-01T10:00:00.000Z',
      venue: { area: { en: 'Sample Area', ur: 'نمونہ علاقہ' } },
    });
  });

  it('throws for a row that cannot make a snapshot', () => {
    expect(() => snapshotOfSessionRow({ ...base, venueNameEn: 'x'.repeat(200) })).toThrow();
  });
});
