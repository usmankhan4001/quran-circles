import { OutboxPayload, TEMPLATES } from '@qc/contracts';
import { schema, type Db } from '../../db';

/**
 * The API never sends a message. It writes a row to `message_outbox` and stops; the messaging
 * lane's worker consumes the rows (checks consent and the daily cap, then sends with retries).
 * The idempotency key makes a retried request queue the same message once.
 */

export interface OutboxEntry {
  /** Unique per message and recipient, for example `registration_confirmation:<id>:whatsapp`. */
  key: string;
  payload: OutboxPayload;
  recipientUserId: string | null;
  /** Needed by the worker for template sends. Cleared after sending or account deletion. */
  recipientPhone?: string | null;
  cityId?: string | null;
  /** The venue the message is about. The worker checks venue-scoped consent against it. */
  venueId?: string | null;
  sentBy?: string | null;
  updateId?: string | null;
}

const CHUNK = 500;

/** Validates each payload against the contract, then inserts. Returns how many rows were new. */
export async function enqueueOutbox(db: Db, entries: readonly OutboxEntry[]): Promise<number> {
  let queued = 0;
  for (let i = 0; i < entries.length; i += CHUNK) {
    const chunk = entries.slice(i, i + CHUNK);
    const rows = chunk.map((e) => {
      const payload = OutboxPayload.parse(e.payload) as OutboxPayload;
      const isPush = payload.channel === 'push';
      const template = isPush ? null : payload.template;
      return {
        idempotencyKey: e.key,
        channel: payload.channel,
        templateKey: template,
        locale: isPush ? null : payload.locale,
        recipientUserId: e.recipientUserId,
        recipientPhoneE164: e.recipientPhone ?? null,
        payload,
        costCategory: template ? TEMPLATES[template].costCategory : ('free' as const),
        cityId: e.cityId ?? null,
        venueId: e.venueId ?? null,
        sentBy: e.sentBy ?? null,
        updateId: e.updateId ?? null,
      };
    });
    if (rows.length === 0) continue;
    const inserted = await db
      .insert(schema.messageOutbox)
      .values(rows)
      .onConflictDoNothing({ target: schema.messageOutbox.idempotencyKey })
      .returning({ id: schema.messageOutbox.id });
    queued += inserted.length;
  }
  return queued;
}
