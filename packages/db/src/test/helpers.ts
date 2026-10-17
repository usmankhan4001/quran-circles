import { PGlite } from '@electric-sql/pglite';
import { is } from 'drizzle-orm';
import { drizzle, type PgliteDatabase } from 'drizzle-orm/pglite';
import { PgTable } from 'drizzle-orm/pg-core';
import { migrateUp, pgliteExecutor, type SqlExecutor } from '../migrate';
import * as schema from '../schema/index';
import { guardTransactions } from '../testing/tx-guard';

export type TestDatabase = PgliteDatabase<typeof schema>;

export interface TestDb {
  /** The raw PGlite instance, for catalog queries and hand-written SQL. */
  pg: PGlite;
  /** The migration runner's view of the same connection. */
  exec: SqlExecutor;
  /** Drizzle on the same connection, for typed inserts. */
  db: TestDatabase;
}

/**
 * A fresh in-process Postgres with no tables. Transactions refuse overlapping queries, as
 * node-postgres 9 will (see `testing/tx-guard.ts`).
 */
export function createEmptyDb(): TestDb {
  const pg = guardTransactions(new PGlite());
  return { pg, exec: pgliteExecutor(pg), db: drizzle(pg, { schema }) };
}

/** Drops everything in the public schema so a shared instance can be reused (booting costs seconds). */
export async function resetDb(test: Pick<TestDb, 'exec'>): Promise<void> {
  await test.exec.exec('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
}

/** A fresh in-process Postgres with every migration applied. */
export async function createMigratedDb(): Promise<TestDb> {
  const test = createEmptyDb();
  await migrateUp(test.exec);
  return test;
}

export interface Violation {
  /** SQLSTATE: 23505 unique, 23514 check, 23502 not null, 23503 foreign key. */
  code: string;
  constraint?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/** Finds the Postgres error inside whatever Drizzle or PGlite wrapped it in. */
function findPgError(error: unknown): Violation | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && isRecord(current); depth++) {
    if (typeof current.code === 'string' && /^[0-9A-Z]{5}$/.test(current.code)) {
      return {
        code: current.code,
        ...(typeof current.constraint === 'string' ? { constraint: current.constraint } : {}),
      };
    }
    current = current.cause;
  }
  return undefined;
}

/** Runs a statement that must fail with a database error, and returns what failed. */
export async function violation(statement: PromiseLike<unknown>): Promise<Violation> {
  try {
    await statement;
  } catch (error) {
    const found = findPgError(error);
    if (!found) throw error;
    return found;
  }
  throw new Error('Expected the database to reject the statement, but it succeeded');
}

export const UNIQUE_VIOLATION = '23505';
export const CHECK_VIOLATION = '23514';
export const NOT_NULL_VIOLATION = '23502';
export const FOREIGN_KEY_VIOLATION = '23503';

let phoneCounter = 0;
let slugCounter = 0;

/** Synthetic E.164 numbers: +923000000001, +923000000002, ... Never a real person. */
export const nextPhone = () => `+92300${String(++phoneCounter).padStart(7, '0')}`;
export const nextSlug = (prefix: string) => `${prefix}-${++slugCounter}`;

/** Row factories with sensible synthetic defaults. */
export function factory({ db }: Pick<TestDb, 'db'>) {
  const first = async <T>(rows: Promise<T[]>): Promise<T> => {
    const [row] = await rows;
    if (!row) throw new Error('insert returned no row');
    return row;
  };
  const s = schema;
  return {
    province: (v: Partial<schema.NewProvinceRow> = {}) =>
      first(
        db
          .insert(s.provinces)
          .values({ code: nextSlug('P'), nameEn: 'Test Province', nameUr: 'ٹیسٹ صوبہ', ...v })
          .returning(),
      ),
    city: async (v: Partial<schema.NewCityRow> = {}) =>
      first(
        db
          .insert(s.cities)
          .values({
            provinceId: v.provinceId ?? (await first(factoryProvince(db))).id,
            slug: nextSlug('city'),
            nameEn: 'Test City',
            nameUr: 'ٹیسٹ شہر',
            ...v,
          })
          .returning(),
      ),
    area: (cityId: string, v: Partial<schema.NewAreaRow> = {}) =>
      first(
        db
          .insert(s.areas)
          .values({
            cityId,
            slug: nextSlug('area'),
            nameEn: 'Test Area',
            nameUr: 'ٹیسٹ علاقہ',
            ...v,
          })
          .returning(),
      ),
    venue: (cityId: string, areaId: string, v: Partial<schema.NewVenueRow> = {}) =>
      first(
        db
          .insert(s.venues)
          .values({
            cityId,
            areaId,
            slug: nextSlug('venue'),
            nameEn: 'Test Masjid',
            nameUr: 'ٹیسٹ مسجد',
            addressEn: '1 Test Road',
            addressUr: '۱ ٹیسٹ روڈ',
            ...v,
          })
          .returning(),
      ),
    user: (v: Partial<schema.NewUserRow> = {}) =>
      first(
        db
          .insert(s.users)
          .values({
            phoneE164: nextPhone(),
            phoneVerifiedAt: new Date('2026-01-01T00:00:00Z'),
            displayName: 'Test Person',
            ...v,
          })
          .returning(),
      ),
    program: async (key: schema.NewProgramRow['key'] = 'circles') => {
      const existing = await db.select().from(s.programs);
      const found = existing.find((p) => p.key === key);
      if (found) return found;
      return first(
        db
          .insert(s.programs)
          .values({ key, nameEn: `Program ${key}`, nameUr: `پروگرام ${key}` })
          .returning(),
      );
    },
    session: (venueId: string, programId: string, v: Partial<schema.NewSessionRow> = {}) =>
      first(
        db
          .insert(s.sessions)
          .values({
            venueId,
            programId,
            kind: 'recurring',
            titleEn: 'Weekly tafsir',
            titleUr: 'ہفتہ وار تفسیر',
            section: 'family',
            language: 'ur',
            localStartTime: '19:30',
            durationMinutes: 60,
            daysOfWeek: [5],
            startsOn: '2026-03-01',
            ...v,
          })
          .returning(),
      ),
    occurrence: (sessionId: string, v: Partial<schema.NewOccurrenceRow> = {}) =>
      first(
        db
          .insert(s.occurrences)
          .values({
            sessionId,
            startsAt: new Date('2026-03-06T14:30:00Z'),
            endsAt: new Date('2026-03-06T15:30:00Z'),
            ...v,
          })
          .returning(),
      ),
    circle: (venueId: string, v: Partial<schema.NewCircleRow> = {}) =>
      first(
        db
          .insert(s.circles)
          .values({ venueId, nameEn: 'Test Circle', nameUr: 'ٹیسٹ حلقہ', language: 'ur', ...v })
          .returning(),
      ),
    registration: (
      userId: string | null,
      sessionId: string,
      areaId: string,
      v: Partial<schema.NewRegistrationRow> = {},
    ) =>
      first(
        db
          .insert(s.registrations)
          .values({ userId, sessionId, areaId, section: 'family', partySize: 1, ...v })
          .returning(),
      ),
  };
}

function factoryProvince(db: TestDatabase) {
  return db
    .insert(schema.provinces)
    .values({ code: nextSlug('P'), nameEn: 'Test Province', nameUr: 'ٹیسٹ صوبہ' })
    .returning();
}

/** A small place hierarchy plus a program and a session, for tests that need a world. */
export async function buildWorld(test: Pick<TestDb, 'db'>) {
  const make = factory(test);
  const city = await make.city();
  const area = await make.area(city.id);
  const venue = await make.venue(city.id, area.id);
  const program = await make.program('circles');
  const session = await make.session(venue.id, program.id);
  return { make, city, area, venue, program, session };
}

/** Every Drizzle table exported by the schema. */
export const allTables: PgTable[] = (Object.values(schema) as unknown[]).filter(
  (value): value is PgTable => is(value, PgTable),
);
