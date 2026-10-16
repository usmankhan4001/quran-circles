import { and, eq, isNull } from 'drizzle-orm';
import type { ConsentFact } from '@qc/messaging';
import { tables, type Db, type OutboxRow } from '../db';

export interface RecipientContext {
  user: { id: string; status: 'active' | 'suspended'; locale: 'en' | 'ur'; phone: string } | null;
  /** The phone to send to: the outbox row's, else the account's. */
  phone: string | null;
  consents: ConsentFact[];
  devices: Array<{ id: string; provider: 'fcm' | 'apns' | 'webpush'; token: string }>;
}

/** Everything the gate and the senders need to know about the person a row is addressed to. */
export async function loadRecipientContext(db: Db, row: OutboxRow): Promise<RecipientContext> {
  const userId = row.recipientUserId;
  if (!userId) {
    return { user: null, phone: row.recipientPhoneE164, consents: [], devices: [] };
  }
  const [user] = await db.select().from(tables.users).where(eq(tables.users.id, userId));
  const consents = await db
    .select()
    .from(tables.consents)
    .where(eq(tables.consents.userId, userId));
  const devices = await db
    .select()
    .from(tables.devices)
    .where(and(eq(tables.devices.userId, userId), isNull(tables.devices.revokedAt)));
  return {
    user: user
      ? { id: user.id, status: user.status, locale: user.locale, phone: user.phoneE164 }
      : null,
    phone: row.recipientPhoneE164 ?? user?.phoneE164 ?? null,
    consents: consents.map((c) => ({
      channel: c.channel,
      purpose: c.purpose,
      venueId: c.venueId,
      grantedAt: c.grantedAt,
      revokedAt: c.revokedAt,
    })),
    devices: devices.map((d) => ({ id: d.id, provider: d.provider, token: d.token })),
  };
}

/**
 * The venue a message is about, when the row says so: a push for an occurrence or session, or a
 * row posted for a venue update. The outbox has no venue column (see the change request), so
 * other rows have none, and then only a global consent can satisfy the gate.
 */
export async function resolveVenueId(
  db: Db,
  row: OutboxRow,
  push: { occurrenceId?: string | undefined; sessionId?: string | undefined } | null,
): Promise<string | null> {
  if (push?.occurrenceId) {
    const [r] = await db
      .select({ venueId: tables.sessions.venueId })
      .from(tables.occurrences)
      .innerJoin(tables.sessions, eq(tables.sessions.id, tables.occurrences.sessionId))
      .where(eq(tables.occurrences.id, push.occurrenceId));
    if (r) return r.venueId;
  }
  if (push?.sessionId) {
    const [r] = await db
      .select({ venueId: tables.sessions.venueId })
      .from(tables.sessions)
      .where(eq(tables.sessions.id, push.sessionId));
    if (r) return r.venueId;
  }
  if (row.updateId) {
    const [r] = await db
      .select({ venueId: tables.updates.venueId })
      .from(tables.updates)
      .where(eq(tables.updates.id, row.updateId));
    if (r) return r.venueId;
  }
  return null;
}
