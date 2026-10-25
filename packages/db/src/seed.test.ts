import { getTableName, is } from 'drizzle-orm';
import { PgTable } from 'drizzle-orm/pg-core';
import { beforeAll, describe, expect, it } from 'vitest';
import { LOCALES, TEMPLATE_KEYS, TEMPLATES } from '@qc/contracts';
import * as fx from '@qc/contracts/fixtures';
import {
  assertSeedAllowed,
  buildSeedRows,
  seedDatabase,
  SeedRefusedError,
  seedShiftDays,
} from './seed';
import { parseSeedArgs } from './cli/args';
import * as schema from './schema/index';
import { createEmptyDb, createMigratedDb, type TestDb } from './test/helpers';
import { migrateUp } from './migrate';

let test: TestDb;
let first: Awaited<ReturnType<typeof seedDatabase>>;
let second: Awaited<ReturnType<typeof seedDatabase>>;
let afterFirst: Record<string, number>;
let afterSecond: Record<string, number>;

const NOT_PRODUCTION = { NODE_ENV: 'development' };

const allTableNames = (): string[] =>
  (Object.values(schema) as unknown[])
    .filter((value): value is PgTable => is(value, PgTable))
    .map((table) => getTableName(table));

async function countAll(): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const name of allTableNames()) {
    const { rows } = await test.pg.query<{ n: number }>(`SELECT count(*)::int AS n FROM "${name}"`);
    out[name] = rows[0]!.n;
  }
  return out;
}

const count = async (table: string, where = 'true'): Promise<number> => {
  const { rows } = await test.pg.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM "${table}" WHERE ${where}`,
  );
  return rows[0]!.n;
};

beforeAll(async () => {
  test = await createMigratedDb();
  first = await seedDatabase(test.db, { env: NOT_PRODUCTION });
  afterFirst = await countAll();
  second = await seedDatabase(test.db, { env: NOT_PRODUCTION });
  afterSecond = await countAll();
});

describe('seed counts', () => {
  it('inserts one row per fixture into each table', async () => {
    expect(afterFirst).toMatchObject({
      provinces: fx.provinces.length,
      cities: fx.cities.length,
      areas: fx.areas.length,
      venues: fx.venues.length,
      programs: fx.programs.length,
      seasons: fx.seasons.length,
      circles: fx.circles.length,
      sessions: fx.sessions.length,
      occurrences: fx.occurrences.length,
      content_pages: fx.contentPages.length,
      updates: fx.fixtureUpdates.length,
      message_templates: TEMPLATE_KEYS.length * LOCALES.length,
      daily_ayahs: fx.dailyAyahs.length,
    });
  });

  it('seeds the ayah of the day picks with their ids, places and numbers, set by nobody', async () => {
    const { rows } = await test.pg.query<{
      id: string;
      day: string;
      scope_type: string;
      venue_id: string | null;
      circle_id: string | null;
      surah: number;
      ayah: number;
      set_by: string | null;
    }>(
      `SELECT id, to_char(day, 'YYYY-MM-DD') AS day, scope_type, venue_id, circle_id, surah, ayah, set_by
         FROM daily_ayahs ORDER BY id`,
    );
    expect(rows).toEqual(
      fx.dailyAyahs.map((a) => ({
        id: a.id,
        day: a.date,
        scope_type: a.scopeType,
        venue_id: a.venueId,
        circle_id: a.circleId,
        surah: a.surah,
        ayah: a.ayah,
        set_by: null,
      })),
    );
  });

  it('reports what it added on the first run', () => {
    for (const row of first.tables) {
      expect(row.inserted).toBe(row.total);
      expect(row.inserted).toBeGreaterThan(0);
    }
  });

  it('is idempotent: a second run adds nothing', () => {
    expect(afterSecond).toEqual(afterFirst);
    for (const row of second.tables) expect(row.inserted).toBe(0);
  });

  it('keeps the fixture ids, so the mock server and the database agree', async () => {
    const { rows } = await test.pg.query<{ id: string }>('SELECT id FROM sessions ORDER BY id');
    expect(rows.map((r) => r.id)).toEqual(fx.sessions.map((s) => s.id).sort());
    const venue = await test.pg.query<{ id: string }>('SELECT id FROM venues WHERE slug = $1', [
      fx.venues[0]!.slug,
    ]);
    expect(venue.rows[0]!.id).toBe(fx.fixtureId('venue', 1));
  });

  it('does not overwrite rows that already exist', async () => {
    await test.pg.query(`UPDATE venues SET name_en = 'Edited by hand' WHERE id = $1`, [
      fx.fixtureId('venue', 1),
    ]);
    await seedDatabase(test.db, { env: NOT_PRODUCTION });
    const { rows } = await test.pg.query<{ name_en: string }>(
      'SELECT name_en FROM venues WHERE id = $1',
      [fx.fixtureId('venue', 1)],
    );
    expect(rows[0]!.name_en).toBe('Edited by hand');
    await test.pg.query(`UPDATE venues SET name_en = $2 WHERE id = $1`, [
      fx.fixtureId('venue', 1),
      fx.venues[0]!.name.en,
    ]);
  });
});

describe('seed data shape', () => {
  it('satisfies every foreign key', async () => {
    const { rows } = await test.pg.query<{ child: string; parent: string; column: string }>(`
      SELECT c.conrelid::regclass::text AS child, c.confrelid::regclass::text AS parent,
             a.attname AS column
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
      WHERE c.contype = 'f' AND c.connamespace = 'public'::regnamespace
    `);
    expect(rows.length).toBeGreaterThan(10);
    for (const fk of rows) {
      const { rows: orphans } = await test.pg.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM ${fk.child} c
         WHERE c."${fk.column}" IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM ${fk.parent} p WHERE p.id = c."${fk.column}")`,
      );
      expect(orphans[0]!.n, `${fk.child}.${fk.column} -> ${fk.parent}`).toBe(0);
    }
  });

  it('maps schedules, times and facilities from the fixtures', async () => {
    const { rows } = await test.pg.query<{
      local_start_time: string;
      days_of_week: number[];
      timezone: string;
      capacity: number | null;
      capacity_enabled: boolean;
    }>(
      `SELECT local_start_time::text, days_of_week, timezone, capacity, capacity_enabled
       FROM sessions WHERE id = $1`,
      [fx.fixtureId('session', 4)],
    );
    expect(rows[0]).toEqual({
      local_start_time: '19:30:00',
      days_of_week: [2],
      timezone: 'Asia/Karachi',
      capacity: null,
      capacity_enabled: false,
    });
    const lecture = await test.pg.query<{ capacity: number; capacity_enabled: boolean }>(
      'SELECT capacity, capacity_enabled FROM sessions WHERE id = $1',
      [fx.fixtureId('session', 6)],
    );
    expect(lecture.rows[0]).toEqual({ capacity: 200, capacity_enabled: true });

    const { rows: occ } = await test.pg.query<{ starts_at: string }>(
      'SELECT to_char(starts_at AT TIME ZONE $2, $3) AS starts_at FROM occurrences WHERE id = $1',
      [fx.occurrences[0]!.id, 'Asia/Karachi', 'HH24:MI'],
    );
    const session = fx.sessions.find((s) => s.id === fx.occurrences[0]!.sessionId)!;
    expect(occ[0]!.starts_at).toBe(session.localStartTime);

    expect(await count('venues', 'has_women_section')).toBe(
      fx.venues.filter((v) => v.facilities.womenSection).length,
    );
    expect(await count('venues', 'entrance_notes_en IS NOT NULL')).toBe(1);
  });

  it('keeps pending and published circles as the fixtures say', async () => {
    expect(await count('circles', `status = 'published' AND approved_at IS NOT NULL`)).toBe(1);
    expect(await count('circles', `status = 'pending_approval' AND approved_at IS NULL`)).toBe(1);
  });
});

describe('message templates', () => {
  it('covers every template in both locales (written by migration 0013, not by the seed)', async () => {
    const { rows } = await test.pg.query<{ key: string; locale: string }>(
      'SELECT key, locale FROM message_templates',
    );
    const have = new Set(rows.map((r) => `${r.key}/${r.locale}`));
    expect(TEMPLATE_KEYS).toHaveLength(8);
    for (const key of TEMPLATE_KEYS)
      for (const locale of LOCALES) expect(have).toContain(`${key}/${locale}`);
    expect(rows).toHaveLength(16);
    expect(first.tables.map((t) => t.table)).not.toContain('message_templates');
  });

  it('approves the English wording by nobody, and keeps Urdu a draft until it is reviewed', async () => {
    expect(await count('message_templates', `locale = 'en' AND status = 'approved'`)).toBe(8);
    expect(await count('message_templates', `locale = 'ur' AND status = 'draft'`)).toBe(8);
    expect(await count('message_templates', 'approved_by IS NOT NULL')).toBe(0);
  });

  it('stores the contract wording, Meta name, cost category and variables', async () => {
    for (const key of TEMPLATE_KEYS) {
      for (const locale of LOCALES) {
        const { rows } = await test.pg.query<{
          body: string;
          wa_template_name: string;
          cost_category: string;
          channel: string;
          variables: string[];
        }>(
          'SELECT body, wa_template_name, cost_category, channel, variables FROM message_templates WHERE key = $1 AND locale = $2',
          [key, locale],
        );
        const def = TEMPLATES[key];
        expect(rows[0]).toMatchObject({
          body: def.body[locale],
          wa_template_name: def.waTemplateName,
          cost_category: def.costCategory,
          channel: def.channels[0],
        });
        expect([...rows[0]!.variables].sort()).toEqual(
          [...def.body[locale].matchAll(/\{(\w+)\}/g)]
            .map((m) => m[1]!)
            .sort()
            .filter((v, i, a) => a.indexOf(v) === i),
        );
      }
    }
  });
});

describe('no person data', () => {
  const PERSON_TABLES = [
    schema.users,
    schema.profiles,
    schema.roleAssignments,
    schema.coordinatorInvites,
    schema.devices,
    schema.otpChallenges,
    schema.authSessions,
    schema.registrations,
    schema.follows,
    schema.consents,
    schema.attendance,
    schema.circleProgress,
    schema.circleRequests,
    schema.bookmarks,
    schema.readingPositions,
    schema.readingDays,
    schema.memorisation,
    schema.communityDays,
    schema.updateReads,
    schema.messageOutbox,
    schema.posters,
    schema.auditLog,
  ].map((table) => getTableName(table));

  it('leaves person-like tables empty', () => {
    expect(PERSON_TABLES).toContain('users');
    for (const table of PERSON_TABLES) expect(afterSecond[table], table).toBe(0);
  });

  it('only fills the tables the seed owns (and the catalog the migrations write)', () => {
    const seeded = new Set([...first.tables.map((t) => t.table), 'message_templates']);
    for (const [table, n] of Object.entries(afterSecond)) {
      if (!seeded.has(table)) expect(n, table).toBe(0);
    }
  });

  it('has no phone numbers beyond the synthetic venue contact numbers', async () => {
    const { rows } = await test.pg.query<{ contact_phone: string }>(
      'SELECT contact_phone FROM venues WHERE contact_phone IS NOT NULL',
    );
    for (const row of rows) expect(row.contact_phone).toMatch(/^\+923000000\d{3}$/);
    const rowsData = buildSeedRows();
    expect(JSON.stringify(rowsData)).not.toMatch(/@/);
  });
});

describe('production guard', () => {
  it.each([
    { APP_ENV: 'production' },
    { NODE_ENV: 'production' },
    { APP_ENV: ' Production ' },
    { APP_ENV: 'staging', NODE_ENV: 'production' },
  ])('refuses %j', async (env) => {
    const before = await countAll();
    await expect(seedDatabase(test.db, { env })).rejects.toThrow(SeedRefusedError);
    await expect(seedDatabase(test.db, { env })).rejects.toThrow(/production/);
    expect(await countAll()).toEqual(before);
  });

  it('allows development, staging, test and unset environments', () => {
    for (const env of [
      {},
      { APP_ENV: 'staging' },
      { NODE_ENV: 'test' },
      { APP_ENV: 'development' },
    ]) {
      expect(() => assertSeedAllowed(env)).not.toThrow();
    }
  });

  it('has no override flag', () => {
    expect(() => assertSeedAllowed({ APP_ENV: 'production', ALLOW_PRODUCTION: '1' })).toThrow(
      SeedRefusedError,
    );
  });
});

describe('date anchor (F-07)', () => {
  const DAY = 86_400_000;
  /** Saturday 17 October 2026, 09:00 in Pakistan. */
  const ANCHOR = new Date('2026-10-17T04:00:00Z');
  /** Monday of that week (Pakistan date). */
  const MONDAY = '2026-10-12';
  const pktDate = (d: Date) => new Date(d.getTime() + 5 * 3_600_000).toISOString().slice(0, 10);
  const pktDay = (d: Date) => new Date(d.getTime() + 5 * 3_600_000).getUTCDay();

  it('without an anchor keeps the fixture dates exactly', () => {
    const rows = buildSeedRows();
    expect(rows.occurrences.map((o) => o.startsAt)).toEqual(
      fx.occurrences.map((o) => new Date(o.startsAt)),
    );
    expect(rows.sessions.map((s) => s.startsOn)).toEqual(fx.sessions.map((s) => s.startsOn));
    expect(rows.seasons.map((s) => s.endsOn)).toEqual(fx.seasons.map((s) => s.endsOn));
  });

  it("moves by whole weeks so the fixtures' first day is the Monday of the anchor week", () => {
    const shift = seedShiftDays(ANCHOR);
    expect(Math.abs(shift % 7)).toBe(0);
    expect(shift).toBeLessThan(0);
    const firstDay = new Date(Date.parse(fx.FIXTURE_NOW) + shift * DAY);
    expect(pktDate(firstDay)).toBe(MONDAY);
    // Every day of the week maps to the same Monday; the next Monday starts the next week.
    for (let d = 0; d < 7; d++) {
      expect(seedShiftDays(new Date(Date.parse('2026-10-12T00:00:00+05:00') + d * DAY))).toBe(
        shift,
      );
    }
    expect(seedShiftDays(new Date('2026-10-19T00:00:00+05:00'))).toBe(shift + 7);
    // Pakistan date, not UTC: 23:30 UTC on Sunday is already Monday in Pakistan.
    expect(seedShiftDays(new Date('2026-10-18T23:30:00Z'))).toBe(shift + 7);
    expect(seedShiftDays(new Date(fx.FIXTURE_NOW))).toBe(0);
    expect(() => seedShiftDays(new Date('nope'))).toThrow(/anchor/);
  });

  it('moves every date and instant by the same days, keeping weekdays and wall-clock times', () => {
    const shift = seedShiftDays(ANCHOR);
    const base = buildSeedRows();
    const moved = buildSeedRows({ anchor: ANCHOR });
    moved.occurrences.forEach((o, i) => {
      const was = base.occurrences[i]!;
      expect((o.startsAt as Date).getTime() - (was.startsAt as Date).getTime()).toBe(shift * DAY);
      expect((o.endsAt as Date).getTime() - (was.endsAt as Date).getTime()).toBe(shift * DAY);
      expect(pktDay(o.startsAt as Date)).toBe(pktDay(was.startsAt as Date));
      expect((o.startsAt as Date).getUTCHours()).toBe((was.startsAt as Date).getUTCHours());
    });
    const addDays = (ymd: string, n: number) =>
      new Date(Date.parse(`${ymd}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
    moved.sessions.forEach((s, i) => {
      const was = base.sessions[i]!;
      expect(s.startsOn).toBe(addDays(was.startsOn as string, shift));
      expect(s.endsOn).toBe(was.endsOn ? addDays(was.endsOn, shift) : null);
    });
    moved.seasons.forEach((s, i) => {
      expect(s.startsOn).toBe(addDays(base.seasons[i]!.startsOn, shift));
      expect(s.endsOn).toBe(addDays(base.seasons[i]!.endsOn, shift));
    });
    moved.dailyAyahs.forEach((a, i) => {
      expect(a.day).toBe(addDays(base.dailyAyahs[i]!.day, shift));
      expect([a.surah, a.ayah]).toEqual([base.dailyAyahs[i]!.surah, base.dailyAyahs[i]!.ayah]);
    });
    moved.updates.forEach((u, i) => {
      expect((u.publishAt as Date).getTime() - (base.updates[i]!.publishAt as Date).getTime()).toBe(
        shift * DAY,
      );
    });
    // Ids, names and times of day do not change.
    expect(moved.sessions.map((s) => [s.id, s.localStartTime, s.daysOfWeek])).toEqual(
      base.sessions.map((s) => [s.id, s.localStartTime, s.daysOfWeek]),
    );
  });

  it('puts sessions in the anchor week: occurrences after the anchor this week, updates before it', () => {
    const rows = buildSeedRows({ anchor: ANCHOR });
    const nextMonday = Date.parse('2026-10-19T00:00:00+05:00');
    const thisWeek = rows.occurrences.filter(
      (o) =>
        (o.startsAt as Date).getTime() > ANCHOR.getTime() &&
        (o.startsAt as Date).getTime() < nextMonday,
    );
    expect(thisWeek.length).toBeGreaterThan(0);
    expect(rows.occurrences.every((o) => pktDate(o.startsAt as Date) >= MONDAY)).toBe(true);
    expect(rows.updates.every((u) => (u.publishAt as Date) < ANCHOR)).toBe(true);
    const active = rows.seasons.filter((s) => s.isActive);
    expect(active.length).toBeGreaterThan(0);
    for (const season of active) {
      expect(season.startsOn <= pktDate(ANCHOR) && pktDate(ANCHOR) <= season.endsOn).toBe(true);
    }
  });

  it('seeds an anchored database that satisfies every constraint', async () => {
    const fresh = createEmptyDb();
    await migrateUp(fresh.exec);
    const result = await seedDatabase(fresh.db, { env: NOT_PRODUCTION, anchor: ANCHOR });
    expect(result.tables.find((t) => t.table === 'occurrences')?.inserted).toBe(
      fx.occurrences.length,
    );
    const { rows } = await fresh.pg.query<{ first: string }>(
      `SELECT to_char(min(starts_at) AT TIME ZONE 'Asia/Karachi', 'YYYY-MM-DD') AS first FROM occurrences`,
    );
    expect(rows[0]!.first).toBe(MONDAY);
  });
});

describe('seed CLI arguments', () => {
  const NOW = new Date('2026-10-17T04:00:00Z');

  it('anchors on now by default', () => {
    expect(parseSeedArgs([], NOW)).toEqual({ anchor: NOW });
    expect(parseSeedArgs(['--'], NOW)).toEqual({ anchor: NOW });
  });

  it('takes a fixed anchor as a date (noon in Pakistan) or an ISO instant', () => {
    expect(parseSeedArgs(['--anchor', '2026-03-01'], NOW).anchor?.toISOString()).toBe(
      '2026-03-01T07:00:00.000Z',
    );
    expect(parseSeedArgs(['--anchor=2026-03-01T10:00:00Z'], NOW).anchor?.toISOString()).toBe(
      '2026-03-01T10:00:00.000Z',
    );
  });

  it('keeps the fixture dates with --fixture-dates', () => {
    expect(parseSeedArgs(['--fixture-dates'], NOW)).toEqual({ anchor: null });
  });

  it('refuses bad input', () => {
    expect(() => parseSeedArgs(['--anchor'], NOW)).toThrow(/--anchor needs a date/);
    expect(() => parseSeedArgs(['--anchor', '2026-02-30'], NOW)).toThrow(/--anchor needs a date/);
    expect(() => parseSeedArgs(['--anchor', 'tomorrow'], NOW)).toThrow(/--anchor needs a date/);
    expect(() => parseSeedArgs(['--anchor', '2026-03-01', '--fixture-dates'], NOW)).toThrow(
      /not both/,
    );
    expect(() => parseSeedArgs(['--fixture-dates', '--anchor', '2026-03-01'], NOW)).toThrow(
      /not both/,
    );
    expect(() => parseSeedArgs(['--force'], NOW)).toThrow(/Unknown argument/);
  });
});
