import { sql } from 'drizzle-orm';
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  time,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import {
  CIRCLE_STATUSES,
  LOCALES,
  OCCURRENCE_STATUSES,
  PROGRAMS,
  SECTIONS,
  SESSION_KINDS,
  SESSION_STATUSES,
} from '@qc/contracts';
import {
  createdAt,
  daysOfWeekCheck,
  enumCheck,
  pk,
  rangeCheck,
  rawCheck,
  tstz,
  updatedAt,
} from './_helpers';
import { users } from './people';
import { venues } from './places';

export const programs = pgTable(
  'programs',
  {
    id: pk(),
    key: text('key', { enum: PROGRAMS }).notNull().unique(),
    nameEn: text('name_en').notNull(),
    nameUr: text('name_ur').notNull(),
  },
  () => [enumCheck('programs', 'key', PROGRAMS)],
);

/** Dora has one season row per Ramadan. Circles run year-round and need none. */
export const seasons = pgTable(
  'seasons',
  {
    id: pk(),
    programId: uuid('program_id')
      .notNull()
      .references(() => programs.id),
    name: text('name').notNull(),
    startsOn: date('starts_on', { mode: 'string' }).notNull(),
    endsOn: date('ends_on', { mode: 'string' }).notNull(),
    hijriYear: integer('hijri_year'),
    isActive: boolean('is_active').notNull().default(false),
  },
  (t) => [
    index('seasons_program_idx').on(t.programId),
    rawCheck('seasons_dates_chk', '"ends_on" >= "starts_on"'),
  ],
);

export const circles = pgTable(
  'circles',
  {
    id: pk(),
    venueId: uuid('venue_id')
      .notNull()
      .references(() => venues.id),
    nameEn: text('name_en').notNull(),
    nameUr: text('name_ur').notNull(),
    /** The teacher is a name, not an account or a role. */
    teacherName: text('teacher_name'),
    descriptionEn: text('description_en'),
    descriptionUr: text('description_ur'),
    language: text('language', { enum: LOCALES }).notNull(),
    section: text('section', { enum: SECTIONS }).notNull().default('family'),
    onlineLink: text('online_link'),
    status: text('status', { enum: CIRCLE_STATUSES }).notNull().default('draft'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    approvedBy: uuid('approved_by').references(() => users.id, { onDelete: 'set null' }),
    approvedAt: tstz('approved_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('circles_venue_status_idx').on(t.venueId, t.status),
    enumCheck('circles', 'language', LOCALES),
    enumCheck('circles', 'section', SECTIONS),
    enumCheck('circles', 'status', CIRCLE_STATUSES),
  ],
);

/** A recurring schedule or a one-off lecture. Occurrences are the dated instances. */
export const sessions = pgTable(
  'sessions',
  {
    id: pk(),
    programId: uuid('program_id')
      .notNull()
      .references(() => programs.id),
    seasonId: uuid('season_id').references(() => seasons.id),
    venueId: uuid('venue_id')
      .notNull()
      .references(() => venues.id),
    circleId: uuid('circle_id').references(() => circles.id),
    kind: text('kind', { enum: SESSION_KINDS }).notNull(),
    titleEn: text('title_en').notNull(),
    titleUr: text('title_ur').notNull(),
    descriptionEn: text('description_en'),
    descriptionUr: text('description_ur'),
    section: text('section', { enum: SECTIONS }).notNull(),
    language: text('language', { enum: LOCALES }).notNull(),
    /** Wall-clock start in the session's timezone. */
    localStartTime: time('local_start_time').notNull(),
    durationMinutes: integer('duration_minutes').notNull(),
    /** 0 = Sunday .. 6 = Saturday. Empty for one-off lectures. */
    daysOfWeek: smallint('days_of_week')
      .array()
      .notNull()
      .default(sql`'{}'::smallint[]`),
    startsOn: date('starts_on', { mode: 'string' }).notNull(),
    endsOn: date('ends_on', { mode: 'string' }),
    timezone: text('timezone').notNull().default('Asia/Karachi'),
    capacityEnabled: boolean('capacity_enabled').notNull().default(false),
    capacity: integer('capacity'),
    registrationEnabled: boolean('registration_enabled').notNull().default(true),
    status: text('status', { enum: SESSION_STATUSES }).notNull().default('published'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('sessions_venue_idx').on(t.venueId),
    index('sessions_starts_on_idx').on(t.startsOn),
    enumCheck('sessions', 'kind', SESSION_KINDS),
    enumCheck('sessions', 'section', SECTIONS),
    enumCheck('sessions', 'language', LOCALES),
    enumCheck('sessions', 'status', SESSION_STATUSES),
    daysOfWeekCheck('sessions', 'days_of_week'),
    rawCheck(
      'sessions_kind_days_chk',
      `("kind" = 'one_off' AND cardinality("days_of_week") = 0) ` +
        `OR ("kind" = 'recurring' AND cardinality("days_of_week") > 0)`,
    ),
    rangeCheck('sessions', 'duration_minutes', 1, 1440),
    rawCheck('sessions_dates_chk', '"ends_on" IS NULL OR "ends_on" >= "starts_on"'),
    rawCheck(
      'sessions_capacity_chk',
      '("capacity" IS NULL OR "capacity" > 0) AND (NOT "capacity_enabled" OR "capacity" IS NOT NULL)',
    ),
  ],
);

export const occurrences = pgTable(
  'occurrences',
  {
    id: pk(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => sessions.id),
    startsAt: tstz('starts_at').notNull(),
    endsAt: tstz('ends_at').notNull(),
    status: text('status', { enum: OCCURRENCE_STATUSES }).notNull().default('scheduled'),
    /** Structured portion for the day, set by the coordinator. */
    portion: jsonb('portion'),
    portionLabel: text('portion_label'),
    recapNote: text('recap_note'),
    recapLocale: text('recap_locale', { enum: LOCALES }),
    headcount: integer('headcount'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique('occurrences_session_starts_unique').on(t.sessionId, t.startsAt),
    index('occurrences_starts_at_idx').on(t.startsAt),
    index('occurrences_session_idx').on(t.sessionId),
    enumCheck('occurrences', 'status', OCCURRENCE_STATUSES),
    enumCheck('occurrences', 'recap_locale', LOCALES),
    rawCheck('occurrences_times_chk', '"ends_at" > "starts_at"'),
    rawCheck('occurrences_headcount_chk', '"headcount" >= 0'),
  ],
);

export type ProgramRow = typeof programs.$inferSelect;
export type NewProgramRow = typeof programs.$inferInsert;
export type SeasonRow = typeof seasons.$inferSelect;
export type NewSeasonRow = typeof seasons.$inferInsert;
export type CircleRow = typeof circles.$inferSelect;
export type NewCircleRow = typeof circles.$inferInsert;
export type SessionRow = typeof sessions.$inferSelect;
export type NewSessionRow = typeof sessions.$inferInsert;
export type OccurrenceRow = typeof occurrences.$inferSelect;
export type NewOccurrenceRow = typeof occurrences.$inferInsert;
