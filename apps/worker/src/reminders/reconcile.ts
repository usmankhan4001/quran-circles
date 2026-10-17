import { and, eq, gt, inArray, isNull, like, lte } from 'drizzle-orm';
import { draftPushRow, type Logger } from '@qc/messaging';
import { tables, type Clock, type Db } from '../db';
import { insertIfNew } from '../outbox/repo';
import { readSettings } from '../settings';
import {
  buildReminderPush,
  canonical,
  occurrenceOfKey,
  reminderKey,
  type ReminderFacts,
} from './format';

/**
 * Reminders, relative to each occurrence's own start time.
 *
 * Every run works out which reminders should exist right now and brings the outbox in line:
 * new ones are inserted (idempotent on `reminder:<occurrenceId>:<userId>:push`), queued ones whose
 * session moved are re-timed and re-worded, and queued ones whose occurrence was cancelled, whose
 * registration was cancelled or whose person lost every device are withdrawn. A reminder that was
 * already sent is never touched. Running it twice in a row changes nothing.
 *
 * Who gets a reminder: confirmed registrants (for the one occurrence they chose, or for every
 * occurrence of the session) and, for a circle's sessions, followers of the circle who have alerts
 * on. They need a user account and at least one working push device. Reminders over WhatsApp are
 * Wave 4 (fallback for people without push).
 */
export interface ReconcileOptions {
  db: Db;
  logger: Logger;
  now: Clock;
  /** How far ahead to look, besides the lead time. Default 72 hours. */
  horizonHours?: number;
  /** A reminder whose time passed less than this long ago is still sent. Default 30 minutes. */
  graceMinutes?: number;
  /** Public https origin for links; without it links use the app scheme. */
  webBase?: string;
}

export interface ReconcileSummary {
  inserted: number;
  retimed: number;
  revived: number;
  withdrawn: number;
  unchanged: number;
}

/** Failure codes that mean "we withdrew it" and may be reversed if the situation reverses. */
const REVIVABLE = new Set(['occurrence_cancelled', 'recipient_removed']);

const chunk = <T>(items: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

interface OccurrenceRow {
  occurrenceId: string;
  startsAt: Date;
  occurrenceStatus: 'scheduled' | 'cancelled' | 'done';
  sessionId: string;
  circleId: string | null;
  sessionStatus: 'draft' | 'published' | 'cancelled' | 'archived';
  timezone: string;
  titleEn: string;
  titleUr: string;
  programKey: 'dora' | 'circles';
  venueNameEn: string;
  venueNameUr: string;
  venueId: string;
  cityId: string;
}

async function loadOccurrences(db: Db, ids: string[]): Promise<OccurrenceRow[]> {
  const out: OccurrenceRow[] = [];
  for (const part of chunk(ids, 500)) {
    out.push(
      ...(await db
        .select({
          occurrenceId: tables.occurrences.id,
          startsAt: tables.occurrences.startsAt,
          occurrenceStatus: tables.occurrences.status,
          sessionId: tables.sessions.id,
          circleId: tables.sessions.circleId,
          sessionStatus: tables.sessions.status,
          timezone: tables.sessions.timezone,
          titleEn: tables.sessions.titleEn,
          titleUr: tables.sessions.titleUr,
          programKey: tables.programs.key,
          venueNameEn: tables.venues.nameEn,
          venueNameUr: tables.venues.nameUr,
          venueId: tables.venues.id,
          cityId: tables.venues.cityId,
        })
        .from(tables.occurrences)
        .innerJoin(tables.sessions, eq(tables.sessions.id, tables.occurrences.sessionId))
        .innerJoin(tables.programs, eq(tables.programs.id, tables.sessions.programId))
        .innerJoin(tables.venues, eq(tables.venues.id, tables.sessions.venueId))
        .where(inArray(tables.occurrences.id, part))),
    );
  }
  return out;
}

export async function reconcileReminders(opts: ReconcileOptions): Promise<ReconcileSummary> {
  const { db } = opts;
  const now = opts.now();
  const settings = await readSettings(db);
  const maxLeadMs = Math.max(...Object.values(settings.reminderLeadMinutes)) * 60_000;
  const horizonEnd = new Date(now.getTime() + maxLeadMs + (opts.horizonHours ?? 72) * 3_600_000);
  const graceMs = (opts.graceMinutes ?? 30) * 60_000;
  const summary: ReconcileSummary = {
    inserted: 0,
    retimed: 0,
    revived: 0,
    withdrawn: 0,
    unchanged: 0,
  };
  const out = tables.messageOutbox;

  // Reminders still waiting to go out, so moved or cancelled occurrences are found too.
  const pending = await db
    .select()
    .from(out)
    .where(
      and(
        eq(out.status, 'queued'),
        eq(out.channel, 'push'),
        eq(out.templateKey, 'session_reminder'),
        like(out.idempotencyKey, 'reminder:%'),
      ),
    );

  const upcoming = await db
    .select({ id: tables.occurrences.id })
    .from(tables.occurrences)
    .where(
      and(
        eq(tables.occurrences.status, 'scheduled'),
        gt(tables.occurrences.startsAt, now),
        lte(tables.occurrences.startsAt, horizonEnd),
      ),
    );

  const occurrenceIds = [
    ...new Set([
      ...upcoming.map((r) => r.id),
      ...pending.flatMap((r) => {
        const id = occurrenceOfKey(r.idempotencyKey);
        return id ? [id] : [];
      }),
    ]),
  ];
  const occurrences = new Map(
    (await loadOccurrences(db, occurrenceIds)).map((o) => [o.occurrenceId, o]),
  );
  const eligible = [...occurrences.values()].filter(
    (o) =>
      o.occurrenceStatus === 'scheduled' &&
      o.sessionStatus === 'published' &&
      o.startsAt.getTime() > now.getTime(),
  );

  // Audience: registrants and circle followers.
  const audience = new Map<string, Set<string>>();
  const addAudience = (occurrenceId: string, userId: string) => {
    const set = audience.get(occurrenceId) ?? new Set<string>();
    set.add(userId);
    audience.set(occurrenceId, set);
  };
  const sessionIds = [...new Set(eligible.map((o) => o.sessionId))];
  const circleIds = [...new Set(eligible.flatMap((o) => (o.circleId ? [o.circleId] : [])))];
  for (const part of chunk(sessionIds, 500)) {
    const regs = await db
      .select({
        userId: tables.registrations.userId,
        sessionId: tables.registrations.sessionId,
        occurrenceId: tables.registrations.occurrenceId,
      })
      .from(tables.registrations)
      .where(
        and(
          inArray(tables.registrations.sessionId, part),
          eq(tables.registrations.status, 'confirmed'),
        ),
      );
    for (const reg of regs) {
      if (!reg.userId) continue;
      for (const o of eligible) {
        if (o.sessionId !== reg.sessionId) continue;
        if (reg.occurrenceId === null || reg.occurrenceId === o.occurrenceId) {
          addAudience(o.occurrenceId, reg.userId);
        }
      }
    }
  }
  for (const part of chunk(circleIds, 500)) {
    const follows = await db
      .select({ userId: tables.follows.userId, circleId: tables.follows.circleId })
      .from(tables.follows)
      .where(and(inArray(tables.follows.circleId, part), eq(tables.follows.alertsEnabled, true)));
    for (const f of follows) {
      for (const o of eligible)
        if (o.circleId === f.circleId) addAudience(o.occurrenceId, f.userId);
    }
  }

  // Who is reachable: an active account with a working push device.
  const userIds = [...new Set([...audience.values()].flatMap((s) => [...s]))];
  const users = new Map<string, { locale: 'en' | 'ur' }>();
  const reachable = new Set<string>();
  for (const part of chunk(userIds, 500)) {
    for (const u of await db
      .select({ id: tables.users.id, locale: tables.users.locale })
      .from(tables.users)
      .where(and(inArray(tables.users.id, part), eq(tables.users.status, 'active')))) {
      users.set(u.id, { locale: u.locale });
    }
    for (const d of await db
      .select({ userId: tables.devices.userId })
      .from(tables.devices)
      .where(and(inArray(tables.devices.userId, part), isNull(tables.devices.revokedAt)))) {
      reachable.add(d.userId);
    }
  }

  // What should exist.
  interface Wanted {
    key: string;
    fireAt: Date;
    draft: ReturnType<typeof draftPushRow>;
    /** False for a reminder that is too late or too far ahead to create; existing rows still follow the schedule. */
    mayCreate: boolean;
  }
  const wanted = new Map<string, Wanted>();
  for (const o of eligible) {
    const leadMs = settings.reminderLeadMinutes[o.programKey] * 60_000;
    const fireAt = new Date(o.startsAt.getTime() - leadMs);
    const mayCreate =
      now.getTime() <= fireAt.getTime() + graceMs && o.startsAt.getTime() <= horizonEnd.getTime();
    const facts: ReminderFacts = {
      occurrenceId: o.occurrenceId,
      sessionId: o.sessionId,
      sessionTitle: { en: o.titleEn, ur: o.titleUr },
      venueName: { en: o.venueNameEn, ur: o.venueNameUr },
      startsAt: o.startsAt,
      timezone: o.timezone,
      fireAt,
    };
    for (const userId of audience.get(o.occurrenceId) ?? []) {
      const user = users.get(userId);
      if (!user || !reachable.has(userId)) continue;
      const key = reminderKey(o.occurrenceId, userId);
      wanted.set(key, {
        key,
        fireAt,
        mayCreate,
        draft: draftPushRow({
          idempotencyKey: key,
          recipientUserId: userId,
          sendAt: fireAt,
          push: buildReminderPush(facts, user.locale, opts.webBase),
          templateKey: 'session_reminder',
          locale: user.locale,
          cityId: o.cityId,
          venueId: o.venueId,
        }),
      });
    }
  }

  // Compare with what exists.
  const existing = new Map<string, typeof out.$inferSelect>();
  for (const part of chunk([...wanted.keys()], 500)) {
    for (const row of await db.select().from(out).where(inArray(out.idempotencyKey, part))) {
      existing.set(row.idempotencyKey, row);
    }
  }

  for (const w of wanted.values()) {
    const row = existing.get(w.key);
    if (!row) {
      if (!w.mayCreate) continue;
      if (await insertIfNew(db, w.draft)) summary.inserted++;
      else summary.unchanged++;
      continue;
    }
    if (row.status === 'failed' && row.lastErrorCode && REVIVABLE.has(row.lastErrorCode)) {
      if (!w.mayCreate) continue;
      // The occurrence or registration came back; bring the withdrawn reminder back with it.
      await db
        .update(out)
        .set({
          status: 'queued',
          attempts: 0,
          lastErrorCode: null,
          nextAttemptAt: w.fireAt,
          payload: w.draft.payload,
          locale: w.draft.locale,
          cityId: w.draft.cityId,
          venueId: w.draft.venueId,
        })
        .where(and(eq(out.id, row.id), eq(out.status, 'failed')));
      summary.revived++;
      continue;
    }
    if (row.status !== 'queued') {
      summary.unchanged++;
      continue;
    }
    const payloadChanged = canonical(row.payload) !== canonical(w.draft.payload);
    // A row already retrying keeps its backoff; only its wording follows the schedule.
    const timeChanged = row.attempts === 0 && row.nextAttemptAt.getTime() !== w.fireAt.getTime();
    if (!payloadChanged && !timeChanged) {
      summary.unchanged++;
      continue;
    }
    await db
      .update(out)
      .set({
        payload: w.draft.payload,
        locale: w.draft.locale,
        ...(timeChanged ? { nextAttemptAt: w.fireAt } : {}),
      })
      .where(and(eq(out.id, row.id), eq(out.status, 'queued')));
    summary.retimed++;
  }

  // Withdraw queued reminders that should no longer exist.
  for (const row of pending) {
    if (wanted.has(row.idempotencyKey)) continue;
    const occurrenceId = occurrenceOfKey(row.idempotencyKey);
    const o = occurrenceId ? occurrences.get(occurrenceId) : undefined;
    let code = 'recipient_removed';
    if (!o) code = 'occurrence_cancelled';
    else if (o.occurrenceStatus !== 'scheduled' || o.sessionStatus !== 'published')
      code = 'occurrence_cancelled';
    else if (o.startsAt.getTime() <= now.getTime()) code = 'expired';
    const withdrawn = await db
      .update(out)
      .set({ status: 'failed', lastErrorCode: code })
      .where(and(eq(out.id, row.id), eq(out.status, 'queued')))
      .returning({ id: out.id });
    if (withdrawn.length > 0) summary.withdrawn++;
  }

  if (summary.inserted + summary.retimed + summary.revived + summary.withdrawn > 0) {
    opts.logger.info('reminders.reconciled', { ...summary });
  }
  return summary;
}
