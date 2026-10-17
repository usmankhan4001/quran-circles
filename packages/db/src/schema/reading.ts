import { sql } from 'drizzle-orm';
import {
  date,
  index,
  integer,
  pgTable,
  smallint,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { DAILY_AYAH_SCOPES, MEMORISATION_STATUSES, READING_DAY_SOURCES } from '@qc/contracts';
import { AYAH_COUNTS } from '@qc/contracts/bookmarks';
import {
  NIL_UUID,
  createdAt,
  enumCheck,
  pk,
  rangeCheck,
  rawCheck,
  tstz,
  updatedAt,
} from './_helpers';
import { users } from './people';
import { cities, venues } from './places';
import { circles } from './programs';

/**
 * Days read, the community total, the ayah of the day and the memorisation tracker
 * (contract 1.0.0-rc.4, migration 0009). Dates are Pakistan-time calendar dates.
 */

/** The ayah must exist in its surah: the 114 ayah counts, indexed by surah (1-based in SQL). */
export const AYAH_IN_SURAH_SQL = `"ayah" <= (ARRAY[${AYAH_COUNTS.join(',')}]::smallint[])["surah"]`;

/**
 * One row per person, Pakistan date and source. Visible to the person only. Deleted with the
 * account (cascade); the national total in `community_days` keeps its anonymous count.
 */
export const readingDays = pgTable(
  'reading_days',
  {
    id: pk(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    day: date('day', { mode: 'string' }).notNull(),
    source: text('source', { enum: READING_DAY_SOURCES }).notNull(),
    /** The day's total for this source so far; a repeat keeps the larger value. */
    pages: smallint('pages').notNull().default(0),
    ayahs: smallint('ayahs').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('reading_days_user_day_source_uq').on(t.userId, t.day, t.source),
    enumCheck('reading_days', 'source', READING_DAY_SOURCES),
    rangeCheck('reading_days', 'pages', 0, 604),
    rangeCheck('reading_days', 'ayahs', 0, 6236),
  ],
);

/**
 * The national "read together" total per Pakistan date, counted without user ids. Rows are only
 * ever incremented: deleting an account does not take its reading back out.
 */
export const communityDays = pgTable(
  'community_days',
  {
    day: date('day', { mode: 'string' }).primaryKey(),
    readers: integer('readers').notNull().default(0),
    pages: integer('pages').notNull().default(0),
    updatedAt: updatedAt(),
  },
  () => [
    rawCheck('community_days_readers_chk', '"readers" >= 0'),
    rawCheck('community_days_pages_chk', '"pages" >= 0'),
  ],
);

/**
 * Curated ayah of the day picks: numbers only, never translation text. One pick per date and
 * scope. A venue pick carries its venue and city; a circle pick carries the circle and its venue
 * and city, so scope filters need no join.
 */
export const dailyAyahs = pgTable(
  'daily_ayahs',
  {
    id: pk(),
    day: date('day', { mode: 'string' }).notNull(),
    scopeType: text('scope_type', { enum: DAILY_AYAH_SCOPES }).notNull(),
    cityId: uuid('city_id').references(() => cities.id, { onDelete: 'cascade' }),
    venueId: uuid('venue_id').references(() => venues.id, { onDelete: 'cascade' }),
    circleId: uuid('circle_id').references(() => circles.id, { onDelete: 'cascade' }),
    surah: smallint('surah').notNull(),
    ayah: smallint('ayah').notNull(),
    setBy: uuid('set_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('daily_ayahs_day_scope_uq').on(
      t.day,
      t.scopeType,
      sql`coalesce(${t.circleId}, ${t.venueId}, ${NIL_UUID})`,
    ),
    index('daily_ayahs_venue_idx').on(t.venueId),
    index('daily_ayahs_circle_idx').on(t.circleId),
    index('daily_ayahs_city_idx').on(t.cityId),
    enumCheck('daily_ayahs', 'scope_type', DAILY_AYAH_SCOPES),
    rangeCheck('daily_ayahs', 'surah', 1, 114),
    rangeCheck('daily_ayahs', 'ayah', 1, 286),
    rawCheck('daily_ayahs_ayah_in_surah_chk', AYAH_IN_SURAH_SQL),
    rawCheck(
      'daily_ayahs_scope_shape_chk',
      `("scope_type" = 'national' AND "city_id" IS NULL AND "venue_id" IS NULL AND "circle_id" IS NULL) ` +
        `OR ("scope_type" = 'venue' AND "city_id" IS NOT NULL AND "venue_id" IS NOT NULL AND "circle_id" IS NULL) ` +
        `OR ("scope_type" = 'circle' AND "city_id" IS NOT NULL AND "venue_id" IS NOT NULL AND "circle_id" IS NOT NULL)`,
    ),
  ],
);

/** Private memorisation tracker: one row per person and marked surah. Deleted with the account. */
export const memorisation = pgTable(
  'memorisation',
  {
    id: pk(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    surah: smallint('surah').notNull(),
    status: text('status', { enum: MEMORISATION_STATUSES }).notNull(),
    lastRevisedAt: tstz('last_revised_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('memorisation_user_surah_uq').on(t.userId, t.surah),
    enumCheck('memorisation', 'status', MEMORISATION_STATUSES),
    rangeCheck('memorisation', 'surah', 1, 114),
  ],
);

export type ReadingDayRow = typeof readingDays.$inferSelect;
export type NewReadingDayRow = typeof readingDays.$inferInsert;
export type CommunityDayRow = typeof communityDays.$inferSelect;
export type NewCommunityDayRow = typeof communityDays.$inferInsert;
export type DailyAyahRow = typeof dailyAyahs.$inferSelect;
export type NewDailyAyahRow = typeof dailyAyahs.$inferInsert;
export type MemorisationRow = typeof memorisation.$inferSelect;
export type NewMemorisationRow = typeof memorisation.$inferInsert;
