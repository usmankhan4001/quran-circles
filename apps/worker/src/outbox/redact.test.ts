import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { draftTemplateRow } from '@qc/messaging';
import { tables } from '../db';
import { createTestDb, type TestDb } from '../test/db';
import {
  NO_JITTER,
  createHarness,
  pushDraft,
  updatePush,
  whatsappDraft,
  type Harness,
} from '../test/harness';
import { nextPhone, seedConsent, seedDevice, seedUser } from '../test/seed';
import {
  applyDeliveryReport,
  claimDue,
  reclaimStale,
  redactFinishedPayloads,
  redactedPayload,
} from './repo';

// SEC-06: once a row is finished, its payload keeps only what the audit trail needs.

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

const REDACTED_CONFIRMATION = {
  channel: 'whatsapp',
  template: 'registration_confirmation',
  locale: 'en',
  redacted: true,
};

const confirmation = async (key: string) => {
  const user = await seedUser(test.db);
  await seedConsent(test.db, user.id, { purpose: 'registration_updates' });
  return h.queue_(
    whatsappDraft(key, 'registration_confirmation', user.id, h.clock.now(), user.phoneE164),
  );
};

const invite = (key: string) =>
  h.queue_(
    draftTemplateRow({
      idempotencyKey: key,
      channel: 'whatsapp',
      template: 'coordinator_invite',
      locale: 'ur',
      variables: { inviterName: 'Bilal Ahmed', scopeName: 'Test Masjid', link: 'https://x.test/i' },
      recipientPhoneE164: nextPhone(),
      sendAt: h.clock.now(),
    }),
  );

describe('redaction on each finishing transition', () => {
  it('a sent WhatsApp message keeps its template and locale, not the name or wording', async () => {
    const row = await confirmation('c:1');
    expect(JSON.stringify(row.payload)).toContain('Aisha Khan');
    await h.run();
    const after = await h.row(row.id);
    expect(after.status).toBe('sent');
    expect(after.payload).toEqual(REDACTED_CONFIRMATION);
    // What was sent was the full message.
    expect(h.whatsapp.sent[0]!.bodyParams).toContain('Aisha Khan');
  });

  it("a sent invitation loses the inviter's name, so it cannot outlive their account", async () => {
    const row = await invite('i:1');
    await h.run();
    const after = await h.row(row.id);
    expect(after.status).toBe('sent');
    expect(after.payload).toEqual({
      channel: 'whatsapp',
      template: 'coordinator_invite',
      locale: 'ur',
      redacted: true,
    });
    expect(JSON.stringify(after.payload)).not.toContain('Bilal');
  });

  it('a sent push keeps its type, deep link and ids, not its title or text', async () => {
    const user = await seedUser(test.db);
    await seedDevice(test.db, user.id);
    const base = updatePush();
    const push = {
      ...base,
      data: { ...base.data, updateId: '00000000-0000-4000-8000-0000000000d1' },
      collapseKey: 'update:d1',
    };
    const row = await h.queue_(pushDraft('p:1', user.id, h.clock.now(), push));
    await h.run();
    const after = await h.row(row.id);
    expect(after.status).toBe('sent');
    expect(after.payload).toEqual({ channel: 'push', push: { data: push.data }, redacted: true });
  });

  it('a row the gate refused is redacted', async () => {
    const user = await seedUser(test.db); // no consent
    const row = await h.queue_(
      whatsappDraft('g:1', 'registration_confirmation', user.id, h.clock.now(), user.phoneE164),
    );
    await h.run();
    const after = await h.row(row.id);
    expect(after).toMatchObject({ status: 'failed', lastErrorCode: 'gate_no_consent' });
    expect(after.payload).toEqual(REDACTED_CONFIRMATION);
  });

  it('a row whose recipient account was deleted is refused and redacted', async () => {
    const row = await confirmation('del:1');
    // Account deletion: the user row goes (recipient set to null); the phone was cleared with it.
    await test.db
      .update(tables.messageOutbox)
      .set({ recipientPhoneE164: null })
      .where(eq(tables.messageOutbox.id, row.id));
    await test.db.delete(tables.users).where(eq(tables.users.id, row.recipientUserId!));
    await h.run();
    const after = await h.row(row.id);
    expect(after).toMatchObject({
      status: 'failed',
      lastErrorCode: 'gate_no_recipient',
      recipientUserId: null,
    });
    expect(after.payload).toEqual(REDACTED_CONFIRMATION);
    expect(h.whatsapp.sent).toHaveLength(0);
  });

  it('a row waiting for a retry keeps its full payload, and the dead letter is redacted', async () => {
    h.whatsapp.respondWith(() => ({ status: 'transient_failure', code: 'wa_130429' }));
    const row = await confirmation('r:1');
    await h.run();
    const waiting = await h.row(row.id);
    expect(waiting.status).toBe('queued');
    expect(waiting.payload).toEqual(row.payload);
    for (let i = 1; i < NO_JITTER.maxAttempts; i++) {
      h.clock.advance(3_600_000);
      await h.run();
    }
    const dead = await h.row(row.id);
    expect(dead.status).toBe('dead');
    expect(dead.payload).toEqual(REDACTED_CONFIRMATION);
  });

  it('a permanent provider failure is redacted', async () => {
    h.whatsapp.failNext({ status: 'permanent_failure', code: 'wa_131026', cause: 'recipient' });
    const row = await confirmation('f:1');
    await h.run();
    const after = await h.row(row.id);
    expect(after.status).toBe('failed');
    expect(after.payload).toEqual(REDACTED_CONFIRMATION);
  });

  it("a crashed worker's row that runs out of attempts is redacted", async () => {
    const row = await confirmation('crash:1');
    for (let i = 0; i < NO_JITTER.maxAttempts; i++) {
      await claimDue(test.db, { now: h.clock.now(), limit: 10, leaseMs: 60_000 });
      h.clock.advance(61_000);
      await reclaimStale(test.db, { now: h.clock.now(), maxAttempts: NO_JITTER.maxAttempts });
    }
    const after = await h.row(row.id);
    expect(after).toMatchObject({ status: 'dead', lastErrorCode: 'worker_lost' });
    expect(after.payload).toEqual(REDACTED_CONFIRMATION);
  });

  it('a delivery report that fails or delivers a row still being sent redacts it', async () => {
    const failed = await confirmation('wh:1');
    const delivered = await confirmation('wh:2');
    await claimDue(test.db, { now: h.clock.now(), limit: 10, leaseMs: 60_000 });
    await applyDeliveryReport(
      test.db,
      { id: failed.id },
      { status: 'failed', at: h.clock.now(), errorCode: 'wa_131049' },
    );
    await applyDeliveryReport(
      test.db,
      { id: delivered.id },
      { status: 'delivered', at: h.clock.now() },
    );
    expect((await h.row(failed.id)).payload).toEqual(REDACTED_CONFIRMATION);
    expect((await h.row(delivered.id)).payload).toEqual(REDACTED_CONFIRMATION);
  });
});

describe('redactFinishedPayloads', () => {
  const setStatus = (id: string, status: 'sent' | 'delivered' | 'failed' | 'dead' | 'sending') =>
    test.db.update(tables.messageOutbox).set({ status }).where(eq(tables.messageOutbox.id, id));

  it('redacts finished rows that still hold their payload, and leaves unfinished ones', async () => {
    const sent = await confirmation('s:1');
    const delivered = await confirmation('s:2');
    const failed = await invite('s:3');
    const dead = await confirmation('s:4');
    const queued = await confirmation('s:5');
    const sending = await confirmation('s:6');
    await setStatus(sent.id, 'sent');
    await setStatus(delivered.id, 'delivered');
    await setStatus(failed.id, 'failed');
    await setStatus(dead.id, 'dead');
    await setStatus(sending.id, 'sending');

    expect(await redactFinishedPayloads(test.db, { batchSize: 2 })).toBe(4);
    for (const id of [sent.id, delivered.id, dead.id]) {
      expect((await h.row(id)).payload).toEqual(REDACTED_CONFIRMATION);
    }
    expect((await h.row(failed.id)).payload).toMatchObject({ redacted: true });
    expect((await h.row(queued.id)).payload).toEqual(queued.payload);
    expect((await h.row(sending.id)).payload).toEqual(sending.payload);
    // A second run finds nothing to do.
    expect(await redactFinishedPayloads(test.db)).toBe(0);
  });

  it('leaves an empty payload (cleared by account deletion) empty', async () => {
    const row = await confirmation('e:1');
    await test.db
      .update(tables.messageOutbox)
      .set({ status: 'dead', payload: {} })
      .where(eq(tables.messageOutbox.id, row.id));
    expect(await redactFinishedPayloads(test.db)).toBe(0);
    expect((await h.row(row.id)).payload).toEqual({});
  });

  it('redacting twice gives the same result', async () => {
    const row = await confirmation('t:1');
    const update = () =>
      test.db
        .update(tables.messageOutbox)
        .set({ payload: redactedPayload() })
        .where(eq(tables.messageOutbox.id, row.id));
    await update();
    const once = (await h.row(row.id)).payload;
    await update();
    expect((await h.row(row.id)).payload).toEqual(once);
    expect(once).toEqual(REDACTED_CONFIRMATION);
  });
});
