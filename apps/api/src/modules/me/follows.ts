import { and, desc, eq, inArray, or } from 'drizzle-orm';
import type { Follow } from '@qc/contracts';
import { schema, type Db } from '../../db';
import { fail, isUniqueViolation } from '../shared/errors';
import { localized } from '../shared/mappers';
import { applyConsent } from './consents';

const { follows, venues, circles } = schema;
type FollowRow = typeof follows.$inferSelect;

async function toFollows(db: Db, rows: readonly FollowRow[]): Promise<Follow[]> {
  const venueIds = rows.flatMap((r) => (r.venueId ? [r.venueId] : []));
  const circleIds = rows.flatMap((r) => (r.circleId ? [r.circleId] : []));
  // One after another: `db` may be a transaction, whose single client runs one query at a time.
  const venueRows = venueIds.length
    ? await db.select().from(venues).where(inArray(venues.id, venueIds))
    : [];
  const circleRows = circleIds.length
    ? await db.select().from(circles).where(inArray(circles.id, circleIds))
    : [];
  const venueName = new Map(venueRows.map((v) => [v.id, localized(v.nameEn, v.nameUr)]));
  const circleName = new Map(circleRows.map((c) => [c.id, localized(c.nameEn, c.nameUr)]));
  return rows.flatMap((r) => {
    const name = r.venueId
      ? venueName.get(r.venueId)
      : r.circleId
        ? circleName.get(r.circleId)
        : null;
    if (!name) return [];
    return [
      {
        id: r.id,
        venueId: r.venueId,
        circleId: r.circleId,
        name,
        alertsEnabled: r.alertsEnabled,
        createdAt: r.createdAt.toISOString(),
      },
    ];
  });
}

export async function listFollows(db: Db, userId: string): Promise<{ items: Follow[] }> {
  const rows = await db
    .select()
    .from(follows)
    .where(eq(follows.userId, userId))
    .orderBy(desc(follows.createdAt), desc(follows.id));
  return { items: await toFollows(db, rows) };
}

/** The per-venue Alerts toggle is the consent for alerts about that venue, on push and WhatsApp. */
async function setAlertConsent(
  db: Db,
  userId: string,
  now: Date,
  venueId: string,
  granted: boolean,
): Promise<void> {
  for (const channel of ['push', 'whatsapp'] as const) {
    await applyConsent(
      db,
      userId,
      now,
      { channel, purpose: 'venue_alerts', venueId, granted },
      'follow',
    );
  }
}

/** True while another follow of this person still wants alerts from the venue. */
async function alertsStillWanted(db: Db, userId: string, venueId: string): Promise<boolean> {
  const rows = await db
    .select({ id: follows.id })
    .from(follows)
    .leftJoin(circles, eq(circles.id, follows.circleId))
    .where(
      and(
        eq(follows.userId, userId),
        eq(follows.alertsEnabled, true),
        or(eq(follows.venueId, venueId), eq(circles.venueId, venueId)),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

export async function createFollow(
  db: Db,
  userId: string,
  now: Date,
  input:
    | { target: 'venue'; venueId: string; alertsEnabled: boolean }
    | { target: 'circle'; circleId: string; alertsEnabled: boolean },
): Promise<Follow> {
  try {
    const row = await db.transaction(async (tx) => {
      let venueId: string;
      if (input.target === 'venue') {
        const [venue] = await tx.select().from(venues).where(eq(venues.id, input.venueId));
        // An archived venue is not public, so it reads as unknown.
        if (!venue || venue.status !== 'active') return fail('not_found');
        venueId = venue.id;
      } else {
        const [circle] = await tx.select().from(circles).where(eq(circles.id, input.circleId));
        if (!circle || circle.status !== 'published') return fail('not_found');
        venueId = circle.venueId;
      }
      const [created] = await tx
        .insert(follows)
        .values({
          userId,
          venueId: input.target === 'venue' ? input.venueId : null,
          circleId: input.target === 'circle' ? input.circleId : null,
          alertsEnabled: input.alertsEnabled,
          createdAt: now,
        })
        .returning();
      if (!created) throw new Error('follow insert returned no row');
      if (input.alertsEnabled) await setAlertConsent(tx, userId, now, venueId, true);
      return created;
    });
    const [view] = await toFollows(db, [row]);
    if (!view) throw new Error('follow vanished after insert');
    return view;
  } catch (error) {
    if (isUniqueViolation(error)) return fail('conflict');
    throw error;
  }
}

async function venueOf(db: Db, row: FollowRow): Promise<string | null> {
  if (row.venueId) return row.venueId;
  if (!row.circleId) return null;
  const [circle] = await db
    .select({ venueId: circles.venueId })
    .from(circles)
    .where(eq(circles.id, row.circleId));
  return circle?.venueId ?? null;
}

export async function updateFollow(
  db: Db,
  userId: string,
  now: Date,
  followId: string,
  alertsEnabled: boolean,
): Promise<Follow> {
  const row = await db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(follows)
      .where(and(eq(follows.id, followId), eq(follows.userId, userId)));
    if (!current) return fail('not_found');
    const [updated] = await tx
      .update(follows)
      .set({ alertsEnabled })
      .where(eq(follows.id, followId))
      .returning();
    const venueId = await venueOf(tx, current);
    if (venueId) {
      if (alertsEnabled) await setAlertConsent(tx, userId, now, venueId, true);
      else if (!(await alertsStillWanted(tx, userId, venueId))) {
        await setAlertConsent(tx, userId, now, venueId, false);
      }
    }
    return updated!;
  });
  const [view] = await toFollows(db, [row]);
  if (!view) return fail('not_found');
  return view;
}

export async function deleteFollow(
  db: Db,
  userId: string,
  now: Date,
  followId: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(follows)
      .where(and(eq(follows.id, followId), eq(follows.userId, userId)));
    if (!current) return fail('not_found');
    await tx.delete(follows).where(eq(follows.id, followId));
    const venueId = await venueOf(tx, current);
    if (venueId && !(await alertsStillWanted(tx, userId, venueId))) {
      await setAlertConsent(tx, userId, now, venueId, false);
    }
  });
}
