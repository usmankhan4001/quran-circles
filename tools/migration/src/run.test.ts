import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cities as fixtureCities } from '@qc/contracts/fixtures';
import type { SqlExecutor } from '@qc/db';
import { parseCsvObjects } from './csv';
import { MigrationToolError } from './errors';
import { readMapping } from './places';
import { planFingerprint, runMigration, type RunOptions } from './run';
import { takeSnapshot, verifySnapshots } from './snapshot';
import {
  syntheticMappingCsv,
  syntheticRegistrations,
  syntheticSubscribers,
  syntheticVenues,
} from './synthetic';
import { clearMigrated, countRows, createSeededTarget, type TestTarget } from './test/db';

let target: TestTarget;
beforeAll(async () => {
  target = await createSeededTarget();
});
afterAll(async () => {
  await target.pg.close();
});
beforeEach(async () => {
  await clearMigrated(target);
});

const input = (overrides: Partial<RunOptions['input']> = {}): RunOptions['input'] => ({
  venues: syntheticVenues(),
  registrations: syntheticRegistrations(),
  subscribers: syntheticSubscribers(),
  mapping: readMapping(parseCsvObjects(syntheticMappingCsv())),
  createAreas: true,
  ...overrides,
});

const NOW = new Date('2026-10-16T09:00:00Z');
const run = (
  apply: boolean,
  inputOverrides: Partial<RunOptions['input']> = {},
  db: SqlExecutor | null = target.exec,
) => runMigration({ db, apply, now: NOW, input: input(inputOverrides) });

const tables = ['areas', 'venues', 'legacy_registrations', 'legacy_whatsapp_subscribers', 'users'];
async function rowCounts() {
  const out: Record<string, number> = {};
  for (const t of tables) out[t] = await countRows(target, t);
  return out;
}

describe('dry run', () => {
  it('writes nothing', async () => {
    const before = await rowCounts();
    const { report } = await run(false);
    expect(report.mode).toBe('dry-run');
    expect(report.applied).toBeUndefined();
    expect(await rowCounts()).toEqual(before);
  });

  it('runs inside a read-only transaction, so even a bug could not write', async () => {
    const statements: string[] = [];
    const spy: SqlExecutor = {
      exec: async (sql) => {
        statements.push(sql);
        await target.exec.exec(sql);
      },
      query: async (sql, params) => {
        statements.push(sql);
        return target.exec.query(sql, params);
      },
    };
    await run(false, {}, spy);
    expect(statements[0]).toBe('BEGIN READ ONLY');
    expect(statements.at(-1)).toBe('ROLLBACK');
    expect(statements.some((s) => /^\s*(insert|update|delete)/i.test(s))).toBe(false);
  });

  it('works offline against the nine fixture cities and an empty target', async () => {
    const { report } = await run(false, {}, null);
    expect(report.target).toBe('offline');
    expect(report.totals.venues.toInsert).toBeGreaterThan(0);
  });

  it('refuses to apply offline', async () => {
    await expect(run(true, {}, null)).rejects.toBeInstanceOf(MigrationToolError);
  });
});

describe('counts per category', () => {
  it('classifies the synthetic venues, once each', async () => {
    const { report } = await run(false);
    expect(report.totals.venues).toMatchObject({
      read: 14,
      valid: 9,
      toInsert: 9,
      alreadyPresent: 0,
      invalidRow: 1, // 14: no address
      duplicate: 1, // 8: the same venue entered twice
      unapproved: 1, // 10: the reviewer has not approved it
      unknownCity: 1, // 11: karachi is not a V2 city
      invalidCoordinates: 1, // 9: latitude and longitude swapped
      slugConflict: 0,
      unknownArea: 0,
      contactPhoneInvalid: 1, // 12
      needsUrduText: 9,
    });
  });

  it('classifies the synthetic registrations, once each', async () => {
    const { report } = await run(false);
    expect(report.totals.registrations).toMatchObject({
      read: 17,
      valid: 10,
      toInsert: 10,
      duplicate: 1,
      invalidPhone: 2,
      ambiguousVenue: 1,
      unmappedVenue: 2,
      invalidRow: 1,
      unparseableTimestamp: 1,
      nonPakistanNumber: 1,
    });
  });

  it('classifies the synthetic subscribers, once each', async () => {
    const { report } = await run(false);
    expect(report.totals.subscribers).toMatchObject({
      read: 6,
      valid: 4,
      toInsert: 4,
      duplicate: 1,
      invalidPhone: 1,
      venueUnmapped: 1,
    });
  });

  it('breaks everything down per city', async () => {
    const { report } = await run(false);
    const city = (slug: string) => report.cities[slug]!;
    expect(city('rawalpindi').venues).toMatchObject({ read: 3, toInsert: 2, duplicate: 1 });
    expect(city('rawalpindi').registrations).toMatchObject({
      read: 9,
      toInsert: 6,
      duplicate: 1,
      invalidPhone: 2,
    });
    expect(city('rawalpindi').subscribers).toMatchObject({
      toInsert: 1,
      duplicate: 1,
      invalidPhone: 1,
    });
    expect(city('islamabad').venues.toInsert).toBe(2);
    expect(city('islamabad').registrations.toInsert).toBe(2);
    expect(city('lahore').venues.toInsert).toBe(2);
    expect(city('multan').venues.toInsert).toBe(2); // 7 and 13
    expect(city('wah-cantt').venues).toMatchObject({ toInsert: 1, contactPhoneInvalid: 1 });
    expect(city('faisalabad').venues).toMatchObject({
      read: 2,
      invalidCoordinates: 1,
      unapproved: 1,
    });
    expect(city('unassigned').venues).toMatchObject({ read: 2, unknownCity: 1, invalidRow: 1 });
    expect(city('unassigned').registrations).toMatchObject({
      read: 4,
      ambiguousVenue: 1,
      unmappedVenue: 2,
      invalidRow: 1,
    });
    expect(city('unassigned').subscribers).toMatchObject({ toInsert: 1, venueUnmapped: 1 });
  });

  it('every row falls in exactly one outcome, and cities add up to the totals', async () => {
    const { report } = await run(false);
    const outcomes = {
      venues: [
        'invalidRow',
        'duplicate',
        'unapproved',
        'unknownCity',
        'provinceMismatch',
        'unknownArea',
        'invalidCoordinates',
        'slugConflict',
        'alreadyPresent',
        'toInsert',
      ],
      registrations: [
        'invalidRow',
        'invalidPhone',
        'duplicate',
        'unmappedVenue',
        'ambiguousVenue',
        'alreadyPresent',
        'toInsert',
      ],
      subscribers: ['invalidRow', 'invalidPhone', 'duplicate', 'alreadyPresent', 'toInsert'],
    } as const;
    for (const dataset of ['venues', 'registrations', 'subscribers'] as const) {
      const sum = (counts: Record<string, number>) =>
        outcomes[dataset].reduce((n, key) => n + (counts[key] ?? 0), 0);
      expect(sum(report.totals[dataset])).toBe(report.totals[dataset].read);
      for (const key of ['read', ...outcomes[dataset]]) {
        const across = Object.values(report.cities).reduce((n, c) => n + (c[dataset][key] ?? 0), 0);
        expect(across, `${dataset}.${key}`).toBe(report.totals[dataset][key]);
      }
    }
  });

  it('lists the cities that have rows, and always an unassigned bucket', async () => {
    const { report } = await run(false);
    expect(Object.keys(report.cities).sort()).toEqual(
      [
        'faisalabad',
        'islamabad',
        'lahore',
        'multan',
        'rawalpindi',
        'unassigned',
        'wah-cantt',
      ].sort(),
    );
    const empty = await run(false, { venues: [], registrations: null, subscribers: null });
    expect(Object.keys(empty.report.cities)).toEqual(['unassigned']);
  });

  it('reports what was and was not provided, and what is never carried', async () => {
    const { report } = await run(false, { subscribers: null });
    expect(report.provided).toEqual({ venues: true, registrations: true, subscribers: false });
    expect(report.notCarried).toEqual(['push_subscriptions', 'accounts']);
  });
});

describe('apply', () => {
  it('writes the planned rows and nothing else', async () => {
    const { report } = await run(true);
    expect(report.applied?.inserted).toEqual({
      areas: 9,
      venues: 9,
      registrations: 10,
      subscribers: 4,
    });
    expect(await rowCounts()).toEqual({
      areas: 9,
      venues: 9,
      legacy_registrations: 10,
      legacy_whatsapp_subscribers: 4,
      users: 0, // registrations are never turned into accounts
    });
    expect(await countRows(target, 'cities')).toBe(fixtureCities.length); // none invented
    expect(await countRows(target, 'sessions')).toBe(0);
  });

  it('tags registrations ramadan-2026 and keeps the originals out of accounts', async () => {
    await run(true);
    const rows = await target.pg.query<{
      season_tag: string;
      phone_raw: string;
      city_name: string;
    }>('SELECT season_tag, phone_raw, city_name FROM legacy_registrations');
    expect(new Set(rows.rows.map((r) => r.season_tag))).toEqual(new Set(['ramadan-2026']));
    expect(rows.rows.every((r) => /^\+[1-9][0-9]{7,14}$/.test(r.phone_raw))).toBe(true);
    expect(new Set(rows.rows.map((r) => r.city_name))).toEqual(
      new Set(['Rawalpindi', 'Islamabad', 'Lahore', 'Multan']),
    );
  });

  it('marks every WhatsApp subscriber as needing re-consent, with E.164 numbers', async () => {
    await run(true);
    const rows = await target.pg.query<{
      needs_reconsent: boolean;
      phone_raw: string;
      season_tag: string;
    }>('SELECT needs_reconsent, phone_raw, season_tag FROM legacy_whatsapp_subscribers');
    expect(rows.rows).toHaveLength(4);
    expect(rows.rows.every((r) => r.needs_reconsent === true)).toBe(true);
    expect(rows.rows.every((r) => /^\+92300[0-9]{7}$/.test(r.phone_raw))).toBe(true);
    expect(await countRows(target, 'consents')).toBe(0); // no consent is carried over
  });

  it('carries venues with normalised contacts, valid places and unique slugs', async () => {
    await run(true);
    const rows = await target.pg.query<{
      slug: string;
      contact_phone: string | null;
      name_ur: string;
      name_en: string;
    }>('SELECT slug, contact_phone, name_ur, name_en FROM venues ORDER BY slug');
    expect(rows.rows).toHaveLength(9);
    expect(
      rows.rows.every((r) => r.contact_phone === null || /^\+92[0-9]{9,10}$/.test(r.contact_phone)),
    ).toBe(true);
    // The Urdu column is filled with the English text until an admin writes the Urdu.
    expect(rows.rows.every((r) => r.name_ur === r.name_en)).toBe(true);
    const bilal = rows.rows.filter((r) => r.name_en === 'Sample Masjid Bilal').map((r) => r.slug);
    expect(bilal).toEqual([
      'sample-masjid-bilal-sample-gulgasht',
      'sample-masjid-bilal-sample-johar-town',
    ]);
    const orphaned = await target.pg.query(
      `SELECT 1 FROM venues v LEFT JOIN areas a ON a.id = v.area_id AND a.city_id = v.city_id WHERE a.id IS NULL`,
    );
    expect(orphaned.rows).toHaveLength(0);
  });

  it('keeps push subscriptions out: nothing in the plan or the database refers to them', async () => {
    const { plan, report } = await run(true);
    expect(JSON.stringify(plan).toLowerCase()).not.toContain('push');
    expect(JSON.stringify(report.notCarried)).toContain('push_subscriptions');
    const tablesNamedPush = await target.pg.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name ILIKE '%push%'`,
    );
    expect(tablesNamedPush.rows).toHaveLength(0);
  });
});

describe('idempotency', () => {
  async function dump() {
    const out: Record<string, unknown[]> = {};
    for (const [table, order] of [
      ['areas', 'id'],
      ['venues', 'id'],
      ['legacy_registrations', 'id'],
      ['legacy_whatsapp_subscribers', 'id'],
    ] as const) {
      out[table] = (await target.pg.query(`SELECT * FROM ${table} ORDER BY ${order}`)).rows;
    }
    return out;
  }

  it('applying twice changes nothing the second time', async () => {
    const first = await run(true);
    const afterFirst = await dump();
    const second = await run(true);
    expect(second.report.applied?.inserted).toEqual({
      areas: 0,
      venues: 0,
      registrations: 0,
      subscribers: 0,
    });
    expect(await dump()).toEqual(afterFirst); // same rows, same ids, same timestamps
    expect(second.report.totals.venues).toMatchObject({ toInsert: 0, alreadyPresent: 9 });
    expect(second.report.totals.registrations).toMatchObject({ toInsert: 0, alreadyPresent: 10 });
    expect(second.report.totals.subscribers).toMatchObject({ toInsert: 0, alreadyPresent: 4 });
    expect(second.report.areas.toCreate).toBe(0);
    // The rows that were never importable are still reported the same way.
    expect(second.report.totals.venues.invalidCoordinates).toBe(
      first.report.totals.venues.invalidCoordinates,
    );
  });

  it('a dry run after an apply reports nothing left to do', async () => {
    await run(true);
    const { report } = await run(false);
    expect(report.totals.venues.toInsert).toBe(0);
    expect(report.totals.registrations.toInsert).toBe(0);
    expect(report.totals.subscribers.toInsert).toBe(0);
  });

  it('a later run adds only what is new', async () => {
    await run(true);
    const more = syntheticRegistrations();
    more.push({ ...more[0]!, id: 900, mobile: '923000000999' });
    const { report } = await run(true, { registrations: more });
    expect(report.applied?.inserted.registrations).toBe(1);
    expect(await countRows(target, 'legacy_registrations')).toBe(11);
  });

  it('fixing the mapping and re-running adds the venue that was held back', async () => {
    const first = await run(true);
    expect(first.report.totals.venues.unapproved).toBe(1);
    const csv = syntheticMappingCsv().replace(
      /^(00000000-0000-4000-8000-000000000010,.*),$/m,
      '$1,yes',
    );
    const { report } = await run(true, { mapping: readMapping(parseCsvObjects(csv)) });
    expect(report.applied?.inserted.venues).toBe(1);
    expect(await countRows(target, 'venues')).toBe(10);
    // ...and now the registration at that venue can be placed too.
    expect(report.applied?.inserted.registrations).toBe(1);
  });
});

describe('dry run and apply agree', () => {
  it('produce the same counts', async () => {
    const dry = await run(false);
    const applied = await run(true);
    const strip = (r: typeof dry.report) => ({ ...r, mode: undefined, applied: undefined });
    expect(strip(applied.report)).toEqual(strip(dry.report));
    expect(applied.report.applied?.inserted).toEqual({
      areas: dry.report.areas.toCreate,
      venues: dry.report.totals.venues.toInsert,
      registrations: dry.report.totals.registrations.toInsert,
      subscribers: dry.report.totals.subscribers.toInsert,
    });
  });

  it('agree per city on what was inserted', async () => {
    const dry = await run(false);
    const applied = await run(true);
    for (const [slug, counts] of Object.entries(dry.report.cities)) {
      expect(applied.report.applied?.insertedByCity[slug]?.venues ?? 0).toBe(
        counts.venues.toInsert,
      );
      expect(applied.report.applied?.insertedByCity[slug]?.registrations ?? 0).toBe(
        counts.registrations.toInsert,
      );
    }
  });

  it('the offline dry run matches the database dry run on an empty target', async () => {
    const offline = await run(false, {}, null);
    const database = await run(false);
    expect({ ...offline.report, target: undefined }).toEqual({
      ...database.report,
      target: undefined,
    });
  });
});

describe('one transaction, rolled back on any error', () => {
  const statements = [
    ['areas', 'INSERT INTO areas'],
    ['venues', 'INSERT INTO venues'],
    ['registrations', 'INSERT INTO legacy_registrations'],
    ['subscribers', 'INSERT INTO legacy_whatsapp_subscribers'],
  ] as const;

  it.each(statements)(
    'a failure while inserting %s leaves the database untouched',
    async (_name, fragment) => {
      const before = await rowCounts();
      const failing: SqlExecutor = {
        exec: (sql) => target.exec.exec(sql),
        query: async (sql, params) => {
          if (sql.includes(fragment))
            throw new Error('injected failure Test Person 1 +923000000101');
          return target.exec.query(sql, params);
        },
      };
      await expect(run(true, {}, failing)).rejects.toThrow('injected failure');
      expect(await rowCounts()).toEqual(before);
      // The connection is usable afterwards: no transaction was left open.
      const ok = await run(true);
      expect(ok.report.applied?.inserted.venues).toBe(9);
    },
  );

  it('a failure on COMMIT also rolls back', async () => {
    const before = await rowCounts();
    const failing: SqlExecutor = {
      exec: async (sql) => {
        if (sql === 'COMMIT') throw new Error('injected commit failure');
        await target.exec.exec(sql);
      },
      query: (sql, params) => target.exec.query(sql, params),
    };
    await expect(run(true, {}, failing)).rejects.toThrow('injected commit failure');
    expect(await rowCounts()).toEqual(before);
  });

  it('a real database constraint violation rolls back everything before it', async () => {
    const before = await rowCounts();
    // Registration 1 would violate the party_size check if it were negative; build one that does.
    const bad = syntheticRegistrations();
    const failing: SqlExecutor = {
      exec: (sql) => target.exec.exec(sql),
      query: async (sql, params) => {
        if (sql.includes('INSERT INTO legacy_registrations')) {
          // Force a genuine constraint violation by sending a negative party size.
          const patched = [...(params ?? [])];
          patched[6] = -1;
          return target.exec.query(sql, patched);
        }
        return target.exec.query(sql, params);
      },
    };
    await expect(run(true, { registrations: bad }, failing)).rejects.toMatchObject({
      code: '23514',
    });
    expect(await rowCounts()).toEqual(before);
  });

  it('an unapproved apply is refused before anything is written', async () => {
    const before = await rowCounts();
    await expect(
      runMigration({
        db: target.exec,
        apply: true,
        now: NOW,
        input: input(),
        beforeApply: () => {
          throw new MigrationToolError('not_approved', 'no');
        },
      }),
    ).rejects.toMatchObject({ code: 'not_approved' });
    expect(await rowCounts()).toEqual(before);
  });
});

describe('places are never invented', () => {
  it('without --create-areas, unknown areas are reported and nothing is created', async () => {
    const { report } = await run(true, { createAreas: false });
    // Every approved venue in a known city: the nine importable ones plus the swapped-coordinates one.
    expect(report.totals.venues.unknownArea).toBe(10);
    expect(report.totals.venues.toInsert).toBe(0);
    expect(await countRows(target, 'areas')).toBe(0);
    expect(await countRows(target, 'venues')).toBe(0);
    expect(await countRows(target, 'cities')).toBe(fixtureCities.length);
    // Registrations cannot be placed in a city without a venue, but venue cities are known.
    expect(report.totals.registrations.toInsert).toBeGreaterThan(0);
  });

  it('a city that V2 does not have is reported, never created', async () => {
    const { report, plan } = await run(true);
    expect(report.totals.venues.unknownCity).toBe(1);
    expect(plan.venues.every((v) => v.citySlug !== 'karachi')).toBe(true);
    const karachi = await target.pg.query(`SELECT 1 FROM cities WHERE slug = 'karachi'`);
    expect(karachi.rows).toHaveLength(0);
  });

  it('a province that disagrees with the city is held back', async () => {
    const csv = syntheticMappingCsv().replace(/,PB,rawalpindi,/g, ',KP,rawalpindi,');
    const { report } = await run(false, { mapping: readMapping(parseCsvObjects(csv)) });
    expect(report.totals.venues.provinceMismatch).toBe(2);
  });

  it('with no mapping at all, every venue is unapproved and nothing is inserted', async () => {
    const { report } = await run(true, { mapping: null });
    expect(report.totals.venues.unapproved).toBe(12); // all but the duplicate and the blank one
    expect(report.totals.venues.toInsert).toBe(0);
    expect(report.totals.registrations.toInsert).toBe(0);
    expect(await countRows(target, 'venues')).toBe(0);
  });

  it('a venue that already exists in V2 is neither duplicated nor overwritten', async () => {
    await run(true);
    await target.pg.query(
      `UPDATE venues SET contact_phone = '+923009999999', name_ur = 'edited by an admin' WHERE slug = 'sample-masjid-al-noor'`,
    );
    await run(true);
    const row = await target.pg.query<{ contact_phone: string; name_ur: string }>(
      `SELECT contact_phone, name_ur FROM venues WHERE slug = 'sample-masjid-al-noor'`,
    );
    expect(row.rows[0]).toEqual({ contact_phone: '+923009999999', name_ur: 'edited by an admin' });
    expect(await countRows(target, 'venues')).toBe(9);
  });

  it('a slug used by a different venue is flagged, not overwritten', async () => {
    const lahore = (
      await target.pg.query<{ id: string }>(`SELECT id FROM cities WHERE slug = 'lahore'`)
    ).rows[0]!.id;
    await target.pg.query(
      `INSERT INTO areas (city_id, slug, name_en, name_ur) VALUES ($1, 'x', 'X', 'X')`,
      [lahore],
    );
    const area = (await target.pg.query<{ id: string }>(`SELECT id FROM areas WHERE slug = 'x'`))
      .rows[0]!.id;
    await target.pg.query(
      `INSERT INTO venues (city_id, area_id, slug, name_en, name_ur, address_en, address_ur)
       VALUES ($1, $2, 'sample-masjid-al-noor', 'Someone else', 'x', 'elsewhere', 'x')`,
      [lahore, area],
    );
    const { report } = await run(true);
    expect(report.totals.venues.slugConflict).toBe(1);
    expect(report.totals.venues.toInsert).toBe(8);
  });
});

describe('approval fingerprint', () => {
  it('is stable for the same plan and changes when the data does', async () => {
    const a = await run(false);
    const b = await run(false);
    const digests = { venues: 'aaaa' };
    expect(planFingerprint(a.report, digests)).toBe(planFingerprint(b.report, digests));
    expect(planFingerprint(a.report, { venues: 'bbbb' })).not.toBe(
      planFingerprint(a.report, digests),
    );
    const fewer = await run(false, { subscribers: syntheticSubscribers().slice(0, 2) });
    expect(planFingerprint(fewer.report, digests)).not.toBe(planFingerprint(a.report, digests));
  });

  it('does not depend on the time or the mode', async () => {
    const dry = await run(false);
    const later = await runMigration({
      db: target.exec,
      apply: false,
      now: new Date('2030-01-01T00:00:00Z'),
      input: input(),
    });
    expect(planFingerprint(later.report, {})).toBe(planFingerprint(dry.report, {}));
  });
});

describe('verification of counts before and after', () => {
  it('passes after a clean apply', async () => {
    const before = await takeSnapshot(target.exec, NOW);
    const { report } = await run(true);
    const after = await takeSnapshot(target.exec, NOW);
    const result = verifySnapshots({
      before,
      after,
      inserted: report.applied!.inserted,
      insertedByCity: report.applied!.insertedByCity,
    });
    expect(result.checks.filter((c) => !c.ok)).toEqual([]);
    expect(result.ok).toBe(true);
    expect(after.cities.rawalpindi).toMatchObject({ venues: 2, legacyRegistrations: 6 });
  });

  it('the snapshot taken inside the apply equals the one taken just before it', async () => {
    const before = await takeSnapshot(target.exec, NOW);
    const result = await run(true);
    expect(result.before).toEqual(before);
  });

  it('passes after an idempotent re-run (nothing added)', async () => {
    await run(true);
    const before = await takeSnapshot(target.exec, NOW);
    const { report } = await run(true);
    const after = await takeSnapshot(target.exec, NOW);
    expect(
      verifySnapshots({
        before,
        after,
        inserted: report.applied!.inserted,
        insertedByCity: report.applied!.insertedByCity,
      }).ok,
    ).toBe(true);
  });

  it('fails when rows appear that the report did not insert, or an account is created', async () => {
    const before = await takeSnapshot(target.exec, NOW);
    const { report } = await run(true);
    await target.pg.query(
      `INSERT INTO legacy_whatsapp_subscribers (phone_raw, needs_reconsent) VALUES ('+923000000999', false)`,
    );
    await target.pg.query(
      `INSERT INTO users (phone_e164, phone_verified_at, display_name) VALUES ('+923000000998', now(), 'Test Person')`,
    );
    const after = await takeSnapshot(target.exec, NOW);
    const result = verifySnapshots({
      before,
      after,
      inserted: report.applied!.inserted,
      insertedByCity: report.applied!.insertedByCity,
    });
    expect(result.ok).toBe(false);
    const failed = result.checks.filter((c) => !c.ok).map((c) => c.name);
    expect(failed).toEqual(
      expect.arrayContaining([
        'legacy subscribers added',
        'accounts created (must be none)',
        'subscribers not marked for re-consent (must be none)',
      ]),
    );
  });
});
