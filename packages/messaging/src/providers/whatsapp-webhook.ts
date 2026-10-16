import { createHmac, timingSafeEqual } from 'node:crypto';
import { isRecord } from '../http';

/**
 * Meta WhatsApp Cloud API webhooks.
 *
 * - `verifySubscription` answers the one-time GET handshake.
 * - `verifySignature` checks `X-Hub-Signature-256` (HMAC-SHA256 of the raw body with the app secret).
 * - `parseWebhook` turns the payload into normalised events and drops message bodies on the way, so
 *   nothing downstream can log them.
 */

export function signWebhookBody(appSecret: string, rawBody: string | Uint8Array): string {
  return `sha256=${createHmac('sha256', appSecret).update(rawBody).digest('hex')}`;
}

/** Constant-time check of the signature header against the raw request body. */
export function verifySignature(
  appSecret: string,
  rawBody: string | Uint8Array,
  header: string | null | undefined,
): boolean {
  if (!header || !header.startsWith('sha256=')) return false;
  const expected = Buffer.from(signWebhookBody(appSecret, rawBody));
  const given = Buffer.from(header);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export type SubscriptionCheck = { ok: true; challenge: string } | { ok: false };

/** The GET handshake: `hub.mode=subscribe` with our verify token echoes `hub.challenge`. */
export function verifySubscription(
  verifyToken: string,
  query: Record<string, string | undefined>,
): SubscriptionCheck {
  const given = query['hub.verify_token'];
  const challenge = query['hub.challenge'];
  if (query['hub.mode'] !== 'subscribe' || given === undefined || challenge === undefined) {
    return { ok: false };
  }
  const a = Buffer.from(given);
  const b = Buffer.from(verifyToken);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false };
  return { ok: true, challenge };
}

export type WhatsAppDeliveryStatus = 'sent' | 'delivered' | 'read' | 'failed';
export type InboundIntent = 'opt_in' | 'opt_out' | 'other';

export type WhatsAppWebhookEvent =
  | {
      kind: 'status';
      providerMessageId: string;
      status: WhatsAppDeliveryStatus;
      at: Date;
      /** E.164 with the plus sign. */
      recipient: string;
      callbackData?: string;
      errorCode?: string;
      billable?: boolean;
      pricingCategory?: string;
    }
  | {
      kind: 'inbound';
      providerMessageId: string;
      at: Date;
      /** E.164 with the plus sign. */
      from: string;
      intent: InboundIntent;
    };

const OPT_OUT_WORDS = new Set([
  'stop',
  'unsubscribe',
  'quit',
  'cancel',
  'end',
  'optout',
  'opt out',
  'بند',
  'روکیں',
  'روکیے',
  'سٹاپ',
]);
const OPT_IN_WORDS = new Set(['start', 'subscribe', 'optin', 'opt in', 'شروع']);

/** Classifies a reply by its whole text. Only an exact keyword counts, so chat is never misread. */
export function classifyInbound(text: string): InboundIntent {
  const normalised = text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s.!؟?،,۔]+/g, ' ')
    .trim();
  if (OPT_OUT_WORDS.has(normalised)) return 'opt_out';
  if (OPT_IN_WORDS.has(normalised)) return 'opt_in';
  return 'other';
}

const STATUSES = new Set<string>(['sent', 'delivered', 'read', 'failed']);
const toPhone = (digits: unknown): string | undefined =>
  typeof digits === 'string' && /^[0-9]{8,15}$/.test(digits) ? `+${digits}` : undefined;
const toDate = (seconds: unknown): Date | undefined => {
  const n = typeof seconds === 'string' ? Number(seconds) : seconds;
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? new Date(n * 1000) : undefined;
};

/** Normalises a webhook payload. Unknown or malformed entries are skipped, never thrown on. */
export function parseWebhook(payload: unknown): WhatsAppWebhookEvent[] {
  const events: WhatsAppWebhookEvent[] = [];
  if (!isRecord(payload) || !Array.isArray(payload.entry)) return events;
  for (const entry of payload.entry) {
    if (!isRecord(entry) || !Array.isArray(entry.changes)) continue;
    for (const change of entry.changes) {
      if (!isRecord(change) || !isRecord(change.value)) continue;
      const value = change.value;
      for (const s of Array.isArray(value.statuses) ? value.statuses : []) {
        if (!isRecord(s) || typeof s.id !== 'string' || typeof s.status !== 'string') continue;
        if (!STATUSES.has(s.status)) continue;
        const at = toDate(s.timestamp);
        const recipient = toPhone(s.recipient_id);
        if (!at || !recipient) continue;
        const errors = Array.isArray(s.errors) ? s.errors : [];
        const first = errors[0];
        const pricing = isRecord(s.pricing) ? s.pricing : undefined;
        events.push({
          kind: 'status',
          providerMessageId: s.id,
          status: s.status as WhatsAppDeliveryStatus,
          at,
          recipient,
          ...(typeof s.biz_opaque_callback_data === 'string'
            ? { callbackData: s.biz_opaque_callback_data }
            : {}),
          ...(isRecord(first) && typeof first.code === 'number'
            ? { errorCode: `wa_${first.code}` }
            : {}),
          ...(typeof pricing?.billable === 'boolean' ? { billable: pricing.billable } : {}),
          ...(typeof pricing?.category === 'string' ? { pricingCategory: pricing.category } : {}),
        });
      }
      for (const m of Array.isArray(value.messages) ? value.messages : []) {
        if (!isRecord(m) || typeof m.id !== 'string') continue;
        const at = toDate(m.timestamp);
        const from = toPhone(m.from);
        if (!at || !from) continue;
        let text = '';
        if (m.type === 'text' && isRecord(m.text) && typeof m.text.body === 'string') {
          text = m.text.body;
        } else if (m.type === 'button' && isRecord(m.button)) {
          text = typeof m.button.text === 'string' ? m.button.text : '';
        }
        // The text is classified here and dropped: nothing after this point can log it.
        events.push({
          kind: 'inbound',
          providerMessageId: m.id,
          at,
          from,
          intent: classifyInbound(text),
        });
      }
    }
  }
  return events;
}
