import { describe, expect, it } from 'vitest';
import {
  classifyInbound,
  parseWebhook,
  signWebhookBody,
  verifySignature,
  verifySubscription,
} from './whatsapp-webhook';

const SECRET = 'test-app-secret';

const statusBody = (over: Record<string, unknown> = {}) => ({
  object: 'whatsapp_business_account',
  entry: [
    {
      id: 'waba-1',
      changes: [
        {
          field: 'messages',
          value: {
            messaging_product: 'whatsapp',
            statuses: [
              {
                id: 'wamid.S1',
                status: 'delivered',
                timestamp: '1788000000',
                recipient_id: '923000000001',
                biz_opaque_callback_data: 'outbox:11111111-1111-4111-8111-111111111111',
                pricing: { billable: true, category: 'utility' },
                ...over,
              },
            ],
          },
        },
      ],
    },
  ],
});

describe('webhook signature', () => {
  const raw = JSON.stringify(statusBody());

  it('accepts the exact signature of the raw body', () => {
    expect(verifySignature(SECRET, raw, signWebhookBody(SECRET, raw))).toBe(true);
  });

  it.each([
    ['a body changed after signing', raw.replace('delivered', 'failed'), undefined],
    ['the wrong secret', raw, 'sha256=' + 'a'.repeat(64)],
    ['a missing header', raw, ''],
    ['no sha256 prefix', raw, 'abc'],
    ['a truncated signature', raw, signWebhookBody(SECRET, raw).slice(0, 20)],
    ['a different algorithm prefix', raw, signWebhookBody(SECRET, raw).replace('sha256', 'sha1')],
  ])('rejects %s', (_name, body, header) => {
    const signature = header === undefined ? signWebhookBody(SECRET, raw) : header;
    expect(verifySignature(SECRET, body, signature)).toBe(false);
  });

  it('rejects a null header', () => {
    expect(verifySignature(SECRET, raw, null)).toBe(false);
    expect(verifySignature(SECRET, raw, undefined)).toBe(false);
  });

  it('is computed over bytes, so an altered encoding does not verify', () => {
    const bytes = new TextEncoder().encode(raw);
    expect(verifySignature(SECRET, bytes, signWebhookBody(SECRET, raw))).toBe(true);
    expect(verifySignature(SECRET, raw + ' ', signWebhookBody(SECRET, raw))).toBe(false);
  });
});

describe('subscription handshake', () => {
  const ok = { 'hub.mode': 'subscribe', 'hub.verify_token': 'vt', 'hub.challenge': '12345' };
  it('echoes the challenge for the right token', () => {
    expect(verifySubscription('vt', ok)).toEqual({ ok: true, challenge: '12345' });
  });
  it.each([
    ['wrong token', { ...ok, 'hub.verify_token': 'nope' }],
    ['wrong mode', { ...ok, 'hub.mode': 'unsubscribe' }],
    ['no challenge', { 'hub.mode': 'subscribe', 'hub.verify_token': 'vt' }],
    ['no token', { 'hub.mode': 'subscribe', 'hub.challenge': '1' }],
    ['empty query', {}],
  ])('refuses %s', (_n, query) => {
    expect(verifySubscription('vt', query)).toEqual({ ok: false });
  });
});

describe('webhook parsing', () => {
  it('reads delivery statuses, with the callback data and billing info', () => {
    expect(parseWebhook(statusBody())).toEqual([
      {
        kind: 'status',
        providerMessageId: 'wamid.S1',
        status: 'delivered',
        at: new Date(1788000000 * 1000),
        recipient: '+923000000001',
        callbackData: 'outbox:11111111-1111-4111-8111-111111111111',
        billable: true,
        pricingCategory: 'utility',
      },
    ]);
  });

  it('reads the first error code of a failed status', () => {
    const events = parseWebhook(
      statusBody({
        status: 'failed',
        errors: [{ code: 131026, title: 'Undeliverable', message: 'x' }],
      }),
    );
    expect(events[0]).toMatchObject({ kind: 'status', status: 'failed', errorCode: 'wa_131026' });
  });

  it('turns an inbound reply into an intent and keeps no text', () => {
    const body = {
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  {
                    id: 'wamid.M1',
                    from: '923000000001',
                    timestamp: '1788000100',
                    type: 'text',
                    text: { body: 'STOP' },
                  },
                  {
                    id: 'wamid.M2',
                    from: '923000000002',
                    timestamp: '1788000101',
                    type: 'text',
                    text: { body: 'Jazakallah, see you there' },
                  },
                  {
                    id: 'wamid.M3',
                    from: '923000000003',
                    timestamp: '1788000102',
                    type: 'button',
                    button: { text: 'Start', payload: 'p' },
                  },
                  {
                    id: 'wamid.M4',
                    from: '923000000004',
                    timestamp: '1788000103',
                    type: 'image',
                    image: { id: 'x' },
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    const events = parseWebhook(body);
    expect(events.map((e) => e.kind === 'inbound' && e.intent)).toEqual([
      'opt_out',
      'other',
      'opt_in',
      'other',
    ]);
    expect(JSON.stringify(events)).not.toContain('Jazakallah');
    expect(JSON.stringify(events)).not.toContain('STOP');
  });

  it.each([
    ['not an object', 'x'],
    ['null', null],
    ['no entries', {}],
    ['entry without changes', { entry: [{}] }],
    ['unknown status', statusBody({ status: 'teleported' })],
    ['bad timestamp', statusBody({ timestamp: 'later' })],
    ['bad recipient', statusBody({ recipient_id: 'not-digits' })],
    ['missing id', statusBody({ id: undefined })],
  ])('skips %s without throwing', (_n, body) => {
    expect(parseWebhook(body)).toEqual([]);
  });
});

describe('opt-in and opt-out keywords', () => {
  it.each([
    ['STOP', 'opt_out'],
    ['  stop. ', 'opt_out'],
    ['Unsubscribe', 'opt_out'],
    ['بند', 'opt_out'],
    ['روکیں', 'opt_out'],
    ['START', 'opt_in'],
    ['subscribe!', 'opt_in'],
    ['شروع', 'opt_in'],
    ['please stop sending', 'other'],
    ['starting at 7?', 'other'],
    ['', 'other'],
  ])('%j is %s', (text, intent) => {
    expect(classifyInbound(text)).toBe(intent);
  });
});
