import { and, asc, eq, gte, lte, sql } from 'drizzle-orm';
import {
  READING_DAY_SOURCES,
  pakistanDate,
  readingDayDateIssue,
  readingRangeIssue,
  type CommunityToday,
  type ReadingDay,
  type ReadingDayRecord,
  type ReadingDaySource,
} from '@qc/contracts';
import { schema, type Db } from '../../db';
import { fail } from '../shared/errors';

const { users, readingDays, communityDays } = schema;

type ReadingDayRow = typeof readingDays.$inferSelect;

const SOURCE_ORDER = new Map<ReadingDaySource, number>(READING_DAY_SOURCES.map((s, i) => [s, i]));

/** Rows of one person, grouped into contract days: sources in the fixed order, totals summed. */
function toDays(rows: readonly ReadingDayRow[]): ReadingDay[] {
  const byDate = new Map<string, ReadingDayRow[]>();
  for (const row of rows) byDate.set(row.day, [...(byDate.get(row.day) ?? []), row]);
  return [...byDate.keys()].sort().map((date) => {
    const dayRows = [...(byDate.get(date) ?? [])].sort(
      (a, b) => (SOURCE_ORDER.get(a.source) ?? 0) - (SOURCE_ORDER.get(b.source) ?? 0),
    );
    return {
      date,
      sources: dayRows.map((r) => r.source),
      pages: dayRows.reduce((sum, r) => sum + r.pages, 0),
      ayahs: dayRows.reduce((sum, r) => sum + r.ayahs, 0),
    };
  });
}

export interface ReadingDayWrite {
  userId: string;
  /** Pakistan-time date. */
  day: string;
  source: ReadingDaySource;
  pages: number;
  ayahs: number;
  now: Date;
}

/**
 * Upserts one person's row for a date and source, keeping the larger pages and ayahs, and moves
 * the national total in the same transaction: one more reader on the person's first row for that
 * date, and the pages increase (never a decrease) added to the day's pages. `tx` must be a
 * transaction. The person's user row is locked first, so two writes for the same person cannot
 * both count themselves as the first of the day. `community_days` never stores the user id.
 * Returns false, writing nothing, when the account no longer exists.
 */
export async function addReadingDay(tx: Db, w: ReadingDayWrite): Promise<boolean> {
  const [user] = await tx
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, w.userId))
    .for('no key update');
  if (!user) return false;

  const existing = await tx
    .select({ source: readingDays.source, pages: readingDays.pages })
    .from(readingDays)
    .where(and(eq(readingDays.userId, w.userId), eq(readingDays.day, w.day)));
  const firstOfDay = existing.length === 0;
  const previousPages = existing.find((r) => r.source === w.source)?.pages ?? 0;

  await tx
    .insert(readingDays)
    .values({
      userId: w.userId,
      day: w.day,
      source: w.source,
      pages: w.pages,
      ayahs: w.ayahs,
      createdAt: w.now,
      updatedAt: w.now,
    })
    .onConflictDoUpdate({
      target: [readingDays.userId, readingDays.day, readingDays.source],
      set: {
        pages: sql`greatest(${readingDays.pages}, excluded.pages)`,
        ayahs: sql`greatest(${readingDays.ayahs}, excluded.ayahs)`,
        updatedAt: w.now,
      },
    });

  const pagesAdded = Math.max(0, w.pages - previousPages);
  if (!firstOfDay && pagesAdded === 0) return true;
  // One insert-or-increment statement, so concurrent writers for other people never lose a count.
  await tx
    .insert(communityDays)
    .values({ day: w.day, readers: firstOfDay ? 1 : 0, pages: pagesAdded, updatedAt: w.now })
    .onConflictDoUpdate({
      target: communityDays.day,
      set: {
        readers: sql`${communityDays.readers} + excluded.readers`,
        pages: sql`${communityDays.pages} + excluded.pages`,
        updatedAt: w.now,
      },
    });
  return true;
}

async function readDay(db: Db, userId: string, day: string): Promise<ReadingDay> {
  const rows = await db
    .select()
    .from(readingDays)
    .where(and(eq(readingDays.userId, userId), eq(readingDays.day, day)));
  const [result] = toDays(rows);
  // The row was just written, so the day exists.
  if (!result) return fail('internal_error');
  return result;
}

/** `POST /v1/me/reading-days`: today or yesterday in Pakistan, by the server's clock. */
export async function recordReadingDay(
  db: Db,
  userId: string,
  now: Date,
  body: ReadingDayRecord,
): Promise<ReadingDay> {
  const issue = readingDayDateIssue(body.date, now);
  if (issue) fail('validation_failed', { issues: [issue] });
  const day = body.date ?? pakistanDate(now);
  const written = await db.transaction((tx) =>
    addReadingDay(tx, {
      userId,
      day,
      source: body.source,
      pages: body.pages ?? 0,
      ayahs: body.ayahs ?? 0,
      now,
    }),
  );
  if (!written) return fail('unauthenticated');
  return readDay(db, userId, day);
}

/** `GET /v1/me/reading-days`: the person's own days in an inclusive range, in date order. */
export async function listReadingDays(
  db: Db,
  userId: string,
  q: { from: string; to: string },
): Promise<{ items: ReadingDay[] }> {
  const issue = readingRangeIssue(q);
  if (issue) fail('validation_failed', { issues: [issue] });
  const rows = await db
    .select()
    .from(readingDays)
    .where(
      and(eq(readingDays.userId, userId), gte(readingDays.day, q.from), lte(readingDays.day, q.to)),
    )
    .orderBy(asc(readingDays.day));
  return { items: toDays(rows) };
}

/** `GET /v1/community/today`: today's national row, or zeros before anyone has read. */
export async function communityToday(db: Db, now: Date): Promise<CommunityToday> {
  const date = pakistanDate(now);
  const [row] = await db.select().from(communityDays).where(eq(communityDays.day, date));
  return { date, readersToday: row?.readers ?? 0, pagesTogether: row?.pages ?? 0 };
}
