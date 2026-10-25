import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import {
  ApiClientError,
  createApiClient,
  POSTER_RENDER_QUEUE,
  posterStorageKey,
  type ApiError,
  type Poster,
  type PosterCreateInput,
  type PosterTemplate,
} from '@qc/contracts';
import { schema } from '@qc/db';
import { TEST_PRINCIPAL_HEADER } from '../middleware/test-auth';
import { pgBossPosterQueue, unwiredPosterQueue } from '../modules/posters/queue';
import { posterRuntimeFor } from '../modules/posters/runtime';
import { POSTER_QUEUED_BLOCK_MS } from '../modules/posters/service';
import {
  DEFAULT_POSTER_STORAGE_DIR,
  localDiskPosterStorage,
  PosterStorageKeyError,
  posterStorageFromEnv,
  resolvePosterPath,
} from '../modules/posters/storage';
import { createHarness, type Actor, type ApiResult, type Harness } from './harness';
import {
  createOneOff,
  createSession,
  FAKE_PDF,
  FAKE_PNG,
  failPoster,
  finishPoster,
  seedPosterTemplates,
} from './fixtures';

/**
 * Posters (contract 1.0.0-rc.5): templates, make, list with the out-of-date flag, regenerate and
 * download. The worker's part (render, store, mark ready) is played by `finishPoster`.
 */

let h: Harness;
let admin: Actor;
let sessionId: string;
let templates: Map<string, string>;

beforeAll(async () => {
  h = await createHarness();
});
afterAll(() => h.close());
beforeEach(async () => {
  await h.reset();
  admin = await h.nationalAdmin();
  templates = await seedPosterTemplates(h, [{ key: 'retired', isActive: false }]);
  sessionId = (await createSession(h, { venueId: h.world.venueA1, as: admin })).id;
});

const NIL = '00000000-0000-4000-8000-000000000000';
const code = (res: ApiResult) => res.json<ApiError>().error.code;
const issues = (res: ApiResult) => res.json<ApiError>().error.issues;

const body = (over: Partial<PosterCreateInput> = {}): PosterCreateInput => ({
  templateKey: 'cloud',
  language: 'en',
  formats: ['story', 'print_a4'],
  fields: { title: { en: 'Friday circle' } },
  ...over,
});

const make = (as: Actor | null, over: Partial<PosterCreateInput> = {}, sid = sessionId) =>
  h.api('adminPosters.create', { as, params: { sessionId: sid }, body: body(over) });

async function madePosters(over: Partial<PosterCreateInput> = {}): Promise<Poster[]> {
  const res = await make(admin, over);
  expect(res.status).toBe(202);
  return res.json<{ items: Poster[] }>().items;
}

const list = (as: Actor | null, sid = sessionId) =>
  h.api('adminPosters.list', { as, params: { sessionId: sid } });

const posterRows = () => h.db.select().from(schema.posters);
/** The worker gets to every queued poster (here: they fail), so a new one may be made (SEC-13). */
const settleQueued = () =>
  h.db
    .update(schema.posters)
    .set({ status: 'failed', failureCode: 'render_failed' })
    .where(eq(schema.posters.status, 'queued'));
const auditRows = (action: string) =>
  h.db.select().from(schema.auditLog).where(eq(schema.auditLog.action, action));

describe('adminPosters.templates', () => {
  it('lists the active templates by key, with formats and the demo flag', async () => {
    const res = await h.api('adminPosters.templates', { as: admin });
    expect(res.status).toBe(200);
    const items = res.json<{ items: PosterTemplate[] }>().items;
    expect(items.map((t) => t.key)).toEqual(['cloud', 'night', 'quranic_circles']);
    expect(items[0]).toEqual({
      id: templates.get('cloud'),
      key: 'cloud',
      name: { en: 'Cloud', ur: 'ہلکا' },
      version: 1,
      formats: ['story', 'print_a4', 'print_a3', 'link_preview'],
      provisional: true,
    });
  });

  it('answers every coordinator role, and refuses people with no poster role', async () => {
    const allowed = [
      await h.cityCoordinator(h.world.cityA.id),
      await h.cityCoordinator(h.world.cityB.id),
      await h.venueCoordinator(h.world.venueA1),
      await h.venueCoordinator(h.world.venueB1),
    ];
    for (const actor of allowed) {
      expect((await h.api('adminPosters.templates', { as: actor })).status).toBe(200);
    }
    const attendee = await h.api('adminPosters.templates', { as: await h.person() });
    expect(attendee.status).toBe(403);
    expect((await h.api('adminPosters.templates', { as: null })).status).toBe(401);
  });

  it('answers an empty list when no template is active', async () => {
    await h.db.update(schema.posterTemplates).set({ isActive: false });
    const res = await h.api('adminPosters.templates', { as: admin });
    expect(res.json<{ items: unknown[] }>().items).toEqual([]);
  });
});

describe('adminPosters.create', () => {
  it('queues one poster per format from the session as it is now, and one render job', async () => {
    const res = await make(admin);
    expect(res.status).toBe(202);
    const items = res.json<{ items: Poster[] }>().items;
    expect(items.map((p) => p.format)).toEqual(['story', 'print_a4']);
    const [session] = await h.db
      .select()
      .from(schema.sessions)
      .where(eq(schema.sessions.id, sessionId));
    for (const p of items) {
      expect(p).toMatchObject({
        sessionId,
        templateKey: 'cloud',
        language: 'en',
        locale: 'en',
        fields: { title: { en: 'Friday circle' }, accent: 'tanzeem', qrTarget: 'register' },
        status: 'queued',
        failureCode: null,
        altText: null,
        fileUrl: null,
        outOfDate: null,
        replacesPosterId: null,
        createdAt: h.clock.now().toISOString(),
      });
      expect(p.sourceSnapshot).toEqual({
        sessionId,
        sessionVersion: session!.updatedAt.toISOString(),
        localStartTime: '18:00',
        durationMinutes: 60,
        daysOfWeek: [5],
        startsOn: '2026-10-16',
        endsOn: null,
        timezone: 'Asia/Karachi',
        venue: {
          id: h.world.venueA1,
          name: { en: 'Venue A1', ur: 'Venue A1 ur' },
          area: { en: 'Area 1', ur: 'Area 1 ur' },
        },
      });
    }
    expect(h.posterQueue.jobs).toEqual([{ posterIds: items.map((p) => p.id) }]);
    const rows = await posterRows();
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.createdBy).toBe(admin.userId);
      expect(row.templateId).toBe(templates.get('cloud'));
      expect(row.storageKey).toBeNull();
    }
  });

  it('stores the language and its leading locale for bilingual posters', async () => {
    const items = await madePosters({
      language: 'ur_en',
      formats: ['link_preview'],
      fields: { title: { en: 'Circle', ur: 'حلقہ' }, accent: 'night', qrTarget: 'session' },
    });
    expect(items[0]).toMatchObject({ language: 'ur_en', locale: 'ur' });
    expect(items[0]!.fields).toEqual({
      title: { en: 'Circle', ur: 'حلقہ' },
      accent: 'night',
      qrTarget: 'session',
    });
  });

  it('writes one audit row with ids and choices only, never the typed text', async () => {
    const items = await madePosters({ fields: { title: { en: 'Secret-looking title' } } });
    const audit = await auditRows('poster.create');
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({
      actorUserId: admin.userId,
      entityType: 'session',
      entityId: sessionId,
      scopeType: 'venue',
      venueId: h.world.venueA1,
      cityId: h.world.cityA.id,
    });
    expect(audit[0]!.meta).toEqual({
      posterIds: items.map((p) => p.id),
      templateKey: 'cloud',
      language: 'en',
      formats: ['story', 'print_a4'],
    });
    expect(JSON.stringify(audit[0]!.meta)).not.toContain('Secret-looking');
    expect(h.logs.join('\n')).not.toContain('Secret-looking');
  });

  it('answers not_found for an unknown or inactive template, and writes nothing', async () => {
    for (const templateKey of ['nosuch', 'retired']) {
      const res = await make(admin, { templateKey });
      expect(res.status, templateKey).toBe(404);
      expect(code(res)).toBe('not_found');
    }
    expect(await posterRows()).toHaveLength(0);
    expect(h.posterQueue.jobs).toHaveLength(0);
    expect(await auditRows('poster.create')).toHaveLength(0);
  });

  it('checks the scope before the template, so outsiders learn nothing about template keys', async () => {
    const other = await h.venueCoordinator(h.world.venueB1);
    const res = await make(other, { templateKey: 'nosuch' });
    expect(res.status).toBe(403);
    expect(code(res)).toBe('forbidden');
  });

  it('refuses a format the template does not offer with validation_failed on formats', async () => {
    await h.db
      .update(schema.posterTemplates)
      .set({ formats: ['story'] })
      .where(eq(schema.posterTemplates.key, 'night'));
    const res = await make(admin, { templateKey: 'night', formats: ['story', 'print_a3'] });
    expect(res.status).toBe(400);
    expect(issues(res)).toEqual([{ path: 'formats', code: 'invalid_value' }]);
    expect(await posterRows()).toHaveLength(0);
    expect(h.posterQueue.jobs).toHaveLength(0);
  });

  it('refuses a body the contract refuses: missing title, repeated formats, control characters', async () => {
    const missing = await make(admin, { language: 'en_ur', fields: { title: { en: 'Only en' } } });
    expect(missing.status).toBe(400);
    expect(issues(missing)).toEqual([{ path: 'fields.title.ur', code: 'custom' }]);
    const repeated = await make(admin, { formats: ['story', 'story'] });
    expect(repeated.status).toBe(400);
    const control = await make(admin, { fields: { title: { en: 'A‮B' } } });
    expect(control.status).toBe(400);
    expect(control.text).not.toContain('A‮B');
    expect(await posterRows()).toHaveLength(0);
  });

  it('answers an unknown session with not_found for staff and forbidden for others', async () => {
    const staff = await make(await h.venueCoordinator(h.world.venueB1), {}, NIL);
    expect(staff.status).toBe(404);
    const attendee = await make(await h.person(), {}, NIL);
    expect(attendee.status).toBe(403);
  });

  it('refuses coordinators outside the session venue with forbidden', async () => {
    for (const actor of [
      await h.venueCoordinator(h.world.venueA2),
      await h.venueCoordinator(h.world.venueB1),
      await h.cityCoordinator(h.world.cityB.id),
    ]) {
      const res = await make(actor);
      expect(res.status).toBe(403);
      expect(code(res)).toBe('forbidden');
    }
    expect(await posterRows()).toHaveLength(0);
  });

  it('lets the venue and city coordinators of the session make posters', async () => {
    for (const actor of [
      await h.venueCoordinator(h.world.venueA1),
      await h.cityCoordinator(h.world.cityA.id),
    ]) {
      expect((await make(actor, { formats: ['story'] })).status).toBe(202);
      await settleQueued();
    }
    expect(h.posterQueue.jobs).toHaveLength(2);
  });

  it('marks the posters failed when the render queue refuses the job, so they can be made again', async () => {
    h.posterQueue.fail = true;
    const res = await make(admin);
    expect(res.status).toBe(202);
    const items = res.json<{ items: Poster[] }>().items;
    expect(items.map((p) => [p.status, p.failureCode])).toEqual([
      ['failed', 'render_failed'],
      ['failed', 'render_failed'],
    ]);
    expect(h.logs.some((l) => l.includes('poster render job could not be queued'))).toBe(true);
    h.posterQueue.fail = false;
    const again = await h.api('adminPosters.regenerate', {
      as: admin,
      params: { posterId: items[0]!.id },
    });
    expect(again.status).toBe(202);
    expect(again.json<Poster>().status).toBe('queued');
  });

  it('makes posters for a one-off lecture, with no days and its date', async () => {
    const lecture = await createOneOff(h, {
      venueId: h.world.venueA1,
      as: admin,
      date: '2026-11-02',
    });
    const res = await make(admin, { formats: ['story'] }, lecture.id);
    expect(res.status).toBe(202);
    const snap = res.json<{ items: Poster[] }>().items[0]!.sourceSnapshot;
    expect(snap).toMatchObject({ daysOfWeek: [], startsOn: '2026-11-02', localStartTime: '20:00' });
  });
});

describe('adminPosters.create while a poster is still queued (SEC-13)', () => {
  it('answers conflict for the same session and template, for every staff role, and writes nothing', async () => {
    await madePosters({ formats: ['story'] });
    const jobs = h.posterQueue.jobs.length;
    for (const who of [
      admin,
      await h.cityCoordinator(h.world.cityA.id),
      await h.venueCoordinator(h.world.venueA1),
    ]) {
      // Another format or language does not matter: the template is still being made.
      const res = await make(who, {
        formats: ['print_a4'],
        language: 'ur',
        fields: { title: { ur: 'حلقہ' } },
      });
      expect(res.status).toBe(409);
      expect(code(res)).toBe('conflict');
    }
    expect(await posterRows()).toHaveLength(1);
    expect(await auditRows('poster.create')).toHaveLength(1);
    expect(h.posterQueue.jobs).toHaveLength(jobs);
  });

  it('allows another template, another session, and the same one once the first is done', async () => {
    await madePosters({ formats: ['story'] });
    expect((await make(admin, { templateKey: 'night', formats: ['story'] })).status).toBe(202);
    const other = await createSession(h, { venueId: h.world.venueA1, as: admin, title: 'Other' });
    expect((await make(admin, { formats: ['story'] }, other.id)).status).toBe(202);

    const [queued] = await h.db
      .select()
      .from(schema.posters)
      .where(and(eq(schema.posters.sessionId, sessionId), eq(schema.posters.status, 'queued')))
      .limit(1);
    const sameTemplate = await h.db
      .select()
      .from(schema.posters)
      .where(
        and(
          eq(schema.posters.sessionId, sessionId),
          eq(schema.posters.templateId, queued!.templateId),
        ),
      );
    // Ready: free again.
    for (const row of sameTemplate) await finishPoster(h, row.id);
    const next = await make(admin, { templateKey: 'cloud', formats: ['story'] });
    expect(next.status).toBe(202);
    // Failed: free again.
    await failPoster(h, next.json<{ items: Poster[] }>().items[0]!.id, 'render_failed');
    expect((await make(admin, { templateKey: 'cloud', formats: ['story'] })).status).toBe(202);
  });

  it('counts a queued remake as still being made', async () => {
    const [p] = await madePosters({ formats: ['story'] });
    await finishPoster(h, p!.id);
    const remake = await h.api('adminPosters.regenerate', {
      as: admin,
      params: { posterId: p!.id },
    });
    expect(remake.status).toBe(202);
    const res = await make(admin, { formats: ['story'] });
    expect(res.status).toBe(409);
    expect(code(res)).toBe('conflict');
  });

  it('stops blocking once a queued poster is older than the bound', async () => {
    await madePosters({ formats: ['story'] });
    h.clock.advanceMinutes(POSTER_QUEUED_BLOCK_MS / 60_000 - 1);
    expect((await make(admin, { formats: ['story'] })).status).toBe(409);
    h.clock.advanceMinutes(2);
    expect((await make(admin, { formats: ['story'] })).status).toBe(202);
  });

  it('decides scope and the template first: outsiders get forbidden, an unknown template not_found', async () => {
    await madePosters({ formats: ['story'] });
    const outsider = await h.venueCoordinator(h.world.venueB1);
    expect((await make(outsider, { formats: ['story'] })).status).toBe(403);
    expect((await make(await h.person(), { formats: ['story'] })).status).toBe(403);
    expect((await make(null, { formats: ['story'] })).status).toBe(401);
    expect((await make(admin, { templateKey: 'nosuch', formats: ['story'] })).status).toBe(404);
  });

  it('lets only one of two parallel requests through', async () => {
    const results = await Promise.all([
      make(admin, { formats: ['story'] }),
      make(admin, { formats: ['print_a4'] }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([202, 409]);
    expect(await posterRows()).toHaveLength(1);
  });
});

describe('adminPosters.list', () => {
  it('lists newest first, with the file link only when ready and the failure code only when failed', async () => {
    const first = await madePosters({ formats: ['story', 'print_a4'] });
    await finishPoster(h, first[0]!.id);
    await failPoster(h, first[1]!.id, 'text_too_long');
    h.clock.advanceMinutes(5);
    const second = await madePosters({ formats: ['link_preview'] });

    const res = await list(admin);
    expect(res.status).toBe(200);
    const items = res.json<{ items: Poster[] }>().items;
    expect(items.map((p) => p.id)).toEqual([second[0]!.id, first[0]!.id, first[1]!.id]);
    expect(items[0]).toMatchObject({ status: 'queued', fileUrl: null, failureCode: null });
    expect(items[1]).toMatchObject({
      status: 'ready',
      fileUrl: `/v1/admin/posters/${first[0]!.id}/file`,
      altText: { en: 'A poster for a circle.' },
      failureCode: null,
    });
    expect(items[2]).toMatchObject({
      status: 'failed',
      fileUrl: null,
      failureCode: 'text_too_long',
      altText: null,
    });
  });

  it('lists only the posters of the session asked for', async () => {
    await madePosters();
    const other = await createSession(h, { venueId: h.world.venueA1, as: admin, title: 'Other' });
    const res = await list(admin, other.id);
    expect(res.json<{ items: unknown[] }>().items).toEqual([]);
  });

  it('flags a poster out of date on time when the start time changes', async () => {
    await madePosters({ formats: ['story'] });
    const change = await h.api('adminSessions.changeSchedule', {
      as: admin,
      params: { sessionId },
      body: { localStartTime: '19:30', effectiveFrom: '2026-10-17', notify: false },
    });
    expect(change.status).toBe(200);
    const items = (await list(admin)).json<{ items: Poster[] }>().items;
    expect(items[0]!.outOfDate).toEqual({ reasons: ['time'] });
  });

  it('flags a poster out of date on venue when the venue is renamed, but not for a new session title', async () => {
    await madePosters({ formats: ['story'] });
    const title = await h.api('adminSessions.update', {
      as: admin,
      params: { sessionId },
      body: { title: { en: 'A new title' } },
    });
    expect(title.status).toBe(200);
    expect((await list(admin)).json<{ items: Poster[] }>().items[0]!.outOfDate).toBeNull();

    const renamed = await h.api('adminVenues.update', {
      as: admin,
      params: { venueId: h.world.venueA1 },
      body: { name: { en: 'Venue A1 renamed' } },
    });
    expect(renamed.status).toBe(200);
    expect((await list(admin)).json<{ items: Poster[] }>().items[0]!.outOfDate).toEqual({
      reasons: ['venue'],
    });
  });

  it('flags both reasons when the time and the venue area changed', async () => {
    await madePosters({ formats: ['story'] });
    await h.db
      .update(schema.sessions)
      .set({ localStartTime: '07:00' })
      .where(eq(schema.sessions.id, sessionId));
    await h.db
      .update(schema.venues)
      .set({ areaId: h.world.cityA.areaId2 })
      .where(eq(schema.venues.id, h.world.venueA1));
    const items = (await list(admin)).json<{ items: Poster[] }>().items;
    expect(items[0]!.outOfDate).toEqual({ reasons: ['time', 'venue'] });
  });

  it('answers an unknown session with not_found for staff and forbidden for others', async () => {
    expect((await list(admin, NIL)).status).toBe(404);
    expect((await list(await h.person(), NIL)).status).toBe(403);
  });

  it('refuses coordinators outside the session venue, and answers those inside', async () => {
    await madePosters();
    expect((await list(await h.venueCoordinator(h.world.venueA2))).status).toBe(403);
    expect((await list(await h.cityCoordinator(h.world.cityB.id))).status).toBe(403);
    expect((await list(await h.venueCoordinator(h.world.venueA1))).status).toBe(200);
    expect((await list(await h.cityCoordinator(h.world.cityA.id))).status).toBe(200);
  });
});

describe('adminPosters.regenerate', () => {
  const regenerate = (as: Actor | null, posterId: string) =>
    h.api('adminPosters.regenerate', { as, params: { posterId } });

  it('answers conflict for a poster that is still queued, and writes nothing', async () => {
    const [p] = await madePosters({ formats: ['story'] });
    h.posterQueue.jobs.length = 0;
    const res = await regenerate(admin, p!.id);
    expect(res.status).toBe(409);
    expect(code(res)).toBe('conflict');
    expect(await posterRows()).toHaveLength(1);
    expect(h.posterQueue.jobs).toHaveLength(0);
  });

  it('queues a new poster with a fresh snapshot that names the one it replaces', async () => {
    const [p] = await madePosters({
      language: 'en_ur',
      formats: ['print_a3'],
      fields: { title: { en: 'Circle', ur: 'حلقہ' }, details: { en: 'Juz 1' }, accent: 'deep' },
    });
    await finishPoster(h, p!.id);
    await h.db
      .update(schema.sessions)
      .set({ localStartTime: '21:00' })
      .where(eq(schema.sessions.id, sessionId));
    h.posterQueue.jobs.length = 0;
    h.clock.advanceMinutes(10);

    const res = await regenerate(admin, p!.id);
    expect(res.status).toBe(202);
    const fresh = res.json<Poster>();
    expect(fresh).toMatchObject({
      sessionId,
      templateKey: 'cloud',
      format: 'print_a3',
      language: 'en_ur',
      locale: 'en',
      fields: p!.fields,
      status: 'queued',
      replacesPosterId: p!.id,
      outOfDate: null,
      fileUrl: null,
      createdAt: h.clock.now().toISOString(),
    });
    expect(fresh.id).not.toBe(p!.id);
    expect(fresh.sourceSnapshot.localStartTime).toBe('21:00');
    expect(h.posterQueue.jobs).toEqual([{ posterIds: [fresh.id] }]);

    // The old one stays until the worker has the new one ready, and is now out of date.
    const items = (await list(admin)).json<{ items: Poster[] }>().items;
    expect(items.map((x) => x.id)).toEqual([fresh.id, p!.id]);
    expect(items[1]!.outOfDate).toEqual({ reasons: ['time'] });

    const audit = await auditRows('poster.regenerate');
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({
      actorUserId: admin.userId,
      entityType: 'poster',
      entityId: fresh.id,
      venueId: h.world.venueA1,
    });
    expect(audit[0]!.meta).toEqual({
      sessionId,
      replacesPosterId: p!.id,
      templateKey: 'cloud',
      format: 'print_a3',
    });
  });

  it('remakes a failed poster', async () => {
    const [p] = await madePosters({ formats: ['story'] });
    await failPoster(h, p!.id, 'render_timeout');
    const res = await regenerate(await h.venueCoordinator(h.world.venueA1), p!.id);
    expect(res.status).toBe(202);
    expect(res.json<Poster>()).toMatchObject({ status: 'queued', failureCode: null });
  });

  it('answers not_found when the template was retired since', async () => {
    const [p] = await madePosters({ formats: ['story'] });
    await finishPoster(h, p!.id);
    await h.db
      .update(schema.posterTemplates)
      .set({ isActive: false })
      .where(eq(schema.posterTemplates.key, 'cloud'));
    const res = await regenerate(admin, p!.id);
    expect(res.status).toBe(404);
    expect(await posterRows()).toHaveLength(1);
  });

  it('answers an unknown poster with not_found for staff and forbidden for others', async () => {
    expect((await regenerate(admin, NIL)).status).toBe(404);
    expect((await regenerate(await h.person(), NIL)).status).toBe(403);
  });

  it('refuses coordinators outside the poster session venue', async () => {
    const [p] = await madePosters({ formats: ['story'] });
    await finishPoster(h, p!.id);
    for (const actor of [
      await h.venueCoordinator(h.world.venueA2),
      await h.cityCoordinator(h.world.cityB.id),
    ]) {
      expect((await regenerate(actor, p!.id)).status).toBe(403);
    }
    expect(await posterRows()).toHaveLength(1);
  });
});

describe('adminPosters.file', () => {
  const download = (as: Actor | null, posterId: string) =>
    h.api('adminPosters.file', { as, params: { posterId } });

  it('answers a ready story as PNG bytes, as an attachment', async () => {
    const [story] = await madePosters({ formats: ['story'] });
    await finishPoster(h, story!.id);
    const res = await download(admin, story!.id);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
    expect(res.headers.get('content-disposition')).toBe(
      'attachment; filename="poster-cloud-story.png"',
    );
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect([...res.bytes]).toEqual([...FAKE_PNG]);
  });

  it('answers a ready print poster as PDF bytes', async () => {
    const [a4] = await madePosters({ templateKey: 'night', formats: ['print_a4'] });
    await finishPoster(h, a4!.id);
    const res = await download(await h.cityCoordinator(h.world.cityA.id), a4!.id);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/pdf');
    expect(res.headers.get('content-disposition')).toBe(
      'attachment; filename="poster-night-print_a4.pdf"',
    );
    expect([...res.bytes]).toEqual([...FAKE_PDF]);
  });

  it('answers conflict for a poster that is queued or failed', async () => {
    const [queued, failed] = await madePosters();
    await failPoster(h, failed!.id, 'busy');
    for (const p of [queued!, failed!]) {
      const res = await download(admin, p.id);
      expect(res.status).toBe(409);
      expect(code(res)).toBe('conflict');
    }
  });

  it('answers not_found when the stored file is gone, and logs only the id', async () => {
    const [p] = await madePosters({ formats: ['story'] });
    const key = await finishPoster(h, p!.id, { store: false });
    const res = await download(admin, p!.id);
    expect(res.status).toBe(404);
    const line = h.logs.find((l) => l.includes('poster file missing'));
    expect(line).toContain(p!.id);
    expect(line).not.toContain(key);
  });

  it('answers an unknown poster with not_found for staff and forbidden for others', async () => {
    expect((await download(admin, NIL)).status).toBe(404);
    expect((await download(await h.person(), NIL)).status).toBe(403);
  });

  it('refuses coordinators outside the poster session venue', async () => {
    const [p] = await madePosters({ formats: ['story'] });
    await finishPoster(h, p!.id);
    expect((await download(await h.venueCoordinator(h.world.venueA2), p!.id)).status).toBe(403);
    expect((await download(await h.cityCoordinator(h.world.cityB.id), p!.id)).status).toBe(403);
    expect((await download(await h.venueCoordinator(h.world.venueA1), p!.id)).status).toBe(200);
  });

  it('comes back as bytes through the typed client', async () => {
    const [p] = await madePosters({ formats: ['link_preview'] });
    await finishPoster(h, p!.id);
    const client = createApiClient({
      baseUrl: 'http://api.test',
      getAccessToken: () => JSON.stringify(admin.principal),
      fetch: async (input, init) => {
        const url = new URL(
          typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
        );
        const headers = new Headers(init?.headers);
        const bearer = headers.get('authorization');
        if (bearer?.startsWith('Bearer ')) headers.set(TEST_PRINCIPAL_HEADER, bearer.slice(7));
        headers.delete('authorization');
        return h.app.request(`${url.pathname}${url.search}`, { ...init, headers });
      },
    });
    const bytes = await client.adminPosters.file({ params: { posterId: p!.id } });
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect([...bytes]).toEqual([...FAKE_PNG]);
    const refused = await client.adminPosters
      .file({ params: { posterId: NIL } })
      .catch((e: unknown) => e);
    expect(refused).toBeInstanceOf(ApiClientError);
  });
});

describe('poster file storage', () => {
  /** Plays the worker: writes a file where its rule puts it. */
  const put = (root: string, key: string, bytes: Uint8Array) => {
    const file = resolvePosterPath(root, key);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, bytes);
  };

  it('maps posterStorageKey keys to <root>/<key> and refuses anything else, as the worker does', () => {
    const root = '/srv/posters';
    const key = posterStorageKey(NIL, 'a'.repeat(64), 'image/png');
    expect(resolvePosterPath(root, key)).toBe(resolve(root, key));
    for (const bad of [
      '',
      'posters',
      'other/x.png',
      '../x.png',
      '/etc/passwd',
      '/posters/x.png',
      'posters/../../x.png',
      'posters/..',
      'posters//x.png',
      'posters/./x.png',
      'posters/.hidden',
      'posters/x.tar.gz',
      'posters\\..\\x.png',
      'posters/x.png\u0000',
      `posters/${'a'.repeat(300)}.png`,
    ]) {
      expect(() => resolvePosterPath(root, bad), JSON.stringify(bad)).toThrow(
        PosterStorageKeyError,
      );
    }
    expect(() => resolvePosterPath('relative/root', key)).toThrow(PosterStorageKeyError);
  });

  it('reads the bytes the worker wrote, and answers null for a missing key', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'qc-poster-store-'));
    try {
      const store = localDiskPosterStorage(dir);
      const key = posterStorageKey(NIL, 'b'.repeat(64), 'application/pdf');
      expect(await store.read(key)).toBeNull();
      put(dir, key, FAKE_PDF);
      expect([...((await store.read(key)) ?? [])]).toEqual([...FAKE_PDF]);
      await expect(store.read('../outside')).rejects.toThrow(PosterStorageKeyError);
      expect(Object.keys(store)).toEqual(['read']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('is rooted at POSTER_STORAGE_DIR, else a folder under the OS temp dir', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'qc-poster-env-'));
    try {
      const key = posterStorageKey(NIL, 'c'.repeat(64), 'image/png');
      put(dir, key, FAKE_PNG);
      const fromEnv = posterStorageFromEnv({ POSTER_STORAGE_DIR: dir });
      expect([...((await fromEnv.read(key)) ?? [])]).toEqual([...FAKE_PNG]);
      expect(DEFAULT_POSTER_STORAGE_DIR.startsWith(tmpdir())).toBe(true);
      expect(await posterStorageFromEnv({ POSTER_STORAGE_DIR: '  ' }).read(key)).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('poster render queue', () => {
  it('sends one PosterRenderJob to the poster-render pg-boss queue', async () => {
    const sent: { name: string; data: object }[] = [];
    const queue = pgBossPosterQueue({
      send: async (name, data) => {
        sent.push({ name, data });
        return 'job-1';
      },
    });
    await queue.enqueue({ posterIds: [NIL] });
    expect(sent).toEqual([{ name: POSTER_RENDER_QUEUE, data: { posterIds: [NIL] } }]);
    expect(POSTER_RENDER_QUEUE).toBe('poster-render');
  });

  it('treats a refused send or a malformed job as a failure', async () => {
    const queue = pgBossPosterQueue({ send: async () => null });
    await expect(queue.enqueue({ posterIds: [NIL] })).rejects.toThrow();
    const ok = pgBossPosterQueue({ send: async () => 'id' });
    await expect(ok.enqueue({ posterIds: [] })).rejects.toThrow();
  });

  it('falls back to the POSTER_STORAGE_DIR store and a refusing queue for an app nobody wired', () => {
    const runtime = posterRuntimeFor({});
    expect(runtime.queue).toBe(unwiredPosterQueue);
    const wired = { queue: h.posterQueue, storage: h.posterStorage };
    expect(posterRuntimeFor({ posters: wired })).toBe(wired);
  });

  it('marks posters failed when the server has wired no queue', async () => {
    // A second app on its own database, built with no `posters`, as a server that wired nothing.
    const bare = await createHarness({ posterQueue: null });
    try {
      const boss = await bare.nationalAdmin();
      await seedPosterTemplates(bare);
      const s = await createSession(bare, { venueId: bare.world.venueA1, as: boss });
      const res = await bare.api('adminPosters.create', {
        as: boss,
        params: { sessionId: s.id },
        body: body({ formats: ['story'] }),
      });
      expect(res.status).toBe(202);
      expect(res.json<{ items: Poster[] }>().items[0]).toMatchObject({
        status: 'failed',
        failureCode: 'render_failed',
      });
      const [row] = await bare.db
        .select()
        .from(schema.posters)
        .where(and(eq(schema.posters.sessionId, s.id), eq(schema.posters.status, 'failed')));
      expect(row?.failureCode).toBe('render_failed');
    } finally {
      await bare.close();
    }
  });
});

describe('poster throttle (SEC-13)', () => {
  it('gives each staff member ten makes or remakes a minute, for every staff role', async () => {
    const staff = [
      admin,
      await h.cityCoordinator(h.world.cityA.id),
      await h.venueCoordinator(h.world.venueA1),
    ];
    for (const who of staff) {
      for (let n = 0; n < 10; n++) {
        expect((await make(who, { formats: ['story'] })).status).toBe(202);
        await settleQueued();
      }
      const over = await make(who, { formats: ['story'] });
      expect(over.status).toBe(429);
      expect(code(over)).toBe('rate_limited');
      expect(over.json<ApiError>().error.retryAfterSeconds).toBeGreaterThan(0);
      expect(over.headers.get('retry-after')).not.toBeNull();
    }
    const rows = await posterRows();
    // Ten each, and the refused calls wrote nothing.
    expect(rows).toHaveLength(30);
    h.clock.advanceMinutes(1);
    expect((await make(admin, { formats: ['story'] })).status).toBe(202);
  });

  it('counts regenerate against the same allowance', async () => {
    const [p] = await madePosters({ formats: ['story'] });
    await finishPoster(h, p!.id);
    for (let n = 0; n < 9; n++) {
      expect((await make(admin, { formats: ['story'] })).status).toBe(202);
      await settleQueued();
    }
    const remake = await h.api('adminPosters.regenerate', {
      as: admin,
      params: { posterId: p!.id },
    });
    expect(remake.status).toBe(429);
    expect(code(remake)).toBe('rate_limited');
    h.clock.advanceMinutes(1);
    const later = await h.api('adminPosters.regenerate', {
      as: admin,
      params: { posterId: p!.id },
    });
    expect(later.status).toBe(202);
  });

  it('refuses people without a staff role, and still throttles their attempts', async () => {
    const person = await h.person();
    for (let n = 0; n < 10; n++)
      expect((await make(person, { formats: ['story'] })).status).toBe(403);
    expect((await make(person, { formats: ['story'] })).status).toBe(429);
    expect((await make(null, { formats: ['story'] })).status).toBe(401);
    expect(await posterRows()).toHaveLength(0);
  });
});
