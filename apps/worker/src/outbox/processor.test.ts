import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { draftTemplateRow } from '@qc/messaging';
import { tables } from '../db';
import { claimDue, reclaimStale } from './repo';
import { processClaimedRow, processJob } from './processor';
import { createTestDb, type TestDb } from '../test/db';
import {
  NO_JITTER,
  OCCURRENCE_ID,
  createHarness,
  pushDraft,
  reminderPush,
  whatsappDraft,
  type Harness,
} from '../test/harness';
import {
  nextPhone,
  seedConsent,
  seedDevice,
  seedOccurrence,
  seedUser,
  seedWorld,
} from '../test/seed';

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

describe('push', () => {
  it("sends to the person's devices and records the outcome", async () => {
    const user = await seedUser(test.db);
    const d1 = await seedDevice(test.db, user.id, { provider: 'fcm' });
    const d2 = await seedDevice(test.db, user.id, { provider: 'apns', platform: 'ios' });
    const row = await h.queue_(pushDraft('update:1:push', user.id, h.clock.now()));
    await h.run();
    const after = await h.row(row.id);
    expect(after.status).toBe('sent');
    expect(after.attempts).toBe(1);
    expect(after.sentAt).toEqual(h.clock.now());
    expect(h.push.sent.map((s) => s.target)).toEqual([
      { kind: 'fcm', token: d1.token },
      { kind: 'apns', token: d2.token },
    ]);
  });

  it('revokes a device the provider reports dead, and still succeeds on the others', async () => {
    const user = await seedUser(test.db);
    const dead = await seedDevice(test.db, user.id);
    const alive = await seedDevice(test.db, user.id);
    h.push.invalidateToken(dead.token);
    const row = await h.queue_(pushDraft('update:2:push', user.id, h.clock.now()));
    await h.run();
    expect((await h.row(row.id)).status).toBe('sent');
    const devices = await test.db.select().from(tables.devices);
    expect(devices.find((d) => d.id === dead.id)?.revokedAt).toEqual(h.clock.now());
    expect(devices.find((d) => d.id === alive.id)?.revokedAt).toBeNull();
  });

  it('fails with no_working_push when every token is dead, and never tries them again', async () => {
    const user = await seedUser(test.db);
    const dead = await seedDevice(test.db, user.id);
    h.push.invalidateToken(dead.token);
    const row = await h.queue_(pushDraft('update:3:push', user.id, h.clock.now()));
    await h.run();
    const after = await h.row(row.id);
    expect(after.status).toBe('failed');
    expect(after.lastErrorCode).toBe('no_working_push');
    // A second push for the same person finds no working device and does not call the provider.
    h.push.reset();
    const again = await h.queue_(pushDraft('update:3b:push', user.id, h.clock.now()));
    await h.run();
    expect((await h.row(again.id)).lastErrorCode).toBe('gate_no_working_push');
    expect(h.push.sent).toHaveLength(0);
  });

  it('retries a transient provider failure with backoff and then succeeds', async () => {
    const user = await seedUser(test.db);
    await seedDevice(test.db, user.id);
    h.push.failNext({ status: 'transient_failure', code: 'fcm_unavailable' });
    const row = await h.queue_(pushDraft('update:4:push', user.id, h.clock.now()));
    await h.run();
    let after = await h.row(row.id);
    expect(after.status).toBe('queued');
    expect(after.attempts).toBe(1);
    expect(after.lastErrorCode).toBe('fcm_unavailable');
    expect(after.nextAttemptAt).toEqual(new Date(h.clock.now().getTime() + 60_000));

    await h.run(); // not due yet
    expect(h.push.sent).toHaveLength(1);

    h.clock.advance(60_000);
    await h.run();
    after = await h.row(row.id);
    expect(after.status).toBe('sent');
    expect(after.attempts).toBe(2);
    expect(h.push.sent).toHaveLength(2);
  });

  it('suppresses push for a person who revoked push for the purpose', async () => {
    const user = await seedUser(test.db);
    await seedDevice(test.db, user.id);
    await seedConsent(test.db, user.id, {
      channel: 'push',
      purpose: 'announcements',
      revokedAt: new Date('2026-02-01T00:00:00Z'),
    });
    const row = await h.queue_(pushDraft('update:5:push', user.id, h.clock.now()));
    await h.run();
    expect((await h.row(row.id)).lastErrorCode).toBe('gate_push_opted_out');
    expect(h.push.sent).toHaveLength(0);
  });

  it('refuses a suspended account', async () => {
    const user = await seedUser(test.db, { status: 'suspended' });
    await seedDevice(test.db, user.id);
    const row = await h.queue_(pushDraft('update:6:push', user.id, h.clock.now()));
    await h.run();
    expect((await h.row(row.id)).lastErrorCode).toBe('gate_account_inactive');
  });
});

describe('WhatsApp and the consent gate', () => {
  it('sends an approved template with positional variables and clears the phone', async () => {
    const user = await seedUser(test.db);
    await seedConsent(test.db, user.id, { purpose: 'registration_updates' });
    const row = await h.queue_(
      whatsappDraft(
        'registration_confirmation:r1:whatsapp',
        'registration_confirmation',
        user.id,
        h.clock.now(),
        user.phoneE164,
      ),
    );
    expect(row.recipientPhoneE164).toBe(user.phoneE164);
    await h.run();
    const after = await h.row(row.id);
    expect(after.status).toBe('sent');
    expect(after.recipientPhoneE164).toBeNull();
    expect(after.providerMessageId).toMatch(/^wamid\.fake-/);
    // The id lives in its own column now, not inside the payload.
    expect(after.payload).not.toHaveProperty('providerMessageId');
    expect(h.whatsapp.sent).toHaveLength(1);
    expect(h.whatsapp.sent[0]).toMatchObject({
      to: user.phoneE164,
      templateName: 'qc_registration_confirmation',
      language: 'en',
      bodyParams: [
        'Aisha Khan',
        'Weekly tafsir',
        'Test Masjid',
        'Fri 7:30 pm',
        'https://x.test/o/1',
      ],
      callbackData: `outbox:${row.id}`,
    });
  });

  it('falls back to the account phone when the row has none', async () => {
    const user = await seedUser(test.db);
    await seedConsent(test.db, user.id, { purpose: 'registration_updates' });
    await h.queue_(
      whatsappDraft(
        'registration_confirmation:r2:whatsapp',
        'registration_confirmation',
        user.id,
        h.clock.now(),
      ),
    );
    await h.run();
    expect(h.whatsapp.sent[0]!.to).toBe(user.phoneE164);
  });

  type Case = {
    name: string;
    setup: (userId: string) => Promise<void>;
    template: 'session_reminder' | 'session_changed' | 'registration_confirmation';
    withDevice?: boolean;
    expectedStatus: 'sent' | 'failed';
    expectedCode?: string;
  };
  const cases: Case[] = [
    {
      name: 'no consent record',
      setup: async () => {},
      template: 'registration_confirmation',
      expectedStatus: 'failed',
      expectedCode: 'gate_no_consent',
    },
    {
      name: 'consent revoked',
      setup: async (u) =>
        void (await seedConsent(test.db, u, {
          purpose: 'registration_updates',
          revokedAt: new Date('2026-03-01T00:00:00Z'),
        })),
      template: 'registration_confirmation',
      expectedStatus: 'failed',
      expectedCode: 'gate_no_consent',
    },
    {
      name: 'consent for a different purpose',
      setup: async (u) => void (await seedConsent(test.db, u, { purpose: 'announcements' })),
      template: 'registration_confirmation',
      expectedStatus: 'failed',
      expectedCode: 'gate_no_consent',
    },
    {
      name: 'consent on a different channel',
      setup: async (u) =>
        void (await seedConsent(test.db, u, { purpose: 'registration_updates', channel: 'sms' })),
      template: 'registration_confirmation',
      expectedStatus: 'failed',
      expectedCode: 'gate_no_consent',
    },
    {
      name: 'active consent',
      setup: async (u) => void (await seedConsent(test.db, u, { purpose: 'registration_updates' })),
      template: 'registration_confirmation',
      expectedStatus: 'sent',
    },
    {
      name: 'non-critical reminder while push works',
      setup: async (u) => void (await seedConsent(test.db, u, { purpose: 'session_reminders' })),
      template: 'session_reminder',
      withDevice: true,
      expectedStatus: 'failed',
      expectedCode: 'gate_push_available',
    },
    {
      name: 'non-critical reminder for a person with no push',
      setup: async (u) => void (await seedConsent(test.db, u, { purpose: 'session_reminders' })),
      template: 'session_reminder',
      expectedStatus: 'sent',
    },
    {
      name: 'critical change with push working',
      setup: async (u) => void (await seedConsent(test.db, u, { purpose: 'registration_updates' })),
      template: 'session_changed',
      withDevice: true,
      expectedStatus: 'sent',
    },
    {
      name: 'critical change without consent, push working',
      setup: async () => {},
      template: 'session_changed',
      withDevice: true,
      expectedStatus: 'failed',
      expectedCode: 'gate_no_consent',
    },
  ];
  it.each(cases)('$name', async (c) => {
    const user = await seedUser(test.db);
    await c.setup(user.id);
    if (c.withDevice) await seedDevice(test.db, user.id);
    const row = await h.queue_(
      whatsappDraft(`case:${c.name}`, c.template, user.id, h.clock.now(), user.phoneE164),
    );
    await h.run();
    const after = await h.row(row.id);
    expect(after.status).toBe(c.expectedStatus);
    if (c.expectedCode) expect(after.lastErrorCode).toBe(c.expectedCode);
    // The point of the gate: a blocked message never reaches the provider.
    expect(h.whatsapp.sent).toHaveLength(c.expectedStatus === 'sent' ? 1 : 0);
  });

  it('a venue-specific consent does not cover a message whose venue is unknown', async () => {
    const world = await seedWorld(test.db);
    const user = await seedUser(test.db);
    await seedConsent(test.db, user.id, {
      purpose: 'registration_updates',
      venueId: world.venue.id,
    });
    const row = await h.queue_(
      whatsappDraft('venue:1', 'registration_confirmation', user.id, h.clock.now(), user.phoneE164),
    );
    await h.run();
    expect((await h.row(row.id)).lastErrorCode).toBe('gate_no_consent');
  });

  it('a venue-specific consent covers a message whose row names that venue', async () => {
    const world = await seedWorld(test.db);
    const user = await seedUser(test.db);
    await seedConsent(test.db, user.id, {
      purpose: 'registration_updates',
      venueId: world.venue.id,
    });
    const row = await h.queue_({
      ...whatsappDraft(
        'venue:2',
        'registration_confirmation',
        user.id,
        h.clock.now(),
        user.phoneE164,
      ),
      venueId: world.venue.id,
    });
    await h.run();
    expect((await h.row(row.id)).status).toBe('sent');
  });

  it('a venue-specific consent does not cover a message about another venue', async () => {
    const world = await seedWorld(test.db);
    const elsewhere = await seedWorld(test.db);
    const user = await seedUser(test.db);
    await seedConsent(test.db, user.id, {
      purpose: 'registration_updates',
      venueId: world.venue.id,
    });
    const row = await h.queue_({
      ...whatsappDraft(
        'venue:3',
        'registration_confirmation',
        user.id,
        h.clock.now(),
        user.phoneE164,
      ),
      venueId: elsewhere.venue.id,
    });
    await h.run();
    expect((await h.row(row.id)).lastErrorCode).toBe('gate_no_consent');
  });

  it('a row queued before the venue column existed still finds its venue from its push', async () => {
    const world = await seedWorld(test.db);
    const user = await seedUser(test.db);
    await seedDevice(test.db, user.id);
    // The person turned reminders off for this venue only.
    await seedConsent(test.db, user.id, {
      channel: 'push',
      purpose: 'session_reminders',
      venueId: world.venue.id,
      revokedAt: new Date('2026-01-03T00:00:00Z'),
    });
    const row = await h.queue_(
      pushDraft('old:1', user.id, h.clock.now(), reminderPush({ sessionId: world.session.id })),
    );
    expect(row.venueId).toBeNull();
    await h.run();
    expect((await h.row(row.id)).lastErrorCode).toBe('gate_push_opted_out');
  });

  it('sign-in-style templates need no consent and no account', async () => {
    const row = await h.queue_(
      draftTemplateRow({
        idempotencyKey: 'invite:1:sms',
        channel: 'sms',
        template: 'coordinator_invite',
        locale: 'en',
        variables: { inviterName: 'Ali', scopeName: 'Test Masjid', link: 'https://x.test/i/1' },
        recipientPhoneE164: nextPhone(),
        sendAt: h.clock.now(),
      }),
    );
    await h.run();
    const after = await h.row(row.id);
    expect(after.status).toBe('sent');
    expect(h.sms.sent).toHaveLength(1);
    expect(h.sms.sent[0]!.body).toContain('Ali invited you to help run Test Masjid');
    expect(after.recipientPhoneE164).toBeNull();
  });

  it('retries a template or configuration problem, since a person can fix it', async () => {
    const user = await seedUser(test.db);
    await seedConsent(test.db, user.id, { purpose: 'registration_updates' });
    h.whatsapp.failNext({ status: 'permanent_failure', code: 'wa_132001', cause: 'template' });
    const row = await h.queue_(
      whatsappDraft('tpl:1', 'registration_confirmation', user.id, h.clock.now(), user.phoneE164),
    );
    await h.run();
    const after = await h.row(row.id);
    expect(after.status).toBe('queued');
    expect(after.lastErrorCode).toBe('wa_132001');
    expect(after.recipientPhoneE164).toBe(user.phoneE164);
    expect(
      h.logger.lines.some(
        (l) => l.event === 'provider.operator_action_needed' && l.level === 'error',
      ),
    ).toBe(true);
  });

  it('fails a recipient problem at once, with no retry', async () => {
    const user = await seedUser(test.db);
    await seedConsent(test.db, user.id, { purpose: 'registration_updates' });
    h.whatsapp.failNext({ status: 'permanent_failure', code: 'wa_131026', cause: 'recipient' });
    const row = await h.queue_(
      whatsappDraft('rcpt:1', 'registration_confirmation', user.id, h.clock.now(), user.phoneE164),
    );
    await h.run();
    const after = await h.row(row.id);
    expect(after.status).toBe('failed');
    expect(after.lastErrorCode).toBe('wa_131026');
    expect(after.recipientPhoneE164).toBeNull();
    h.clock.advance(24 * 3_600_000);
    await h.run();
    expect(h.whatsapp.sent).toHaveLength(1);
  });

  it('lands in the dead-letter state after the last retry, visibly, and clears the phone', async () => {
    const user = await seedUser(test.db);
    await seedConsent(test.db, user.id, { purpose: 'registration_updates' });
    h.whatsapp.respondWith(() => ({ status: 'transient_failure', code: 'wa_130429' }));
    const row = await h.queue_(
      whatsappDraft('dead:1', 'registration_confirmation', user.id, h.clock.now(), user.phoneE164),
    );
    const seen: string[] = [];
    for (let i = 0; i < NO_JITTER.maxAttempts; i++) {
      await h.run();
      seen.push((await h.row(row.id)).status);
      h.clock.advance(3_600_000);
    }
    expect(seen).toEqual(['queued', 'queued', 'dead']);
    const after = await h.row(row.id);
    expect(after.attempts).toBe(3);
    expect(after.lastErrorCode).toBe('wa_130429');
    expect(after.recipientPhoneE164).toBeNull();
    expect(h.whatsapp.sent).toHaveLength(3);
    // Dead is terminal: nothing more is sent.
    await h.run();
    expect(h.whatsapp.sent).toHaveLength(3);
    expect(h.logger.lines.some((l) => l.event === 'outbox.dead' && l.level === 'warn')).toBe(true);
  });

  it('honours the provider retry-after when it is longer than the backoff', async () => {
    const user = await seedUser(test.db);
    await seedConsent(test.db, user.id, { purpose: 'registration_updates' });
    h.whatsapp.failNext({ status: 'transient_failure', code: 'wa_130429', retryAfterMs: 900_000 });
    const row = await h.queue_(
      whatsappDraft('ra:1', 'registration_confirmation', user.id, h.clock.now(), user.phoneE164),
    );
    await h.run();
    expect((await h.row(row.id)).nextAttemptAt).toEqual(
      new Date(h.clock.now().getTime() + 900_000),
    );
  });
});

describe('idempotency and crash safety', () => {
  it('a duplicate outbox insert produces one row and one message', async () => {
    const user = await seedUser(test.db);
    await seedDevice(test.db, user.id);
    const draft = pushDraft('dup:1', user.id, h.clock.now());
    await h.queue_(draft);
    await h.queue_(draft);
    await h.queue_(draft);
    const rows = await test.db.select().from(tables.messageOutbox);
    expect(rows).toHaveLength(1);
    await h.run();
    await h.run();
    expect(h.push.sent).toHaveLength(1);
  });

  it('processing the same job twice sends once', async () => {
    const user = await seedUser(test.db);
    await seedDevice(test.db, user.id);
    const row = await h.queue_(pushDraft('dup:2', user.id, h.clock.now()));
    await h.dispatcher.tick();
    const [job] = h.queue.jobs;
    expect(job).toEqual({ outboxId: row.id, attempt: 1 });
    expect(await processJob(h.deps, job!)).toEqual({ outcome: 'sent' });
    expect(await processJob(h.deps, job!)).toEqual({ outcome: 'skipped' });
    expect(h.push.sent).toHaveLength(1);
  });

  it('ignores a job for an earlier attempt', async () => {
    const user = await seedUser(test.db);
    await seedDevice(test.db, user.id);
    h.push.failNext({ status: 'transient_failure', code: 'x' });
    const row = await h.queue_(pushDraft('dup:3', user.id, h.clock.now()));
    await h.run();
    expect(await processJob(h.deps, { outboxId: row.id, attempt: 1 })).toEqual({
      outcome: 'skipped',
    });
  });

  it('two claimers never take the same row', async () => {
    const user = await seedUser(test.db);
    for (let i = 0; i < 6; i++) await h.queue_(pushDraft(`claim:${i}`, user.id, h.clock.now()));
    const [a, b] = await Promise.all([
      claimDue(test.db, { now: h.clock.now(), limit: 4, leaseMs: 60_000 }),
      claimDue(test.db, { now: h.clock.now(), limit: 4, leaseMs: 60_000 }),
    ]);
    const ids = [...a, ...b].map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(6);
  });

  it('does not claim a row scheduled for later', async () => {
    const user = await seedUser(test.db);
    await h.queue_(pushDraft('later:1', user.id, new Date(h.clock.now().getTime() + 60_000)));
    expect(await claimDue(test.db, { now: h.clock.now(), limit: 10, leaseMs: 60_000 })).toEqual([]);
  });

  it("hands a crashed worker's row back after the lease, and kills a row that keeps crashing", async () => {
    const user = await seedUser(test.db);
    await seedDevice(test.db, user.id);
    const row = await h.queue_(pushDraft('crash:1', user.id, h.clock.now()));
    await claimDue(test.db, { now: h.clock.now(), limit: 10, leaseMs: 60_000 }); // worker dies here
    expect((await h.row(row.id)).status).toBe('sending');

    expect(await reclaimStale(test.db, { now: h.clock.now(), maxAttempts: 3 })).toEqual({
      requeued: 0,
      dead: 0,
    });
    h.clock.advance(61_000);
    expect(await reclaimStale(test.db, { now: h.clock.now(), maxAttempts: 3 })).toEqual({
      requeued: 1,
      dead: 0,
    });
    await h.run();
    expect((await h.row(row.id)).status).toBe('sent');

    const poison = await h.queue_(pushDraft('crash:2', user.id, h.clock.now()));
    for (let i = 0; i < 3; i++) {
      await claimDue(test.db, { now: h.clock.now(), limit: 10, leaseMs: 60_000 });
      h.clock.advance(61_000);
      await reclaimStale(test.db, { now: h.clock.now(), maxAttempts: 3 });
    }
    const after = await h.row(poison.id);
    expect(after.status).toBe('dead');
    expect(after.lastErrorCode).toBe('worker_lost');
  });
});

describe('payload validation', () => {
  it('fails a row whose payload is not a valid OutboxPayload, without calling a provider', async () => {
    const user = await seedUser(test.db);
    const [row] = await test.db
      .insert(tables.messageOutbox)
      .values({
        idempotencyKey: 'bad:1',
        channel: 'whatsapp',
        recipientUserId: user.id,
        payload: {
          channel: 'whatsapp',
          template: 'session_reminder',
          locale: 'en',
          variables: { sessionTitle: 'x' },
        },
        costCategory: 'utility',
      })
      .returning();
    await h.run();
    expect((await h.row(row!.id)).lastErrorCode).toBe('invalid_payload');
    expect(h.whatsapp.sent).toHaveLength(0);
  });

  it('fails a row whose payload channel disagrees with its column', async () => {
    const user = await seedUser(test.db);
    await seedDevice(test.db, user.id);
    const draft = pushDraft('bad:2', user.id, h.clock.now());
    const [row] = await test.db
      .insert(tables.messageOutbox)
      .values({ ...draft, channel: 'whatsapp' })
      .returning();
    await h.run();
    expect((await h.row(row!.id)).lastErrorCode).toBe('payload_channel_mismatch');
  });

  it('rejects an empty payload object', async () => {
    const user = await seedUser(test.db);
    const [row] = await test.db
      .insert(tables.messageOutbox)
      .values({
        idempotencyKey: 'bad:3',
        channel: 'push',
        recipientUserId: user.id,
        costCategory: 'free',
      })
      .returning();
    await h.run();
    expect((await h.row(row!.id)).lastErrorCode).toBe('invalid_payload');
  });
});

describe('reminders are not sent late', () => {
  it('fails a reminder whose session has started, and one whose occurrence was cancelled', async () => {
    const world = await seedWorld(test.db);
    const user = await seedUser(test.db);
    await seedDevice(test.db, user.id);
    const started = await seedOccurrence(
      test.db,
      world.session.id,
      new Date(h.clock.now().getTime() - 60_000),
    );
    const cancelled = await seedOccurrence(
      test.db,
      world.session.id,
      new Date(h.clock.now().getTime() + 7_200_000),
      { status: 'cancelled' },
    );
    const live = await seedOccurrence(
      test.db,
      world.session.id,
      new Date(h.clock.now().getTime() + 14_400_000),
    );
    const rows = await Promise.all(
      [started, cancelled, live].map((o) =>
        h.queue_(
          pushDraft(
            `reminder:${o.id}:${user.id}:push`,
            user.id,
            h.clock.now(),
            reminderPush({ occurrenceId: o.id }),
          ),
        ),
      ),
    );
    await h.run();
    const results = await Promise.all(rows.map((r) => h.row(r.id)));
    expect(results.map((r) => [r.status, r.lastErrorCode])).toEqual([
      ['failed', 'expired'],
      ['failed', 'occurrence_cancelled'],
      ['sent', null],
    ]);
    expect(h.push.sent).toHaveLength(1);
  });

  it('fails a reminder for an occurrence that no longer exists', async () => {
    const user = await seedUser(test.db);
    await seedDevice(test.db, user.id);
    const row = await h.queue_(
      pushDraft(
        'reminder:ghost',
        user.id,
        h.clock.now(),
        reminderPush({ occurrenceId: OCCURRENCE_ID }),
      ),
    );
    await h.run();
    expect((await h.row(row.id)).lastErrorCode).toBe('occurrence_missing');
  });
});

describe('logging', () => {
  it('never writes a phone number, name, message body or token to a log line', async () => {
    const user = await seedUser(test.db, { displayName: 'Distinctive Name' });
    const device = await seedDevice(test.db, user.id, { token: 'secret-device-token-xyz' });
    await seedConsent(test.db, user.id, { purpose: 'registration_updates' });
    const flaky = await seedUser(test.db);
    await seedConsent(test.db, flaky.id, { purpose: 'registration_updates' });

    await h.queue_(pushDraft('log:1', user.id, h.clock.now()));
    await h.queue_(
      whatsappDraft('log:2', 'registration_confirmation', flaky.id, h.clock.now(), flaky.phoneE164),
    );
    await h.queue_(
      whatsappDraft('log:3', 'registration_confirmation', user.id, h.clock.now(), user.phoneE164),
    );
    await h.queue_(
      whatsappDraft('log:4', 'session_changed', user.id, h.clock.now(), user.phoneE164),
    );
    await h.queue_(
      whatsappDraft('log:5', 'registration_confirmation', flaky.id, h.clock.now(), flaky.phoneE164),
    );
    h.whatsapp.failNext({ status: 'transient_failure', code: 'wa_130429' });
    h.whatsapp.failNext({ status: 'permanent_failure', code: 'wa_131026', cause: 'recipient' });
    h.push.invalidateToken(device.token);
    await h.run();
    h.clock.advance(3_600_000);
    await h.run();

    const dump = h.logger.dump();
    expect(h.logger.lines.length).toBeGreaterThan(4);
    for (const secret of [
      user.phoneE164,
      user.phoneE164.slice(1),
      flaky.phoneE164,
      'Distinctive Name',
      'Aisha Khan',
      'Weekly tafsir',
      'Test Masjid',
      'secret-device-token-xyz',
      'A new update is posted',
      'x.test',
    ]) {
      expect(dump, `log contains ${secret}`).not.toContain(secret);
    }
  });
});

describe('direct processing', () => {
  it('records the outcome of processClaimedRow', async () => {
    const user = await seedUser(test.db);
    await seedDevice(test.db, user.id);
    const row = await h.queue_(pushDraft('direct:1', user.id, h.clock.now()));
    const [claimed] = await claimDue(test.db, { now: h.clock.now(), limit: 1, leaseMs: 60_000 });
    expect(await processClaimedRow(h.deps, claimed!)).toEqual({ outcome: 'sent' });
    expect(
      (
        await test.db.select().from(tables.messageOutbox).where(eq(tables.messageOutbox.id, row.id))
      )[0]!.status,
    ).toBe('sent');
  });
});
