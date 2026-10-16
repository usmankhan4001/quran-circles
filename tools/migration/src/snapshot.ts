import type { SqlExecutor } from '@qc/db';
import { z } from 'zod';
import { SEASON_TAG, UNASSIGNED } from './constants';

/** Counts only: how many rows the V2 database holds, per city and in total. */
export const SnapshotSchema = z.strictObject({
  schemaVersion: z.literal(1),
  takenAt: z.iso.datetime(),
  cities: z.record(
    z.string(),
    z.strictObject({
      venues: z.number().int().min(0),
      areas: z.number().int().min(0),
      sessions: z.number().int().min(0),
      legacyRegistrations: z.number().int().min(0),
    }),
  ),
  totals: z.strictObject({
    venues: z.number().int().min(0),
    areas: z.number().int().min(0),
    sessions: z.number().int().min(0),
    users: z.number().int().min(0),
    legacyRegistrations: z.number().int().min(0),
    legacySubscribers: z.number().int().min(0),
    subscribersWithoutReconsentFlag: z.number().int().min(0),
  }),
});
export type Snapshot = z.infer<typeof SnapshotSchema>;

const num = (value: unknown): number => Number(value ?? 0);

/** Takes a snapshot. Counts only. */
export async function takeSnapshot(db: SqlExecutor, now: Date = new Date()): Promise<Snapshot> {
  const cities: Snapshot['cities'] = {};
  const ensure = (slug: string) =>
    (cities[slug] ??= { venues: 0, areas: 0, sessions: 0, legacyRegistrations: 0 });

  const allCities = await db.query<{ slug: string }>('SELECT slug FROM cities');
  for (const c of allCities.rows) ensure(c.slug);

  const venues = await db.query<{ slug: string; n: string }>(
    `SELECT c.slug, count(*)::text AS n FROM venues v JOIN cities c ON c.id = v.city_id GROUP BY c.slug`,
  );
  for (const r of venues.rows) ensure(r.slug).venues = num(r.n);

  const areas = await db.query<{ slug: string; n: string }>(
    `SELECT c.slug, count(*)::text AS n FROM areas a JOIN cities c ON c.id = a.city_id GROUP BY c.slug`,
  );
  for (const r of areas.rows) ensure(r.slug).areas = num(r.n);

  const sessions = await db.query<{ slug: string; n: string }>(
    `SELECT c.slug, count(*)::text AS n
       FROM sessions s JOIN venues v ON v.id = s.venue_id JOIN cities c ON c.id = v.city_id
      GROUP BY c.slug`,
  );
  for (const r of sessions.rows) ensure(r.slug).sessions = num(r.n);

  // Legacy rows carry the city's English name, not an id.
  const legacy = await db.query<{ slug: string | null; n: string }>(
    `SELECT c.slug, count(*)::text AS n
       FROM legacy_registrations l LEFT JOIN cities c ON c.name_en = l.city_name
      WHERE l.season_tag = $1 GROUP BY c.slug`,
    [SEASON_TAG],
  );
  for (const r of legacy.rows) ensure(r.slug ?? UNASSIGNED).legacyRegistrations = num(r.n);

  const one = async (sql: string, params?: unknown[]): Promise<number> => {
    const r = await db.query<{ n: string }>(sql, params);
    return num(r.rows[0]?.n);
  };
  const sum = (key: keyof Snapshot['cities'][string]) =>
    Object.values(cities).reduce((total, c) => total + c[key], 0);

  return {
    schemaVersion: 1,
    takenAt: now.toISOString(),
    cities,
    totals: {
      venues: sum('venues'),
      areas: sum('areas'),
      sessions: sum('sessions'),
      users: await one('SELECT count(*)::text AS n FROM users'),
      legacyRegistrations: await one(
        'SELECT count(*)::text AS n FROM legacy_registrations WHERE season_tag = $1',
        [SEASON_TAG],
      ),
      legacySubscribers: await one(
        'SELECT count(*)::text AS n FROM legacy_whatsapp_subscribers WHERE season_tag = $1',
        [SEASON_TAG],
      ),
      subscribersWithoutReconsentFlag: await one(
        'SELECT count(*)::text AS n FROM legacy_whatsapp_subscribers WHERE season_tag = $1 AND needs_reconsent = false',
        [SEASON_TAG],
      ),
    },
  };
}

export interface VerifyInput {
  before: Snapshot;
  after: Snapshot;
  /** What the apply report says it inserted. */
  inserted: {
    areas: number;
    venues: number;
    registrations: number;
    subscribers: number;
  };
  insertedByCity: Record<string, { venues: number; registrations: number }>;
}

export interface VerifyResult {
  ok: boolean;
  /** Short, fixed-vocabulary lines. Counts and city slugs only. */
  checks: { name: string; ok: boolean; expected: number; actual: number }[];
}

/** Compares snapshots with what the apply report says it did. */
export function verifySnapshots(input: VerifyInput): VerifyResult {
  const checks: VerifyResult['checks'] = [];
  const check = (name: string, expected: number, actual: number) =>
    checks.push({ name, ok: expected === actual, expected, actual });

  const { before, after, inserted, insertedByCity } = input;
  check('areas added', inserted.areas, after.totals.areas - before.totals.areas);
  check('venues added', inserted.venues, after.totals.venues - before.totals.venues);
  check(
    'legacy registrations added',
    inserted.registrations,
    after.totals.legacyRegistrations - before.totals.legacyRegistrations,
  );
  check(
    'legacy subscribers added',
    inserted.subscribers,
    after.totals.legacySubscribers - before.totals.legacySubscribers,
  );
  check('sessions unchanged', 0, after.totals.sessions - before.totals.sessions);
  check('accounts created (must be none)', 0, after.totals.users - before.totals.users);
  check(
    'subscribers not marked for re-consent (must be none)',
    0,
    after.totals.subscribersWithoutReconsentFlag,
  );

  const slugs = new Set([...Object.keys(before.cities), ...Object.keys(after.cities)]);
  for (const slug of [...slugs].sort()) {
    const b = before.cities[slug];
    const a = after.cities[slug];
    const planned = insertedByCity[slug];
    check(`${slug}: venues added`, planned?.venues ?? 0, (a?.venues ?? 0) - (b?.venues ?? 0));
    check(
      `${slug}: legacy registrations added`,
      planned?.registrations ?? 0,
      (a?.legacyRegistrations ?? 0) - (b?.legacyRegistrations ?? 0),
    );
  }
  return { ok: checks.every((c) => c.ok), checks };
}
