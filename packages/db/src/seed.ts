import { count, getTableName } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT, PgTable } from 'drizzle-orm/pg-core';
import { TEMPLATES, TEMPLATE_KEYS, templatePlaceholders } from '@qc/contracts';
import * as fixtures from '@qc/contracts/fixtures';
import * as schema from './schema/index';

/**
 * Development and staging seed, built from the synthetic contract fixtures
 * (`@qc/contracts/fixtures`), the same data the mock server serves. It uses the fixtures' ids,
 * so the mock server, the API tests and a seeded database agree.
 *
 * What it inserts: provinces (the cities' foreign key needs them), cities, areas, venues,
 * programs, seasons, circles, sessions, occurrences, content pages, the feed updates, and the
 * message template catalog.
 * What it never inserts: users, phone numbers, registrations, OTPs, consents, devices,
 * sessions of sign-in, follows or any other person-like row. Venue contact numbers are the
 * fixtures' synthetic +92300000000x numbers (venue-public, not people).
 * It refuses to run when APP_ENV or NODE_ENV is "production". There is no override.
 *
 * Idempotent: every insert is ON CONFLICT DO NOTHING (primary key or natural key), so a second
 * run adds nothing. Existing rows are never updated. It runs in one transaction.
 *
 * Dates (integration finding F-07): the fixtures are dated around `FIXTURE_NOW`, Monday
 * 15 February 2027. With an `anchor`, every date and instant is moved by a whole number of weeks
 * so that the fixtures' first day lands on the Monday (Pakistan date) of the anchor's week: the
 * seeded occurrences then cover this week and next week, the season runs around them, and the
 * feed updates are a few days old. Whole weeks keep every weekday, and Pakistan has no daylight
 * saving, so wall-clock times stay as they are. Without an anchor the fixture dates are kept
 * unchanged (tests and the mock server). The CLI anchors on today unless told otherwise. A rerun
 * with another anchor still adds nothing: the ids are the same.
 *
 * Mapping notes, where a fixture field and a column do not line up:
 * - Localized `{ en, ur: null }`: NOT NULL Urdu columns (names, addresses, titles) fall back to
 *   the English text; nullable Urdu columns (descriptions, entrance notes, update and page
 *   titles and bodies) keep null.
 * - Programs, seasons and sessions carry no `description` fixture: description columns get null.
 * - `Session.registration.seatsTaken` and `full` have no column. Seats taken are counted from
 *   registrations, which are never seeded, so the sample "full" session (Women Dora) shows
 *   0 taken in a seeded database. `capacityEnabled` is true exactly when a capacity is set.
 * - `registrationEnabled` is true for every session (the fixtures say so); `status` is
 *   'published'.
 * - `AdminCircle.cityId` has no column (the city comes from the venue). `createdBy` and
 *   `approvedBy` stay null because there are no users; `approvedAt` is kept.
 * - Fixture times are UTC instants already, produced from Pakistan wall-clock time (UTC+5, no
 *   daylight saving). Session `localStartTime` is the wall-clock value, `timezone` is
 *   Asia/Karachi, `daysOfWeek` is 0 (Sunday) to 6 as the schema expects. Seasons and session
 *   dates are plain dates.
 * - Cities have no `isActive` fixture: they take the column default (true). Updates have no
 *   expiry fixture (null); `isRead` is per person and has no column.
 * - Message templates: one row per template key and locale (16 rows). `channel` is the
 *   template's first (preferred) channel, because the table holds one channel per row.
 *   `status` is always 'draft': the English wording is not approved by Meta or the admins
 *   either, and the Urdu lines are drafts that a native speaker still has to review. Nothing
 *   here marks anything approved or sets approved_by/approved_at. `variables` is the list of
 *   placeholder names in that locale's body.
 */

/** Any Drizzle Postgres database: node-postgres in the CLI, PGlite in tests. */
export type SeedDatabase = PgDatabase<PgQueryResultHKT, typeof schema>;

export interface SeedOptions {
  /** Environment to check for production. Defaults to `process.env`. */
  env?: Readonly<Record<string, string | undefined>>;
  /** Move the fixture dates to the week of this instant. Omitted: the fixture dates as they are. */
  anchor?: Date;
}

export interface SeedRowOptions {
  anchor?: Date | undefined;
}

export interface SeedTableResult {
  table: string;
  /** Rows this run added. Zero on a rerun. */
  inserted: number;
  /** Rows now in the table. */
  total: number;
}

export interface SeedResult {
  tables: SeedTableResult[];
}

/** Thrown when the seed is asked to run against production. */
export class SeedRefusedError extends Error {
  constructor(variable: string) {
    super(
      `Refusing to seed: ${variable} is "production". The seed is for development and staging only.`,
    );
    this.name = 'SeedRefusedError';
  }
}

/** Throws unless neither APP_ENV nor NODE_ENV says production. */
export function assertSeedAllowed(
  env: Readonly<Record<string, string | undefined>> = process.env,
): void {
  for (const variable of ['APP_ENV', 'NODE_ENV']) {
    if (env[variable]?.trim().toLowerCase() === 'production') throw new SeedRefusedError(variable);
  }
}

const orEnglish = (l: { en: string; ur: string | null }): string => l.ur ?? l.en;

const MS_PER_DAY = 24 * 60 * 60 * 1000;
/** Pakistan is UTC+5 all year. */
const PKT_OFFSET_MS = 5 * 60 * 60 * 1000;

/**
 * Days to move the fixtures by for `anchor`: a whole number of weeks that puts the fixtures'
 * first day (the Pakistan date of `FIXTURE_NOW`, a Monday) on the Monday of the anchor's week.
 */
export function seedShiftDays(anchor: Date): number {
  if (Number.isNaN(anchor.getTime())) throw new Error('The seed anchor is not a valid date.');
  const pktDay = (t: number) => Math.floor((t + PKT_OFFSET_MS) / MS_PER_DAY);
  const days = pktDay(anchor.getTime()) - pktDay(Date.parse(fixtures.FIXTURE_NOW));
  return Math.floor(days / 7) * 7;
}

/** Moves fixture dates and instants by `days`. Fixture times are UTC instants already. */
function dateShifter(days: number) {
  const ms = days * MS_PER_DAY;
  const instant = (iso: string): Date => new Date(Date.parse(iso) + ms);
  const date = (ymd: string): string => instant(`${ymd}T00:00:00Z`).toISOString().slice(0, 10);
  const maybeDate = (ymd: string | null): string | null => (ymd === null ? null : date(ymd));
  return { instant, date, maybeDate };
}

const programIdByKey = (key: string): string => {
  const found = fixtures.programs.find((p) => p.key === key);
  if (!found) throw new Error(`Fixture program "${key}" not found`);
  return found.id;
};

/**
 * The rows the seed inserts, in foreign key order. Pure data; exported for tests. With an
 * `anchor` the dates are moved to that week (see the notes at the top).
 */
export function buildSeedRows(options: SeedRowOptions = {}) {
  const { instant, date, maybeDate } = dateShifter(
    options.anchor ? seedShiftDays(options.anchor) : 0,
  );
  const provinces: (typeof schema.provinces.$inferInsert)[] = fixtures.provinces.map((p) => ({
    id: p.id,
    code: p.code,
    nameEn: p.name.en,
    nameUr: orEnglish(p.name),
  }));

  const cities: (typeof schema.cities.$inferInsert)[] = fixtures.cities.map((c) => ({
    id: c.id,
    provinceId: c.provinceId,
    slug: c.slug,
    nameEn: c.name.en,
    nameUr: orEnglish(c.name),
    timezone: c.timezone,
  }));

  const areas: (typeof schema.areas.$inferInsert)[] = fixtures.areas.map((a) => ({
    id: a.id,
    cityId: a.cityId,
    slug: a.slug,
    nameEn: a.name.en,
    nameUr: orEnglish(a.name),
    lat: a.lat,
    lng: a.lng,
  }));

  const venues: (typeof schema.venues.$inferInsert)[] = fixtures.venues.map((v) => ({
    id: v.id,
    cityId: v.cityId,
    areaId: v.areaId,
    slug: v.slug,
    nameEn: v.name.en,
    nameUr: orEnglish(v.name),
    addressEn: v.address.en,
    addressUr: orEnglish(v.address),
    lat: v.lat,
    lng: v.lng,
    contactPhone: v.contactPhone,
    hasWomenSection: v.facilities.womenSection,
    hasParking: v.facilities.parking,
    hasWuduArea: v.facilities.wuduArea,
    hasElderWheelchairAccess: v.facilities.elderWheelchairAccess,
    isChildFriendly: v.facilities.childFriendly,
    entranceNotesEn: v.facilities.entranceNotes?.en ?? null,
    entranceNotesUr: v.facilities.entranceNotes?.ur ?? null,
    status: v.status,
  }));

  const programs: (typeof schema.programs.$inferInsert)[] = fixtures.programs.map((p) => ({
    id: p.id,
    key: p.key,
    nameEn: p.name.en,
    nameUr: orEnglish(p.name),
  }));

  const seasons: (typeof schema.seasons.$inferInsert)[] = fixtures.seasons.map((s) => ({
    id: s.id,
    programId: s.programId,
    name: s.name,
    startsOn: date(s.startsOn),
    endsOn: date(s.endsOn),
    hijriYear: s.hijriYear,
    isActive: s.isActive,
  }));

  const circles: (typeof schema.circles.$inferInsert)[] = fixtures.circles.map((c) => ({
    id: c.id,
    venueId: c.venueId,
    nameEn: c.name.en,
    nameUr: orEnglish(c.name),
    teacherName: c.teacherName,
    descriptionEn: c.description?.en ?? null,
    descriptionUr: c.description?.ur ?? null,
    language: c.language,
    section: c.section,
    onlineLink: c.onlineLink,
    status: c.status,
    approvedAt: c.approvedAt ? instant(c.approvedAt) : null,
    createdAt: instant(c.createdAt),
  }));

  const sessions: (typeof schema.sessions.$inferInsert)[] = fixtures.sessions.map((s) => ({
    id: s.id,
    programId: programIdByKey(s.program),
    seasonId: s.seasonId,
    venueId: s.venueId,
    circleId: s.circle?.id ?? null,
    kind: s.kind,
    titleEn: s.title.en,
    titleUr: orEnglish(s.title),
    descriptionEn: s.description?.en ?? null,
    descriptionUr: s.description?.ur ?? null,
    section: s.section,
    language: s.language,
    localStartTime: s.localStartTime,
    durationMinutes: s.durationMinutes,
    daysOfWeek: s.daysOfWeek,
    startsOn: date(s.startsOn),
    endsOn: maybeDate(s.endsOn),
    timezone: s.timezone,
    capacityEnabled: s.registration.capacity !== null,
    capacity: s.registration.capacity,
    registrationEnabled: s.registration.enabled,
    status: s.status,
  }));

  const occurrences: (typeof schema.occurrences.$inferInsert)[] = fixtures.occurrences.map((o) => ({
    id: o.id,
    sessionId: o.sessionId,
    startsAt: instant(o.startsAt),
    endsAt: instant(o.endsAt),
    status: o.status,
    portion: o.portion,
    portionLabel: o.portionLabel,
    recapNote: o.recapNote,
    recapLocale: o.recapLocale,
    headcount: o.headcount,
  }));

  const contentPages: (typeof schema.contentPages.$inferInsert)[] = fixtures.contentPages.map(
    (p) => ({
      slug: p.slug,
      titleEn: p.title.en,
      titleUr: p.title.ur,
      bodyEn: p.body.en,
      bodyUr: p.body.ur,
      status: 'published',
      publishedAt: instant(p.publishedAt),
    }),
  );

  const updates: (typeof schema.updates.$inferInsert)[] = fixtures.fixtureUpdates.map((u) => ({
    id: u.id,
    scopeType: u.scope.type,
    cityId: u.scope.cityId,
    venueId: u.scope.venueId,
    kind: u.kind,
    titleEn: u.title.en,
    titleUr: u.title.ur,
    bodyEn: u.body.en,
    bodyUr: u.body.ur,
    sessionId: u.sessionId,
    publishAt: instant(u.publishedAt),
  }));

  const messageTemplates: (typeof schema.messageTemplates.$inferInsert)[] = TEMPLATE_KEYS.flatMap(
    (key) => {
      const def = TEMPLATES[key];
      return (['en', 'ur'] as const).map((locale) => ({
        key,
        channel: def.channels[0]!,
        locale,
        body: def.body[locale],
        variables: templatePlaceholders(def.body[locale]),
        waTemplateName: def.waTemplateName,
        costCategory: def.costCategory,
        // Never 'approved': approval is a human step, and Urdu is a draft until a native
        // speaker signs it off.
        status: 'draft' as const,
      }));
    },
  );

  return {
    provinces,
    cities,
    areas,
    venues,
    programs,
    seasons,
    circles,
    sessions,
    occurrences,
    contentPages,
    updates,
    messageTemplates,
  };
}

/**
 * Inserts the synthetic development data. Safe to run again: it adds nothing the second time.
 * Throws `SeedRefusedError` before touching the database when the environment is production.
 */
export async function seedDatabase(
  db: SeedDatabase,
  options: SeedOptions = {},
): Promise<SeedResult> {
  assertSeedAllowed(options.env ?? process.env);
  const rows = buildSeedRows({ anchor: options.anchor });

  const plan: [PgTable, readonly Record<string, unknown>[]][] = [
    [schema.provinces, rows.provinces],
    [schema.cities, rows.cities],
    [schema.areas, rows.areas],
    [schema.venues, rows.venues],
    [schema.programs, rows.programs],
    [schema.seasons, rows.seasons],
    [schema.circles, rows.circles],
    [schema.sessions, rows.sessions],
    [schema.occurrences, rows.occurrences],
    [schema.contentPages, rows.contentPages],
    [schema.updates, rows.updates],
    [schema.messageTemplates, rows.messageTemplates],
  ];

  const tables = await db.transaction(async (tx) => {
    const results: SeedTableResult[] = [];
    for (const [table, values] of plan) {
      const before = await rowCount(tx, table);
      if (values.length > 0)
        await tx
          .insert(table)
          .values([...values])
          .onConflictDoNothing();
      const total = await rowCount(tx, table);
      results.push({ table: getTableName(table), inserted: total - before, total });
    }
    return results;
  });
  return { tables };
}

async function rowCount(db: Pick<SeedDatabase, 'select'>, table: PgTable): Promise<number> {
  const [row] = await db.select({ n: count() }).from(table);
  return Number(row?.n ?? 0);
}
