import { and, asc, desc, eq, inArray, ne, or, sql, type SQL } from 'drizzle-orm';
import type { AdminCircle, ScopeFilter } from '@qc/contracts';
import type { CircleCreate } from '../shared/types';
import { schema, type Db } from '../../db';
import { venueScope, writeAudit } from '../shared/audit';
import { fail, invalid } from '../shared/errors';
import { localized } from '../shared/mappers';
import { decodeOffsetCursor, offsetPage, type Page } from '../shared/pagination';

const { circles, venues } = schema;

const columns = {
  circle: circles,
  cityId: venues.cityId,
  venueStatus: venues.status,
};

type Record = {
  circle: typeof circles.$inferSelect;
  cityId: string;
  venueStatus: 'active' | 'archived';
};

export function toAdminCircle(r: Record): AdminCircle {
  const c = r.circle;
  return {
    id: c.id,
    venueId: c.venueId,
    cityId: r.cityId,
    name: localized(c.nameEn, c.nameUr),
    teacherName: c.teacherName,
    description: c.descriptionEn ? localized(c.descriptionEn, c.descriptionUr) : null,
    language: c.language,
    section: c.section,
    onlineLink: c.onlineLink,
    status: c.status,
    createdAt: c.createdAt.toISOString(),
    approvedAt: c.approvedAt ? c.approvedAt.toISOString() : null,
  };
}

const select = (db: Db) =>
  db.select(columns).from(circles).innerJoin(venues, eq(venues.id, circles.venueId));

/** The city and venue `can` needs to decide on a circle. */
export const circleResource = (r: Record): { cityId: string; venueId: string } => ({
  cityId: r.cityId,
  venueId: r.circle.venueId,
});

/** A circle with the city of its venue, for the scope check. */
export async function findCircle(db: Db, circleId: string) {
  const [row] = await select(db).where(eq(circles.id, circleId));
  return row ?? null;
}

function scopeCondition(filter: ScopeFilter): SQL {
  if (filter.national) return sql`true`;
  const parts: SQL[] = [];
  if (filter.cityIds.length) parts.push(inArray(venues.cityId, filter.cityIds));
  if (filter.venueIds.length) parts.push(inArray(circles.venueId, filter.venueIds));
  return parts.length ? (or(...parts) as SQL) : sql`false`;
}

export async function listAdminCircles(
  db: Db,
  filter: ScopeFilter,
  query: {
    cursor?: string | undefined;
    limit: number;
    cityId?: string | undefined;
    venueId?: string | undefined;
    status?: AdminCircle['status'] | undefined;
  },
): Promise<Page<AdminCircle>> {
  const offset = decodeOffsetCursor(query.cursor);
  const rows = await select(db)
    .where(
      and(
        scopeCondition(filter),
        query.cityId ? eq(venues.cityId, query.cityId) : undefined,
        query.venueId ? eq(circles.venueId, query.venueId) : undefined,
        query.status ? eq(circles.status, query.status) : ne(circles.status, 'archived'),
      ),
    )
    .orderBy(desc(circles.createdAt), asc(circles.id))
    .limit(query.limit + 1)
    .offset(offset);
  const page = offsetPage(rows, query.limit, offset);
  return { items: page.items.map(toAdminCircle), nextCursor: page.nextCursor };
}

/**
 * Anyone who may approve circles in the city publishes straight away; a venue coordinator's
 * circle waits for approval.
 */
export async function createCircle(
  db: Db,
  now: Date,
  actorId: string,
  venue: { id: string; cityId: string; status: 'active' | 'archived' },
  autoPublish: boolean,
  input: CircleCreate,
): Promise<AdminCircle> {
  if (venue.status !== 'active') invalid('venueId', 'venue_archived');
  const id = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(circles)
      .values({
        venueId: venue.id,
        nameEn: input.name.en,
        nameUr: input.name.ur ?? input.name.en,
        teacherName: input.teacherName,
        descriptionEn: input.description?.en ?? null,
        descriptionUr: input.description?.ur ?? null,
        language: input.language,
        section: input.section,
        onlineLink: input.onlineLink,
        status: autoPublish ? 'published' : 'pending_approval',
        createdBy: actorId,
        approvedBy: autoPublish ? actorId : null,
        approvedAt: autoPublish ? now : null,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: circles.id });
    if (!row) throw new Error('circle insert returned no row');
    await writeAudit(tx, {
      actorUserId: actorId,
      action: 'circle.create',
      entityType: 'circle',
      entityId: row.id,
      scope: venueScope(venue),
      meta: { status: autoPublish ? 'published' : 'pending_approval' },
    });
    return row.id;
  });
  const found = await findCircle(db, id);
  if (!found) throw new Error('circle vanished after insert');
  return toAdminCircle(found);
}

export interface CirclePatch {
  name?: { en: string; ur?: string | null | undefined } | undefined;
  teacherName?: string | null | undefined;
  description?: { en: string; ur?: string | null | undefined } | null | undefined;
  language?: AdminCircle['language'] | undefined;
  section?: AdminCircle['section'] | undefined;
  onlineLink?: string | null | undefined;
  /** Archive a published circle or publish an archived one again. */
  status?: 'published' | 'archived' | undefined;
}

/** `status` only moves a circle between published and archived; pending, rejected and draft stay. */
const ARCHIVE_MOVES: ReadonlySet<string> = new Set(['published>archived', 'archived>published']);

export async function updateCircle(
  db: Db,
  now: Date,
  actorId: string,
  record: Record,
  patch: CirclePatch,
): Promise<AdminCircle> {
  const set: Partial<typeof circles.$inferInsert> = {};
  const fields: string[] = [];
  if (patch.name !== undefined) {
    set.nameEn = patch.name.en;
    set.nameUr = patch.name.ur ?? patch.name.en;
    fields.push('name');
  }
  if (patch.teacherName !== undefined) {
    set.teacherName = patch.teacherName;
    fields.push('teacherName');
  }
  if (patch.description !== undefined) {
    set.descriptionEn = patch.description?.en ?? null;
    set.descriptionUr = patch.description?.ur ?? null;
    fields.push('description');
  }
  if (patch.language !== undefined) {
    set.language = patch.language;
    fields.push('language');
  }
  if (patch.section !== undefined) {
    set.section = patch.section;
    fields.push('section');
  }
  if (patch.onlineLink !== undefined) {
    set.onlineLink = patch.onlineLink;
    fields.push('onlineLink');
  }
  const from = record.circle.status;
  if (patch.status !== undefined && patch.status !== from) {
    if (!ARCHIVE_MOVES.has(`${from}>${patch.status}`)) invalid('status', 'invalid_transition');
    set.status = patch.status;
    fields.push('status');
  }
  if (fields.length > 0) {
    await db.transaction(async (tx) => {
      await tx
        .update(circles)
        .set({ ...set, updatedAt: now })
        .where(eq(circles.id, record.circle.id));
      await writeAudit(tx, {
        actorUserId: actorId,
        action: 'circle.update',
        entityType: 'circle',
        entityId: record.circle.id,
        scope: venueScope({ id: record.circle.venueId, cityId: record.cityId }),
        meta: { fields, ...(set.status ? { status: set.status } : {}) },
      });
    });
  }
  const found = await findCircle(db, record.circle.id);
  if (!found) return fail('not_found');
  return toAdminCircle(found);
}

export async function decideCircle(
  db: Db,
  now: Date,
  actorId: string,
  circleId: string,
  decision: 'approve' | 'reject',
): Promise<AdminCircle> {
  await db.transaction(async (tx) => {
    // Conditional update: only a circle still pending can be decided, even with two deciders at once.
    const [changed] = await tx
      .update(circles)
      .set(
        decision === 'approve'
          ? { status: 'published', approvedBy: actorId, approvedAt: now, updatedAt: now }
          : { status: 'rejected', updatedAt: now },
      )
      .where(and(eq(circles.id, circleId), eq(circles.status, 'pending_approval')))
      .returning({ id: circles.id, venueId: circles.venueId });
    if (!changed) return fail('circle_not_pending');
    const [venue] = await tx
      .select({ cityId: venues.cityId })
      .from(venues)
      .where(eq(venues.id, changed.venueId));
    await writeAudit(tx, {
      actorUserId: actorId,
      action: decision === 'approve' ? 'circle.approve' : 'circle.reject',
      entityType: 'circle',
      entityId: circleId,
      scope: venueScope({ id: changed.venueId, cityId: venue?.cityId as string }),
    });
  });
  const found = await findCircle(db, circleId);
  if (!found) return fail('not_found');
  return toAdminCircle(found);
}
