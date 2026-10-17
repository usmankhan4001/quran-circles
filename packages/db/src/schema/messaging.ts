import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import {
  COST_CATEGORIES,
  LOCALES,
  MESSAGE_CHANNELS,
  OUTBOX_STATUSES,
  SCOPE_TYPES,
  TEMPLATE_STATUSES,
  UPDATE_KINDS,
} from '@qc/contracts';
import {
  createdAt,
  e164Check,
  enumCheck,
  pk,
  rawCheck,
  scopeShapeCheck,
  tstz,
  updatedAt,
} from './_helpers';
import { users } from './people';
import { sessions } from './programs';
import { cities, venues } from './places';

/** Feed items by scope. National reaches everyone; city and venue reach connected people. */
export const updates = pgTable(
  'updates',
  {
    id: pk(),
    scopeType: text('scope_type', { enum: SCOPE_TYPES }).notNull(),
    cityId: uuid('city_id').references(() => cities.id, { onDelete: 'cascade' }),
    venueId: uuid('venue_id').references(() => venues.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id').references(() => users.id, { onDelete: 'set null' }),
    kind: text('kind', { enum: UPDATE_KINDS }).notNull(),
    titleEn: text('title_en').notNull(),
    titleUr: text('title_ur'),
    bodyEn: text('body_en').notNull(),
    bodyUr: text('body_ur'),
    sessionId: uuid('session_id').references(() => sessions.id, { onDelete: 'set null' }),
    publishAt: tstz('publish_at').notNull().defaultNow(),
    expiresAt: tstz('expires_at'),
    createdAt: createdAt(),
  },
  (t) => [
    index('updates_scope_publish_idx').on(
      t.scopeType,
      t.cityId,
      t.venueId,
      sql`${t.publishAt} desc`,
    ),
    enumCheck('updates', 'scope_type', SCOPE_TYPES),
    enumCheck('updates', 'kind', UPDATE_KINDS),
    scopeShapeCheck('updates'),
    rawCheck('updates_expiry_chk', '"expires_at" IS NULL OR "expires_at" > "publish_at"'),
  ],
);

/** Per-person read state, for unread badges. */
export const updateReads = pgTable(
  'update_reads',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    updateId: uuid('update_id')
      .notNull()
      .references(() => updates.id, { onDelete: 'cascade' }),
    readAt: tstz('read_at').notNull().defaultNow(),
  },
  (t) => [primaryKey({ name: 'update_reads_pkey', columns: [t.userId, t.updateId] })],
);

/** Approved wording. One row per template key and language. */
export const messageTemplates = pgTable(
  'message_templates',
  {
    id: pk(),
    key: text('key').notNull(),
    channel: text('channel', { enum: MESSAGE_CHANNELS }).notNull(),
    locale: text('locale', { enum: LOCALES }).notNull(),
    body: text('body').notNull(),
    variables: jsonb('variables')
      .notNull()
      .default(sql`'[]'::jsonb`),
    waTemplateName: text('wa_template_name'),
    costCategory: text('cost_category', { enum: COST_CATEGORIES }).notNull(),
    status: text('status', { enum: TEMPLATE_STATUSES }).notNull().default('draft'),
    approvedBy: uuid('approved_by').references(() => users.id, { onDelete: 'set null' }),
    approvedAt: tstz('approved_at'),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique('message_templates_key_locale_unique').on(t.key, t.locale),
    enumCheck('message_templates', 'channel', MESSAGE_CHANNELS),
    enumCheck('message_templates', 'locale', LOCALES),
    enumCheck('message_templates', 'cost_category', COST_CATEGORIES),
    enumCheck('message_templates', 'status', TEMPLATE_STATUSES),
  ],
);

/**
 * Every outgoing message. The recipient phone is cleared after sending or when the account
 * is deleted; the row stays for spend and delivery reporting.
 */
export const messageOutbox = pgTable(
  'message_outbox',
  {
    id: pk(),
    idempotencyKey: text('idempotency_key').notNull().unique(),
    channel: text('channel', { enum: MESSAGE_CHANNELS }).notNull(),
    templateKey: text('template_key'),
    locale: text('locale', { enum: LOCALES }),
    recipientUserId: uuid('recipient_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    recipientPhoneE164: text('recipient_phone_e164'),
    payload: jsonb('payload')
      .notNull()
      .default(sql`'{}'::jsonb`),
    status: text('status', { enum: OUTBOX_STATUSES }).notNull().default('queued'),
    attempts: integer('attempts').notNull().default(0),
    nextAttemptAt: tstz('next_attempt_at').notNull().defaultNow(),
    lastErrorCode: text('last_error_code'),
    costCategory: text('cost_category', { enum: COST_CATEGORIES }).notNull(),
    cityId: uuid('city_id').references(() => cities.id),
    /** The venue the message is about, for venue-scoped consent. NULL for city or national sends. */
    venueId: uuid('venue_id').references(() => venues.id, { onDelete: 'set null' }),
    /** The id the provider (Meta, FCM, the SMS gateway) returned, for delivery receipts. */
    providerMessageId: text('provider_message_id'),
    sentBy: uuid('sent_by').references(() => users.id, { onDelete: 'set null' }),
    updateId: uuid('update_id').references(() => updates.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    sentAt: tstz('sent_at'),
    deliveredAt: tstz('delivered_at'),
  },
  (t) => [
    index('message_outbox_status_next_idx').on(t.status, t.nextAttemptAt),
    index('message_outbox_recipient_created_idx').on(t.recipientUserId, t.createdAt),
    index('message_outbox_city_created_idx').on(t.cityId, t.createdAt),
    index('message_outbox_provider_message_id_idx')
      .on(t.providerMessageId)
      .where(sql`${t.providerMessageId} IS NOT NULL`),
    enumCheck('message_outbox', 'channel', MESSAGE_CHANNELS),
    enumCheck('message_outbox', 'locale', LOCALES),
    enumCheck('message_outbox', 'status', OUTBOX_STATUSES),
    enumCheck('message_outbox', 'cost_category', COST_CATEGORIES),
    e164Check('message_outbox', 'recipient_phone_e164'),
    rawCheck('message_outbox_attempts_chk', '"attempts" >= 0'),
  ],
);

export type UpdateRow = typeof updates.$inferSelect;
export type NewUpdateRow = typeof updates.$inferInsert;
export type UpdateReadRow = typeof updateReads.$inferSelect;
export type NewUpdateReadRow = typeof updateReads.$inferInsert;
export type MessageTemplateRow = typeof messageTemplates.$inferSelect;
export type NewMessageTemplateRow = typeof messageTemplates.$inferInsert;
export type MessageOutboxRow = typeof messageOutbox.$inferSelect;
export type NewMessageOutboxRow = typeof messageOutbox.$inferInsert;
