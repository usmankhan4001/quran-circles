import type { ScopeType } from '@qc/contracts';
import { schema, type Db } from '../../db';

export interface AuditScope {
  type: ScopeType;
  cityId?: string | null;
  venueId?: string | null;
}

export interface AuditEntryInput {
  actorUserId: string;
  /** `entity.verb`, for example `venue.create`. */
  action: string;
  entityType: string;
  entityId: string | null;
  scope: AuditScope;
  /** Ids, counts and field names only. Never names, numbers, message text or notes. */
  meta?: Record<string, unknown>;
}

/**
 * Every admin and coordinator write records who did what and in which scope. A venue-scoped row
 * also stores its city so a city coordinator's audit view can find it. Call this inside the same
 * transaction as the write it describes.
 */
export async function writeAudit(db: Db, entry: AuditEntryInput): Promise<void> {
  const { scope } = entry;
  await db.insert(schema.auditLog).values({
    actorUserId: entry.actorUserId,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    scopeType: scope.type,
    cityId: scope.type === 'national' ? null : (scope.cityId ?? null),
    venueId: scope.type === 'venue' ? (scope.venueId ?? null) : null,
    meta: entry.meta ?? {},
  });
}

/** Scope for something that belongs to a venue (the city is stored too). */
export const venueScope = (venue: { id: string; cityId: string }): AuditScope => ({
  type: 'venue',
  venueId: venue.id,
  cityId: venue.cityId,
});

export const cityScope = (cityId: string): AuditScope => ({ type: 'city', cityId });
export const nationalScope: AuditScope = { type: 'national' };
