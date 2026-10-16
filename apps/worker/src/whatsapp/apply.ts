import { and, eq, inArray, isNull, lte, or, gte, sql } from 'drizzle-orm';
import type { ConsentPurpose } from '@qc/contracts';
import type { Logger, WhatsAppWebhookEvent } from '@qc/messaging';
import { tables, type Db } from '../db';
import { applyDeliveryReport } from '../outbox/repo';

export interface ApplyDeps {
  db: Db;
  logger: Logger;
}

export interface ApplySummary {
  statusApplied: number;
  statusIgnored: number;
  optedOut: number;
  optedIn: number;
  inboundIgnored: number;
}

/** What a "START" reply turns back on. Announcements and venue alerts stay a deliberate choice in the app. */
export const OPT_IN_PURPOSES: readonly ConsentPurpose[] = [
  'registration_updates',
  'session_reminders',
];

const CALLBACK_PREFIX = 'outbox:';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The outbox id we put in `biz_opaque_callback_data` when sending, if this event carries one. */
export function outboxIdFromCallback(data: string | undefined): string | undefined {
  if (!data?.startsWith(CALLBACK_PREFIX)) return undefined;
  const id = data.slice(CALLBACK_PREFIX.length);
  return UUID.test(id) ? id : undefined;
}

/**
 * Applies normalised WhatsApp webhook events to the outbox and to consent. Safe to run twice on the
 * same event: statuses only move forward, a replayed STOP cannot undo a later opt-in, and a replayed
 * START cannot undo a later STOP. Phone numbers are looked up, never logged.
 */
export async function applyWhatsAppEvents(
  deps: ApplyDeps,
  events: readonly WhatsAppWebhookEvent[],
): Promise<ApplySummary> {
  const summary: ApplySummary = {
    statusApplied: 0,
    statusIgnored: 0,
    optedOut: 0,
    optedIn: 0,
    inboundIgnored: 0,
  };
  for (const event of events) {
    try {
      if (event.kind === 'status') {
        if (await applyStatus(deps, event)) summary.statusApplied += 1;
        else summary.statusIgnored += 1;
      } else {
        const result = await applyInbound(deps, event);
        if (result === 'opted_out') summary.optedOut += 1;
        else if (result === 'opted_in') summary.optedIn += 1;
        else summary.inboundIgnored += 1;
      }
    } catch (error) {
      // One bad event must not make Meta redeliver the whole batch forever: log and carry on.
      deps.logger.error('whatsapp.webhook.apply_failed', {
        kind: event.kind,
        error: error instanceof Error ? error.name : 'unknown',
      });
    }
  }
  deps.logger.info('whatsapp.webhook.applied', { ...summary });
  return summary;
}

async function applyStatus(
  { db }: ApplyDeps,
  event: Extract<WhatsAppWebhookEvent, { kind: 'status' }>,
): Promise<boolean> {
  const where = outboxIdFromCallback(event.callbackData);
  const target = where ? { id: where } : { providerMessageId: event.providerMessageId };
  const status = event.status === 'read' ? 'delivered' : event.status;
  return applyDeliveryReport(db, target, {
    status,
    at: event.at,
    ...(event.errorCode ? { errorCode: event.errorCode } : {}),
  });
}

type InboundResult = 'opted_out' | 'opted_in' | 'ignored';

async function applyInbound(
  { db }: ApplyDeps,
  event: Extract<WhatsAppWebhookEvent, { kind: 'inbound' }>,
): Promise<InboundResult> {
  if (event.intent === 'other') return 'ignored';
  const [user] = await db
    .select({ id: tables.users.id })
    .from(tables.users)
    .where(eq(tables.users.phoneE164, event.from));
  if (!user) return 'ignored';
  const c = tables.consents;

  if (event.intent === 'opt_out') {
    // Only consents that existed when the person wrote STOP; a later grant is a later decision.
    const revoked = await db
      .update(c)
      .set({ revokedAt: sql`GREATEST(${event.at.toISOString()}::timestamptz, ${c.grantedAt})` })
      .where(
        and(
          eq(c.userId, user.id),
          eq(c.channel, 'whatsapp'),
          isNull(c.revokedAt),
          lte(c.grantedAt, event.at),
        ),
      )
      .returning({ id: c.id });
    return revoked.length > 0 ? 'opted_out' : 'ignored';
  }

  // opt_in: skip when the person has made any later decision about WhatsApp (grant or revoke).
  const later = await db
    .select({ id: c.id })
    .from(c)
    .where(
      and(
        eq(c.userId, user.id),
        eq(c.channel, 'whatsapp'),
        or(gte(c.grantedAt, event.at), gte(c.revokedAt, event.at)),
      ),
    )
    .limit(1);
  if (later.length > 0) return 'ignored';
  const existing = await db
    .select({ purpose: c.purpose })
    .from(c)
    .where(
      and(
        eq(c.userId, user.id),
        eq(c.channel, 'whatsapp'),
        isNull(c.revokedAt),
        isNull(c.venueId),
        inArray(c.purpose, [...OPT_IN_PURPOSES]),
      ),
    );
  const have = new Set(existing.map((r) => r.purpose));
  const missing = OPT_IN_PURPOSES.filter((p) => !have.has(p));
  if (missing.length === 0) return 'ignored';
  await db
    .insert(c)
    .values(
      missing.map((purpose) => ({
        userId: user.id,
        channel: 'whatsapp' as const,
        purpose,
        grantedAt: event.at,
        source: 'whatsapp_reply',
      })),
    )
    .onConflictDoNothing();
  return 'opted_in';
}
