import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { REGISTRATION_EXPORT_COLUMNS } from '@qc/contracts';
import { schema } from '@qc/db';
import { TEST_PRINCIPAL_HEADER } from '../middleware/test-auth';
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

const nil = '00000000-0000-4000-8000-000000000000';
type Query = { cityId?: string; venueId?: string; from?: string; to?: string };
const exportAs = (as: Actor | null, query: Query = {}) =>
  h.api('adminRegistrations.export', { ...(as ? { as } : {}), query });
const dataLines = (text: string) => text.trimEnd().split('\r\n').slice(1);
const code = (res: { json<T>(): T }) => res.json<{ error: { code: string } }>().error.code;

/** One registration at each of venue A1, A2 and B1. */
async function seed() {
  const a1 = await createSession(h, { venueId: h.world.venueA1, as: admin, title: 'A1' });
  const a2 = await createSession(h, { venueId: h.world.venueA2, as: admin, title: 'A2' });
  const b1 = await createSession(h, { venueId: h.world.venueB1, as: admin, title: 'B1' });
  for (const [session, areaId] of [
    [a1, h.world.cityA.areaId],
    [a2, h.world.cityA.areaId],
    [b1, h.world.cityB.areaId],
  ] as const) {
    await register(h, await h.person(), session.id, { areaId });
  }
  return { a1, a2, b1 };
}

describe('the scoped registrations export', () => {
  it('returns a CSV with the contract header and no byte order mark', async () => {
    const { a1 } = await seed();
    const named = await h.person({ displayName: '=SUM(A1:A2)' });
    await register(h, named, a1.id, { areaId: h.world.cityA.areaId });
    const res = await exportAs(admin);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/csv');
    expect(res.headers.get('content-disposition')).toContain('registrations.csv');
    expect(res.text.startsWith(`${REGISTRATION_EXPORT_COLUMNS.join(',')}\r\n`)).toBe(true);
    expect(dataLines(res.text)).toHaveLength(4);
    // A name that looks like a formula is defused; ids and numbers are not touched.
    expect(res.text).toContain(`,'=SUM(A1:A2),`);
    expect(res.text).toContain(`,${named.phone},`);

    const raw = await h.app.request('/v1/admin/registrations/export', {
      headers: { [TEST_PRINCIPAL_HEADER]: JSON.stringify(admin.principal) },
    });
    const bytes = new Uint8Array(await raw.arrayBuffer());
    expect([...bytes.slice(0, 3)]).not.toEqual([0xef, 0xbb, 0xbf]);
  });

  it('gives each kind of staff member exactly their own scope', async () => {
    const { a1, a2, b1 } = await seed();
    const sessionsIn = async (who: Actor, query: Query = {}) =>
      dataLines((await exportAs(who, query)).text)
        .map((line) => line.split(',')[0])
        .sort();
    expect(await sessionsIn(admin)).toEqual([a1.id, a2.id, b1.id].sort());
    expect(await sessionsIn(await h.cityCoordinator(h.world.cityA.id))).toEqual(
      [a1.id, a2.id].sort(),
    );
    expect(await sessionsIn(await h.venueCoordinator(h.world.venueA1))).toEqual([a1.id]);
    expect(await sessionsIn(admin, { cityId: h.world.cityB.id })).toEqual([b1.id]);
    expect(await sessionsIn(admin, { venueId: h.world.venueA2 })).toEqual([a2.id]);
  });

  it('refuses a filter outside the caller scope, and callers with no staff role', async () => {
    const venue = await h.venueCoordinator(h.world.venueA1);
    const city = await h.cityCoordinator(h.world.cityA.id);
    expect((await exportAs(venue, { venueId: h.world.venueA2 })).status).toBe(403);
    expect((await exportAs(venue, { cityId: h.world.cityA.id })).status).toBe(403);
    expect((await exportAs(city, { cityId: h.world.cityB.id })).status).toBe(403);
    expect((await exportAs(city, { venueId: h.world.venueB1 })).status).toBe(403);
    expect((await exportAs(city, { venueId: h.world.venueA2 })).status).toBe(200);
    expect((await exportAs(await h.person())).status).toBe(403);
    expect((await exportAs(null)).status).toBe(401);
  });

  it('answers an unknown venue or city with not_found for every staff role, and forbidden for everyone else', async () => {
    const roles: [string, Actor | null, number][] = [
      ['national admin', admin, 404],
      ['city coordinator', await h.cityCoordinator(h.world.cityA.id), 404],
      ['venue coordinator', await h.venueCoordinator(h.world.venueA1), 404],
      ['person with no role', await h.person(), 403],
      ['nobody', null, 401],
    ];
    for (const [name, who, status] of roles) {
      for (const query of [{ venueId: nil }, { cityId: nil }, { cityId: nil, venueId: nil }]) {
        const res = await exportAs(who, query);
        expect(res.status, `${name} ${JSON.stringify(query)}`).toBe(status);
        if (status === 404) expect(code(res)).toBe('not_found');
      }
    }
    // Known places keep the scope rule: out of scope is forbidden, not not_found.
    const venue = await h.venueCoordinator(h.world.venueA1);
    expect((await exportAs(venue, { venueId: h.world.venueB1 })).status).toBe(403);
    expect((await exportAs(venue, { cityId: h.world.cityB.id })).status).toBe(403);
    // An unknown venue inside a known city is still not_found.
    expect((await exportAs(admin, { cityId: h.world.cityA.id, venueId: nil })).status).toBe(404);
    // A backwards range is reported before the lookup, as for any request.
    expect(
      (await exportAs(admin, { venueId: nil, from: '2026-10-17', to: '2026-10-16' })).status,
    ).toBe(400);
    // Refused requests leave no audit row.
    expect((await auditRows(h)).filter((r) => r.action === 'registration.export')).toHaveLength(0);
  });

  it('counts from and to as whole days in Pakistan time, both included', async () => {
    const session = await createSession(h, { venueId: h.world.venueA1, as: admin });
    const at = async () => {
      const p = await h.person();
      await register(h, p, session.id, { areaId: h.world.cityA.areaId });
      return p.phone;
    };
    // The clock starts on Friday 2026-10-16 at 10:00 in Pakistan.
    const morning = await at();
    h.clock.advanceMinutes(13 * 60 + 59); // 23:59 the same day
    const lateEvening = await at();
    h.clock.advanceMinutes(2); // 00:01 on the 17th
    const afterMidnight = await at();
    const phones = async (query: Query) => (await exportAs(admin, query)).text;

    const day16 = await phones({ from: '2026-10-16', to: '2026-10-16' });
    expect(dataLines(day16)).toHaveLength(2);
    expect(day16).toContain(morning);
    expect(day16).toContain(lateEvening);
    expect(day16).not.toContain(afterMidnight);

    const day17 = await phones({ from: '2026-10-17' });
    expect(dataLines(day17)).toHaveLength(1);
    expect(day17).toContain(afterMidnight);
    expect(dataLines(await phones({ to: '2026-10-15' }))).toHaveLength(0);
  });

  it('refuses a range that ends before it starts', async () => {
    const res = await exportAs(admin, { from: '2026-10-17', to: '2026-10-16' });
    expect(res.status).toBe(400);
    expect(
      res.json<{ error: { issues: { path: string; code: string }[] } }>().error.issues,
    ).toEqual([{ path: 'from', code: 'invalid_range' }]);
  });

  it('leaves out cancelled registrations', async () => {
    const { a1 } = await seed();
    const leaving = await h.person();
    const reg = await register(h, leaving, a1.id, { areaId: h.world.cityA.areaId });
    await h.api('registrations.cancel', { as: leaving, params: { registrationId: reg.body.id } });
    const text = (await exportAs(admin, { venueId: h.world.venueA1 })).text;
    expect(text).not.toContain(leaving.phone);
  });

  it('refuses an export over the row limit', async () => {
    const session = await createSession(h, { venueId: h.world.venueA1, as: admin });
    const [occurrence] = await h.db.select().from(schema.occurrences);
    // Insert directly (as anonymous rows): 50 001 registrations through the endpoint would be
    // far too slow for a test.
    await h.pg.exec(`
      INSERT INTO registrations (session_id, occurrence_id, area_id, section, party_size, status)
      SELECT '${session.id}', '${occurrence!.id}', '${h.world.cityA.areaId}', 'family', 1, 'confirmed'
      FROM generate_series(1, 50001)
    `);
    const res = await exportAs(admin);
    expect(res.status).toBe(400);
    expect(code(res)).toBe('validation_failed');
  });

  it('writes one audit row with the filters and the row count, and no personal data', async () => {
    await seed();
    const city = await h.cityCoordinator(h.world.cityA.id);
    await exportAs(city, { venueId: h.world.venueA1, from: '2026-10-01' });
    await exportAs(city);
    const rows = (await auditRows(h)).filter((r) => r.action === 'registration.export');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      actorUserId: city.userId,
      entityType: 'export',
      scopeType: 'venue',
      venueId: h.world.venueA1,
      cityId: h.world.cityA.id,
      meta: { cityId: null, venueId: h.world.venueA1, from: '2026-10-01', to: null, rows: 1 },
    });
    expect(rows[1]).toMatchObject({
      scopeType: 'city',
      cityId: h.world.cityA.id,
      meta: { rows: 2 },
    });
    expect(JSON.stringify(rows)).not.toContain('+92');
  });
});
