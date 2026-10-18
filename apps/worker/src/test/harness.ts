import { eq } from 'drizzle-orm';
import type { PushPayload } from '@qc/contracts';
import {
  FakePushProvider,
  FakeSmsProvider,
  FakeWhatsAppProvider,
  createMemoryLogger,
  draftPushRow,
  draftTemplateRow,
  type MemoryLogger,
  type OutboxRowDraft,
  type RetryPolicy,
} from '@qc/messaging';
import { tables, type Db } from '../db';
import { createDispatcher, type SendJob, type SendQueue } from '../outbox/dispatcher';
import {
  DEFAULT_WHATSAPP_LIMITS,
  createWhatsAppLimits,
  type WhatsAppLimitsConfig,
} from '../outbox/limits';
import { processJob, type ProcessorDeps } from '../outbox/processor';
import { insertIfNew } from '../outbox/repo';

export const T0 = new Date('2026-11-02T10:00:00Z');

/** A clock tests move by hand. */
export class TestClock {
  constructor(private current: Date = T0) {}
  now = (): Date => new Date(this.current);
  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
  set(date: Date): void {
    this.current = date;
  }
}

/** Collects jobs and runs them on demand, like a queue that only runs when told to. */
export class InlineQueue implements SendQueue {
  readonly jobs: SendJob[] = [];
  enqueue(job: SendJob): Promise<void> {
    this.jobs.push(job);
    return Promise.resolve();
  }
  async drain(deps: ProcessorDeps): Promise<void> {
    while (this.jobs.length > 0) {
      const job = this.jobs.shift()!;
      await processJob(deps, job);
    }
  }
}

export const NO_JITTER: RetryPolicy = {
  maxAttempts: 3,
  baseDelayMs: 60_000,
  factor: 2,
  maxDelayMs: 3_600_000,
  jitterRatio: 0,
};

export function createHarness(
  db: Db,
  opts: {
    retry?: RetryPolicy;
    /** Apply the WhatsApp cap and city budgets, as `main.ts` does. Off unless given. */
    limits?: Partial<WhatsAppLimitsConfig>;
  } = {},
) {
  const clock = new TestClock();
  const push = new FakePushProvider();
  const whatsapp = new FakeWhatsAppProvider();
  const sms = new FakeSmsProvider();
  const logger: MemoryLogger = createMemoryLogger();
  const queue = new InlineQueue();
  const retry = opts.retry ?? NO_JITTER;
  const deps: ProcessorDeps = {
    db,
    push,
    whatsapp,
    sms,
    logger,
    now: clock.now,
    retry,
    random: () => 0.5,
  };
  if (opts.limits) {
    const limits = createWhatsAppLimits(
      { db, logger, now: clock.now },
      { ...DEFAULT_WHATSAPP_LIMITS, ...opts.limits },
    );
    deps.limits = limits.limits;
    deps.afterSend = limits.afterSend;
  }
  const dispatcher = createDispatcher({ db, queue, logger, now: clock.now, retry });
  return {
    db,
    clock,
    push,
    whatsapp,
    sms,
    logger,
    queue,
    deps,
    dispatcher,
    /** Claim what is due and send it. */
    async run(): Promise<void> {
      await dispatcher.tick();
      await queue.drain(deps);
    },
    async row(id: string) {
      const [r] = await db
        .select()
        .from(tables.messageOutbox)
        .where(eq(tables.messageOutbox.id, id));
      if (!r) throw new Error('row not found');
      return r;
    },
    async rowByKey(key: string) {
      const [r] = await db
        .select()
        .from(tables.messageOutbox)
        .where(eq(tables.messageOutbox.idempotencyKey, key));
      return r;
    },
    async queue_(draft: OutboxRowDraft) {
      await insertIfNew(db, draft);
      const row = await this.rowByKey(draft.idempotencyKey);
      if (!row) throw new Error('row not inserted');
      return row;
    },
  };
}

export type Harness = ReturnType<typeof createHarness>;

export const OCCURRENCE_ID = '00000000-0000-4000-8000-0000000000c1';
export const SESSION_ID = '00000000-0000-4000-8000-0000000000c2';

export const reminderPush = (over: { occurrenceId?: string; sessionId?: string } = {}) => ({
  title: 'Session reminder',
  body: 'Reminder: Weekly tafsir at Test Masjid, 7:30 pm. qurancircles://occurrence/x',
  data: {
    type: 'reminder' as const,
    deepLink: `qurancircles://occurrence/${over.occurrenceId ?? OCCURRENCE_ID}`,
    ...(over.occurrenceId ? { occurrenceId: over.occurrenceId } : {}),
    ...(over.sessionId ? { sessionId: over.sessionId } : {}),
  },
  collapseKey: 'reminder:x',
  ttlSeconds: 3600,
});

export const updatePush = () => ({
  title: 'Update',
  body: 'A new update is posted',
  data: { type: 'update' as const, deepLink: 'qurancircles://updates' },
  ttlSeconds: 3600,
});

export const pushDraft = (
  key: string,
  userId: string,
  sendAt: Date,
  push: PushPayload = updatePush(),
): OutboxRowDraft =>
  draftPushRow({ idempotencyKey: key, recipientUserId: userId, sendAt, push, templateKey: null });

export const whatsappDraft = (
  key: string,
  template: 'session_reminder' | 'session_changed' | 'registration_confirmation',
  userId: string,
  sendAt: Date,
  phone: string | null = null,
): OutboxRowDraft => {
  const common = {
    idempotencyKey: key,
    channel: 'whatsapp' as const,
    locale: 'en' as const,
    recipientUserId: userId,
    recipientPhoneE164: phone,
    sendAt,
  };
  if (template === 'session_reminder') {
    return draftTemplateRow({
      ...common,
      template,
      variables: {
        sessionTitle: 'Weekly tafsir',
        venueName: 'Test Masjid',
        when: 'Fri 7:30 pm',
        link: 'https://x.test/o/1',
      },
    });
  }
  if (template === 'session_changed') {
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
  }
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
};
