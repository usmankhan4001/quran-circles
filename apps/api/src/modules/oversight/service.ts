import { and, desc, eq, gte, inArray, lt, lte, sql, type SQL } from 'drizzle-orm';
import type { ScopeFilter, Settings, SettingsUpdate } from '@qc/contracts';
import { schema, type Db } from '../../db';
import { fail } from '../shared/errors';
import { nationalScope, writeAudit } from '../shared/audit';
import { visibleName } from '../shared/names';
import { readSettings, writeSettings } from '../settings/store';

const { auditLog, users } = schema;

function scopeCondition(filter: ScopeFilter): SQL {
  if (filter.national) return sql`true`;
  // A venue-level row stores its city too, so a city coordinator sees their venues' history.
  return filter.cityIds.length ? inArray(auditLog.cityId, filter.cityIds) : sql`false`;
}

export async function listAudit(
  db: Db,
  filter: ScopeFilter,
  query: {
    cursor?: string | undefined;
    limit: number;
    cityId?: string | undefined;
    venueId?: string | undefined;
    entityType?: string | undefined;
    from?: string | undefined;
    to?: string | undefined;
  },
) {
  let before: number | null = null;
  if (query.cursor) {
    const text = Buffer.from(query.cursor, 'base64url').toString('utf8');
    const m = /^k:(\d{1,18})$/.exec(text);
    if (!m) fail('validation_failed', { issues: [{ path: 'cursor', code: 'invalid_cursor' }] });
    before = Number((m as RegExpExecArray)[1]);
  }
  const rows = await db
    .select({ row: auditLog, actorName: users.displayName, actorPhone: users.phoneE164 })
    .from(auditLog)
    .leftJoin(users, eq(users.id, auditLog.actorUserId))
    .where(
      and(
        scopeCondition(filter),
        before !== null ? lt(auditLog.id, before) : undefined,
        query.cityId ? eq(auditLog.cityId, query.cityId) : undefined,
        query.venueId ? eq(auditLog.venueId, query.venueId) : undefined,
        query.entityType ? eq(auditLog.entityType, query.entityType) : undefined,
        query.from ? gte(auditLog.createdAt, new Date(query.from)) : undefined,
        query.to ? lte(auditLog.createdAt, new Date(query.to)) : undefined,
      ),
    )
    .orderBy(desc(auditLog.id))
    .limit(query.limit + 1);
  const hasMore = rows.length > query.limit;
  const page = hasMore ? rows.slice(0, query.limit) : rows;
  const last = page[page.length - 1];
  return {
    items: page.map(({ row, actorName, actorPhone }) => ({
      id: String(row.id),
      actorName: actorName ? visibleName(actorName) : null,
      actorPhoneLast4: actorPhone ? actorPhone.slice(-4) : null,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      scopeType: row.scopeType,
      cityId: row.cityId,
      venueId: row.venueId,
      createdAt: row.createdAt.toISOString(),
    })),
    nextCursor:
      hasMore && last ? Buffer.from(`k:${last.row.id}`, 'utf8').toString('base64url') : null,
  };
}

export const getSettings = (db: Db): Promise<Settings> => readSettings(db);

export async function updateSettings(
  db: Db,
  actorId: string,
  patch: SettingsUpdate,
): Promise<Settings> {
  return db.transaction(async (tx) => {
    const { settings, changed } = await writeSettings(tx, patch, actorId);
    if (changed.length > 0) {
      await writeAudit(tx, {
        actorUserId: actorId,
        action: 'settings.update',
        entityType: 'settings',
        entityId: null,
        scope: nationalScope,
        meta: { fields: changed },
      });
    }
    return settings;
  });
}
