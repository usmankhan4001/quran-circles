import { and, eq } from 'drizzle-orm';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createMemoryLogger, signWebhookBody, type WhatsAppWebhookEvent } from '@qc/messaging';
import { tables } from '../db';
import { createTestDb, type TestDb } from '../test/db';
import { createHarness, whatsappDraft, type Harness } from '../test/harness';
import { seedConsent, seedUser } from '../test/seed';
import { applyWhatsAppEvents, outboxIdFromCallback } from './apply';
import { createWebhookHandler, createWebhookServer, type WebhookRequest } from './handler';

let test: TestDb;
let h: Harness;

beforeAll(async () => {
  test = await createTestDb();
});
afterAll(async () => {
  await test.pg.close();
});
beforeEach(async () => {
  await test.reset();
  h = createHarness(test.db);
});

const SECRET = 'test-app-secret';
const VERIFY = 'test-verify-token';
const deps = () => ({ db: test.db, logger: h.logger });
const secs = (d: Date) => String(Math.floor(d.getTime() / 1000));
const digits = (phone: string) => phone.replace('+', '');

const status = (
  over: Partial<Extract<WhatsAppWebhookEvent, { kind: 'status' }>> & { providerMessageId: string },
): WhatsAppWebhookEvent => ({
  kind: 'status',
  status: 'delivered',
  at: new Date(h.clock.now().getTime() + 5_000),
  recipient: '+923000000001',
  ...over,
});

const inbound = (
  from: string,
  intent: 'opt_in' | 'opt_out' | 'other',
  at: Date,
  id = 'wamid.in.1',
): WhatsAppWebhookEvent => ({
  kind: 'inbound',
  providerMessageId: id,
  at,
  from,
  intent,
});

/** A consented person with one WhatsApp reminder, sent. */
async function sentWhatsApp() {
  const user = await seedUser(test.db);
  await seedConsent(test.db, user.id, { purpose: 'session_reminders' });
  const row = await h.queue_(
    whatsappDraft('wa-1', 'session_reminder', user.id, h.clock.now(), user.phoneE164),
  );
  await h.run();
  return { user, row: await h.row(row.id) };
}

describe('delivery status events', () => {
  it('moves a sent message to delivered, matched by the callback data, and clears the phone', async () => {
    const { row } = await sentWhatsApp();
    expect(row.status).toBe('sent');
    const summary = await applyWhatsAppEvents(deps(), [
      status({ providerMessageId: 'unrelated', callbackData: `outbox:${row.id}` }),
    ]);
    expect(summary).toMatchObject({ statusApplied: 1 });
    const after = await h.row(row.id);
    expect(after.status).toBe('delivered');
    expect(after.deliveredAt).not.toBeNull();
    expect(after.recipientPhoneE164).toBeNull();
  });

  it('matches by the provider message id when there is no callback data', async () => {
    const { row } = await sentWhatsApp();
    const { providerMessageId } = await h.row(row.id);
    expect(providerMessageId).toBeTruthy();
    await applyWhatsAppEvents(deps(), [status({ providerMessageId: providerMessageId! })]);
    expect((await h.row(row.id)).status).toBe('delivered');
  });

  it('treats read as delivered', async () => {
    const { row } = await sentWhatsApp();
    await applyWhatsAppEvents(deps(), [
      status({ providerMessageId: 'x', status: 'read', callbackData: `outbox:${row.id}` }),
    ]);
    expect((await h.row(row.id)).status).toBe('delivered');
  });

  it('only moves forward: a late sent or failed event cannot undo delivered, and replays change nothing', async () => {
    const { row } = await sentWhatsApp();
    const cb = `outbox:${row.id}`;
    await applyWhatsAppEvents(deps(), [status({ providerMessageId: 'x', callbackData: cb })]);
    const delivered = await h.row(row.id);
    const summary = await applyWhatsAppEvents(deps(), [
      status({ providerMessageId: 'x', callbackData: cb, status: 'sent' }),
      status({
        providerMessageId: 'x',
        callbackData: cb,
        status: 'failed',
        errorCode: 'wa_131026',
      }),
      status({ providerMessageId: 'x', callbackData: cb }),
    ]);
    expect(summary).toMatchObject({ statusApplied: 0, statusIgnored: 3 });
    expect(await h.row(row.id)).toEqual(delivered);
  });

  it('records a delivery failure with its error code', async () => {
    const { row } = await sentWhatsApp();
    await applyWhatsAppEvents(deps(), [
      status({
        providerMessageId: 'x',
        status: 'failed',
        errorCode: 'wa_131026',
        callbackData: `outbox:${row.id}`,
      }),
    ]);
    expect(await h.row(row.id)).toMatchObject({
      status: 'failed',
      lastErrorCode: 'wa_131026',
      recipientPhoneE164: null,
    });
  });

  it('ignores events for messages we do not know, and malformed callback data', async () => {
    await sentWhatsApp();
    const summary = await applyWhatsAppEvents(deps(), [
      status({ providerMessageId: 'wamid.unknown' }),
      status({ providerMessageId: 'wamid.unknown2', callbackData: 'outbox:not-a-uuid' }),
    ]);
    expect(summary).toMatchObject({ statusApplied: 0, statusIgnored: 2 });
    expect(outboxIdFromCallback('outbox:not-a-uuid')).toBeUndefined();
    expect(outboxIdFromCallback(undefined)).toBeUndefined();
  });
});

describe('opt-out and opt-in replies', () => {
  const consents = (userId: string) =>
    test.db.select().from(tables.consents).where(eq(tables.consents.userId, userId));
  const active = async (userId: string, purpose?: string) =>
    (await consents(userId)).filter(
      (c) => !c.revokedAt && c.channel === 'whatsapp' && (!purpose || c.purpose === purpose),
    );

  it('STOP revokes every active WhatsApp consent and leaves other channels alone', async () => {
    const user = await seedUser(test.db);
    await seedConsent(test.db, user.id, { purpose: 'session_reminders' });
    await seedConsent(test.db, user.id, { purpose: 'announcements' });
    await seedConsent(test.db, user.id, { purpose: 'session_reminders', channel: 'push' });
    const at = new Date('2026-11-02T09:00:00Z');
    const summary = await applyWhatsAppEvents(deps(), [inbound(user.phoneE164, 'opt_out', at)]);
    expect(summary.optedOut).toBe(1);
    expect(await active(user.id)).toHaveLength(0);
    const rows = await consents(user.id);
    expect(rows.filter((c) => c.channel === 'push' && !c.revokedAt)).toHaveLength(1);
    expect(
      rows
        .filter((c) => c.channel === 'whatsapp')
        .every((c) => c.revokedAt?.getTime() === at.getTime()),
    ).toBe(true);
  });

  it('after STOP the sender no longer sends WhatsApp to that person', async () => {
    const user = await seedUser(test.db);
    await seedConsent(test.db, user.id, { purpose: 'session_reminders' });
    await applyWhatsAppEvents(deps(), [
      inbound(user.phoneE164, 'opt_out', new Date('2026-11-02T09:00:00Z')),
    ]);
    const row = await h.queue_(
      whatsappDraft('wa-stop', 'session_reminder', user.id, h.clock.now(), user.phoneE164),
    );
    await h.run();
    expect(h.whatsapp.sent).toHaveLength(0);
    expect((await h.row(row.id)).status).toBe('failed');
  });

  it('a replayed STOP does not undo a later opt-in', async () => {
    const user = await seedUser(test.db);
    await seedConsent(test.db, user.id, { purpose: 'session_reminders' });
    const stopAt = new Date('2026-11-02T09:00:00Z');
    await applyWhatsAppEvents(deps(), [inbound(user.phoneE164, 'opt_out', stopAt)]);
    await seedConsent(test.db, user.id, {
      purpose: 'session_reminders',
      grantedAt: new Date('2026-11-02T09:30:00Z'),
    });
    const summary = await applyWhatsAppEvents(deps(), [inbound(user.phoneE164, 'opt_out', stopAt)]);
    expect(summary.optedOut).toBe(0);
    expect(await active(user.id, 'session_reminders')).toHaveLength(1);
  });

  it('START grants reminders and registration updates, once, and a replay changes nothing', async () => {
    const user = await seedUser(test.db);
    const at = new Date('2026-11-02T09:00:00Z');
    const first = await applyWhatsAppEvents(deps(), [inbound(user.phoneE164, 'opt_in', at)]);
    expect(first.optedIn).toBe(1);
    const granted = await active(user.id);
    expect(granted.map((c) => c.purpose).sort()).toEqual([
      'registration_updates',
      'session_reminders',
    ]);
    expect(granted.every((c) => c.source === 'whatsapp_reply' && c.venueId === null)).toBe(true);
    const second = await applyWhatsAppEvents(deps(), [inbound(user.phoneE164, 'opt_in', at)]);
    expect(second.optedIn).toBe(0);
    expect(await consents(user.id)).toHaveLength(2);
  });

  it('a replayed START cannot undo a later STOP', async () => {
    const user = await seedUser(test.db);
    const startAt = new Date('2026-11-02T09:00:00Z');
    await applyWhatsAppEvents(deps(), [inbound(user.phoneE164, 'opt_in', startAt)]);
    await applyWhatsAppEvents(deps(), [
      inbound(user.phoneE164, 'opt_out', new Date('2026-11-02T09:10:00Z'), 'wamid.in.2'),
    ]);
    expect(await active(user.id)).toHaveLength(0);
    const replay = await applyWhatsAppEvents(deps(), [inbound(user.phoneE164, 'opt_in', startAt)]);
    expect(replay.optedIn).toBe(0);
    expect(await active(user.id)).toHaveLength(0);
  });

  it('ignores ordinary chat and numbers that belong to nobody', async () => {
    const user = await seedUser(test.db);
    const at = new Date('2026-11-02T09:00:00Z');
    const summary = await applyWhatsAppEvents(deps(), [
      inbound(user.phoneE164, 'other', at),
      inbound('+923009999999', 'opt_in', at, 'wamid.in.3'),
      inbound('+923009999998', 'opt_out', at, 'wamid.in.4'),
    ]);
    expect(summary).toMatchObject({ optedIn: 0, optedOut: 0, inboundIgnored: 3 });
    expect(await consents(user.id)).toHaveLength(0);
    const all = await test.db.select().from(tables.consents);
    expect(all).toHaveLength(0);
  });

  it('never writes phone numbers to the log', async () => {
    const { user, row } = await sentWhatsApp();
    await applyWhatsAppEvents(deps(), [
      inbound(user.phoneE164, 'opt_out', new Date('2026-11-02T09:00:00Z')),
      status({
        providerMessageId: 'x',
        callbackData: `outbox:${row.id}`,
        recipient: user.phoneE164,
      }),
    ]);
    const dump = h.logger.dump();
    expect(dump).not.toContain(user.phoneE164);
    expect(dump).not.toContain(digits(user.phoneE164));
  });
});

describe('HTTP handler', () => {
  const memory = createMemoryLogger();
  const received: WhatsAppWebhookEvent[][] = [];
  const handler = (
    over: { fail?: boolean; appSecret?: string | undefined; verifyToken?: string | undefined } = {},
  ) =>
    createWebhookHandler({
      appSecret: 'appSecret' in over ? over.appSecret : SECRET,
      verifyToken: 'verifyToken' in over ? over.verifyToken : VERIFY,
      logger: memory,
      onEvents: async (events) => {
        if (over.fail) throw new Error('db down');
        received.push(events);
      },
    });
  beforeEach(() => {
    received.length = 0;
  });

  const body = (from: string, text: string, at: Date) =>
    JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  {
                    id: 'wamid.1',
                    from: digits(from),
                    timestamp: secs(at),
                    type: 'text',
                    text: { body: text },
                  },
                ],
              },
            },
          ],
        },
      ],
    });
  const post = (raw: string, signature?: string): WebhookRequest => ({
    method: 'POST',
    path: '/webhooks/whatsapp',
    query: {},
    headers: signature === undefined ? {} : { 'x-hub-signature-256': signature },
    rawBody: Buffer.from(raw),
  });

  it('answers the subscription handshake only with the right token', async () => {
    const ok = await handler()({
      method: 'GET',
      path: '/webhooks/whatsapp',
      query: { 'hub.mode': 'subscribe', 'hub.verify_token': VERIFY, 'hub.challenge': '12345' },
      headers: {},
      rawBody: new Uint8Array(),
    });
    expect(ok).toMatchObject({ status: 200, body: '12345' });
    const bad = await handler()({
      method: 'GET',
      path: '/webhooks/whatsapp',
      query: { 'hub.mode': 'subscribe', 'hub.verify_token': 'nope', 'hub.challenge': '1' },
      headers: {},
      rawBody: new Uint8Array(),
    });
    expect(bad.status).toBe(403);
  });

  it('accepts a correctly signed post and passes on normalised events without the message text', async () => {
    const raw = body('+923000000001', 'STOP', new Date('2026-11-02T09:00:00Z'));
    const res = await handler()(post(raw, signWebhookBody(SECRET, raw)));
    expect(res.status).toBe(200);
    expect(received).toHaveLength(1);
    expect(received[0]![0]).toMatchObject({ kind: 'inbound', intent: 'opt_out' });
    expect(JSON.stringify(received)).not.toContain('STOP');
  });

  it('rejects missing, wrong and tampered signatures without parsing', async () => {
    const raw = body('+923000000001', 'STOP', new Date('2026-11-02T09:00:00Z'));
    const sig = signWebhookBody(SECRET, raw);
    expect((await handler()(post(raw))).status).toBe(401);
    expect((await handler()(post(raw, signWebhookBody('other-secret', raw)))).status).toBe(401);
    expect((await handler()(post(raw.replace('STOP', 'START'), sig))).status).toBe(401);
    expect(received).toHaveLength(0);
  });

  it('answers 503 when the secrets are not configured, and 404 or 405 for other routes', async () => {
    const raw = '{}';
    expect(
      (await handler({ appSecret: undefined })(post(raw, signWebhookBody(SECRET, raw)))).status,
    ).toBe(503);
    expect(
      (
        await handler({ verifyToken: undefined })({
          method: 'GET',
          path: '/webhooks/whatsapp',
          query: {},
          headers: {},
          rawBody: new Uint8Array(),
        })
      ).status,
    ).toBe(503);
    expect(
      (
        await handler()({
          method: 'GET',
          path: '/nope',
          query: {},
          headers: {},
          rawBody: new Uint8Array(),
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await handler()({
          method: 'PUT',
          path: '/webhooks/whatsapp',
          query: {},
          headers: {},
          rawBody: new Uint8Array(),
        })
      ).status,
    ).toBe(405);
  });

  it('answers 400 for a signed body that is not JSON and 500 when storing fails, so Meta retries', async () => {
    const junk = 'not json';
    expect((await handler()(post(junk, signWebhookBody(SECRET, junk)))).status).toBe(400);
    const raw = body('+923000000001', 'STOP', new Date('2026-11-02T09:00:00Z'));
    expect((await handler({ fail: true })(post(raw, signWebhookBody(SECRET, raw)))).status).toBe(
      500,
    );
  });

  it('serves a health check', async () => {
    const res = await createWebhookHandler({
      appSecret: SECRET,
      verifyToken: VERIFY,
      logger: memory,
      onEvents: async () => {},
      health: async () => ({ ok: true, details: { queued: 0 } }),
    })({ method: 'GET', path: '/healthz', query: {}, headers: {}, rawBody: new Uint8Array() });
    expect(res).toMatchObject({ status: 200, contentType: 'application/json' });
    const down = await createWebhookHandler({
      appSecret: SECRET,
      verifyToken: VERIFY,
      logger: memory,
      onEvents: async () => {},
      health: async () => {
        throw new Error('x');
      },
    })({ method: 'GET', path: '/healthz', query: {}, headers: {}, rawBody: new Uint8Array() });
    expect(down.status).toBe(503);
  });

  it('runs end to end over a loopback socket and applies STOP to the database', async () => {
    const user = await seedUser(test.db);
    await seedConsent(test.db, user.id, { purpose: 'session_reminders' });
    const wired = createWebhookHandler({
      appSecret: SECRET,
      verifyToken: VERIFY,
      logger: memory,
      onEvents: (events) => applyWhatsAppEvents(deps(), events),
    });
    const server = createWebhookServer(wired, memory);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;
    try {
      const raw = body(user.phoneE164, ' Stop. ', new Date('2026-11-02T09:00:00Z'));
      const ok = await fetch(`http://127.0.0.1:${port}/webhooks/whatsapp`, {
        method: 'POST',
        body: raw,
        headers: {
          'x-hub-signature-256': signWebhookBody(SECRET, raw),
          'content-type': 'application/json',
        },
      });
      expect(ok.status).toBe(200);
      const open = await test.db
        .select()
        .from(tables.consents)
        .where(and(eq(tables.consents.userId, user.id), eq(tables.consents.channel, 'whatsapp')));
      expect(open.every((c) => c.revokedAt !== null)).toBe(true);

      const forged = await fetch(`http://127.0.0.1:${port}/webhooks/whatsapp`, {
        method: 'POST',
        body: raw,
        headers: { 'x-hub-signature-256': 'sha256=00' },
      });
      expect(forged.status).toBe(401);

      const handshake = await fetch(
        `http://127.0.0.1:${port}/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=${VERIFY}&hub.challenge=abc`,
      );
      expect(await handshake.text()).toBe('abc');

      const huge = await fetch(`http://127.0.0.1:${port}/webhooks/whatsapp`, {
        method: 'POST',
        body: 'x'.repeat(1_100_000),
      });
      expect(huge.status).toBe(413);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    expect(memory.dump()).not.toContain(user.phoneE164);
  });
});
