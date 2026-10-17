import { and, asc, count, eq, gte, inArray, lt, ne, or, sql, type SQL } from 'drizzle-orm';
import {
  REGISTRATION_EXPORT_COLUMNS,
  REGISTRATION_EXPORT_MAX_ROWS,
  csvCell,
  csvFile,
  csvLine,
  type AdminRegistrationsExportQuery,
  type ScopeFilter,
} from '@qc/contracts';
import { schema, type Db } from '../../db';
import { cityScope, nationalScope, venueScope, type AuditScope } from '../shared/audit';
import { fail } from '../shared/errors';
import { visibleName } from '../shared/names';
import { DEFAULT_TIMEZONE, addDays, localToUtc } from '../shared/time';

const { registrations, sessions, venues, users } = schema;

/**
 * The registrants of a city, a venue or a coordinator's whole scope, in one CSV. `from` and `to`
 * are inclusive local dates in Pakistan time of when the person registered. Cancelled
 * registrations are left out, as in the per-session export.
 */

function scopeCondition(filter: ScopeFilter): SQL {
  if (filter.national) return sql`true`;
  const parts: SQL[] = [];
  if (filter.cityIds.length) parts.push(inArray(venues.cityId, filter.cityIds));
  if (filter.venueIds.length) parts.push(inArray(sessions.venueId, filter.venueIds));
  return parts.length ? (or(...parts) as SQL) : sql`false`;
}

function conditions(filter: ScopeFilter, query: AdminRegistrationsExportQuery): SQL {
  return and(
    scopeCondition(filter),
    ne(registrations.status, 'cancelled'),
    query.cityId ? eq(venues.cityId, query.cityId) : undefined,
    query.venueId ? eq(sessions.venueId, query.venueId) : undefined,
    query.from
      ? gte(registrations.createdAt, localToUtc(query.from, '00:00', DEFAULT_TIMEZONE))
      : undefined,
    query.to
      ? lt(registrations.createdAt, localToUtc(addDays(query.to, 1), '00:00', DEFAULT_TIMEZONE))
      : undefined,
  ) as SQL;
}

const base = (db: Db) =>
  db
    .select({
      sessionId: registrations.sessionId,
      venueId: sessions.venueId,
      cityId: venues.cityId,
      name: users.displayName,
      phone: users.phoneE164,
      partySize: registrations.partySize,
      section: registrations.section,
      status: registrations.status,
      registeredAt: registrations.createdAt,
    })
    .from(registrations)
    .innerJoin(sessions, eq(sessions.id, registrations.sessionId))
    .innerJoin(venues, eq(venues.id, sessions.venueId))
    // A deleted account leaves an anonymous registration: no name, no number.
    .leftJoin(users, eq(users.id, registrations.userId));

export async function exportScopedRegistrations(
  db: Db,
  filter: ScopeFilter,
  query: AdminRegistrationsExportQuery,
): Promise<{ csv: string; rows: number }> {
  const where = conditions(filter, query);
  const [total] = await db
    .select({ n: count() })
    .from(registrations)
    .innerJoin(sessions, eq(sessions.id, registrations.sessionId))
    .innerJoin(venues, eq(venues.id, sessions.venueId))
    .where(where);
  if ((total?.n ?? 0) > REGISTRATION_EXPORT_MAX_ROWS) {
    fail('validation_failed', { issues: [{ path: '', code: 'too_many_rows' }] });
  }
  const rows = await base(db)
    .where(where)
    .orderBy(asc(registrations.createdAt), asc(registrations.id));
  const lines = rows.map((r) =>
    csvLine([
      csvCell(r.sessionId, { trusted: true }),
      csvCell(r.venueId, { trusted: true }),
      csvCell(r.cityId, { trusted: true }),
      csvCell(visibleName(r.name)),
      csvCell(r.phone, { trusted: true }),
      csvCell(r.partySize),
      csvCell(r.section, { trusted: true }),
      csvCell(r.status, { trusted: true }),
      csvCell(r.registeredAt.toISOString(), { trusted: true }),
    ]),
  );
  return { csv: csvFile(REGISTRATION_EXPORT_COLUMNS, lines), rows: rows.length };
}

/**
 * Where the export's audit row lives: the venue or city asked for, or else the caller's own scope
 * when it is one venue or one city, so a city coordinator sees their venues' exports.
 */
export async function exportAuditScope(
  db: Db,
  filter: ScopeFilter,
  query: AdminRegistrationsExportQuery,
  venue: { id: string; cityId: string } | null,
): Promise<AuditScope> {
  if (venue) return venueScope(venue);
  if (query.cityId) return cityScope(query.cityId);
  if (filter.national) return nationalScope;
  const [onlyCity] = filter.cityIds;
  const [onlyVenue] = filter.venueIds;
  if (filter.cityIds.length === 1 && filter.venueIds.length === 0 && onlyCity) {
    return cityScope(onlyCity);
  }
  if (filter.venueIds.length === 1 && filter.cityIds.length === 0 && onlyVenue) {
    const [row] = await db
      .select({ cityId: venues.cityId })
      .from(venues)
      .where(eq(venues.id, onlyVenue));
    if (row) return venueScope({ id: onlyVenue, cityId: row.cityId });
  }
  return nationalScope;
}
