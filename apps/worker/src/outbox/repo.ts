import { and, eq, inArray, isNull, lte, ne, or, sql, type SQL } from 'drizzle-orm';
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

/**
 * What a finished row keeps of its payload (SEC-06). Names (`variables.name`,
 * `variables.inviterName`), session and venue wording, links and push text are personal or
 * re-identifying and no longer needed once a row is `sent`, `delivered`, `failed` or `dead`: a
 * finished row is never sent again (a withdrawn reminder that comes back gets a fresh payload).
 * Kept for the audit trail and the console: the channel, the template key and locale of a template
 * message, and a push's `data` (its type, deep link and ids), plus `redacted: true`. A payload that
 * is already redacted or empty stays as it is, so applying this twice changes nothing.
 */
export function redactedPayload(): SQL {
  const p = tables.messageOutbox.payload;
  return sql`CASE
    WHEN ${p}->'redacted' IS NOT NULL OR ${p} = '{}'::jsonb THEN ${p}
    WHEN ${p}->>'channel' = 'push' THEN jsonb_build_object(
      'channel', 'push',
      'push', jsonb_build_object('data', COALESCE(${p}->'push'->'data', '{}'::jsonb)),
      'redacted', true)
    ELSE jsonb_strip_nulls(jsonb_build_object(
      'channel', ${p}->'channel',
      'template', ${p}->'template',
      'locale', ${p}->'locale',
      'redacted', true))
  END`;
}

/**
 * How long a claim lasts before a crashed worker's rows are handed out again. Senders renew it when
 * they start on a row (`takeForSending`), so it bounds the time a row waits on the queue plus the
 * time one send takes, not the whole burst.
 */
export const DEFAULT_LEASE_MS = 5 * 60_000;

/** The statuses after which a row is never sent again. */
export const FINISHED_STATUSES = ['sent', 'delivered', 'failed', 'dead'] as const;

/**
 * Which rows a claim or a count looks at. Push rows are sent on their own queue, faster and in
 * parallel; WhatsApp and SMS keep theirs (one at a time per batch, with the SEC-02 limits), so a
 * large push burst never holds up a reminder or a confirmation, and the reverse.
 */
export type SendLane = 'push' | 'message';

const laneFilter = (lane: SendLane | undefined): SQL | undefined => {
  const t = tables.messageOutbox;
  if (lane === 'push') return eq(t.channel, 'push');
  if (lane === 'message') return ne(t.channel, 'push');
  return undefined;
};

export interface ClaimOptions {
  now: Date;
  limit: number;
  leaseMs: number;
  /** Only this lane's rows. Every channel when left out. */
  lane?: SendLane;
}

/** Takes due `queued` rows for this worker. Safe to run from several workers at once. */
export async function claimDue(db: Db, opts: ClaimOptions): Promise<OutboxRow[]> {
  const t = tables.messageOutbox;
  if (opts.limit <= 0) return [];
  return db.transaction(async (tx) => {
    const due = await tx
      .select({ id: t.id })
      .from(t)
      .where(and(eq(t.status, 'queued'), lte(t.nextAttemptAt, opts.now), laneFilter(opts.lane)))
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
 * Rows of a lane claimed and not finished yet, by every worker: what is on the queue or being sent.
 * The dispatcher claims no more than its in-flight limit minus this, so it never hands out more
 * than the senders can finish within one lease.
 */
export async function countInFlight(db: Db, lane?: SendLane): Promise<number> {
  const t = tables.messageOutbox;
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(t)
    .where(and(eq(t.status, 'sending'), laneFilter(lane)));
  return row?.n ?? 0;
}

/** One queue job as the sender sees it. `lease` is the claim's lease end, when the job carries it. */
export interface TakeRequest {
  outboxId: string;
  attempt: number;
  lease?: string | undefined;
}

/**
 * The senders' compare-and-set before sending: of these jobs, takes the rows still `sending` for
 * the job's attempt and, when the job names its claim's lease, still on that lease, and renews
 * the lease to `leaseUntil`. One statement for the whole batch, so a stale job costs no send slot.
 *
 * Exactly one sender takes a claim: the renewed lease is always later than the claim's (at least
 * by a millisecond), so a duplicate job for the same claim, on this worker or another, no longer
 * matches. And a row taken is never reclaimed while it is being sent, because its lease starts
 * again when sending starts, not when it was claimed. Jobs queued before leases were carried
 * (no `lease`) are matched on the attempt alone, as before.
 */
export async function takeForSending(
  db: Db,
  jobs: readonly TakeRequest[],
  opts: { leaseUntil: Date },
): Promise<OutboxRow[]> {
  const t = tables.messageOutbox;
  if (jobs.length === 0) return [];
  const until = opts.leaseUntil.toISOString();
  const matches = jobs.map((j) =>
    j.lease
      ? and(eq(t.id, j.outboxId), eq(t.attempts, j.attempt), eq(t.nextAttemptAt, new Date(j.lease)))
      : and(eq(t.id, j.outboxId), eq(t.attempts, j.attempt)),
  );
  return db
    .update(t)
    .set({
      nextAttemptAt: sql`GREATEST(${until}::timestamptz, ${t.nextAttemptAt} + interval '1 millisecond')`,
    })
    .where(and(eq(t.status, 'sending'), or(...matches)))
    .returning();
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
    .set({
      status: 'dead',
      lastErrorCode: 'worker_lost',
      recipientPhoneE164: null,
      payload: redactedPayload(),
    })
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

/**
 * The send succeeded. Clears the recipient phone, reduces the payload to what the audit trail needs
 * (`redactedPayload`) and stores the provider's message id in its own column, where delivery
 * reports without our callback data look the row up.
 */
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
      payload: redactedPayload(),
      lastErrorCode: null,
      ...(opts.providerMessageId ? { providerMessageId: opts.providerMessageId } : {}),
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
    .set({
      status: 'failed',
      lastErrorCode: errorCode,
      recipientPhoneE164: null,
      payload: redactedPayload(),
    })
    .where(and(eq(t.id, id), eq(t.status, 'sending')))
    .returning({ id: t.id });
  return rows.length > 0;
}

/** Retries used up. Terminal, and visible to the console as `dead`. */
export async function markDead(db: Db, id: string, errorCode: string): Promise<boolean> {
  const t = tables.messageOutbox;
  const rows = await db
    .update(t)
    .set({
      status: 'dead',
      lastErrorCode: errorCode,
      recipientPhoneE164: null,
      payload: redactedPayload(),
    })
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
    'id' in where ? eq(t.id, where.id) : eq(t.providerMessageId, where.providerMessageId);
  if (report.status === 'delivered') {
    const rows = await db
      .update(t)
      .set({
        status: 'delivered',
        deliveredAt: sql`COALESCE(${t.deliveredAt}, ${report.at.toISOString()}::timestamptz)`,
        sentAt: sql`COALESCE(${t.sentAt}, ${report.at.toISOString()}::timestamptz)`,
        lastErrorCode: null,
        recipientPhoneE164: null,
        payload: redactedPayload(),
      })
      .where(and(target, sql`${t.status} <> 'delivered'`))
      .returning({ id: t.id });
    return rows.length > 0;
  }
  if (report.status === 'sent') {
    const rows = await db
      .update(t)
      .set({
        status: 'sent',
        sentAt: sql`COALESCE(${t.sentAt}, ${report.at.toISOString()}::timestamptz)`,
      })
      .where(and(target, eq(t.status, 'sending')))
      .returning({ id: t.id });
    return rows.length > 0;
  }
  const rows = await db
    .update(t)
    .set({
      status: 'failed',
      lastErrorCode: report.errorCode ?? 'wa_failed',
      recipientPhoneE164: null,
      payload: redactedPayload(),
    })
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

/**
 * Redacts the payloads of finished rows that still hold the full one (SEC-06): rows finished
 * before redaction existed, and rows another path finished. Runs in batches; returns how many rows
 * changed. Idempotent.
 */
export async function redactFinishedPayloads(
  db: Db,
  opts: { batchSize?: number } = {},
): Promise<number> {
  const t = tables.messageOutbox;
  const batchSize = opts.batchSize ?? 1000;
  let total = 0;
  for (;;) {
    const due = db
      .select({ id: t.id })
      .from(t)
      .where(
        and(
          inArray(t.status, [...FINISHED_STATUSES]),
          isNull(sql`${t.payload}->'redacted'`),
          ne(t.payload, sql`'{}'::jsonb`),
        ),
      )
      .limit(batchSize);
    const rows = await db
      .update(t)
      .set({ payload: redactedPayload() })
      .where(and(inArray(t.id, due), inArray(t.status, [...FINISHED_STATUSES])))
      .returning({ id: t.id });
    total += rows.length;
    if (rows.length < batchSize) return total;
  }
}
