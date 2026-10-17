import { sql } from 'drizzle-orm';
import {
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import {
  ACCOUNT_STATUSES,
  AGE_BANDS,
  DEVICE_PLATFORMS,
  INVITE_STATUSES,
  LOCALES,
  OTP_CHANNELS,
  PRIOR_READING,
  PUSH_PROVIDERS,
  ROLES,
  SCOPE_TYPES,
} from '@qc/contracts';
import {
  NIL_UUID,
  createdAt,
  e164Check,
  enumCheck,
  pk,
  rawCheck,
  roleScopeCheck,
  scopeShapeCheck,
  tstz,
} from './_helpers';
import { areas, cities, venues } from './places';

/** The verified phone number is the account. Deleting a user removes personal data. */
export const users = pgTable(
  'users',
  {
    id: pk(),
    phoneE164: text('phone_e164').notNull().unique(),
    phoneVerifiedAt: tstz('phone_verified_at').notNull(),
    /** NULL until registration asks for the name. A non-null name is never blank. */
    displayName: text('display_name'),
    locale: text('locale', { enum: LOCALES }).notNull().default('ur'),
    status: text('status', { enum: ACCOUNT_STATUSES }).notNull().default('active'),
    createdAt: createdAt(),
    lastSeenAt: tstz('last_seen_at'),
  },
  () => [
    e164Check('users', 'phone_e164'),
    enumCheck('users', 'locale', LOCALES),
    enumCheck('users', 'status', ACCOUNT_STATUSES),
    rawCheck(
      'users_display_name_chk',
      '"display_name" IS NULL OR char_length(btrim("display_name")) > 0',
    ),
  ],
);

/** Optional details asked for later, never at sign-up. */
export const profiles = pgTable(
  'profiles',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    areaId: uuid('area_id').references(() => areas.id, { onDelete: 'set null' }),
    ageBand: text('age_band', { enum: AGE_BANDS }),
    profession: text('profession'),
    education: text('education'),
    priorReading: text('prior_reading', { enum: PRIOR_READING }),
    preferredLanguage: text('preferred_language', { enum: LOCALES }),
  },
  () => [
    enumCheck('profiles', 'age_band', AGE_BANDS),
    enumCheck('profiles', 'prior_reading', PRIOR_READING),
    enumCheck('profiles', 'preferred_language', LOCALES),
  ],
);

/** A role with a scope. Revoking sets `revoked_at`; the history stays. */
export const roleAssignments = pgTable(
  'role_assignments',
  {
    id: pk(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ROLES }).notNull(),
    scopeType: text('scope_type', { enum: SCOPE_TYPES }).notNull(),
    cityId: uuid('city_id').references(() => cities.id, { onDelete: 'cascade' }),
    venueId: uuid('venue_id').references(() => venues.id, { onDelete: 'cascade' }),
    grantedBy: uuid('granted_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    revokedAt: tstz('revoked_at'),
  },
  (t) => [
    // One live assignment per person, role and scope target.
    uniqueIndex('role_assignments_active_uq')
      .on(t.userId, t.role, sql`coalesce(${t.venueId}, ${t.cityId}, ${NIL_UUID})`)
      .where(sql`${t.revokedAt} IS NULL`),
    index('role_assignments_city_idx').on(t.cityId),
    index('role_assignments_venue_idx').on(t.venueId),
    enumCheck('role_assignments', 'role', ROLES),
    enumCheck('role_assignments', 'scope_type', SCOPE_TYPES),
    scopeShapeCheck('role_assignments'),
    roleScopeCheck('role_assignments'),
  ],
);

export const devices = pgTable(
  'devices',
  {
    id: pk(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    platform: text('platform', { enum: DEVICE_PLATFORMS }).notNull(),
    provider: text('provider', { enum: PUSH_PROVIDERS }).notNull(),
    token: text('token').notNull(),
    locale: text('locale', { enum: LOCALES }).notNull(),
    createdAt: createdAt(),
    lastSeenAt: tstz('last_seen_at').notNull().defaultNow(),
    revokedAt: tstz('revoked_at'),
  },
  (t) => [
    unique('devices_provider_token_unique').on(t.provider, t.token),
    index('devices_user_idx').on(t.userId),
    enumCheck('devices', 'platform', DEVICE_PLATFORMS),
    enumCheck('devices', 'provider', PUSH_PROVIDERS),
    enumCheck('devices', 'locale', LOCALES),
  ],
);

/** Sign-in codes. Only a hash of the code is stored. Rows are short-lived. */
export const otpChallenges = pgTable(
  'otp_challenges',
  {
    id: pk(),
    phoneE164: text('phone_e164').notNull(),
    channel: text('channel', { enum: OTP_CHANNELS }).notNull(),
    codeHash: text('code_hash').notNull(),
    /** Language the person was using when they asked for the code; copied to a new account. */
    locale: text('locale', { enum: LOCALES }).notNull().default('ur'),
    attempts: integer('attempts').notNull().default(0),
    expiresAt: tstz('expires_at').notNull(),
    consumedAt: tstz('consumed_at'),
    createdAt: createdAt(),
    /** Hash of the caller's IP address, for rate limits. Never the address itself. */
    ipHash: text('ip_hash'),
  },
  (t) => [
    index('otp_challenges_phone_created_idx').on(t.phoneE164, t.createdAt),
    e164Check('otp_challenges', 'phone_e164'),
    enumCheck('otp_challenges', 'channel', OTP_CHANNELS),
    enumCheck('otp_challenges', 'locale', LOCALES),
    rawCheck('otp_challenges_attempts_chk', '"attempts" >= 0'),
  ],
);

/** Refresh-token sessions. Only a hash of the refresh token is stored. */
export const authSessions = pgTable(
  'auth_sessions',
  {
    id: pk(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    refreshTokenHash: text('refresh_token_hash').notNull().unique(),
    /**
     * The hash this session held before its last rotation, kept for a short grace window so a
     * lost response or a second tab can retry. `rotated_at` says when the rotation happened.
     */
    previousRefreshTokenHash: text('previous_refresh_token_hash'),
    rotatedAt: tstz('rotated_at'),
    deviceLabel: text('device_label'),
    createdAt: createdAt(),
    expiresAt: tstz('expires_at').notNull(),
    revokedAt: tstz('revoked_at'),
    lastUsedAt: tstz('last_used_at'),
  },
  (t) => [index('auth_sessions_user_idx').on(t.userId)],
);

export const coordinatorInvites = pgTable(
  'coordinator_invites',
  {
    id: pk(),
    phoneE164: text('phone_e164').notNull(),
    displayName: text('display_name'),
    role: text('role', { enum: ROLES }).notNull(),
    scopeType: text('scope_type', { enum: SCOPE_TYPES }).notNull(),
    cityId: uuid('city_id').references(() => cities.id, { onDelete: 'cascade' }),
    venueId: uuid('venue_id').references(() => venues.id, { onDelete: 'cascade' }),
    invitedBy: uuid('invited_by').references(() => users.id, { onDelete: 'set null' }),
    /**
     * Handover: the assignment this invite replaces. When the invite is accepted the new
     * assignment is created and this one is revoked in the same transaction.
     */
    replacesAssignmentId: uuid('replaces_assignment_id'),
    status: text('status', { enum: INVITE_STATUSES }).notNull().default('pending'),
    createdAt: createdAt(),
    expiresAt: tstz('expires_at').notNull(),
    acceptedBy: uuid('accepted_by').references(() => users.id, { onDelete: 'set null' }),
    acceptedAt: tstz('accepted_at'),
  },
  (t) => [
    uniqueIndex('coordinator_invites_pending_uq')
      .on(t.phoneE164, t.role, sql`coalesce(${t.venueId}, ${t.cityId}, ${NIL_UUID})`)
      .where(sql`${t.status} = 'pending'`),
    index('coordinator_invites_phone_idx').on(t.phoneE164),
    foreignKey({
      name: 'coordinator_invites_replaces_assignment_fk',
      columns: [t.replacesAssignmentId],
      foreignColumns: [roleAssignments.id],
    }).onDelete('set null'),
    e164Check('coordinator_invites', 'phone_e164'),
    enumCheck('coordinator_invites', 'role', ROLES),
    enumCheck('coordinator_invites', 'scope_type', SCOPE_TYPES),
    enumCheck('coordinator_invites', 'status', INVITE_STATUSES),
    scopeShapeCheck('coordinator_invites'),
    roleScopeCheck('coordinator_invites'),
  ],
);

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
export type ProfileRow = typeof profiles.$inferSelect;
export type NewProfileRow = typeof profiles.$inferInsert;
export type RoleAssignmentRow = typeof roleAssignments.$inferSelect;
export type NewRoleAssignmentRow = typeof roleAssignments.$inferInsert;
export type DeviceRow = typeof devices.$inferSelect;
export type NewDeviceRow = typeof devices.$inferInsert;
export type OtpChallengeRow = typeof otpChallenges.$inferSelect;
export type NewOtpChallengeRow = typeof otpChallenges.$inferInsert;
export type AuthSessionRow = typeof authSessions.$inferSelect;
export type NewAuthSessionRow = typeof authSessions.$inferInsert;
export type CoordinatorInviteRow = typeof coordinatorInvites.$inferSelect;
export type NewCoordinatorInviteRow = typeof coordinatorInvites.$inferInsert;
