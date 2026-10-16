import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import type { Consent, ConsentChannel, ConsentPurpose } from '@qc/contracts';
import { schema, type Db } from '../../db';
import { invalid } from '../shared/errors';

const { consents, venues } = schema;

type ConsentRow = typeof consents.$inferSelect;

export const toConsent = (r: ConsentRow): Consent => ({
  id: r.id,
  channel: r.channel,
  purpose: r.purpose,
  venueId: r.venueId,
  grantedAt: r.grantedAt.toISOString(),
  revokedAt: r.revokedAt ? r.revokedAt.toISOString() : null,
});

export async function listConsents(db: Db, userId: string): Promise<{ items: Consent[] }> {
  const rows = await db
    .select()
    .from(consents)
    .where(eq(consents.userId, userId))
    .orderBy(desc(consents.grantedAt), desc(consents.id))
    .limit(200);
  return { items: rows.map(toConsent) };
}

export interface ConsentChange {
  channel: ConsentChannel;
  purpose: ConsentPurpose;
  venueId: string | null;
  granted: boolean;
}

/**
 * Grants or revokes one consent. The history stays: a grant adds a row, a revoke stamps the live
 * row, so the worker always sees what the person agreed to and when. Revoking something never
 * granted records the refusal.
 */
export async function applyConsent(
  db: Db,
  userId: string,
  now: Date,
  change: ConsentChange,
  source: string,
): Promise<ConsentRow> {
  const sameTarget = and(
    eq(consents.userId, userId),
    eq(consents.channel, change.channel),
    eq(consents.purpose, change.purpose),
    change.venueId ? eq(consents.venueId, change.venueId) : isNull(consents.venueId),
  );
  const [live] = await db
    .select()
    .from(consents)
    .where(and(sameTarget, isNull(consents.revokedAt)))
    .limit(1);
  if (change.granted) {
    if (live) return live;
    const [row] = await db
      .insert(consents)
      .values({
        userId,
        channel: change.channel,
        purpose: change.purpose,
        venueId: change.venueId,
        grantedAt: now,
        source,
      })
      .returning();
    return row!;
  }
  if (live) {
    const [row] = await db
      .update(consents)
      .set({ revokedAt: sql`greatest(${consents.grantedAt}, ${now.toISOString()}::timestamptz)` })
      .where(eq(consents.id, live.id))
      .returning();
    return row!;
  }
  const [latest] = await db
    .select()
    .from(consents)
    .where(sameTarget)
    .orderBy(desc(consents.grantedAt))
    .limit(1);
  if (latest) return latest;
  const [row] = await db
    .insert(consents)
    .values({
      userId,
      channel: change.channel,
      purpose: change.purpose,
      venueId: change.venueId,
      grantedAt: now,
      revokedAt: now,
      source,
    })
    .returning();
  return row!;
}

export async function setConsent(
  db: Db,
  userId: string,
  now: Date,
  input: {
    channel: ConsentChannel;
    purpose: ConsentPurpose;
    venueId?: string | null | undefined;
    granted: boolean;
  },
): Promise<Consent> {
  const venueId = input.venueId ?? null;
  if (venueId) {
    const [venue] = await db.select({ id: venues.id }).from(venues).where(eq(venues.id, venueId));
    if (!venue) invalid('venueId');
  }
  const row = await applyConsent(
    db,
    userId,
    now,
    { channel: input.channel, purpose: input.purpose, venueId, granted: input.granted },
    'settings',
  );
  return toConsent(row);
}
