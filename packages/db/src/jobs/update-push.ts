import { and, asc, eq, inArray, isNotNull, isNull, ne, sql } from 'drizzle-orm';
import { OutboxPayload, buildDeepLink, type Locale, type UpdateKind } from '@qc/contracts';
import * as schema from '../schema/index';
import type { JobDb } from './occurrences';

const {
  registrations,
  sessions,
  follows,
  circles,
  profiles,
  areas,
  venues,
  users,
  devices,
  updates,
  messageOutbox,
} = schema;

/**
 * Who an update reaches, and the push rows for it. Shared by the API (the recipient count it
 * answers with, the preview) and the worker (which writes the push rows after the post, see
 * `fanOutPendingUpdatePushes`), so both pick exactly the same people. Moved here unchanged from
 * `apps/api/src/modules/updates/reach.ts` and `publish.ts` (load test finding, migration 0011).
 */

export type UpdateScopeRef =
  | { type: 'national' }
  | { type: 'city'; cityId: string }
  | { type: 'venue'; venueId: string; cityId: string };

const uniq = <T>(values: T[]): T[] => [...new Set(values)];

/**
 * Who is connected to a venue: registered for one of its sessions, following it, or following one
 * of its circles. Cancelled registrations do not count.
 */
export async function venueConnectedUserIds(
  db: JobDb,
  venueIds: readonly string[],
): Promise<string[]> {
  if (venueIds.length === 0) return [];
  const ids = [...venueIds];
  // One after another, here and below: `db` may be a transaction (F-02).
  const registered = await db
    .selectDistinct({ userId: registrations.userId })
    .from(registrations)
    .innerJoin(sessions, eq(sessions.id, registrations.sessionId))
    .where(
      and(
        inArray(sessions.venueId, ids),
        ne(registrations.status, 'cancelled'),
        isNotNull(registrations.userId),
      ),
    );
  const followedVenue = await db
    .selectDistinct({ userId: follows.userId })
    .from(follows)
    .where(inArray(follows.venueId, ids));
  const followedCircle = await db
    .selectDistinct({ userId: follows.userId })
    .from(follows)
    .innerJoin(circles, eq(circles.id, follows.circleId))
    .where(inArray(circles.venueId, ids));
  return uniq([
    ...registered.flatMap((r) => (r.userId ? [r.userId] : [])),
    ...followedVenue.map((r) => r.userId),
    ...followedCircle.map((r) => r.userId),
  ]);
}

/** People in a city: connected to one of its venues, or with their profile area in the city. */
async function cityUserIds(db: JobDb, cityId: string): Promise<string[]> {
  const cityVenues = await db
    .select({ id: venues.id })
    .from(venues)
    .where(eq(venues.cityId, cityId));
  const connected = await venueConnectedUserIds(
    db,
    cityVenues.map((v) => v.id),
  );
  const inCity = await db
    .selectDistinct({ userId: profiles.userId })
    .from(profiles)
    .innerJoin(areas, eq(areas.id, profiles.areaId))
    .where(eq(areas.cityId, cityId));
  return uniq([...connected, ...inCity.map((r) => r.userId)]);
}

/**
 * The people an update reaches: everyone for a national update; for a city or venue update the
 * people connected to it. Suspended accounts are left out.
 */
export async function reachUserIds(db: JobDb, scope: UpdateScopeRef): Promise<string[]> {
  let ids: string[];
  if (scope.type === 'national') {
    const rows = await db.select({ id: users.id }).from(users).where(eq(users.status, 'active'));
    return rows.map((r) => r.id);
  }
  if (scope.type === 'city') ids = await cityUserIds(db, scope.cityId);
  else ids = await venueConnectedUserIds(db, [scope.venueId]);
  if (ids.length === 0) return [];
  const active: string[] = [];
  for (let i = 0; i < ids.length; i += 1000) {
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(and(inArray(users.id, ids.slice(i, i + 1000)), eq(users.status, 'active')));
    active.push(...rows.map((r) => r.id));
  }
  return active;
}

type UpdateRow = typeof updates.$inferSelect;

/** The scope an update row was posted to. */
export function updateScopeOf(update: UpdateRow): UpdateScopeRef | null {
  if (update.scopeType === 'national') return { type: 'national' };
  if (update.scopeType === 'city')
    return update.cityId ? { type: 'city', cityId: update.cityId } : null;
  return update.venueId && update.cityId
    ? { type: 'venue', venueId: update.venueId, cityId: update.cityId }
    : null;
}

const PUSH_TYPE: Record<UpdateKind, 'update' | 'session_changed' | 'session_cancelled'> = {
  announcement: 'update',
  special_lecture: 'update',
  time_change: 'session_changed',
  cancellation: 'session_cancelled',
};

const clip = (text: string, max: number): string =>
  text.length <= max ? text : text.slice(0, max);

/** The push an update sends to a person who reads `locale`: the Urdu text when there is one. */
export function updatePushPayload(
  update: UpdateRow,
  locale: Locale,
  webBase?: string,
): OutboxPayload {
  const pick = (en: string, ur: string | null): string => (locale === 'ur' && ur ? ur : en);
  const payload: OutboxPayload = {
    channel: 'push',
    push: {
      title: clip(pick(update.titleEn, update.titleUr), 120),
      body: clip(pick(update.bodyEn, update.bodyUr), 500),
      data: {
        type: PUSH_TYPE[update.kind],
        deepLink: buildDeepLink({ type: 'update', updateId: update.id }, webBase),
        updateId: update.id,
        ...(update.sessionId ? { sessionId: update.sessionId } : {}),
      },
      collapseKey: `update:${update.id}`,
      ttlSeconds: 6 * 3600,
    },
  };
  return OutboxPayload.parse(payload) as OutboxPayload;
}

/** The idempotency key of one person's push for an update. A rerun writes nothing new. */
export const updatePushKey = (updateId: string, userId: string): string =>
  `update:${updateId}:${userId}:push`;

/** People looked up, and rows inserted, per statement. */
export const UPDATE_PUSH_CHUNK = 1000;
const INSERT_CHUNK = 500;

export interface UpdatePushOptions {
  /** The public web origin for the deep link (`PUBLIC_WEB_BASE`), as the API uses. */
  webBase?: string | undefined;
  /** People per lookup. Default `UPDATE_PUSH_CHUNK`. */
  chunkSize?: number;
}

/**
 * Writes one push row per person in the update's reach who has a working device, in chunks, with
 * the idempotency key `update:<update>:<person>:push` (a rerun inserts nothing new). The same rows
 * the API used to write in the request. Returns the reach and how many rows were new.
 */
export async function writeUpdatePushes(
  db: JobDb,
  update: UpdateRow,
  options: UpdatePushOptions = {},
): Promise<{ recipients: number; rows: number }> {
  const scope = updateScopeOf(update);
  if (!scope) return { recipients: 0, rows: 0 };
  const reach = await reachUserIds(db, scope);
  const chunk = Math.max(1, options.chunkSize ?? UPDATE_PUSH_CHUNK);
  const payloads: Record<Locale, OutboxPayload> = {
    en: updatePushPayload(update, 'en', options.webBase),
    ur: updatePushPayload(update, 'ur', options.webBase),
  };
  const cityId = scope.type === 'national' ? null : scope.cityId;
  const venueId = scope.type === 'venue' ? scope.venueId : null;
  let rows = 0;
  for (let i = 0; i < reach.length; i += chunk) {
    const people = await db
      .selectDistinct({ id: users.id, locale: users.locale })
      .from(users)
      .innerJoin(devices, eq(devices.userId, users.id))
      .where(and(inArray(users.id, reach.slice(i, i + chunk)), isNull(devices.revokedAt)));
    for (let j = 0; j < people.length; j += INSERT_CHUNK) {
      const values = people.slice(j, j + INSERT_CHUNK).map((person) => ({
        idempotencyKey: updatePushKey(update.id, person.id),
        channel: 'push' as const,
        templateKey: null,
        locale: null,
        recipientUserId: person.id,
        recipientPhoneE164: null,
        payload: payloads[person.locale],
        costCategory: 'free' as const,
        cityId,
        venueId,
        sentBy: update.authorId,
        updateId: update.id,
      }));
      const inserted = await db
        .insert(messageOutbox)
        .values(values)
        .onConflictDoNothing({ target: messageOutbox.idempotencyKey })
        .returning({ id: messageOutbox.id });
      rows += inserted.length;
    }
  }
  return { recipients: reach.length, rows };
}

export interface UpdatePushSummary {
  /** Updates whose pushes were written in this run. */
  updates: number;
  /** New outbox rows. */
  rows: number;
}

/**
 * The worker's half of `notify: true` (migration 0011): writes the push rows of updates marked
 * `push_pending_since`, oldest first, at most `limit` updates per call. Each update is one
 * transaction: its row is locked (`SKIP LOCKED`, so two workers never take the same update), its
 * rows are written in chunks, and the mark is cleared. A crash rolls the whole update back and the
 * next run does it again; rows that exist already are skipped by their idempotency key, so a run
 * twice never queues a second push. An update deleted meanwhile has nothing left to do.
 */
export async function fanOutPendingUpdatePushes(
  db: JobDb,
  options: UpdatePushOptions & { limit?: number } = {},
): Promise<UpdatePushSummary> {
  const limit = Math.max(1, options.limit ?? 1);
  const summary: UpdatePushSummary = { updates: 0, rows: 0 };
  for (let n = 0; n < limit; n++) {
    const done = await db.transaction(async (tx) => {
      const [update] = await tx
        .select()
        .from(updates)
        .where(isNotNull(updates.pushPendingSince))
        .orderBy(asc(updates.pushPendingSince))
        .limit(1)
        .for('update', { skipLocked: true });
      if (!update) return null;
      const written = await writeUpdatePushes(tx, update, options);
      await tx.update(updates).set({ pushPendingSince: null }).where(eq(updates.id, update.id));
      return written;
    });
    if (!done) break;
    summary.updates++;
    summary.rows += done.rows;
  }
  return summary;
}

/** How many updates still wait for their pushes to be written, for the worker's health check. */
export async function countPendingUpdatePushes(db: JobDb): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(updates)
    .where(isNotNull(updates.pushPendingSince));
  return row?.n ?? 0;
}
