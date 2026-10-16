import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  pgTable,
  smallint,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import {
  BOOKMARK_KINDS,
  CIRCLE_REQUEST_STATUSES,
  CONSENT_CHANNELS,
  CONSENT_PURPOSES,
  LOCALES,
  PORTION_KINDS,
  REGISTRATION_STATUSES,
  SECTIONS,
} from '@qc/contracts';
import {
  NIL_UUID,
  createdAt,
  daysOfWeekCheck,
  enumCheck,
  pk,
  rangeCheck,
  rawCheck,
  tstz,
  updatedAt,
} from './_helpers';
import { circles, occurrences, sessions } from './programs';
import { users } from './people';
import { areas, venues } from './places';

/**
 * `user_id` is set to NULL when the account is deleted. The row stays so counts survive,
 * and the app stamps `anonymised_at`.
 */
export const registrations = pgTable(
  'registrations',
  {
    id: pk(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => sessions.id),
    occurrenceId: uuid('occurrence_id').references(() => occurrences.id),
    areaId: uuid('area_id')
      .notNull()
      .references(() => areas.id),
    section: text('section', { enum: SECTIONS }).notNull(),
    partySize: integer('party_size').notNull(),
    status: text('status', { enum: REGISTRATION_STATUSES }).notNull().default('confirmed'),
    createdAt: createdAt(),
    cancelledAt: tstz('cancelled_at'),
    anonymisedAt: tstz('anonymised_at'),
  },
  (t) => [
    // One live registration (confirmed or waitlisted) per person and session.
    uniqueIndex('registrations_user_session_active_uq')
      .on(t.userId, t.sessionId)
      .where(sql`${t.status} <> 'cancelled' AND ${t.userId} IS NOT NULL`),
    index('registrations_session_idx').on(t.sessionId),
    index('registrations_session_status_idx').on(t.sessionId, t.status),
    index('registrations_user_idx').on(t.userId),
    enumCheck('registrations', 'section', SECTIONS),
    enumCheck('registrations', 'status', REGISTRATION_STATUSES),
    rangeCheck('registrations', 'party_size', 1, 20),
  ],
);

/** Follow a venue or a circle. Exactly one target per row. */
export const follows = pgTable(
  'follows',
  {
    id: pk(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    venueId: uuid('venue_id').references(() => venues.id, { onDelete: 'cascade' }),
    circleId: uuid('circle_id').references(() => circles.id, { onDelete: 'cascade' }),
    alertsEnabled: boolean('alerts_enabled').notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('follows_user_venue_uq')
      .on(t.userId, t.venueId)
      .where(sql`${t.venueId} IS NOT NULL`),
    uniqueIndex('follows_user_circle_uq')
      .on(t.userId, t.circleId)
      .where(sql`${t.circleId} IS NOT NULL`),
    index('follows_venue_idx').on(t.venueId),
    index('follows_circle_idx').on(t.circleId),
    rawCheck('follows_one_target_chk', '("venue_id" IS NULL) <> ("circle_id" IS NULL)'),
  ],
);

/** Consent per channel and purpose, optionally for one venue. Revoking sets `revoked_at`. */
export const consents = pgTable(
  'consents',
  {
    id: pk(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    channel: text('channel', { enum: CONSENT_CHANNELS }).notNull(),
    purpose: text('purpose', { enum: CONSENT_PURPOSES }).notNull(),
    venueId: uuid('venue_id').references(() => venues.id, { onDelete: 'cascade' }),
    grantedAt: tstz('granted_at').notNull().defaultNow(),
    revokedAt: tstz('revoked_at'),
    source: text('source').notNull(),
  },
  (t) => [
    uniqueIndex('consents_active_uq')
      .on(t.userId, t.channel, t.purpose, sql`coalesce(${t.venueId}, ${NIL_UUID})`)
      .where(sql`${t.revokedAt} IS NULL`),
    enumCheck('consents', 'channel', CONSENT_CHANNELS),
    enumCheck('consents', 'purpose', CONSENT_PURPOSES),
    rawCheck('consents_revoked_after_granted_chk', '"revoked_at" >= "granted_at"'),
  ],
);

/** Coordinator-only. A headcount for drop-ins, plus names when the coordinator knows them. */
export const attendance = pgTable(
  'attendance',
  {
    id: pk(),
    occurrenceId: uuid('occurrence_id')
      .notNull()
      .references(() => occurrences.id),
    registrationId: uuid('registration_id').references(() => registrations.id, {
      onDelete: 'set null',
    }),
    name: text('name'),
    count: integer('count').notNull().default(1),
    markedBy: uuid('marked_by').references(() => users.id, { onDelete: 'set null' }),
    markedAt: tstz('marked_at').notNull().defaultNow(),
  },
  (t) => [
    index('attendance_occurrence_idx').on(t.occurrenceId),
    rawCheck('attendance_count_chk', '"count" >= 1'),
  ],
);

export const circleProgress = pgTable(
  'circle_progress',
  {
    id: pk(),
    circleId: uuid('circle_id')
      .notNull()
      .references(() => circles.id),
    occurrenceId: uuid('occurrence_id').references(() => occurrences.id),
    kind: text('kind', { enum: PORTION_KINDS }).notNull(),
    label: text('label').notNull(),
    setBy: uuid('set_by').references(() => users.id, { onDelete: 'set null' }),
    setAt: tstz('set_at').notNull().defaultNow(),
  },
  (t) => [
    index('circle_progress_circle_set_at_idx').on(t.circleId, t.setAt),
    enumCheck('circle_progress', 'kind', PORTION_KINDS),
  ],
);

/** Area-level demand for a new circle. One active request per person per area. */
export const circleRequests = pgTable(
  'circle_requests',
  {
    id: pk(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    areaId: uuid('area_id')
      .notNull()
      .references(() => areas.id),
    days: smallint('days')
      .array()
      .notNull()
      .default(sql`'{}'::smallint[]`),
    section: text('section', { enum: SECTIONS }),
    language: text('language', { enum: LOCALES }),
    status: text('status', { enum: CIRCLE_REQUEST_STATUSES }).notNull().default('active'),
    expiresAt: tstz('expires_at').notNull(),
    createdAt: createdAt(),
    cancelledAt: tstz('cancelled_at'),
  },
  (t) => [
    uniqueIndex('circle_requests_user_area_active_uq')
      .on(t.userId, t.areaId)
      .where(sql`${t.status} = 'active'`),
    index('circle_requests_area_status_idx').on(t.areaId, t.status),
    daysOfWeekCheck('circle_requests', 'days'),
    enumCheck('circle_requests', 'section', SECTIONS),
    enumCheck('circle_requests', 'language', LOCALES),
    enumCheck('circle_requests', 'status', CIRCLE_REQUEST_STATUSES),
  ],
);

export const bookmarks = pgTable(
  'bookmarks',
  {
    id: pk(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: text('kind', { enum: BOOKMARK_KINDS }).notNull(),
    surah: smallint('surah'),
    ayah: smallint('ayah'),
    para: smallint('para'),
    note: text('note'),
    createdAt: createdAt(),
  },
  (t) => [
    // NULL parts count as equal, so a surah bookmark cannot be saved twice.
    uniqueIndex('bookmarks_target_uq').on(
      t.userId,
      t.kind,
      sql`coalesce(${t.surah}, 0)`,
      sql`coalesce(${t.ayah}, 0)`,
      sql`coalesce(${t.para}, 0)`,
    ),
    enumCheck('bookmarks', 'kind', BOOKMARK_KINDS),
    rangeCheck('bookmarks', 'surah', 1, 114),
    rangeCheck('bookmarks', 'ayah', 1, 286),
    rangeCheck('bookmarks', 'para', 1, 30),
    rawCheck(
      'bookmarks_target_shape_chk',
      `("kind" = 'ayah' AND "surah" IS NOT NULL AND "ayah" IS NOT NULL AND "para" IS NULL) ` +
        `OR ("kind" = 'surah' AND "surah" IS NOT NULL AND "ayah" IS NULL AND "para" IS NULL) ` +
        `OR ("kind" = 'para' AND "para" IS NOT NULL AND "surah" IS NULL AND "ayah" IS NULL)`,
    ),
  ],
);

export const readingPositions = pgTable(
  'reading_positions',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    surah: smallint('surah').notNull(),
    ayah: smallint('ayah').notNull(),
    updatedAt: updatedAt(),
  },
  () => [
    rangeCheck('reading_positions', 'surah', 1, 114),
    rangeCheck('reading_positions', 'ayah', 1, 286),
  ],
);

export type RegistrationRow = typeof registrations.$inferSelect;
export type NewRegistrationRow = typeof registrations.$inferInsert;
export type FollowRow = typeof follows.$inferSelect;
export type NewFollowRow = typeof follows.$inferInsert;
export type ConsentRow = typeof consents.$inferSelect;
export type NewConsentRow = typeof consents.$inferInsert;
export type AttendanceRow = typeof attendance.$inferSelect;
export type NewAttendanceRow = typeof attendance.$inferInsert;
export type CircleProgressRow = typeof circleProgress.$inferSelect;
export type NewCircleProgressRow = typeof circleProgress.$inferInsert;
export type CircleRequestRow = typeof circleRequests.$inferSelect;
export type NewCircleRequestRow = typeof circleRequests.$inferInsert;
export type BookmarkRow = typeof bookmarks.$inferSelect;
export type NewBookmarkRow = typeof bookmarks.$inferInsert;
export type ReadingPositionRow = typeof readingPositions.$inferSelect;
export type NewReadingPositionRow = typeof readingPositions.$inferInsert;
