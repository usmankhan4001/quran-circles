import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import type { z } from 'zod';
import { PostedUpdate, type FeedResponse } from '@qc/contracts';
import { fanOutPendingUpdatePushes, schema } from '@qc/db';
import { publishUpdate } from '../modules/updates/publish';
import { createHarness, type Actor, type Harness } from './harness';
import { auditRows, createSession, outboxRows, register } from './fixtures';

let h: Harness;
let admin: Actor;
beforeAll(async () => {
  h = await createHarness();
});
afterAll(() => h.close());
beforeEach(async () => {
  await h.reset();
  admin = await h.nationalAdmin();
});

type Page<T> = { items: T[]; nextCursor: string | null };
type Posted = z.infer<typeof PostedUpdate>;

type PostBody =
  { type: 'national' } | { type: 'city'; cityId: string } | { type: 'venue'; venueId: string };

async function post(
  as: Actor,
  scope: PostBody,
  extra: Record<string, unknown> = {},
  title = 'A notice',
): Promise<{ status: number; body: Posted }> {
  const res = await h.api('adminUpdates.post', {
    as,
    body: { scope, title: { en: title }, body: { en: `${title} body` }, ...extra },
  });
  h.clock.advanceMinutes(1);
  return { status: res.status, body: res.json<Posted>() };
}

/** The worker's half of `notify`: writes the push rows of every pending update. */
const writePushes = () => fanOutPendingUpdatePushes(h.db, { limit: 100 });

const pendingSince = async (updateId: string) => {
  const [row] = await h.db
    .select({ at: schema.updates.pushPendingSince })
    .from(schema.updates)
    .where(eq(schema.updates.id, updateId));
  return row?.at ?? null;
};

const feed = async (who: Actor, query: Record<string, string | number | boolean> = {}) =>
  (await h.api('updates.feed', { as: who, query })).json<FeedResponse>();
const titles = (items: { title: { en: string } }[]) => items.map((i) => i.title.en);

describe('who sees what in the feed', () => {
  it('shows national updates to everyone, even a person with no connections', async () => {
    await post(admin, { type: 'national' }, {}, 'For everyone');
    const stranger = await h.person();
    expect(titles((await feed(stranger)).items)).toEqual(['For everyone']);
  });

  it('shows city and venue updates only to people connected to them', async () => {
    const session = await createSession(h, { venueId: h.world.venueA1, as: admin });
    await post(admin, { type: 'national' }, {}, 'National');
    await post(admin, { type: 'city', cityId: h.world.cityA.id }, {}, 'City A');
    await post(admin, { type: 'city', cityId: h.world.cityB.id }, {}, 'City B');
    await post(admin, { type: 'venue', venueId: h.world.venueA1 }, {}, 'Venue A1');
    await post(admin, { type: 'venue', venueId: h.world.venueA2 }, {}, 'Venue A2');

    const registered = await h.person();
    await register(h, registered, session.id, { areaId: h.world.cityA.areaId });
    expect(titles((await feed(registered)).items)).toEqual(['Venue A1', 'City A', 'National']);

    const follower = await h.person();
    await h.api('follows.create', {
      as: follower,
      body: { target: 'venue', venueId: h.world.venueA2 },
    });
    expect(titles((await feed(follower)).items)).toEqual(['Venue A2', 'City A', 'National']);
  });

  it('reaches a person through the area on their profile', async () => {
    await post(admin, { type: 'city', cityId: h.world.cityB.id }, {}, 'City B');
    const person = await h.person();
    await h.api('me.update', { as: person, body: { areaId: h.world.cityB.areaId } });
    expect(titles((await feed(person)).items)).toEqual(['City B']);
  });

  it('uses the city hint only for people who are connected to nothing', async () => {
    await post(admin, { type: 'city', cityId: h.world.cityA.id }, {}, 'City A');
    await post(admin, { type: 'city', cityId: h.world.cityB.id }, {}, 'City B');
    const newcomer = await h.person();
    expect(titles((await feed(newcomer)).items)).toEqual([]);
    expect(titles((await feed(newcomer, { cityId: h.world.cityB.id })).items)).toEqual(['City B']);

    const session = await createSession(h, { venueId: h.world.venueA1, as: admin });
    await register(h, newcomer, session.id, { areaId: h.world.cityA.areaId });
    expect(titles((await feed(newcomer, { cityId: h.world.cityB.id })).items)).toEqual(['City A']);
  });

  it('leaves out updates that are not published yet or have expired', async () => {
    const person = await h.person();
    const posted = await post(admin, { type: 'national' }, {}, 'Visible');
    await h.db.insert(schema.updates).values({
      scopeType: 'national',
      authorId: admin.userId,
      kind: 'announcement',
      titleEn: 'Later',
      bodyEn: 'later body',
      publishAt: new Date(h.clock.now().getTime() + 3_600_000),
    });
    await h.db.insert(schema.updates).values({
      scopeType: 'national',
      authorId: admin.userId,
      kind: 'announcement',
      titleEn: 'Expired',
      bodyEn: 'expired body',
      publishAt: new Date(h.clock.now().getTime() - 3_600_000),
      expiresAt: new Date(h.clock.now().getTime() - 60_000),
    });
    const result = await feed(person);
    expect(result.items.map((i) => i.id)).toEqual([posted.body.id]);
    expect(result.unreadCount).toBe(1);
  });

  it('needs a signed-in person', async () => {
    expect((await h.api('updates.feed')).status).toBe(401);
    expect((await h.api('updates.unreadCount')).status).toBe(401);
  });
});

describe('paging, reading and the unread count', () => {
  it('pages newest first with a keyset cursor, without skipping or repeating', async () => {
    const person = await h.person();
    const made: string[] = [];
    for (let i = 0; i < 5; i++)
      made.push((await post(admin, { type: 'national' }, {}, `Notice ${i}`)).body.id);
    // Two updates at the very same instant must still page cleanly.
    const same = new Date(h.clock.now());
    for (let i = 5; i < 7; i++) {
      const [row] = await h.db
        .insert(schema.updates)
        .values({
          scopeType: 'national',
          authorId: admin.userId,
          kind: 'announcement',
          titleEn: `Notice ${i}`,
          bodyEn: 'body',
          publishAt: same,
        })
        .returning({ id: schema.updates.id });
      made.push(row!.id);
    }
    const seen: string[] = [];
    let cursor: string | undefined;
    for (let guard = 0; guard < 10; guard++) {
      const page = await feed(person, { limit: 3, ...(cursor ? { cursor } : {}) });
      seen.push(...page.items.map((i) => i.id));
      if (!page.nextCursor) break;
      cursor = page.nextCursor;
    }
    expect(seen).toHaveLength(7);
    expect(new Set(seen).size).toBe(7);
    expect(new Set(seen)).toEqual(new Set(made));
    const items = (await feed(person, { limit: 100 })).items;
    const times = items.map((i) => i.publishedAt);
    expect([...times].sort().reverse()).toEqual(times);
  });

  it('rejects a cursor it did not make', async () => {
    const person = await h.person();
    const res = await h.api('updates.feed', { as: person, query: { cursor: 'not-a-cursor' } });
    expect(res.status).toBe(400);
    expect(res.json<{ error: { code: string } }>().error.code).toBe('validation_failed');
  });

  it('counts unread items, marks some or all read, and filters by unread', async () => {
    const person = await h.person();
    const a = (await post(admin, { type: 'national' }, {}, 'One')).body;
    await post(admin, { type: 'national' }, {}, 'Two');
    await post(admin, { type: 'national' }, {}, 'Three');
    expect(
      (await h.api('updates.unreadCount', { as: person })).json<{ unreadCount: number }>()
        .unreadCount,
    ).toBe(3);

    const some = await h.api('updates.markRead', { as: person, body: { updateIds: [a.id] } });
    expect(some.json<{ unreadCount: number }>().unreadCount).toBe(2);
    const all = await feed(person);
    expect(all.items.find((i) => i.id === a.id)?.isRead).toBe(true);
    expect(all.items.filter((i) => !i.isRead)).toHaveLength(2);
    expect(titles((await feed(person, { unreadOnly: true })).items)).toEqual(['Three', 'Two']);

    // Marking the same item again changes nothing.
    const again = await h.api('updates.markRead', { as: person, body: { updateIds: [a.id] } });
    expect(again.json<{ unreadCount: number }>().unreadCount).toBe(2);

    const done = await h.api('updates.markRead', { as: person, body: { all: true } });
    expect(done.json<{ unreadCount: number }>().unreadCount).toBe(0);
    expect((await feed(person, { unreadOnly: true })).items).toEqual([]);
  });

  it('ignores ids the person cannot see, and keeps reads private to each person', async () => {
    const outsider = await h.person();
    const other = await h.person();
    const hidden = (await post(admin, { type: 'venue', venueId: h.world.venueB1 }, {}, 'Hidden'))
      .body;
    const shared = (await post(admin, { type: 'national' }, {}, 'Shared')).body;
    const res = await h.api('updates.markRead', {
      as: outsider,
      body: { updateIds: [hidden.id, shared.id] },
    });
    expect(res.json<{ unreadCount: number }>().unreadCount).toBe(0);
    const reads = await h.db.select().from(schema.updateReads);
    expect(reads.map((r) => r.updateId)).toEqual([shared.id]);
    expect((await feed(other)).unreadCount).toBe(1);
  });

  it('refuses an empty list of ids', async () => {
    const person = await h.person();
    const res = await h.api('updates.markRead', { as: person, body: { updateIds: [] } });
    expect(res.status).toBe(400);
  });
});

describe('posting an update', () => {
  it('lets each role post only inside its own scope', async () => {
    const national = admin;
    const cityA = await h.cityCoordinator(h.world.cityA.id);
    const venueA1 = await h.venueCoordinator(h.world.venueA1);
    const person = await h.person();
    const nat: PostBody = { type: 'national' };
    const cA: PostBody = { type: 'city', cityId: h.world.cityA.id };
    const cB: PostBody = { type: 'city', cityId: h.world.cityB.id };
    const vA1: PostBody = { type: 'venue', venueId: h.world.venueA1 };
    const vA2: PostBody = { type: 'venue', venueId: h.world.venueA2 };
    const vB1: PostBody = { type: 'venue', venueId: h.world.venueB1 };
    const expected: [Actor, PostBody, number][] = [
      [national, nat, 201],
      [national, cB, 201],
      [national, vB1, 201],
      [cityA, nat, 403],
      [cityA, cA, 201],
      [cityA, vA2, 201],
      [cityA, cB, 403],
      [cityA, vB1, 403],
      [venueA1, nat, 403],
      [venueA1, cA, 403],
      [venueA1, vA1, 201],
      [venueA1, vA2, 403],
      [person, vA1, 403],
    ];
    for (const [who, scope, status] of expected) {
      expect((await post(who, scope)).status, JSON.stringify(scope)).toBe(status);
    }
    expect(
      (
        await h.api('adminUpdates.post', {
          body: { scope: nat, title: { en: 'x' }, body: { en: 'y' } },
        })
      ).status,
    ).toBe(401);
  });

  it('answers a venue or city that does not exist with forbidden for outsiders and not found for staff', async () => {
    const nil = '00000000-0000-4000-8000-000000000000';
    const staff = await h.cityCoordinator(h.world.cityA.id);
    const res = await post(staff, { type: 'venue', venueId: nil });
    expect(res.status).toBe(404);
    expect((await post(staff, { type: 'city', cityId: nil })).status).toBe(404);
    expect((await post(await h.person(), { type: 'venue', venueId: nil })).status).toBe(403);
  });

  it('returns the update with the author name and the number of people it reaches', async () => {
    const session = await createSession(h, { venueId: h.world.venueA1, as: admin });
    const author = await h.venueCoordinator(h.world.venueA1);
    await h.db
      .update(schema.users)
      .set({ displayName: 'Coordinator Test' })
      .where(eq(schema.users.id, author.userId));
    for (let i = 0; i < 2; i++)
      await register(h, await h.person(), session.id, { areaId: h.world.cityA.areaId });
    await h.person();
    const res = await post(author, { type: 'venue', venueId: h.world.venueA1 }, {}, 'Bring a mat');
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      kind: 'announcement',
      scope: { type: 'venue', venueId: h.world.venueA1, cityId: h.world.cityA.id },
      title: { en: 'Bring a mat', ur: null },
      authorName: 'Coordinator Test',
      recipients: 2,
    });
    const national = await post(admin, { type: 'national' });
    expect(national.body.recipients).toBeGreaterThanOrEqual(3);
  });

  it('writes an audit row with ids and the kind, never the text', async () => {
    const res = await post(
      admin,
      { type: 'city', cityId: h.world.cityA.id },
      { kind: 'special_lecture' },
      'Secret wording',
    );
    const rows = (await auditRows(h)).filter((r) => r.action === 'update.post');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      entityId: res.body.id,
      cityId: h.world.cityA.id,
      scopeType: 'city',
    });
    expect(rows[0]?.meta).toMatchObject({ kind: 'special_lecture', notify: true, recipients: 0 });
    expect(JSON.stringify(rows[0])).not.toContain('Secret wording');
  });

  it('queues a push for people in reach who have a device, and none when notify is off', async () => {
    const session = await createSession(h, { venueId: h.world.venueA1, as: admin });
    const withApp = await h.person();
    const withoutApp = await h.person();
    await register(h, withApp, session.id, { areaId: h.world.cityA.areaId });
    await register(h, withoutApp, session.id, { areaId: h.world.cityA.areaId });
    await h.api('devices.register', {
      as: withApp,
      body: { platform: 'ios', provider: 'apns', token: 'fake-apns-token-1', locale: 'ur' },
    });
    const quiet = await post(
      admin,
      { type: 'venue', venueId: h.world.venueA1 },
      { notify: false },
      'Quiet',
    );
    expect(await pendingSince(quiet.body.id)).toBeNull();
    expect(await writePushes()).toEqual({ updates: 0, rows: 0 });
    expect((await outboxRows(h)).filter((r) => r.channel === 'push')).toEqual([]);
    expect(quiet.body.recipients).toBe(2);

    const loud = await post(
      admin,
      { type: 'venue', venueId: h.world.venueA1 },
      { notify: true },
      'Loud',
    );
    // The request only marks the update; the worker writes the rows afterwards.
    expect(loud.body.recipients).toBe(2);
    expect(await pendingSince(loud.body.id)).not.toBeNull();
    expect((await outboxRows(h)).filter((r) => r.channel === 'push')).toEqual([]);
    expect(await writePushes()).toEqual({ updates: 1, rows: 1 });
    expect(await pendingSince(loud.body.id)).toBeNull();

    const pushes = (await outboxRows(h)).filter((r) => r.channel === 'push');
    expect(pushes).toHaveLength(1);
    expect(pushes[0]).toMatchObject({
      recipientUserId: withApp.userId,
      updateId: loud.body.id,
      sentBy: admin.userId,
      idempotencyKey: `update:${loud.body.id}:${withApp.userId}:push`,
      venueId: h.world.venueA1,
      cityId: h.world.cityA.id,
      status: 'queued',
      costCategory: 'free',
    });
    // Posts to the feed do not send WhatsApp: that is reserved for critical session changes.
    expect((await outboxRows(h)).filter((r) => r.channel === 'whatsapp' && r.updateId)).toEqual([]);
    // A second run (a worker restarted mid-way) writes nothing new.
    expect(await writePushes()).toEqual({ updates: 0, rows: 0 });
  });

  it('marks nothing when notify is on but nobody is in reach', async () => {
    const res = await post(admin, { type: 'venue', venueId: h.world.venueA2 }, { notify: true });
    expect(res.status).toBe(201);
    expect(res.body.recipients).toBe(0);
    expect(await pendingSince(res.body.id)).toBeNull();
  });

  it('answers a national post at once and leaves the fan-out to the worker, same people as the count', async () => {
    const people = await Promise.all([h.person(), h.person(), h.person({ locale: 'ur' })]);
    for (const [i, p] of people.entries()) {
      await h.api('devices.register', {
        as: p,
        body: {
          platform: 'android',
          provider: 'fcm',
          token: `fake-fcm-national-${i}`,
          locale: 'en',
        },
      });
    }
    const suspended = await h.person();
    await h.api('devices.register', {
      as: suspended,
      body: { platform: 'android', provider: 'fcm', token: 'fake-fcm-national-s', locale: 'en' },
    });
    await h.db
      .update(schema.users)
      .set({ status: 'suspended' })
      .where(eq(schema.users.id, suspended.userId));

    const res = await post(admin, { type: 'national' }, { notify: true }, 'Taraweeh');
    expect(res.status).toBe(201);
    expect((await outboxRows(h)).filter((r) => r.updateId === res.body.id)).toEqual([]);
    const { recipients } = (
      await h.api('adminUpdates.preview', {
        as: admin,
        body: { scope: { type: 'national' }, title: { en: 'x' }, body: { en: 'x' } },
      })
    ).json<{ recipients: number }>();
    expect(res.body.recipients).toBe(recipients);

    await writePushes();
    const rows = (await outboxRows(h)).filter((r) => r.updateId === res.body.id);
    expect(rows.map((r) => r.recipientUserId).sort()).toEqual(people.map((p) => p.userId).sort());
    expect(rows.every((r) => r.cityId === null && r.venueId === null)).toBe(true);
    const urdu = rows.find((r) => r.recipientUserId === people[2]!.userId);
    expect((urdu?.payload as { push: { title: string } }).push.title).toBe('Taraweeh');
  });

  it('drops the mark with the post when its transaction rolls back, so no push is written', async () => {
    const person = await h.person();
    await h.api('devices.register', {
      as: person,
      body: { platform: 'android', provider: 'fcm', token: 'fake-fcm-rollback-1', locale: 'en' },
    });
    await expect(
      h.db.transaction(async (tx) => {
        await publishUpdate(
          tx,
          { now: h.clock.now() },
          {
            authorId: admin.userId,
            scope: { type: 'national' },
            kind: 'announcement',
            title: { en: 'Rolled back', ur: null },
            body: { en: 'Rolled back body', ur: null },
            sessionId: null,
            notify: true,
          },
        );
        throw new Error('the write after the post failed');
      }),
    ).rejects.toThrow('the write after the post failed');
    expect(
      await h.db
        .select({ id: schema.updates.id })
        .from(schema.updates)
        .where(eq(schema.updates.titleEn, 'Rolled back')),
    ).toEqual([]);
    expect(await writePushes()).toEqual({ updates: 0, rows: 0 });
    expect(await outboxRows(h)).toEqual([]);
  });

  it('sends the Urdu wording to people whose language is Urdu, when it was given', async () => {
    const session = await createSession(h, { venueId: h.world.venueA1, as: admin });
    const urdu = await h.person({ locale: 'ur' });
    await register(h, urdu, session.id, { areaId: h.world.cityA.areaId });
    await h.api('devices.register', {
      as: urdu,
      body: { platform: 'android', provider: 'fcm', token: 'fake-fcm-token-2', locale: 'ur' },
    });
    await h.api('adminUpdates.post', {
      as: admin,
      body: {
        scope: { type: 'venue', venueId: h.world.venueA1 },
        title: { en: 'English title', ur: 'اردو عنوان' },
        body: { en: 'English body', ur: 'اردو متن' },
      },
    });
    await writePushes();
    const [push] = (await outboxRows(h)).filter((r) => r.channel === 'push');
    const payload = push?.payload as { push: { title: string; body: string } };
    expect(payload.push.title).toBe('اردو عنوان');
    expect(payload.push.body).toBe('اردو متن');
  });

  it('checks that a linked session sits inside the scope it is posted to', async () => {
    const mine = await createSession(h, { venueId: h.world.venueA1, as: admin });
    const theirs = await createSession(h, { venueId: h.world.venueB1, as: admin });
    const coordinator = await h.cityCoordinator(h.world.cityA.id);
    expect(
      (await post(coordinator, { type: 'venue', venueId: h.world.venueA1 }, { sessionId: mine.id }))
        .status,
    ).toBe(201);
    expect(
      (
        await post(
          coordinator,
          { type: 'venue', venueId: h.world.venueA1 },
          { sessionId: theirs.id },
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await post(
          coordinator,
          { type: 'city', cityId: h.world.cityA.id },
          { sessionId: theirs.id },
        )
      ).status,
    ).toBe(400);
    expect((await post(admin, { type: 'national' }, { sessionId: theirs.id })).status).toBe(201);
    expect(
      (
        await post(
          admin,
          { type: 'national' },
          { sessionId: '00000000-0000-4000-8000-000000000000' },
        )
      ).status,
    ).toBe(404);
  });

  it('sends a venue time change or cancellation about its own session to registrants on WhatsApp too', async () => {
    const session = await createSession(h, { venueId: h.world.venueA1, as: admin });
    const consenting = await h.person();
    const declining = await h.person();
    await register(h, consenting, session.id, {
      areaId: h.world.cityA.areaId,
      allowWhatsapp: true,
    });
    await register(h, declining, session.id, {
      areaId: h.world.cityA.areaId,
      allowWhatsapp: false,
    });
    const before = (await outboxRows(h)).length;
    const res = await post(
      admin,
      { type: 'venue', venueId: h.world.venueA1 },
      { kind: 'cancellation', sessionId: session.id },
      'Cancelled tonight',
    );
    expect(res.status).toBe(201);
    const rows = (await outboxRows(h)).slice(before).filter((r) => r.channel === 'whatsapp');
    expect(rows.map((r) => [r.templateKey, r.recipientUserId, r.venueId])).toEqual([
      ['session_cancelled', consenting.userId, h.world.venueA1],
    ]);
  });

  it('refuses a template that is not approved, and accepts one that is', async () => {
    const approved = {
      key: 'general_notice',
      channel: 'whatsapp' as const,
      locale: 'en' as const,
      body: 'Hello {{1}}',
      variables: ['name'],
      costCategory: 'utility' as const,
      status: 'approved' as const,
    };
    await h.db
      .insert(schema.messageTemplates)
      .values([approved, { ...approved, key: 'draft_notice', status: 'draft' as const }]);
    const bad = await post(admin, { type: 'national' }, { templateKey: 'draft_notice' });
    expect(bad.status).toBe(400);
    expect(
      (await post(admin, { type: 'national' }, { templateKey: 'nothing_like_it' })).status,
    ).toBe(400);
    expect(
      (await post(admin, { type: 'national' }, { templateKey: 'general_notice' })).status,
    ).toBe(201);
  });

  it('refuses empty or oversized text', async () => {
    const empty = await h.api('adminUpdates.post', {
      as: admin,
      body: { scope: { type: 'national' }, title: { en: '   ' }, body: { en: 'x' } },
    });
    expect(empty.status).toBe(400);
    const long = await h.api('adminUpdates.post', {
      as: admin,
      body: { scope: { type: 'national' }, title: { en: 'x'.repeat(501) }, body: { en: 'x' } },
    });
    expect(long.status).toBe(400);
  });
});

describe('previewing an update', () => {
  const preview = (as: Actor, scope: PostBody, extra: Record<string, unknown> = {}) =>
    h.api('adminUpdates.preview', {
      as,
      body: { scope, title: { en: 'Preview' }, body: { en: 'Preview body' }, ...extra },
    });

  it('counts the people a post would reach and writes or sends nothing', async () => {
    const session = await createSession(h, { venueId: h.world.venueA1, as: admin });
    for (let i = 0; i < 2; i++)
      await register(h, await h.person(), session.id, { areaId: h.world.cityA.areaId });
    const outboxBefore = await outboxRows(h);
    const auditBefore = await auditRows(h);

    const res = await preview(admin, { type: 'venue', venueId: h.world.venueA1 });
    expect(res.status).toBe(200);
    expect(res.json<{ recipients: number }>()).toEqual({ recipients: 2 });
    expect((await preview(admin, { type: 'national' }, { notify: true })).status).toBe(200);
    expect(await h.db.select().from(schema.updates)).toEqual([]);
    expect(await outboxRows(h)).toEqual(outboxBefore);
    expect(await auditRows(h)).toEqual(auditBefore);

    // The count matches what posting reports.
    const posted = await post(admin, { type: 'venue', venueId: h.world.venueA1 });
    expect(posted.body.recipients).toBe(2);
  });

  it('follows the same scope rules as posting', async () => {
    const cityA = await h.cityCoordinator(h.world.cityA.id);
    const venueA1 = await h.venueCoordinator(h.world.venueA1);
    const cases: [Actor, PostBody, number][] = [
      [admin, { type: 'national' }, 200],
      [cityA, { type: 'national' }, 403],
      [cityA, { type: 'city', cityId: h.world.cityA.id }, 200],
      [cityA, { type: 'city', cityId: h.world.cityB.id }, 403],
      [cityA, { type: 'venue', venueId: h.world.venueA2 }, 200],
      [venueA1, { type: 'venue', venueId: h.world.venueA1 }, 200],
      [venueA1, { type: 'venue', venueId: h.world.venueA2 }, 403],
      [await h.person(), { type: 'venue', venueId: h.world.venueA1 }, 403],
    ];
    for (const [who, scope, status] of cases) {
      expect((await preview(who, scope)).status, JSON.stringify(scope)).toBe(status);
    }
  });

  it('validates like posting: unknown references are not found, bad input is refused', async () => {
    const nil = '00000000-0000-4000-8000-000000000000';
    const theirs = await createSession(h, { venueId: h.world.venueB1, as: admin });
    const venueA1 = await h.venueCoordinator(h.world.venueA1);
    expect((await preview(admin, { type: 'venue', venueId: nil })).status).toBe(404);
    expect((await preview(admin, { type: 'national' }, { sessionId: nil })).status).toBe(404);
    expect(
      (
        await preview(
          venueA1,
          { type: 'venue', venueId: h.world.venueA1 },
          { sessionId: theirs.id },
        )
      ).status,
    ).toBe(400);
    expect((await preview(await h.person(), { type: 'venue', venueId: nil })).status).toBe(403);
    const blank = await h.api('adminUpdates.preview', {
      as: admin,
      body: { scope: { type: 'national' }, title: { en: '' }, body: { en: 'x' } },
    });
    expect(blank.status).toBe(400);
  });
});

describe('what staff see of posted updates', () => {
  it('lists updates in scope, newest first, with recipients, and pages', async () => {
    const cityA = await h.cityCoordinator(h.world.cityA.id);
    await post(admin, { type: 'national' }, {}, 'National');
    await post(admin, { type: 'city', cityId: h.world.cityB.id }, {}, 'City B');
    await post(admin, { type: 'city', cityId: h.world.cityA.id }, {}, 'City A');
    await post(admin, { type: 'venue', venueId: h.world.venueA1 }, {}, 'Venue A1');
    await post(admin, { type: 'venue', venueId: h.world.venueB1 }, {}, 'Venue B1');

    const all = (await h.api('adminUpdates.list', { as: admin })).json<Page<Posted>>();
    expect(titles(all.items)).toEqual(['Venue B1', 'Venue A1', 'City A', 'City B', 'National']);
    const mine = (await h.api('adminUpdates.list', { as: cityA })).json<Page<Posted>>();
    expect(titles(mine.items)).toEqual(['Venue A1', 'City A']);
    const venue = await h.venueCoordinator(h.world.venueA1);
    const own = (await h.api('adminUpdates.list', { as: venue })).json<Page<Posted>>();
    expect(titles(own.items)).toEqual(['Venue A1']);

    const filtered = (
      await h.api('adminUpdates.list', { as: admin, query: { cityId: h.world.cityB.id } })
    ).json<Page<Posted>>();
    expect(titles(filtered.items)).toEqual(['Venue B1', 'City B']);

    const first = (await h.api('adminUpdates.list', { as: admin, query: { limit: 2 } })).json<
      Page<Posted>
    >();
    expect(first.items).toHaveLength(2);
    const second = (
      await h.api('adminUpdates.list', {
        as: admin,
        query: { limit: 2, cursor: first.nextCursor! },
      })
    ).json<Page<Posted>>();
    expect(titles(second.items)).toEqual(['City A', 'City B']);
  });

  it('keeps ordinary people out', async () => {
    expect((await h.api('adminUpdates.list', { as: await h.person() })).status).toBe(403);
    expect((await h.api('adminTemplates.list', { as: await h.person() })).status).toBe(403);
  });

  it('lists approved templates only', async () => {
    await h.db.insert(schema.messageTemplates).values([
      {
        key: 'ok_one',
        channel: 'whatsapp',
        locale: 'en',
        body: 'Hi',
        variables: [],
        costCategory: 'utility',
        status: 'approved',
      },
      {
        key: 'ok_one',
        channel: 'whatsapp',
        locale: 'ur',
        body: 'سلام',
        variables: [],
        costCategory: 'utility',
        status: 'approved',
      },
      {
        key: 'old_one',
        channel: 'whatsapp',
        locale: 'en',
        body: 'Old',
        variables: [],
        costCategory: 'utility',
        status: 'retired',
      },
      {
        key: 'new_one',
        channel: 'whatsapp',
        locale: 'en',
        body: 'New',
        variables: [],
        costCategory: 'utility',
        status: 'draft',
      },
    ]);
    const res = (
      await h.api('adminTemplates.list', { as: await h.venueCoordinator(h.world.venueA1) })
    ).json<{
      items: { key: string; locale: string; status: string }[];
    }>();
    expect(res.items.map((t) => [t.key, t.locale, t.status])).toEqual([
      ['ok_one', 'en', 'approved'],
      ['ok_one', 'ur', 'approved'],
    ]);
  });
});
