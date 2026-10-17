import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import type { AdminCircle, Session } from '@qc/contracts';
import { schema } from '@qc/db';
import { createHarness, type Actor, type Harness } from './harness';
import { auditRows, createCircle, createSession } from './fixtures';

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
const nil = '00000000-0000-4000-8000-000000000000';
const code = (res: { json<T>(): T }) => res.json<{ error: { code: string } }>().error.code;
const decide = (who: Actor, circleId: string, body: Record<string, unknown>) =>
  h.api('adminCircles.decide', { as: who, params: { circleId }, body });

describe('creating a circle', () => {
  it('waits for approval when a venue coordinator creates it', async () => {
    const coordinator = await h.venueCoordinator(h.world.venueA1);
    const res = await h.api('adminCircles.create', {
      as: coordinator,
      body: {
        venueId: h.world.venueA1,
        name: { en: 'Seerah circle', ur: 'سیرت حلقہ' },
        teacherName: 'Ustadh Test',
        description: { en: 'Weekly study' },
        language: 'ur',
        section: 'men',
        onlineLink: 'https://example.invalid/room',
      },
    });
    expect(res.status).toBe(201);
    expect(res.json<AdminCircle>()).toMatchObject({
      venueId: h.world.venueA1,
      cityId: h.world.cityA.id,
      name: { en: 'Seerah circle', ur: 'سیرت حلقہ' },
      teacherName: 'Ustadh Test',
      language: 'ur',
      section: 'men',
      onlineLink: 'https://example.invalid/room',
      status: 'pending_approval',
      approvedAt: null,
    });
  });

  it('publishes at once for the people who could approve it', async () => {
    const city = await h.cityCoordinator(h.world.cityA.id);
    const fromCity = await createCircle(h, { venueId: h.world.venueA1, as: city });
    expect(fromCity.status).toBe('published');
    const fromAdmin = await createCircle(h, { venueId: h.world.venueB1, as: admin });
    expect(fromAdmin.status).toBe('published');
    // A city coordinator may not approve in another city, so the same request there is refused.
    const refused = await h.api('adminCircles.create', {
      as: city,
      body: { venueId: h.world.venueB1, name: { en: 'x circle' }, language: 'en' },
    });
    expect(refused.status).toBe(403);
  });

  it('keeps coordinators out of other venues and ordinary people out altogether', async () => {
    const other = await h.venueCoordinator(h.world.venueA2);
    const body = { venueId: h.world.venueA1, name: { en: 'Not mine' }, language: 'en' };
    expect((await h.api('adminCircles.create', { as: other, body })).status).toBe(403);
    expect((await h.api('adminCircles.create', { as: await h.person(), body })).status).toBe(403);
    expect((await h.api('adminCircles.create', { body })).status).toBe(401);
  });

  it('answers not found for an unknown venue, and refuses an archived venue and bad input', async () => {
    const base = { name: { en: 'A circle' }, language: 'en' };
    expect(
      (await h.api('adminCircles.create', { as: admin, body: { ...base, venueId: nil } })).status,
    ).toBe(404);
    // Someone with no circle role at all still learns nothing about which venues exist.
    expect(
      (
        await h.api('adminCircles.create', {
          as: await h.person(),
          body: { ...base, venueId: nil },
        })
      ).status,
    ).toBe(403);
    await h.api('adminVenues.archive', { as: admin, params: { venueId: h.world.venueA2 } });
    expect(
      (
        await h.api('adminCircles.create', {
          as: admin,
          body: { ...base, venueId: h.world.venueA2 },
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await h.api('adminCircles.create', {
          as: admin,
          body: { ...base, venueId: h.world.venueA1, onlineLink: 'not a link' },
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await h.api('adminCircles.create', {
          as: admin,
          body: { ...base, venueId: h.world.venueA1, teacherName: 'A' },
        })
      ).status,
    ).toBe(400);
  });

  it('writes an audit row with the status and no wording', async () => {
    const coordinator = await h.venueCoordinator(h.world.venueA1);
    const circle = await createCircle(h, {
      venueId: h.world.venueA1,
      as: coordinator,
      name: 'Private wording',
    });
    const rows = (await auditRows(h)).filter((r) => r.action === 'circle.create');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      actorUserId: coordinator.userId,
      entityId: circle.id,
      venueId: h.world.venueA1,
      cityId: h.world.cityA.id,
      meta: { status: 'pending_approval' },
    });
    expect(JSON.stringify(rows[0])).not.toContain('Private wording');
  });
});

describe('editing a circle', () => {
  it('changes only the fields sent and records which fields changed', async () => {
    const coordinator = await h.venueCoordinator(h.world.venueA1);
    const circle = await createCircle(h, { venueId: h.world.venueA1, as: coordinator });
    const res = await h.api('adminCircles.update', {
      as: coordinator,
      params: { circleId: circle.id },
      body: { teacherName: 'Ustadh New', language: 'ur' },
    });
    expect(res.json<AdminCircle>()).toMatchObject({
      name: { en: 'Tuesday circle' },
      teacherName: 'Ustadh New',
      language: 'ur',
      status: 'pending_approval',
    });
    const [row] = (await auditRows(h)).filter((r) => r.action === 'circle.update');
    expect(row?.meta).toEqual({ fields: ['teacherName', 'language'] });
    expect(JSON.stringify(row)).not.toContain('Ustadh New');
  });

  it('writes no audit row when nothing changes', async () => {
    const circle = await createCircle(h, { venueId: h.world.venueA1, as: admin });
    await h.api('adminCircles.update', { as: admin, params: { circleId: circle.id }, body: {} });
    expect((await auditRows(h)).filter((r) => r.action === 'circle.update')).toEqual([]);
  });

  it('clears optional fields with null', async () => {
    const circle = await createCircle(h, { venueId: h.world.venueA1, as: admin });
    await h.api('adminCircles.update', {
      as: admin,
      params: { circleId: circle.id },
      body: { teacherName: 'Ustadh Test', onlineLink: 'https://example.invalid/a' },
    });
    const cleared = await h.api('adminCircles.update', {
      as: admin,
      params: { circleId: circle.id },
      body: { teacherName: null, onlineLink: null },
    });
    expect(cleared.json<AdminCircle>()).toMatchObject({ teacherName: null, onlineLink: null });
  });

  it('is limited to staff in scope, and answers unknown ids by role', async () => {
    const circle = await createCircle(h, { venueId: h.world.venueA1, as: admin });
    const body = { section: 'women' };
    for (const who of [
      await h.venueCoordinator(h.world.venueA2),
      await h.cityCoordinator(h.world.cityB.id),
      await h.person(),
    ]) {
      expect(
        (await h.api('adminCircles.update', { as: who, params: { circleId: circle.id }, body }))
          .status,
      ).toBe(403);
    }
    expect(
      (
        await h.api('adminCircles.update', {
          as: await h.venueCoordinator(h.world.venueA1),
          params: { circleId: circle.id },
          body,
        })
      ).status,
    ).toBe(200);
    expect(
      (await h.api('adminCircles.update', { as: admin, params: { circleId: nil }, body })).status,
    ).toBe(404);
    expect(
      (
        await h.api('adminCircles.update', {
          as: await h.person(),
          params: { circleId: nil },
          body,
        })
      ).status,
    ).toBe(403);
  });
});

describe('archiving a circle', () => {
  const setStatus = (who: Actor, circleId: string, status: string) =>
    h.api('adminCircles.update', { as: who, params: { circleId }, body: { status } });

  it('archives a published circle and brings it back, auditing the status', async () => {
    const coordinator = await h.venueCoordinator(h.world.venueA1);
    const circle = await createCircle(h, { venueId: h.world.venueA1, as: admin });
    expect(circle.status).toBe('published');
    const archived = await setStatus(coordinator, circle.id, 'archived');
    expect(archived.status).toBe(200);
    expect(archived.json<AdminCircle>().status).toBe('archived');
    const listed = (await h.api('adminCircles.list', { as: admin })).json<{
      items: AdminCircle[];
    }>().items;
    expect(listed.map((c) => c.id)).not.toContain(circle.id);
    const back = await setStatus(coordinator, circle.id, 'published');
    expect(back.json<AdminCircle>().status).toBe('published');
    const rows = (await auditRows(h)).filter((r) => r.action === 'circle.update');
    expect(rows.map((r) => (r.meta as { status?: string }).status)).toEqual([
      'archived',
      'published',
    ]);
  });

  it('will not publish or archive a circle that still waits for approval or was rejected', async () => {
    const coordinator = await h.venueCoordinator(h.world.venueA1);
    const pending = await createCircle(h, { venueId: h.world.venueA1, as: coordinator });
    for (const status of ['published', 'archived']) {
      const res = await setStatus(admin, pending.id, status);
      expect(res.status, status).toBe(400);
      expect(
        res.json<{ error: { issues: { path: string; code: string }[] } }>().error.issues,
      ).toEqual([{ path: 'status', code: 'invalid_transition' }]);
    }
    await decide(admin, pending.id, { decision: 'reject' });
    expect((await setStatus(admin, pending.id, 'published')).status).toBe(400);
    expect((await setStatus(admin, pending.id, 'pending_approval')).status).toBe(400);
  });

  it('keeps coordinators of other venues out', async () => {
    const circle = await createCircle(h, { venueId: h.world.venueA1, as: admin });
    const other = await h.venueCoordinator(h.world.venueA2);
    expect((await setStatus(other, circle.id, 'archived')).status).toBe(403);
  });
});

describe('reading one circle', () => {
  it('returns the same entry the list shows, to anyone whose scope holds it', async () => {
    const circle = await createCircle(h, { venueId: h.world.venueA1, as: admin });
    const listed = (await h.api('adminCircles.list', { as: admin })).json<{
      items: AdminCircle[];
    }>().items[0];
    for (const who of [
      admin,
      await h.cityCoordinator(h.world.cityA.id),
      await h.venueCoordinator(h.world.venueA1),
    ]) {
      const res = await h.api('adminCircles.get', { as: who, params: { circleId: circle.id } });
      expect(res.status).toBe(200);
      expect(res.json<AdminCircle>()).toEqual(listed);
    }
  });

  it('answers not found outside the scope or for an unknown id, and forbidden to non-staff', async () => {
    const circle = await createCircle(h, { venueId: h.world.venueA1, as: admin });
    const get = (who: Actor, circleId: string) =>
      h.api('adminCircles.get', { as: who, params: { circleId } });
    expect((await get(await h.venueCoordinator(h.world.venueA2), circle.id)).status).toBe(404);
    expect((await get(await h.cityCoordinator(h.world.cityB.id), circle.id)).status).toBe(404);
    expect((await get(admin, nil)).status).toBe(404);
    expect((await get(await h.person(), circle.id)).status).toBe(403);
    expect((await get(await h.person(), nil)).status).toBe(403);
  });
});

describe('deciding on a circle', () => {
  it('lets a city coordinator approve, which publishes it and stamps who and when', async () => {
    const venueCoordinator = await h.venueCoordinator(h.world.venueA1);
    const city = await h.cityCoordinator(h.world.cityA.id);
    const circle = await createCircle(h, { venueId: h.world.venueA1, as: venueCoordinator });
    h.clock.advanceMinutes(30);
    const res = await decide(city, circle.id, { decision: 'approve' });
    expect(res.status).toBe(200);
    const approved = res.json<AdminCircle>();
    expect(approved.status).toBe('published');
    expect(approved.approvedAt).toBe(h.clock.now().toISOString());
    const [row] = await h.db.select().from(schema.circles);
    expect(row?.approvedBy).toBe(city.userId);
  });

  it('rejects a circle, and a note sent by an old client is never stored', async () => {
    const coordinator = await h.venueCoordinator(h.world.venueA1);
    const circle = await createCircle(h, { venueId: h.world.venueA1, as: coordinator });
    const res = await decide(admin, circle.id, {
      decision: 'reject',
      note: 'Not the right venue for this',
    });
    expect(res.json<AdminCircle>().status).toBe('rejected');
    const rows = (await auditRows(h)).filter((r) => r.action === 'circle.reject');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.meta).toEqual({});
    expect(JSON.stringify(await auditRows(h))).not.toContain('right venue');
  });

  it('decides only once', async () => {
    const coordinator = await h.venueCoordinator(h.world.venueA1);
    const circle = await createCircle(h, { venueId: h.world.venueA1, as: coordinator });
    await decide(admin, circle.id, { decision: 'approve' });
    const again = await decide(admin, circle.id, { decision: 'reject' });
    expect(again.status).toBe(409);
    expect(code(again)).toBe('circle_not_pending');
    const published = await createCircle(h, {
      venueId: h.world.venueA1,
      as: admin,
      name: 'Born published',
    });
    expect(code(await decide(admin, published.id, { decision: 'approve' }))).toBe(
      'circle_not_pending',
    );
  });

  it('settles two simultaneous decisions with exactly one winner', async () => {
    const coordinator = await h.venueCoordinator(h.world.venueA1);
    const circle = await createCircle(h, { venueId: h.world.venueA1, as: coordinator });
    const other = await h.cityCoordinator(h.world.cityA.id);
    const results = await Promise.all([
      decide(admin, circle.id, { decision: 'approve' }),
      decide(other, circle.id, { decision: 'reject' }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(
      (await auditRows(h)).filter(
        (r) => r.action === 'circle.approve' || r.action === 'circle.reject',
      ),
    ).toHaveLength(1);
  });

  it('is limited to people who may approve in that city', async () => {
    const circle = await createCircle(h, {
      venueId: h.world.venueA1,
      as: await h.venueCoordinator(h.world.venueA1),
    });
    for (const who of [
      await h.venueCoordinator(h.world.venueA1),
      await h.cityCoordinator(h.world.cityB.id),
      await h.person(),
    ]) {
      expect((await decide(who, circle.id, { decision: 'approve' })).status).toBe(403);
    }
    expect((await decide(admin, nil, { decision: 'approve' })).status).toBe(404);
    expect((await decide(admin, circle.id, { decision: 'maybe' })).status).toBe(400);
  });
});

describe('listing circles', () => {
  it('shows each role only the circles in its scope, hiding archived ones by default', async () => {
    const venueA1 = await h.venueCoordinator(h.world.venueA1);
    const a1 = await createCircle(h, { venueId: h.world.venueA1, as: venueA1, name: 'A1 circle' });
    h.clock.advanceMinutes(1);
    const a2 = await createCircle(h, { venueId: h.world.venueA2, as: admin, name: 'A2 circle' });
    h.clock.advanceMinutes(1);
    const b1 = await createCircle(h, { venueId: h.world.venueB1, as: admin, name: 'B1 circle' });
    const ids = async (who: Actor, query: Record<string, string | number> = {}) =>
      (await h.api('adminCircles.list', { as: who, query }))
        .json<Page<AdminCircle>>()
        .items.map((c) => c.id);

    expect(await ids(admin)).toEqual([b1.id, a2.id, a1.id]);
    expect(await ids(await h.cityCoordinator(h.world.cityA.id))).toEqual([a2.id, a1.id]);
    expect(await ids(venueA1)).toEqual([a1.id]);
    expect(await ids(admin, { cityId: h.world.cityB.id })).toEqual([b1.id]);
    expect(await ids(admin, { venueId: h.world.venueA2 })).toEqual([a2.id]);
    expect(await ids(admin, { status: 'pending_approval' })).toEqual([a1.id]);

    await h.db
      .update(schema.circles)
      .set({ status: 'archived' })
      .where(eq(schema.circles.id, a2.id));
    expect(await ids(admin)).toEqual([b1.id, a1.id]);
    expect(await ids(admin, { status: 'archived' })).toEqual([a2.id]);
  });

  it('pages and refuses ordinary people', async () => {
    for (let i = 0; i < 3; i++) {
      await createCircle(h, { venueId: h.world.venueA1, as: admin, name: `Circle ${i}` });
      h.clock.advanceMinutes(1);
    }
    const first = (await h.api('adminCircles.list', { as: admin, query: { limit: 2 } })).json<
      Page<AdminCircle>
    >();
    expect(first.items).toHaveLength(2);
    const second = (
      await h.api('adminCircles.list', {
        as: admin,
        query: { limit: 2, cursor: first.nextCursor! },
      })
    ).json<Page<AdminCircle>>();
    expect(second.items).toHaveLength(1);
    expect(second.nextCursor).toBeNull();
    expect((await h.api('adminCircles.list', { as: await h.person() })).status).toBe(403);
  });
});

describe('what the public sees of a circle', () => {
  it('hides sessions of an unapproved circle until it is approved', async () => {
    const coordinator = await h.venueCoordinator(h.world.venueA1);
    const circle = await createCircle(h, { venueId: h.world.venueA1, as: coordinator });
    const session = await createSession(h, {
      venueId: h.world.venueA1,
      as: coordinator,
      circleId: circle.id,
    });

    expect((await h.api('sessions.get', { params: { sessionId: session.id } })).status).toBe(404);
    const hidden = (await h.api('sessions.list')).json<Page<Session>>().items;
    expect(hidden.map((s) => s.id)).toEqual([]);

    await decide(admin, circle.id, { decision: 'approve' });
    expect((await h.api('sessions.get', { params: { sessionId: session.id } })).status).toBe(200);
    expect((await h.api('sessions.list')).json<Page<Session>>().items.map((s) => s.id)).toEqual([
      session.id,
    ]);
  });

  it('hides sessions of a rejected circle', async () => {
    const coordinator = await h.venueCoordinator(h.world.venueA1);
    const circle = await createCircle(h, { venueId: h.world.venueA1, as: coordinator });
    const session = await createSession(h, {
      venueId: h.world.venueA1,
      as: coordinator,
      circleId: circle.id,
    });
    await decide(admin, circle.id, { decision: 'reject' });
    expect((await h.api('sessions.get', { params: { sessionId: session.id } })).status).toBe(404);
  });

  it('refuses a session that points at a circle of another venue', async () => {
    const other = await createCircle(h, { venueId: h.world.venueA2, as: admin });
    const res = await h.api('adminSessions.create', {
      as: admin,
      body: {
        kind: 'recurring',
        venueId: h.world.venueA1,
        circleId: other.id,
        program: 'circles',
        title: { en: 'Wrong circle' },
        section: 'family',
        language: 'en',
        localStartTime: '18:00',
        durationMinutes: 60,
        daysOfWeek: [5],
        startsOn: '2026-10-16',
      },
    });
    expect(res.status).toBe(400);
  });
});
