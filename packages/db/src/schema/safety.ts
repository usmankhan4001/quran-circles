import { sql } from 'drizzle-orm';
import { bigserial, index, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { SCOPE_TYPES } from '@qc/contracts';
import { createdAt, enumCheck, scopeShapeCheck } from './_helpers';
import { users } from './people';

/**
 * Who changed what, and in which scope. `meta` must never hold personal data.
 * City and venue ids are plain columns, not foreign keys: the log outlives what it describes.
 */
export const auditLog = pgTable(
  'audit_log',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id'),
    scopeType: text('scope_type', { enum: SCOPE_TYPES }).notNull(),
    cityId: uuid('city_id'),
    venueId: uuid('venue_id'),
    meta: jsonb('meta')
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: createdAt(),
  },
  (t) => [
    index('audit_log_created_at_idx').on(sql`${t.createdAt} desc`),
    index('audit_log_entity_idx').on(t.entityType, t.entityId),
    index('audit_log_city_created_idx').on(t.cityId, sql`${t.createdAt} desc`),
    enumCheck('audit_log', 'scope_type', SCOPE_TYPES),
    scopeShapeCheck('audit_log'),
  ],
);

export type AuditLogRow = typeof auditLog.$inferSelect;
export type NewAuditLogRow = typeof auditLog.$inferInsert;
