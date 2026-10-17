import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import type { AdminOccurrence, AppConfig, Settings } from '@qc/contracts';
import { schema } from '@qc/db';
import { createHarness, type Actor, type Harness } from './harness';
import { auditRows, createSession, register } from './fixtures';

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
type AttendanceView = {
  occurrenceId: string;
  headcount: number | null;
  entries: { registrationId: string | null; name: string | null; count: number }[];
  markedAt: string | null;
};
type AuditItem = {
  id: string;
  actorName: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  scopeType: string;
  cityId: string | null;
  venueId: string | null;
  createdAt: string;
};
const nil = '00000000-0000-4000-8000-000000000000';
const code = (res: { json<T>(): T }) => res.json<{ error: { code: string } }>().error.code;
const issueCodes = (res: { json<T>(): T }) =>
  res.json<{ error: { issues?: { path: string; code: string }[] } }>().error.issues ?? [];

async function sessionWithOccurrences(venueId = h.world.venueA1, capacity?: number) {
  const session = await createSession(h, { venueId, as: admin, ...(capacity ? { capacity } : {}) });
  const list = (
    await h.api('adminSessions.occurrences', {
      as: admin,
      params: { sessionId: session.id },
      query: { limit: 100 },
    })
  ).json<{ items: AdminOccurrence[] }>().items;
  return { session, occurrences: list };
}
const put = (as: Actor, occurrenceId: string, body: unknown) =>
  h.api('adminAttendance.put', { as, params: { occurrenceId }, body });
const get = (as: Actor, occurrenceId: string) =>
  h.api('adminAttendance.get', { as, params: { occurrenceId } });

describe('attendance', () => {
  it('starts empty and unmarked', async () => {
    const { occurrences } = await sessionWithOccurrences();
    const res = await get(admin, occurrences[0]!.id);
    expect(res.json<AttendanceView>()).toEqual({
      occurrenceId: occurrences[0]!.id,
      headcount: null,
      entries: [],
      markedAt: null,
    });
  });

  it('saves a headcount with ticked registrations and typed names, and reads it back', async () => {
    const coordinator = await h.venueCoordinator(h.world.venueA1);
    const { session, occurrences } = await sessionWithOccurrences();
    const person = await h.person();
    const reg = await register(h, person, session.id, {
      areaId: h.world.cityA.areaId,
      partySize: 2,
    });
    h.clock.advanceMinutes(20);
    const res = await put(coordinator, occurrences[0]!.id, {
      headcount: 9,
      entries: [
        { registrationId: reg.body.id, name: null, count: 2 },
        { registrationId: null, name: 'Walk-in guest', count: 1 },
      ],
    });
    expect(res.status).toBe(200);
    const saved = res.json<AttendanceView>();
    expect(saved).toMatchObject({
      occurrenceId: occurrences[0]!.id,
      headcount: 9,
      markedAt: h.clock.now().toISOString(),
    });
    // Entries come back without a promised order; compare as a set.
    expect(saved.entries).toHaveLength(2);
    expect(saved.entries).toEqual(
      expect.arrayContaining([
        { registrationId: reg.body.id, name: null, count: 2 },
        { registrationId: null, name: 'Walk-in guest', count: 1 },
      ]),
    );
    expect((await get(coordinator, occurrences[0]!.id)).json<AttendanceView>()).toEqual(saved);
  });

  it('replaces what was saved before instead of adding to it', async () => {
    const { occurrences } = await sessionWithOccurrences();
    const id = occurrences[0]!.id;
    await put(admin, id, {
      headcount: 10,
      entries: [{ registrationId: null, name: 'First', count: 3 }],
    });
    h.clock.advanceMinutes(5);
    const second = await put(admin, id, { headcount: 4, entries: [] });
    expect(second.json<AttendanceView>()).toMatchObject({ headcount: 4, entries: [] });
    expect(await h.db.select().from(schema.attendance)).toEqual([]);
    // A headcount alone still reports when it was marked.
    expect(second.json<AttendanceView>().markedAt).toBe(h.clock.now().toISOString());
    // A zero headcount is a real answer, different from "not marked".
    const zero = await put(admin, id, { headcount: 0, entries: [] });
    expect(zero.json<AttendanceView>().headcount).toBe(0);
  });

  it('shows the headcount in the occurrence list', async () => {
    const { session, occurrences } = await sessionWithOccurrences();
    await put(admin, occurrences[0]!.id, { headcount: 12, entries: [] });
    const list = (
      await h.api('adminSessions.occurrences', {
        as: admin,
        params: { sessionId: session.id },
        query: { limit: 100 },
      })
    ).json<{ items: AdminOccurrence[] }>().items;
    expect(list[0]?.headcount).toBe(12);
    expect(list[1]?.headcount).toBeNull();
  });

  it('refuses numbers that do not add up', async () => {
    const { occurrences } = await sessionWithOccurrences();
    const id = occurrences[0]!.id;
    const over = await put(admin, id, {
      headcount: 2,
      entries: [{ registrationId: null, name: 'A', count: 3 }],
    });
    expect(over.status).toBe(400);
    expect(issueCodes(over)).toContainEqual({ path: 'headcount', code: 'below_entries' });
    expect((await put(admin, id, { headcount: -1, entries: [] })).status).toBe(400);
    expect(
      (
        await put(admin, id, {
          headcount: 5,
          entries: [{ registrationId: null, name: 'A', count: 0 }],
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await put(admin, id, {
          headcount: 5,
          entries: [{ registrationId: null, name: '', count: 1 }],
        })
      ).status,
    ).toBe(400);
  });

  it('refuses a registration listed twice, one from another session, and an unknown one', async () => {
    const { session, occurrences } = await sessionWithOccurrences();
    const other = await sessionWithOccurrences(h.world.venueA1);
    const person = await h.person();
    const mine = await register(h, person, session.id, { areaId: h.world.cityA.areaId });
    const theirs = await register(h, await h.person(), other.session.id, {
      areaId: h.world.cityA.areaId,
    });
    const id = occurrences[0]!.id;
    const twice = await put(admin, id, {
      headcount: 5,
      entries: [
        { registrationId: mine.body.id, name: null, count: 1 },
        { registrationId: mine.body.id, name: null, count: 1 },
      ],
    });
    expect(twice.status).toBe(400);
    expect(issueCodes(twice)).toContainEqual({ path: 'entries', code: 'duplicate_registration' });
    expect(
      (
        await put(admin, id, {
          headcount: 5,
          entries: [{ registrationId: theirs.body.id, name: null, count: 1 }],
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await put(admin, id, {
          headcount: 5,
          entries: [{ registrationId: nil, name: null, count: 1 }],
        })
      ).status,
    ).toBe(400);
    expect((await get(admin, id)).json<AttendanceView>().headcount).toBeNull();
  });

  it('refuses to mark a cancelled occurrence', async () => {
    const { occurrences } = await sessionWithOccurrences();
    const id = occurrences[0]!.id;
    await h.api('adminOccurrences.update', {
      as: admin,
      params: { occurrenceId: id },
      body: { status: 'cancelled' },
    });
    const res = await put(admin, id, { headcount: 3, entries: [] });
    expect(res.status).toBe(400);
    expect(issueCodes(res)).toContainEqual({ path: 'occurrenceId', code: 'occurrence_cancelled' });
  });

  it('audits each save with counts only, never names', async () => {
    const { occurrences } = await sessionWithOccurrences();
    await put(admin, occurrences[0]!.id, {
      headcount: 6,
      entries: [{ registrationId: null, name: 'Secret Guest', count: 2 }],
    });
    const rows = (await auditRows(h)).filter((r) => r.action === 'attendance.mark');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      entityId: occurrences[0]!.id,
      venueId: h.world.venueA1,
      cityId: h.world.cityA.id,
      meta: { headcount: 6, entries: 1 },
    });
    expect(JSON.stringify(rows[0])).not.toContain('Secret Guest');
  });

  it('is limited to staff in scope, and unknown ids answer by role', async () => {
    const { occurrences } = await sessionWithOccurrences();
    const id = occurrences[0]!.id;
    const body = { headcount: 1, entries: [] };
    for (const who of [
      await h.venueCoordinator(h.world.venueA2),
      await h.cityCoordinator(h.world.cityB.id),
      await h.person(),
    ]) {
      expect((await get(who, id)).status).toBe(403);
      expect((await put(who, id, body)).status).toBe(403);
    }
    for (const who of [
      await h.venueCoordinator(h.world.venueA1),
      await h.cityCoordinator(h.world.cityA.id),
    ]) {
      expect((await put(who, id, body)).status).toBe(200);
    }
    expect((await get(admin, nil)).status).toBe(404);
    expect((await put(admin, nil, body)).status).toBe(404);
    expect((await get(await h.person(), nil)).status).toBe(403);
    expect((await h.api('adminAttendance.get', { params: { occurrenceId: id } })).status).toBe(401);
  });

  it('keeps two coordinators saving at once from mixing their rows', async () => {
    const { occurrences } = await sessionWithOccurrences();
    const id = occurrences[0]!.id;
    const a = await h.venueCoordinator(h.world.venueA1);
    const b = await h.cityCoordinator(h.world.cityA.id);
    await Promise.all([
      put(a, id, {
        headcount: 5,
        entries: [
          { registrationId: null, name: 'From A', count: 1 },
          { registrationId: null, name: 'Also A', count: 1 },
        ],
      }),
      put(b, id, { headcount: 7, entries: [{ registrationId: null, name: 'From B', count: 2 }] }),
    ]);
    const saved = (await get(admin, id)).json<AttendanceView>();
    const names = saved.entries.map((e) => e.name).sort();
    expect([['Also A', 'From A'], ['From B']]).toContainEqual(names);
    expect(saved.headcount === 5 ? names.length === 2 : names.length === 1).toBe(true);
  });
});

describe('the audit log', () => {
  async function makeHistory() {
    const cityA = await h.cityCoordinator(h.world.cityA.id);
    const venueA1 = await h.venueCoordinator(h.world.venueA1);
    await createSession(h, { venueId: h.world.venueA1, as: venueA1, title: 'Hidden title' });
    h.clock.advanceMinutes(1);
    await createSession(h, { venueId: h.world.venueB1, as: admin });
    h.clock.advanceMinutes(1);
    await h.api('adminVenues.update', {
      as: cityA,
      params: { venueId: h.world.venueA2 },
      body: { name: { en: 'Renamed' } },
    });
    h.clock.advanceMinutes(1);
    await h.api('adminSettings.update', { as: admin, body: { hijriOffsetDays: 1 } });
    return { cityA, venueA1 };
  }
  const list = async (as: Actor, query: Record<string, string | number> = {}) =>
    (await h.api('adminAudit.list', { as, query })).json<Page<AuditItem>>();

  it('shows a national admin everything, newest first, with the actor name', async () => {
    await h.db
      .update(schema.users)
      .set({ displayName: 'Admin Test' })
      .where(eq(schema.users.id, admin.userId));
    await makeHistory();
    const page = await list(admin, { limit: 100 });
    expect(page.items.map((i) => i.action)).toEqual(
      expect.arrayContaining(['session.create', 'venue.update', 'settings.update']),
    );
    const ids = page.items.map((i) => Number(i.id));
    expect([...ids].sort((a, b) => b - a)).toEqual(ids);
    expect(page.items.find((i) => i.action === 'settings.update')).toMatchObject({
      actorName: 'Admin Test',
      scopeType: 'national',
      cityId: null,
    });
  });

  it('shows a city coordinator the city and its venues, and nothing national', async () => {
    const { cityA } = await makeHistory();
    const page = await list(cityA, { limit: 100 });
    expect(page.items.length).toBeGreaterThan(0);
    expect(page.items.every((i) => i.cityId === h.world.cityA.id)).toBe(true);
    expect(page.items.map((i) => i.action)).not.toContain('settings.update');
    expect(page.items.some((i) => i.venueId === h.world.venueB1)).toBe(false);
  });

  it('keeps venue coordinators and ordinary people out', async () => {
    expect(
      (await h.api('adminAudit.list', { as: await h.venueCoordinator(h.world.venueA1) })).status,
    ).toBe(403);
    expect((await h.api('adminAudit.list', { as: await h.person() })).status).toBe(403);
    expect((await h.api('adminAudit.list')).status).toBe(401);
  });

  it('filters by city, venue, entity type and time', async () => {
    await makeHistory();
    const byVenue = await list(admin, { venueId: h.world.venueB1 });
    expect(byVenue.items.map((i) => i.action)).toEqual(['session.create']);
    const byCity = await list(admin, { cityId: h.world.cityB.id });
    expect(byCity.items.every((i) => i.cityId === h.world.cityB.id)).toBe(true);
    const byType = await list(admin, { entityType: 'settings' });
    expect(byType.items.map((i) => i.action)).toEqual(['settings.update']);
    // Audit rows are stamped by the database clock, so the time filters use the real time.
    const hour = 3_600_000;
    const everything = await list(admin, {
      from: new Date(Date.now() - hour).toISOString(),
      limit: 100,
    });
    expect(everything.items.length).toBeGreaterThanOrEqual(4);
    expect((await list(admin, { from: new Date(Date.now() + hour).toISOString() })).items).toEqual(
      [],
    );
    expect((await list(admin, { to: new Date(Date.now() - hour).toISOString() })).items).toEqual(
      [],
    );
    const upTo = await list(admin, { to: new Date(Date.now() + hour).toISOString(), limit: 100 });
    expect(upTo.items).toHaveLength(everything.items.length);
  });

  it('pages with a keyset cursor without skipping or repeating a row', async () => {
    await makeHistory();
    const all = await list(admin, { limit: 100 });
    const seen: string[] = [];
    let cursor: string | undefined;
    for (let guard = 0; guard < 20; guard++) {
      const page = await list(admin, { limit: 2, ...(cursor ? { cursor } : {}) });
      seen.push(...page.items.map((i) => i.id));
      if (!page.nextCursor) break;
      cursor = page.nextCursor;
    }
    expect(seen).toEqual(all.items.map((i) => i.id));
  });

  it('rejects a cursor it did not make', async () => {
    const res = await h.api('adminAudit.list', { as: admin, query: { cursor: 'AAAA' } });
    expect(res.status).toBe(400);
    expect(code(res)).toBe('validation_failed');
  });

  it('holds ids and field names, never the wording or numbers behind a change', async () => {
    await makeHistory();
    const text = JSON.stringify(await auditRows(h));
    expect(text).not.toContain('Hidden title');
    expect(text).not.toContain('Renamed');
    expect(text).not.toContain('+92300');
  });
});

describe('platform settings', () => {
  it('starts with the defaults', async () => {
    const res = await h.api('adminSettings.get', { as: admin });
    expect(res.json<Settings>()).toEqual({
      hijriOffsetDays: 0,
      seasonMode: 'circles',
      whatsappDailyCapPerPerson: 1,
      circleRequestAlertThreshold: 10,
      reminderLeadMinutes: { dora: 60, circles: 60 },
    });
  });

  it('merges a partial reminder lead time with the stored one', async () => {
    const one = await h.api('adminSettings.update', {
      as: admin,
      body: { reminderLeadMinutes: { dora: 90 } },
    });
    expect(one.json<Settings>().reminderLeadMinutes).toEqual({ dora: 90, circles: 60 });
    await h.api('adminSettings.update', {
      as: admin,
      body: { reminderLeadMinutes: { circles: 30 } },
    });
    expect(
      (await h.api('adminSettings.get', { as: admin })).json<Settings>().reminderLeadMinutes,
    ).toEqual({ dora: 90, circles: 30 });
    const stored = await h.db
      .select()
      .from(schema.settings)
      .where(eq(schema.settings.key, 'reminder_lead_minutes'));
    expect(stored[0]?.value).toEqual({ dora: 90, circles: 30 });
  });

  it('changes only what is sent, and the apps see the new values', async () => {
    const res = await h.api('adminSettings.update', {
      as: admin,
      body: { hijriOffsetDays: -1, seasonMode: 'dora' },
    });
    expect(res.json<Settings>()).toMatchObject({
      hijriOffsetDays: -1,
      seasonMode: 'dora',
      whatsappDailyCapPerPerson: 1,
    });
    await h.api('adminSettings.update', { as: admin, body: { whatsappDailyCapPerPerson: 2 } });
    expect((await h.api('adminSettings.get', { as: admin })).json<Settings>()).toEqual({
      hijriOffsetDays: -1,
      seasonMode: 'dora',
      whatsappDailyCapPerPerson: 2,
      circleRequestAlertThreshold: 10,
      reminderLeadMinutes: { dora: 60, circles: 60 },
    });
    const config = (await h.api('config.get')).json<AppConfig>();
    expect(config).toMatchObject({ hijriOffsetDays: -1, seasonMode: 'dora' });
  });

  it('refuses values outside the allowed range', async () => {
    for (const body of [
      { hijriOffsetDays: 3 },
      { hijriOffsetDays: 0.5 },
      { seasonMode: 'winter' },
      { whatsappDailyCapPerPerson: 6 },
      { circleRequestAlertThreshold: 0 },
    ]) {
      expect(
        (await h.api('adminSettings.update', { as: admin, body })).status,
        JSON.stringify(body),
      ).toBe(400);
    }
    expect((await h.api('adminSettings.get', { as: admin })).json<Settings>().hijriOffsetDays).toBe(
      0,
    );
  });

  it('audits a change by field name and skips the audit when nothing was sent', async () => {
    await h.api('adminSettings.update', { as: admin, body: {} });
    expect((await auditRows(h)).filter((r) => r.action === 'settings.update')).toEqual([]);
    await h.api('adminSettings.update', { as: admin, body: { hijriOffsetDays: 2 } });
    const rows = (await auditRows(h)).filter((r) => r.action === 'settings.update');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      actorUserId: admin.userId,
      scopeType: 'national',
      meta: { fields: ['hijriOffsetDays'] },
    });
  });

  it('is for national admins only', async () => {
    for (const who of [
      await h.cityCoordinator(h.world.cityA.id),
      await h.venueCoordinator(h.world.venueA1),
      await h.person(),
    ]) {
      expect((await h.api('adminSettings.get', { as: who })).status).toBe(403);
      expect(
        (await h.api('adminSettings.update', { as: who, body: { hijriOffsetDays: 1 } })).status,
      ).toBe(403);
    }
    expect((await h.api('adminSettings.get')).status).toBe(401);
  });
});
