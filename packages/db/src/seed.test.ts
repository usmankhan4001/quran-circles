import { getTableName, is } from 'drizzle-orm';
import { PgTable } from 'drizzle-orm/pg-core';
import { beforeAll, describe, expect, it } from 'vitest';
import { LOCALES, TEMPLATE_KEYS, TEMPLATES } from '@qc/contracts';
import * as fx from '@qc/contracts/fixtures';
import { assertSeedAllowed, buildSeedRows, seedDatabase, SeedRefusedError } from './seed';
import * as schema from './schema/index';
import { createMigratedDb, type TestDb } from './test/helpers';

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
    });
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
  it('covers every template in both locales', async () => {
    const { rows } = await test.pg.query<{ key: string; locale: string }>(
      'SELECT key, locale FROM message_templates',
    );
    const have = new Set(rows.map((r) => `${r.key}/${r.locale}`));
    expect(TEMPLATE_KEYS).toHaveLength(8);
    for (const key of TEMPLATE_KEYS)
      for (const locale of LOCALES) expect(have).toContain(`${key}/${locale}`);
    expect(rows).toHaveLength(16);
  });

  it('keeps every template a draft: nothing is approved, Urdu is never marked reviewed', async () => {
    expect(await count('message_templates', `status <> 'draft'`)).toBe(0);
    expect(
      await count('message_templates', 'approved_by IS NOT NULL OR approved_at IS NOT NULL'),
    ).toBe(0);
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
    schema.updateReads,
    schema.messageOutbox,
    schema.posters,
    schema.auditLog,
  ].map((table) => getTableName(table));

  it('leaves person-like tables empty', () => {
    expect(PERSON_TABLES).toContain('users');
    for (const table of PERSON_TABLES) expect(afterSecond[table], table).toBe(0);
  });

  it('only fills the tables the seed owns', () => {
    const seeded = new Set(first.tables.map((t) => t.table));
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
