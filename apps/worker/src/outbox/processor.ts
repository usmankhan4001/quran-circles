import { eq } from 'drizzle-orm';
import { OutboxPayload, renderTemplate, type PushPayload, type TemplateKey } from '@qc/contracts';
import {
  DEFAULT_RETRY_POLICY,
  buildWhatsAppRequest,
  decideRetry,
  evaluateGate,
  type GateLimits,
  type Logger,
  type PushProvider,
  type RetryPolicy,
  type SmsProvider,
  type WhatsAppProvider,
} from '@qc/messaging';
import { tables, type Clock, type Db, type OutboxRow } from '../db';
import { loadRecipientContext, resolveVenueId, type RecipientContext } from './context';
import * as repo from './repo';

export interface ProcessorDeps {
  db: Db;
  push: PushProvider;
  whatsapp: WhatsAppProvider;
  sms: SmsProvider | undefined;
  logger: Logger;
  now: Clock;
  retry?: RetryPolicy;
  random?: () => number;
  /**
   * Wave 4 seam: supplies the daily-cap and budget figures for the gate. Wave 2 leaves it unset,
   * so no limit is applied.
   */
  limits?: (row: OutboxRow, ctx: RecipientContext) => Promise<GateLimits | undefined>;
  /** Meta language codes if they differ from `en` and `ur`. */
  languageCodes?: Partial<Record<'en' | 'ur', string>>;
}

export type ProcessOutcome =
  | { outcome: 'sent' }
  | { outcome: 'requeued'; errorCode: string; delayMs: number }
  | { outcome: 'failed'; errorCode: string }
  | { outcome: 'dead'; errorCode: string };

type Step =
  | { kind: 'sent'; providerMessageId?: string | undefined }
  | { kind: 'retry'; errorCode: string; hintMs?: number | undefined }
  | { kind: 'fail'; errorCode: string };

const log = (
  deps: ProcessorDeps,
  event: string,
  row: OutboxRow,
  extra: Record<string, string | number | boolean | undefined> = {},
) =>
  deps.logger.info(event, {
    outboxId: row.id,
    channel: row.channel,
    template: row.templateKey ?? undefined,
    attempts: row.attempts,
    costCategory: row.costCategory,
    ...extra,
  });

/**
 * Sends one claimed outbox row (status `sending`) and records the outcome. Never throws for a
 * send problem: failures become row state. It throws only if the database itself fails, and the
 * queue then retries the job.
 */
export async function processClaimedRow(
  deps: ProcessorDeps,
  row: OutboxRow,
): Promise<ProcessOutcome> {
  const policy = deps.retry ?? DEFAULT_RETRY_POLICY;
  const step = await decide(deps, row);
  const now = deps.now();

  if (step.kind === 'sent') {
    await repo.markSent(deps.db, row.id, {
      now,
      ...(step.providerMessageId ? { providerMessageId: step.providerMessageId } : {}),
    });
    log(deps, 'outbox.sent', row);
    return { outcome: 'sent' };
  }
  if (step.kind === 'fail') {
    await repo.markFailed(deps.db, row.id, step.errorCode);
    log(deps, 'outbox.failed', row, { errorCode: step.errorCode });
    return { outcome: 'failed', errorCode: step.errorCode };
  }
  const decision = decideRetry(row.attempts, policy, {
    ...(step.hintMs !== undefined ? { hintMs: step.hintMs } : {}),
    ...(deps.random ? { random: deps.random } : {}),
  });
  if (decision.kind === 'dead') {
    await repo.markDead(deps.db, row.id, step.errorCode);
    deps.logger.warn('outbox.dead', {
      outboxId: row.id,
      channel: row.channel,
      template: row.templateKey ?? undefined,
      attempts: row.attempts,
      errorCode: step.errorCode,
    });
    return { outcome: 'dead', errorCode: step.errorCode };
  }
  await repo.requeue(deps.db, row.id, {
    nextAttemptAt: new Date(now.getTime() + decision.delayMs),
    errorCode: step.errorCode,
  });
  log(deps, 'outbox.requeued', row, { errorCode: step.errorCode, delayMs: decision.delayMs });
  return { outcome: 'requeued', errorCode: step.errorCode, delayMs: decision.delayMs };
}

async function decide(deps: ProcessorDeps, row: OutboxRow): Promise<Step> {
  const parsed = OutboxPayload.safeParse(row.payload);
  if (!parsed.success) return { kind: 'fail', errorCode: 'invalid_payload' };
  const payload = parsed.data as OutboxPayload;
  if (payload.channel !== row.channel)
    return { kind: 'fail', errorCode: 'payload_channel_mismatch' };

  const ctx = await loadRecipientContext(deps.db, row);
  const push = payload.channel === 'push' ? payload.push : null;
  const template = payload.channel === 'push' ? null : payload.template;

  // A reminder is worthless once the session has started or been cancelled.
  if (push?.data.type === 'reminder' && push.data.occurrenceId) {
    const stale = await reminderIsStale(deps, push.data.occurrenceId);
    if (stale) return { kind: 'fail', errorCode: stale };
  }

  // The row names its venue (migration 0008). Rows queued before that carry none, so their venue
  // is worked out from the payload, and only when a per-venue consent could make a difference.
  const venueId =
    row.venueId ??
    (ctx.consents.some((c) => c.venueId !== null)
      ? await resolveVenueId(deps.db, row, push?.data ?? null)
      : null);
  const limits = await deps.limits?.(row, ctx);
  const gate = evaluateGate({
    channel: row.channel,
    template,
    ...(push ? { pushType: push.data.type } : {}),
    venueId,
    recipient: {
      userId: ctx.user?.id ?? null,
      hasPhone: ctx.phone !== null,
      accountActive: ctx.user ? ctx.user.status === 'active' : true,
    },
    consents: ctx.consents,
    workingPushDevices: ctx.devices.length,
    ...(limits ? { limits } : {}),
    now: deps.now(),
  });
  if (!gate.allow) {
    deps.logger.info('outbox.blocked', {
      outboxId: row.id,
      channel: row.channel,
      template: template ?? undefined,
      reason: gate.reason,
    });
    return { kind: 'fail', errorCode: `gate_${gate.reason}` };
  }

  if (payload.channel === 'push') return sendPush(deps, ctx, payload.push);
  if (!ctx.phone) return { kind: 'fail', errorCode: 'gate_no_recipient' };
  if (payload.channel === 'whatsapp') {
    const result = await deps.whatsapp.sendTemplate(
      buildWhatsAppRequest({
        key: payload.template,
        locale: payload.locale,
        variables: payload.variables as never,
        to: ctx.phone,
        callbackData: `outbox:${row.id}`,
        ...(deps.languageCodes ? { languageCodes: deps.languageCodes } : {}),
      }),
    );
    if (result.status === 'ok')
      return { kind: 'sent', providerMessageId: result.providerMessageId };
    if (result.status === 'transient_failure') {
      return { kind: 'retry', errorCode: result.code, hintMs: result.retryAfterMs };
    }
    // Template and configuration problems are fixed by a person; keep the message and retry.
    if (result.cause === 'template' || result.cause === 'configuration') {
      deps.logger.error('provider.operator_action_needed', {
        outboxId: row.id,
        template: payload.template,
        errorCode: result.code,
      });
      return { kind: 'retry', errorCode: result.code };
    }
    return { kind: 'fail', errorCode: result.code };
  }
  // SMS
  if (!deps.sms) return { kind: 'retry', errorCode: 'sms_not_configured' };
  const body = renderTemplate(
    payload.template as TemplateKey,
    payload.locale,
    payload.variables as never,
  );
  const result = await deps.sms.send({ to: ctx.phone, body });
  if (result.status === 'ok') return { kind: 'sent', providerMessageId: result.providerMessageId };
  if (result.status === 'transient_failure') {
    return { kind: 'retry', errorCode: result.code, hintMs: result.retryAfterMs };
  }
  return { kind: 'fail', errorCode: result.code };
}

async function sendPush(
  deps: ProcessorDeps,
  ctx: RecipientContext,
  payload: PushPayload,
): Promise<Step> {
  let delivered = 0;
  let invalid = 0;
  let permanent: string | undefined;
  let transient: { code: string; hintMs: number | undefined } | undefined;
  let firstId: string | undefined;

  for (const device of ctx.devices) {
    const result = await deps.push.send({ kind: device.provider, token: device.token }, payload);
    if (result.status === 'ok') {
      delivered++;
      firstId ??= result.providerMessageId;
    } else if (result.status === 'invalid_token') {
      invalid++;
      // Stale-token cleanup: the device keeps its row but is revoked, so it is never tried again.
      await deps.db
        .update(tables.devices)
        .set({ revokedAt: deps.now() })
        .where(eq(tables.devices.id, device.id));
      deps.logger.info('push.token_revoked', {
        deviceId: device.id,
        provider: device.provider,
        errorCode: result.code,
      });
    } else if (result.status === 'transient_failure') {
      const hint = Math.max(transient?.hintMs ?? 0, result.retryAfterMs ?? 0) || undefined;
      transient = { code: result.code, hintMs: hint };
    } else {
      permanent = result.code;
    }
  }
  if (delivered > 0) return { kind: 'sent', providerMessageId: firstId };
  if (transient) return { kind: 'retry', errorCode: transient.code, hintMs: transient.hintMs };
  if (permanent) return { kind: 'fail', errorCode: permanent };
  if (invalid === ctx.devices.length) return { kind: 'fail', errorCode: 'no_working_push' };
  return { kind: 'fail', errorCode: 'push_failed' };
}

async function reminderIsStale(deps: ProcessorDeps, occurrenceId: string): Promise<string | null> {
  const [occ] = await deps.db
    .select({ startsAt: tables.occurrences.startsAt, status: tables.occurrences.status })
    .from(tables.occurrences)
    .where(eq(tables.occurrences.id, occurrenceId));
  if (!occ) return 'occurrence_missing';
  if (occ.status === 'cancelled') return 'occurrence_cancelled';
  if (occ.startsAt.getTime() <= deps.now().getTime()) return 'expired';
  return null;
}

/**
 * Entry point for a queue job `{ outboxId, attempt }`. Ignores stale jobs: if the row is no
 * longer `sending` for this attempt (already handled, or reclaimed after a crash), it does nothing.
 */
export async function processJob(
  deps: ProcessorDeps,
  job: { outboxId: string; attempt: number },
): Promise<ProcessOutcome | { outcome: 'skipped' }> {
  const row = await repo.getRow(deps.db, job.outboxId);
  if (!row || row.status !== 'sending' || row.attempts !== job.attempt) {
    return { outcome: 'skipped' };
  }
  return processClaimedRow(deps, row);
}
