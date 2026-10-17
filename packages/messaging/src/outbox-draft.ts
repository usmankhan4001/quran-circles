import {
  OutboxPayload,
  TEMPLATES,
  type CostCategory,
  type Locale,
  type MessageChannel,
  type PushPayload,
  type TemplateKey,
  type TemplateVariables,
} from '@qc/contracts';

/**
 * A `message_outbox` row before it is inserted. Anyone who queues a message (the worker's
 * reminders, the API's registration confirmations) builds it here, so the payload is validated
 * with the contract's `OutboxPayload` before it can reach the table and the cost category always
 * comes from the template catalog. Insert with `ON CONFLICT (idempotency_key) DO NOTHING`.
 */
export interface OutboxRowDraft {
  idempotencyKey: string;
  channel: MessageChannel;
  templateKey: TemplateKey | null;
  locale: Locale | null;
  recipientUserId: string | null;
  /** Needed for WhatsApp and SMS. Cleared by the worker after sending. */
  recipientPhoneE164: string | null;
  payload: OutboxPayload;
  costCategory: CostCategory;
  nextAttemptAt: Date;
  cityId: string | null;
  /**
   * The venue the message is about (`message_outbox.venue_id`). The worker checks per-venue
   * consent against it.
   */
  venueId: string | null;
  sentBy: string | null;
  updateId: string | null;
}

interface Common {
  idempotencyKey: string;
  recipientUserId?: string | null;
  recipientPhoneE164?: string | null;
  /** Send no earlier than this. Defaults to now at insert time. */
  sendAt: Date;
  cityId?: string | null;
  venueId?: string | null;
  sentBy?: string | null;
  updateId?: string | null;
}

export function draftPushRow(
  input: Common & { push: PushPayload; templateKey?: TemplateKey | null; locale?: Locale | null },
): OutboxRowDraft {
  const payload = OutboxPayload.parse({ channel: 'push', push: input.push }) as OutboxPayload;
  return {
    idempotencyKey: input.idempotencyKey,
    channel: 'push',
    templateKey: input.templateKey ?? null,
    locale: input.locale ?? null,
    recipientUserId: input.recipientUserId ?? null,
    recipientPhoneE164: null,
    payload,
    costCategory: 'free',
    nextAttemptAt: input.sendAt,
    cityId: input.cityId ?? null,
    venueId: input.venueId ?? null,
    sentBy: input.sentBy ?? null,
    updateId: input.updateId ?? null,
  };
}

export function draftTemplateRow<K extends TemplateKey>(
  input: Common & {
    channel: 'whatsapp' | 'sms';
    template: K;
    locale: Locale;
    variables: TemplateVariables<K>;
  },
): OutboxRowDraft {
  const payload = OutboxPayload.parse({
    channel: input.channel,
    template: input.template,
    locale: input.locale,
    variables: input.variables,
  }) as OutboxPayload;
  return {
    idempotencyKey: input.idempotencyKey,
    channel: input.channel,
    templateKey: input.template,
    locale: input.locale,
    recipientUserId: input.recipientUserId ?? null,
    recipientPhoneE164: input.recipientPhoneE164 ?? null,
    payload,
    costCategory: TEMPLATES[input.template].costCategory,
    nextAttemptAt: input.sendAt,
    cityId: input.cityId ?? null,
    venueId: input.venueId ?? null,
    sentBy: input.sentBy ?? null,
    updateId: input.updateId ?? null,
  };
}
