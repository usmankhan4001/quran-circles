import { and, desc, eq, inArray, lt, or, sql, type SQL } from 'drizzle-orm';
import type { PostUpdateBody, ScopeFilter } from '@qc/contracts';
import { schema, type Db } from '../../db';
import { cityScope, nationalScope, venueScope, writeAudit, type AuditScope } from '../shared/audit';
import { fail, invalid } from '../shared/errors';
import { decodeKeyCursor, encodeKeyCursor } from '../shared/pagination';
import { visibleName } from '../shared/names';
import { feedUpdateColumns, toUpdateBase } from './feed';
import {
  nextStart,
  publishSessionEvent,
  publishUpdate,
  sessionFacts,
  type PublishDeps,
} from './publish';
import { reachUserIds, type UpdateScopeRef } from './reach';

const { updates, users, venues, messageTemplates, cities } = schema;

const ISO_MICRO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export interface ResolvedScope {
  ref: UpdateScopeRef;
  audit: AuditScope;
  /** What `can` needs to decide: the city and venue of the target. */
  resource: { cityId?: string; venueId?: string };
}

/** Looks up the city or venue a post targets. Null when it does not exist. */
export async function resolvePostScope(
  db: Db,
  scope: PostUpdateBody['scope'],
): Promise<ResolvedScope | null> {
  if (scope.type === 'national')
    return { ref: { type: 'national' }, audit: nationalScope, resource: {} };
  if (scope.type === 'city') {
    const [city] = await db
      .select({ id: cities.id })
      .from(cities)
      .where(eq(cities.id, scope.cityId));
    if (!city) return null;
    return {
      ref: { type: 'city', cityId: city.id },
      audit: cityScope(city.id),
      resource: { cityId: city.id },
    };
  }
  const [venue] = await db
    .select({ id: venues.id, cityId: venues.cityId })
    .from(venues)
    .where(eq(venues.id, scope.venueId));
  if (!venue) return null;
  return {
    ref: { type: 'venue', venueId: venue.id, cityId: venue.cityId },
    audit: venueScope(venue),
    resource: { cityId: venue.cityId, venueId: venue.id },
  };
}

async function authorName(db: Db, userId: string): Promise<string | null> {
  const [row] = await db
    .select({ name: users.displayName })
    .from(users)
    .where(eq(users.id, userId));
  return row ? visibleName(row.name) : null;
}

export async function postUpdate(
  db: Db,
  deps: PublishDeps,
  actorId: string,
  scope: ResolvedScope,
  body: PostUpdateBody,
) {
  // A linked session must be inside the scope the update is posted to.
  const facts = body.sessionId ? await sessionFacts(db, body.sessionId) : null;
  if (body.sessionId) {
    if (!facts) invalid('sessionId');
    const { ref } = scope;
    if (ref.type === 'venue' && facts.venueId !== ref.venueId) invalid('sessionId', 'out_of_scope');
    if (ref.type === 'city' && facts.cityId !== ref.cityId) invalid('sessionId', 'out_of_scope');
  }
  if (body.templateKey) {
    const [template] = await db
      .select({ id: messageTemplates.id })
      .from(messageTemplates)
      .where(
        and(eq(messageTemplates.key, body.templateKey), eq(messageTemplates.status, 'approved')),
      )
      .limit(1);
    if (!template) invalid('templateKey', 'not_approved');
  }

  const title = { en: body.title.en, ur: body.title.ur ?? null };
  const text = { en: body.body.en, ur: body.body.ur ?? null };

  const result = await db.transaction(async (tx) => {
    // A time change or cancellation tied to a venue's own session also reaches its registrants
    // and followers on WhatsApp, like the automatic updates do.
    const sessionEvent =
      facts &&
      scope.ref.type === 'venue' &&
      (body.kind === 'time_change' || body.kind === 'cancellation');
    const published = sessionEvent
      ? await publishSessionEvent(tx, deps, {
          actorId,
          session: facts,
          kind: body.kind as 'time_change' | 'cancellation',
          when: await nextStart(tx, facts.id, deps.now),
          notify: body.notify,
          title,
          body: text,
        })
      : await publishUpdate(tx, deps, {
          authorId: actorId,
          scope: scope.ref,
          kind: body.kind,
          title,
          body: text,
          sessionId: body.sessionId ?? null,
          notify: body.notify,
        });
    await writeAudit(tx, {
      actorUserId: actorId,
      action: 'update.post',
      entityType: 'update',
      entityId: published.updateId,
      scope: scope.audit,
      meta: {
        kind: body.kind,
        notify: body.notify,
        recipients: published.recipients,
        sessionId: body.sessionId ?? null,
        templateKey: body.templateKey ?? null,
      },
    });
    return published;
  });

  const [row] = await db
    .select(feedUpdateColumns)
    .from(updates)
    .where(eq(updates.id, result.updateId));
  if (!row) throw new Error('posted update not found');
  return {
    ...toUpdateBase(row),
    authorName: await authorName(db, actorId),
    recipients: result.recipients,
  };
}

function scopeCondition(filter: ScopeFilter): SQL {
  if (filter.national) return sql`true`;
  const parts: SQL[] = [];
  if (filter.cityIds.length) parts.push(inArray(updates.cityId, filter.cityIds));
  if (filter.venueIds.length) parts.push(inArray(updates.venueId, filter.venueIds));
  return parts.length ? (or(...parts) as SQL) : sql`false`;
}

export async function listPostedUpdates(
  db: Db,
  filter: ScopeFilter,
  query: {
    cursor?: string | undefined;
    limit: number;
    cityId?: string | undefined;
    venueId?: string | undefined;
  },
) {
  const key = decodeKeyCursor(query.cursor, 2);
  if (key && (!ISO_MICRO.test(key[0] ?? '') || !UUID.test(key[1] ?? ''))) {
    fail('validation_failed', { issues: [{ path: 'cursor', code: 'invalid_cursor' }] });
  }
  const after = key
    ? or(
        lt(updates.publishAt, sql`${key[0]}::timestamptz`),
        and(eq(updates.publishAt, sql`${key[0]}::timestamptz`), lt(updates.id, key[1] as string)),
      )
    : undefined;
  const rows = await db
    .select({ ...feedUpdateColumns, authorId: updates.authorId, authorName: users.displayName })
    .from(updates)
    .leftJoin(users, eq(users.id, updates.authorId))
    .where(
      and(
        scopeCondition(filter),
        after,
        query.cityId ? eq(updates.cityId, query.cityId) : undefined,
        query.venueId ? eq(updates.venueId, query.venueId) : undefined,
      ),
    )
    .orderBy(desc(updates.publishAt), desc(updates.id))
    .limit(query.limit + 1);
  const hasMore = rows.length > query.limit;
  const page = hasMore ? rows.slice(0, query.limit) : rows;

  // Recipients are the people the update reaches now; the same scope is counted once per page.
  const reachCache = new Map<string, number>();
  const items = [];
  for (const r of page) {
    const ref: UpdateScopeRef =
      r.scopeType === 'national'
        ? { type: 'national' }
        : r.scopeType === 'city'
          ? { type: 'city', cityId: r.cityId as string }
          : { type: 'venue', venueId: r.venueId as string, cityId: r.cityId as string };
    const cacheKey = `${ref.type}:${r.venueId ?? r.cityId ?? ''}`;
    let recipients = reachCache.get(cacheKey);
    if (recipients === undefined) {
      recipients = (await reachUserIds(db, ref)).length;
      reachCache.set(cacheKey, recipients);
    }
    items.push({
      ...toUpdateBase(r),
      authorName: r.authorName ? visibleName(r.authorName) : null,
      recipients,
    });
  }
  const last = page[page.length - 1];
  return {
    items,
    nextCursor: hasMore && last ? encodeKeyCursor(last.publishKey, last.id) : null,
  };
}

export async function listApprovedTemplates(db: Db) {
  const rows = await db
    .select()
    .from(messageTemplates)
    .where(eq(messageTemplates.status, 'approved'))
    .orderBy(messageTemplates.key, messageTemplates.locale);
  return {
    items: rows.map((r) => ({
      key: r.key,
      channel: r.channel,
      locale: r.locale,
      body: r.body,
      variables: Array.isArray(r.variables)
        ? (r.variables as unknown[]).filter((v): v is string => typeof v === 'string')
        : [],
      costCategory: r.costCategory,
      status: r.status,
    })),
  };
}
