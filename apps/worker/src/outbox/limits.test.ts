import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { draftTemplateRow, type OutboxRowDraft } from '@qc/messaging';
import { tables } from '../db';
import { createTestDb, type TestDb } from '../test/db';
import { createHarness, pushDraft, type Harness } from '../test/harness';
import { nextPhone, seedConsent, seedDevice, seedUser, seedWorld } from '../test/seed';
import { budgetAlertAt, createWhatsAppLimits, DEFAULT_WHATSAPP_LIMITS } from './limits';
import { claimDue } from './repo';
import { processClaimedRow, processJobs } from './processor';

// SEC-02: the per-person daily cap and the city budget, wired into the outbox processor.

let test: TestDb;

beforeAll(async () => {
  test = await createTestDb();
});
afterAll(async () => {
  await test.pg.close();
});
beforeEach(async () => {
  await test.reset();
});

let seq = 0;
type Template =
  'session_changed' | 'registration_confirmation' | 'auth_code' | 'coordinator_invite';

/** A WhatsApp row for `userId` (or a bare phone), about a city. */
const wa = (
  h: Harness,
  template: Template,
  to: { userId?: string; phone?: string },
  cityId: string | null,
): OutboxRowDraft => {
  const common = {
    idempotencyKey: `${template}:${++seq}:whatsapp`,
    channel: 'whatsapp' as const,
    locale: 'en' as const,
    recipientUserId: to.userId ?? null,
    recipientPhoneE164: to.phone ?? null,
    sendAt: h.clock.now(),
    cityId,
  };
  switch (template) {
    case 'session_changed':
      return draftTemplateRow({
        ...common,
        template,
        variables: {
          sessionTitle: 'Weekly tafsir',
          venueName: 'Test Masjid',
          newWhen: 'Fri 8 pm',
          link: 'https://x.test/o/1',
        },
      });
    case 'registration_confirmation':
      return draftTemplateRow({
        ...common,
        template,
        variables: {
          name: 'Aisha Khan',
          sessionTitle: 'Weekly tafsir',
          venueName: 'Test Masjid',
          when: 'Fri 7:30 pm',
          link: 'https://x.test/o/1',
        },
      });
    case 'auth_code':
      return draftTemplateRow({
        ...common,
        template,
        variables: { code: '123456', minutes: '5' },
      });
    case 'coordinator_invite':
      return draftTemplateRow({
        ...common,
        template,
        variables: { inviterName: 'Ali', scopeName: 'Test Masjid', link: 'https://x.test/i/1' },
      });
  }
};

/** A person who agreed to registration updates over WhatsApp. */
const consenting = async () => {
  const user = await seedUser(test.db);
  await seedConsent(test.db, user.id, { purpose: 'registration_updates' });
  return user;
};

const setCap = (value: unknown) =>
  test.db.insert(tables.settings).values({ key: 'whatsapp_daily_cap_per_person', value });
const setBudget = (value: unknown) =>
  test.db.insert(tables.settings).values({ key: 'whatsapp_city_monthly_budget', value });

/** Queues, sends and returns the row's final state. */
const send = async (h: Harness, draft: OutboxRowDraft) => {
  const row = await h.queue_(draft);
  await h.run();
  return h.row(row.id);
};

describe('per-person daily cap', () => {
  it('defaults to one WhatsApp template message per person per day', async () => {
    const h = createHarness(test.db, { limits: {} });
    const user = await consenting();
    const first = await send(h, wa(h, 'session_changed', { userId: user.id }, null));
    const second = await send(h, wa(h, 'session_changed', { userId: user.id }, null));
    expect(first.status).toBe('sent');
    expect(second).toMatchObject({ status: 'failed', lastErrorCode: 'gate_daily_cap' });
    expect(h.whatsapp.sent).toHaveLength(1);
    expect(h.logger.lines.find((l) => l.event === 'outbox.blocked')?.fields).toMatchObject({
      reason: 'daily_cap',
    });
  });

  it.each([1, 4])('holds in a batch taken for sending at once (parallel %i)', async (parallel) => {
    const h = createHarness(test.db, { limits: {} });
    const user = await consenting();
    for (let i = 0; i < 3; i++) await h.queue_(wa(h, 'session_changed', { userId: user.id }, null));
    await h.dispatcher.tick();
    const result = await processJobs(h.deps, h.queue.jobs.splice(0), { parallel });
    expect(result.outcomes).toMatchObject({ sent: 1, failed: 2 });
    expect(h.whatsapp.sent).toHaveLength(1);
  });

  it('counts critical templates: a confirmation after a change notice is capped', async () => {
    const h = createHarness(test.db, { limits: {} });
    const user = await consenting();
    expect((await send(h, wa(h, 'session_changed', { userId: user.id }, null))).status).toBe(
      'sent',
    );
    expect(
      await send(h, wa(h, 'registration_confirmation', { userId: user.id }, null)),
    ).toMatchObject({ status: 'failed', lastErrorCode: 'gate_daily_cap' });
  });

  it('counts sign-in codes and stops them at the cap', async () => {
    const h = createHarness(test.db, { limits: {} });
    const user = await seedUser(test.db);
    expect((await send(h, wa(h, 'auth_code', { userId: user.id }, null))).status).toBe('sent');
    expect(await send(h, wa(h, 'auth_code', { userId: user.id }, null))).toMatchObject({
      status: 'failed',
      lastErrorCode: 'gate_daily_cap',
    });
  });

  it('caps each person separately', async () => {
    const h = createHarness(test.db, { limits: {} });
    const a = await consenting();
    const b = await consenting();
    expect((await send(h, wa(h, 'session_changed', { userId: a.id }, null))).status).toBe('sent');
    expect((await send(h, wa(h, 'session_changed', { userId: b.id }, null))).status).toBe('sent');
  });

  it('starts a new day at midnight Pakistan time, not UTC', async () => {
    const h = createHarness(test.db, { limits: {} });
    const user = await consenting();
    h.clock.set(new Date('2026-11-02T18:59:00Z')); // 23:59 in Pakistan
    expect((await send(h, wa(h, 'session_changed', { userId: user.id }, null))).status).toBe(
      'sent',
    );
    h.clock.set(new Date('2026-11-02T19:01:00Z')); // 00:01 the next day in Pakistan, same UTC day
    expect((await send(h, wa(h, 'session_changed', { userId: user.id }, null))).status).toBe(
      'sent',
    );
    h.clock.set(new Date('2026-11-03T10:00:00Z'));
    expect(await send(h, wa(h, 'session_changed', { userId: user.id }, null))).toMatchObject({
      lastErrorCode: 'gate_daily_cap',
    });
  });

  it('takes the cap from the console setting over the environment default', async () => {
    const h = createHarness(test.db, { limits: { dailyCap: 1 } });
    await setCap(2);
    const user = await consenting();
    const statuses = [];
    for (let i = 0; i < 3; i++) {
      statuses.push((await send(h, wa(h, 'session_changed', { userId: user.id }, null))).status);
    }
    expect(statuses).toEqual(['sent', 'sent', 'failed']);
  });

  it('takes the environment default when the setting is missing or not valid', async () => {
    const h = createHarness(test.db, { limits: { dailyCap: 2 } });
    await setCap('lots');
    const user = await consenting();
    const statuses = [];
    for (let i = 0; i < 3; i++) {
      statuses.push((await send(h, wa(h, 'session_changed', { userId: user.id }, null))).status);
    }
    expect(statuses).toEqual(['sent', 'sent', 'failed']);
  });

  it('a cap of 0 sends no WhatsApp at all', async () => {
    const h = createHarness(test.db, { limits: {} });
    await setCap(0);
    const user = await consenting();
    expect(await send(h, wa(h, 'session_changed', { userId: user.id }, null))).toMatchObject({
      lastErrorCode: 'gate_daily_cap',
    });
    expect(h.whatsapp.sent).toHaveLength(0);
  });

  it('does not count a message that failed', async () => {
    const h = createHarness(test.db, { limits: {} });
    const user = await consenting();
    h.whatsapp.failNext({ status: 'permanent_failure', code: 'wa_131026', cause: 'recipient' });
    expect((await send(h, wa(h, 'session_changed', { userId: user.id }, null))).status).toBe(
      'failed',
    );
    expect((await send(h, wa(h, 'session_changed', { userId: user.id }, null))).status).toBe(
      'sent',
    );
  });

  it('does not count or limit push', async () => {
    const h = createHarness(test.db, { limits: {} });
    const user = await consenting();
    await seedDevice(test.db, user.id);
    for (let i = 0; i < 3; i++) {
      const row = await h.queue_(pushDraft(`update:${i}:push`, user.id, h.clock.now()));
      await h.run();
      expect((await h.row(row.id)).status).toBe('sent');
    }
    // The person has push, so a critical change still goes over WhatsApp, once.
    expect((await send(h, wa(h, 'session_changed', { userId: user.id }, null))).status).toBe(
      'sent',
    );
  });

  it('counts a row addressed by number against the account with that number', async () => {
    const h = createHarness(test.db, { limits: {} });
    const user = await seedUser(test.db);
    expect((await send(h, wa(h, 'auth_code', { userId: user.id }, null))).status).toBe('sent');
    expect(
      await send(h, wa(h, 'coordinator_invite', { phone: user.phoneE164 }, null)),
    ).toMatchObject({ status: 'failed', lastErrorCode: 'gate_daily_cap' });
  });

  it('a number with no account has no history, so only the city budget limits it', async () => {
    const h = createHarness(test.db, { limits: {} });
    const phone = nextPhone();
    expect((await send(h, wa(h, 'coordinator_invite', { phone }, null))).status).toBe('sent');
    expect((await send(h, wa(h, 'coordinator_invite', { phone }, null))).status).toBe('sent');
  });

  it('two rows sent at the same moment cannot both take the last slot', async () => {
    const h = createHarness(test.db, { limits: {} });
    const user = await consenting();
    await h.queue_(wa(h, 'session_changed', { userId: user.id }, null));
    await h.queue_(wa(h, 'session_changed', { userId: user.id }, null));
    // Both claimed before either is processed, as two workers would.
    const claimed = await claimDue(test.db, { now: h.clock.now(), limit: 10, leaseMs: 60_000 });
    expect(claimed).toHaveLength(2);
    const outcomes = await Promise.all(claimed.map((row) => processClaimedRow(h.deps, row)));
    expect(outcomes.map((o) => o.outcome).sort()).toEqual(['failed', 'sent']);
    expect(h.whatsapp.sent).toHaveLength(1);
    // The one queued first wins.
    const winner = claimed.slice().sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    expect((await h.row(winner[0]!.id)).status).toBe('sent');
  });
});

describe('city budget', () => {
  it('stops paid WhatsApp in a city once its monthly budget is spent, critical ones included', async () => {
    const h = createHarness(test.db, { limits: { cityMonthlyBudget: 2 } });
    const { city } = await seedWorld(test.db);
    const statuses = [];
    for (let i = 0; i < 3; i++) {
      const user = await consenting();
      const row = await send(h, wa(h, 'registration_confirmation', { userId: user.id }, city.id));
      statuses.push(row.lastErrorCode ?? row.status);
    }
    expect(statuses).toEqual(['sent', 'sent', 'gate_city_budget']);
  });

  it('applies to invitations to numbers with no account', async () => {
    const h = createHarness(test.db, { limits: { cityMonthlyBudget: 1 } });
    const { city } = await seedWorld(test.db);
    expect(
      (await send(h, wa(h, 'coordinator_invite', { phone: nextPhone() }, city.id))).status,
    ).toBe('sent');
    expect(
      await send(h, wa(h, 'coordinator_invite', { phone: nextPhone() }, city.id)),
    ).toMatchObject({ lastErrorCode: 'gate_city_budget' });
  });

  it('lets sign-in codes through when the budget is spent', async () => {
    const h = createHarness(test.db, { limits: { cityMonthlyBudget: 0 } });
    const { city } = await seedWorld(test.db);
    const user = await seedUser(test.db);
    expect((await send(h, wa(h, 'auth_code', { userId: user.id }, city.id))).status).toBe('sent');
  });

  it('keeps each city to its own budget', async () => {
    const h = createHarness(test.db, { limits: { cityMonthlyBudget: 1 } });
    const one = await seedWorld(test.db);
    const two = await seedWorld(test.db);
    const a = await consenting();
    const b = await consenting();
    expect((await send(h, wa(h, 'session_changed', { userId: a.id }, one.city.id))).status).toBe(
      'sent',
    );
    expect((await send(h, wa(h, 'session_changed', { userId: b.id }, two.city.id))).status).toBe(
      'sent',
    );
  });

  it('starts a new month on the 1st, Pakistan time', async () => {
    const h = createHarness(test.db, { limits: { cityMonthlyBudget: 1 } });
    const { city } = await seedWorld(test.db);
    h.clock.set(new Date('2026-11-30T18:30:00Z')); // 23:30 on 30 November in Pakistan
    const a = await consenting();
    expect((await send(h, wa(h, 'session_changed', { userId: a.id }, city.id))).status).toBe(
      'sent',
    );
    const b = await consenting();
    expect(await send(h, wa(h, 'session_changed', { userId: b.id }, city.id))).toMatchObject({
      lastErrorCode: 'gate_city_budget',
    });
    h.clock.set(new Date('2026-11-30T19:30:00Z')); // 00:30 on 1 December in Pakistan
    const c = await consenting();
    expect((await send(h, wa(h, 'session_changed', { userId: c.id }, city.id))).status).toBe(
      'sent',
    );
  });

  it('reads one budget for every city from the settings table', async () => {
    const h = createHarness(test.db, { limits: { cityMonthlyBudget: 100 } });
    await setBudget(1);
    const { city } = await seedWorld(test.db);
    const a = await consenting();
    const b = await consenting();
    await send(h, wa(h, 'session_changed', { userId: a.id }, city.id));
    expect(await send(h, wa(h, 'session_changed', { userId: b.id }, city.id))).toMatchObject({
      lastErrorCode: 'gate_city_budget',
    });
  });

  it('reads a per-city budget, with the setting default for the rest', async () => {
    const h = createHarness(test.db, { limits: { cityMonthlyBudget: 0 } });
    const small = await seedWorld(test.db);
    const other = await seedWorld(test.db);
    await setBudget({ default: 2, cities: { [small.city.id]: 1 } });
    const results = [];
    for (const cityId of [small.city.id, small.city.id, other.city.id, other.city.id]) {
      const user = await consenting();
      const row = await send(h, wa(h, 'session_changed', { userId: user.id }, cityId));
      results.push(row.lastErrorCode ?? row.status);
    }
    expect(results).toEqual(['sent', 'gate_city_budget', 'sent', 'sent']);
  });

  it('a row with no city has no budget', async () => {
    const h = createHarness(test.db, { limits: { cityMonthlyBudget: 0 } });
    const user = await consenting();
    expect((await send(h, wa(h, 'session_changed', { userId: user.id }, null))).status).toBe(
      'sent',
    );
  });

  it('warns once as the city nears its budget and once when it is spent, with no personal data', async () => {
    const h = createHarness(test.db, {
      limits: { cityMonthlyBudget: 5, budgetAlertPercent: 80, dailyCap: 5 },
    });
    const { city } = await seedWorld(test.db);
    const events: string[][] = [];
    for (let i = 0; i < 6; i++) {
      const user = await consenting();
      h.logger.lines.length = 0;
      await send(h, wa(h, 'registration_confirmation', { userId: user.id }, city.id));
      events.push(
        h.logger.lines
          .filter((l) => l.event.startsWith('whatsapp.city_budget'))
          .map((l) => l.event),
      );
      if (i === 3) {
        expect(h.logger.lines.find((l) => l.event === 'whatsapp.city_budget_near')).toEqual({
          level: 'warn',
          event: 'whatsapp.city_budget_near',
          // cityId is an id; the safe logger may mask a uuid whose digits look like a phone number.
          fields: { cityId: expect.any(String), spent: 4, budget: 5, percent: 80 },
        });
        expect(h.logger.dump()).not.toContain('Aisha');
      }
    }
    expect(events).toEqual([
      [],
      [],
      [],
      ['whatsapp.city_budget_near'],
      ['whatsapp.city_budget_reached'],
      [], // blocked by the budget, so nothing was sent and nothing more is said
    ]);
  });

  it('alert threshold: the first message at or past the percentage', () => {
    expect(budgetAlertAt(5, 80)).toBe(4);
    expect(budgetAlertAt(3000, 80)).toBe(2400);
    expect(budgetAlertAt(7, 50)).toBe(4);
    expect(budgetAlertAt(1, 1)).toBe(1);
  });
});

describe('limits figures', () => {
  it('are only for WhatsApp', async () => {
    const h = createHarness(test.db);
    const limits = createWhatsAppLimits({ db: test.db, logger: h.logger, now: h.clock.now });
    const user = await seedUser(test.db);
    const row = await h.queue_(pushDraft('update:x:push', user.id, h.clock.now()));
    expect(
      await limits.limits(row, { user: null, phone: null, consents: [], devices: [] }),
    ).toBeUndefined();
  });

  it('are the documented defaults when nothing is configured', async () => {
    expect(DEFAULT_WHATSAPP_LIMITS).toEqual({
      dailyCap: 1,
      cityMonthlyBudget: 3000,
      budgetAlertPercent: 80,
    });
    const h = createHarness(test.db);
    const limits = createWhatsAppLimits({ db: test.db, logger: h.logger, now: h.clock.now });
    const { city } = await seedWorld(test.db);
    const user = await consenting();
    const row = await h.queue_(wa(h, 'session_changed', { userId: user.id }, city.id));
    expect(
      await limits.limits(row, { user: null, phone: null, consents: [], devices: [] }),
    ).toEqual({
      whatsappDailyCap: 1,
      whatsappSentToday: 0,
      cityBudget: 3000,
      cityBudgetRemaining: 3000,
      estimatedCost: 1,
    });
  });

  it('a failing budget check after a send is logged, and the row stays sent', async () => {
    const h = createHarness(test.db);
    h.deps.afterSend = () => Promise.reject(new Error('database went away'));
    const user = await consenting();
    const row = await send(h, wa(h, 'session_changed', { userId: user.id }, null));
    expect(row.status).toBe('sent');
    expect(h.logger.lines.find((l) => l.event === 'outbox.after_send_failed')?.fields).toEqual({
      outboxId: expect.any(String),
      error: 'Error',
    });
  });
});
