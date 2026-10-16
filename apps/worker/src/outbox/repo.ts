import { and, eq, inArray, lte, sql } from 'drizzle-orm';
import type { OutboxRowDraft } from '@qc/messaging';
import { tables, type Db, type OutboxRow } from '../db';

/**
 * All writes to `message_outbox` status go through here. Every transition is a compare-and-set on
 * the current status, so a webhook, a retry and a crash recovery can never undo one another.
 *
 *   queued -> sending -> sent -> delivered
 *                   \-> queued (retry, with backoff)
 *                   \-> failed (permanent, or blocked by the gate)
 *                   \-> dead   (retries used up)
 *
 * `nextAttemptAt` doubles as the lease while a row is `sending`: if the worker dies, the row is
 * reclaimed once the lease passes.
 */

export interface ClaimOptions {
  now: Date;
  limit: number;
  leaseMs: number;
}

/** Takes due `queued` rows for this worker. Safe to run from several workers at once. */
export async function claimDue(db: Db, opts: ClaimOptions): Promise<OutboxRow[]> {
  const t = tables.messageOutbox;
  return db.transaction(async (tx) => {
    const due = await tx
      .select({ id: t.id })
      .from(t)
      .where(and(eq(t.status, 'queued'), lte(t.nextAttemptAt, opts.now)))
      .orderBy(t.nextAttemptAt)
      .limit(opts.limit)
      .for('update', { skipLocked: true });
    if (due.length === 0) return [];
    return tx
      .update(t)
      .set({
        status: 'sending',
        attempts: sql`${t.attempts} + 1`,
        nextAttemptAt: new Date(opts.now.getTime() + opts.leaseMs),
      })
      .where(
        and(
          inArray(
            t.id,
            due.map((d) => d.id),
          ),
          eq(t.status, 'queued'),
        ),
      )
      .returning();
  });
}

/**
 * Rows stuck in `sending` past their lease belong to a worker that died. They go back to
 * `queued`, or to `dead` when they have already used every attempt (a message that keeps
 * killing the worker must not loop forever).
 */
export async function reclaimStale(
  db: Db,
  opts: { now: Date; maxAttempts: number },
): Promise<{ requeued: number; dead: number }> {
  const t = tables.messageOutbox;
  const stale = and(eq(t.status, 'sending'), lte(t.nextAttemptAt, opts.now));
  const dead = await db
    .update(t)
    .set({ status: 'dead', lastErrorCode: 'worker_lost', recipientPhoneE164: null })
    .where(and(stale, sql`${t.attempts} >= ${opts.maxAttempts}`))
    .returning({ id: t.id });
  const requeued = await db
    .update(t)
    .set({ status: 'queued', lastErrorCode: 'worker_lost', nextAttemptAt: opts.now })
    .where(stale)
    .returning({ id: t.id });
  return { requeued: requeued.length, dead: dead.length };
}

export async function getRow(db: Db, id: string): Promise<OutboxRow | undefined> {
  const [row] = await db.select().from(tables.messageOutbox).where(eq(tables.messageOutbox.id, id));
  return row;
}

/** The send succeeded. Clears the recipient phone and remembers the provider's message id. */
export async function markSent(
  db: Db,
  id: string,
  opts: { now: Date; providerMessageId?: string },
): Promise<void> {
  const t = tables.messageOutbox;
  await db
    .update(t)
    .set({
      // A fast webhook may already have moved the row on to `delivered`; never move it back.
      status: sql`CASE WHEN ${t.status} = 'sending' THEN 'sent' ELSE ${t.status} END`,
      sentAt: sql`COALESCE(${t.sentAt}, ${opts.now.toISOString()}::timestamptz)`,
      recipientPhoneE164: null,
      lastErrorCode: null,
      ...(opts.providerMessageId
        ? {
            payload: sql`${t.payload} || ${JSON.stringify({ providerMessageId: opts.providerMessageId })}::jsonb`,
          }
        : {}),
    })
    .where(and(eq(t.id, id), inArray(t.status, ['sending', 'sent', 'delivered'])));
}

/** A transient failure: back to `queued` for another try. */
export async function requeue(
  db: Db,
  id: string,
  opts: { nextAttemptAt: Date; errorCode: string },
): Promise<boolean> {
  const t = tables.messageOutbox;
  const rows = await db
    .update(t)
    .set({ status: 'queued', nextAttemptAt: opts.nextAttemptAt, lastErrorCode: opts.errorCode })
    .where(and(eq(t.id, id), eq(t.status, 'sending')))
    .returning({ id: t.id });
  return rows.length > 0;
}

/** Permanent failure, or blocked by the gate. Terminal. */
export async function markFailed(db: Db, id: string, errorCode: string): Promise<boolean> {
  const t = tables.messageOutbox;
  const rows = await db
    .update(t)
    .set({ status: 'failed', lastErrorCode: errorCode, recipientPhoneE164: null })
    .where(and(eq(t.id, id), eq(t.status, 'sending')))
    .returning({ id: t.id });
  return rows.length > 0;
}

/** Retries used up. Terminal, and visible to the console as `dead`. */
export async function markDead(db: Db, id: string, errorCode: string): Promise<boolean> {
  const t = tables.messageOutbox;
  const rows = await db
    .update(t)
    .set({ status: 'dead', lastErrorCode: errorCode, recipientPhoneE164: null })
    .where(and(eq(t.id, id), eq(t.status, 'sending')))
    .returning({ id: t.id });
  return rows.length > 0;
}

/** Inserts a row unless its idempotency key exists. Returns whether a row was created. */
export async function insertIfNew(db: Db, draft: OutboxRowDraft): Promise<boolean> {
  const rows = await db
    .insert(tables.messageOutbox)
    .values({ ...draft, payload: draft.payload })
    .onConflictDoNothing({ target: tables.messageOutbox.idempotencyKey })
    .returning({ id: tables.messageOutbox.id });
  return rows.length > 0;
}

/**
 * Applies a provider delivery report. Monotonic: `delivered` beats everything, `sent` only
 * advances `sending`, and `failed` never undoes `delivered`. Replaying an event changes nothing.
 * Returns whether the row changed.
 */
export async function applyDeliveryReport(
  db: Db,
  where: { id: string } | { providerMessageId: string },
  report: { status: 'sent' | 'delivered' | 'failed'; at: Date; errorCode?: string },
): Promise<boolean> {
  const t = tables.messageOutbox;
  const target =
    'id' in where
      ? eq(t.id, where.id)
      : sql`${t.payload} ->> 'providerMessageId' = ${where.providerMessageId}`;
  if (report.status === 'delivered') {
    const rows = await db
      .update(t)
      .set({
        status: 'delivered',
        deliveredAt: sql`COALESCE(${t.deliveredAt}, ${report.at.toISOString()}::timestamptz)`,
        sentAt: sql`COALESCE(${t.sentAt}, ${report.at.toISOString()}::timestamptz)`,
        lastErrorCode: null,
        recipientPhoneE164: null,
      })
      .where(and(target, sql`${t.status} <> 'delivered'`))
      .returning({ id: t.id });
    return rows.length > 0;
  }
  if (report.status === 'sent') {
    const rows = await db
      .update(t)
      .set({ status: 'sent', sentAt: sql`COALESCE(${t.sentAt}, ${report.at.toISOString()}::timestamptz)` })
      .where(and(target, eq(t.status, 'sending')))
      .returning({ id: t.id });
    return rows.length > 0;
  }
  const rows = await db
    .update(t)
    .set({ status: 'failed', lastErrorCode: report.errorCode ?? 'wa_failed', recipientPhoneE164: null })
    .where(and(target, inArray(t.status, ['sending', 'sent'])))
    .returning({ id: t.id });
  return rows.length > 0;
}

/** Counts by status, for the health endpoint and the console. */
export async function countByStatus(db: Db): Promise<Record<string, number>> {
  const t = tables.messageOutbox;
  const rows = await db
    .select({ status: t.status, count: sql<number>`count(*)::int` })
    .from(t)
    .groupBy(t.status);
  return Object.fromEntries(rows.map((r) => [r.status, r.count]));
}
