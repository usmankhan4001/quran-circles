import { and, asc, eq, exists, gt, inArray, isNull, sql } from 'drizzle-orm';
import {
  buildDeepLink,
  consentGranted,
  outboxKey,
  pakistanDate,
  resolveDailyAyah,
  type AyahOfTheDay,
  type DailyAyahPick,
  type FeatureFlagKey,
  type Locale,
  type PushPayload,
} from '@qc/contracts';
import { draftPushRow, type Logger, type OutboxRowDraft } from '@qc/messaging';
import { tables, type Clock, type Db } from '../db';
import { t } from '../reminders/format';

/**
 * The morning ayah push (rc.4, change request 2026-10-17 item 4).
 *
 * Once a morning (the runtime schedules it at 06:30 Pakistan time) every person who
 * - has an active account and at least one push device that is not revoked,
 * - has the `ayah_of_the_day` feature flag on (the global row, overridden by their city's row; the
 *   city comes from their profile's area; no row means off, like every flag), and
 * - has not turned the morning ayah off (`consentGranted('push', 'ayah_daily', rows)`: no row means
 *   on, a revoked row means off)
 * gets one push with the day's ayah, resolved with `resolveDailyAyah` from the venues and circles
 * they follow and that date's `daily_ayahs` picks, linking to the reader (`quran` deep link).
 *
 * Rows are idempotent on `ayah_daily:<date>:<userId>:push`, so a second run the same day (a retry,
 * a restart that makes up a missed run, a second node) queues nothing new. The outbox processor
 * checks consent and devices again at send time, through the `ayah_of_the_day -> ayah_daily`
 * purpose. People are read in pages of `batchSize`, each page with one insert. One log line per
 * run, counts only.
 */

export const AYAH_FLAG: FeatureFlagKey = 'ayah_of_the_day';

export interface AyahJobOptions {
  db: Db;
  logger: Logger;
  now: Clock;
  /** Public https origin for links; without it links use the app scheme. */
  webBase?: string;
  /** People read and rows inserted per page. Default 500. */
  batchSize?: number;
  /**
   * A run that starts at or after this hour, Pakistan time, queues nothing: a make-up run after a
   * long outage should not wake anyone with a "morning" ayah in the evening. Default 12 (noon).
   */
  latestHour?: number;
}

export interface AyahJobSummary {
  /** The Pakistan-time date the run was for. */
  date: string;
  /** Set when the run queued nothing on purpose. */
  skipped: 'flag_off' | 'too_late' | null;
  /** Active people with a live push device that the run looked at. */
  candidates: number;
  /** New outbox rows. */
  queued: number;
  /** Rows an earlier run the same day had already queued. */
  alreadyQueued: number;
  /** People whose city (or the global flag) has the feature off. */
  flagOff: number;
  /** People who turned the morning ayah off. */
  consentOff: number;
}

const HOUR_MS = 3_600_000;
/** Pakistan is UTC+5 all year. */
const PKT_OFFSET_MS = 5 * HOUR_MS;

export const ayahDailyKey = (date: string, userId: string): string =>
  outboxKey('ayah_daily', date, userId, 'push');

/** The push for one person, in their language. Numbers use Western digits in both languages. */
export function buildAyahPush(
  ayah: AyahOfTheDay,
  locale: Locale,
  webBase: string | undefined,
): PushPayload {
  return {
    title: t(locale, 'notifications.ayah.title'),
    body: t(locale, 'notifications.ayah.body', {
      surah: String(ayah.surah),
      ayah: String(ayah.ayah),
    }),
    data: {
      type: 'ayah_of_the_day',
      deepLink: buildDeepLink({ type: 'quran', surah: ayah.surah, ayah: ayah.ayah }, webBase),
    },
    // A later ayah push replaces an unread one from an earlier day.
    collapseKey: 'ayah_daily',
    // Worth showing for the morning; a phone that was off all day does not get it at night.
    ttlSeconds: 6 * 3600,
  };
}

interface FlagState {
  global: boolean;
  byCity: Map<string, boolean>;
}

async function readFlag(db: Db): Promise<FlagState> {
  const rows = await db
    .select({ cityId: tables.featureFlags.cityId, enabled: tables.featureFlags.enabled })
    .from(tables.featureFlags)
    .where(eq(tables.featureFlags.key, AYAH_FLAG));
  const state: FlagState = { global: false, byCity: new Map() };
  for (const row of rows) {
    if (row.cityId === null) state.global = row.enabled;
    else state.byCity.set(row.cityId, row.enabled);
  }
  return state;
}

/** The API's rule (`resolveFlags`): the city's own row wins, then the global row, then off. */
const flagOn = (flag: FlagState, cityId: string | null): boolean =>
  (cityId !== null ? flag.byCity.get(cityId) : undefined) ?? flag.global;

interface Candidate {
  id: string;
  locale: Locale;
  cityId: string | null;
}

/** One page of active people with a live push device, after `cursor`, in id order. */
async function candidatePage(db: Db, cursor: string | null, limit: number): Promise<Candidate[]> {
  const { users, profiles, areas, devices } = tables;
  const liveDevice = db
    .select({ one: sql`1` })
    .from(devices)
    .where(and(eq(devices.userId, users.id), isNull(devices.revokedAt)));
  return db
    .select({ id: users.id, locale: users.locale, cityId: areas.cityId })
    .from(users)
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .leftJoin(areas, eq(areas.id, profiles.areaId))
    .where(
      and(
        eq(users.status, 'active'),
        exists(liveDevice),
        cursor === null ? undefined : gt(users.id, cursor),
      ),
    )
    .orderBy(asc(users.id))
    .limit(limit);
}

export async function runMorningAyah(opts: AyahJobOptions): Promise<AyahJobSummary> {
  const { db, logger } = opts;
  const now = opts.now();
  const date = pakistanDate(now);
  const batchSize = Math.max(1, opts.batchSize ?? 500);
  const summary: AyahJobSummary = {
    date,
    skipped: null,
    candidates: 0,
    queued: 0,
    alreadyQueued: 0,
    flagOff: 0,
    consentOff: 0,
  };
  const finish = (): AyahJobSummary => {
    // Counts only; the date is left out because the safe logger redacts digit runs that look
    // like phone numbers.
    logger.info('ayah_daily.run', {
      skipped: summary.skipped ?? undefined,
      candidates: summary.candidates,
      queued: summary.queued,
      alreadyQueued: summary.alreadyQueued,
      flagOff: summary.flagOff,
      consentOff: summary.consentOff,
    });
    return summary;
  };

  const pktHour = new Date(now.getTime() + PKT_OFFSET_MS).getUTCHours();
  if (pktHour >= (opts.latestHour ?? 12)) {
    summary.skipped = 'too_late';
    return finish();
  }
  const flag = await readFlag(db);
  if (!flag.global && ![...flag.byCity.values()].some(Boolean)) {
    summary.skipped = 'flag_off';
    return finish();
  }

  const picks: DailyAyahPick[] = await db
    .select({
      date: tables.dailyAyahs.day,
      scopeType: tables.dailyAyahs.scopeType,
      venueId: tables.dailyAyahs.venueId,
      circleId: tables.dailyAyahs.circleId,
      surah: tables.dailyAyahs.surah,
      ayah: tables.dailyAyahs.ayah,
    })
    .from(tables.dailyAyahs)
    .where(eq(tables.dailyAyahs.day, date));

  let cursor: string | null = null;
  for (;;) {
    const page = await candidatePage(db, cursor, batchSize);
    if (page.length === 0) break;
    cursor = page[page.length - 1]!.id;
    summary.candidates += page.length;

    const enabled = page.filter((c) => {
      if (flagOn(flag, c.cityId)) return true;
      summary.flagOff++;
      return false;
    });
    const ids = enabled.map((c) => c.id);
    if (ids.length === 0) continue;

    const consentRows = await db
      .select({ userId: tables.consents.userId, revokedAt: tables.consents.revokedAt })
      .from(tables.consents)
      .where(
        and(
          inArray(tables.consents.userId, ids),
          eq(tables.consents.channel, 'push'),
          eq(tables.consents.purpose, 'ayah_daily'),
        ),
      );
    const consentsByUser = new Map<string, { revokedAt: Date | null }[]>();
    for (const row of consentRows) {
      const list = consentsByUser.get(row.userId) ?? [];
      list.push({ revokedAt: row.revokedAt });
      consentsByUser.set(row.userId, list);
    }

    const followRows = await db
      .select({
        userId: tables.follows.userId,
        venueId: tables.follows.venueId,
        circleId: tables.follows.circleId,
      })
      .from(tables.follows)
      .where(inArray(tables.follows.userId, ids));
    const followsByUser = new Map<string, { venues: string[]; circles: string[] }>();
    for (const row of followRows) {
      const entry = followsByUser.get(row.userId) ?? { venues: [], circles: [] };
      if (row.venueId) entry.venues.push(row.venueId);
      if (row.circleId) entry.circles.push(row.circleId);
      followsByUser.set(row.userId, entry);
    }

    const drafts: OutboxRowDraft[] = [];
    for (const person of enabled) {
      if (!consentGranted('push', 'ayah_daily', consentsByUser.get(person.id) ?? [])) {
        summary.consentOff++;
        continue;
      }
      const follows = followsByUser.get(person.id);
      const ayah = resolveDailyAyah({
        date,
        picks,
        followedVenueIds: follows?.venues ?? [],
        followedCircleIds: follows?.circles ?? [],
      });
      drafts.push(
        draftPushRow({
          idempotencyKey: ayahDailyKey(date, person.id),
          recipientUserId: person.id,
          sendAt: now,
          push: buildAyahPush(ayah, person.locale, opts.webBase),
          templateKey: null,
          locale: person.locale,
          cityId: person.cityId,
          // `ayah_daily` consent is never per venue, so the row names no venue.
          venueId: null,
        }),
      );
    }
    if (drafts.length === 0) continue;
    const inserted = await db
      .insert(tables.messageOutbox)
      .values(drafts)
      .onConflictDoNothing({ target: tables.messageOutbox.idempotencyKey })
      .returning({ id: tables.messageOutbox.id });
    summary.queued += inserted.length;
    summary.alreadyQueued += drafts.length - inserted.length;
  }
  return finish();
}
