import { and, asc, eq, sql } from 'drizzle-orm';
import {
  MEMORISATION_REVISE_AFTER_DAYS_DEFAULT,
  type MemorisationEntry,
  type MemorisationPut,
} from '@qc/contracts';
import { schema, type Db } from '../../db';
import { fail } from '../shared/errors';

const { memorisation, profiles } = schema;

type MemorisationRow = typeof memorisation.$inferSelect;

const toEntry = (row: MemorisationRow): MemorisationEntry => ({
  surah: row.surah,
  status: row.status,
  lastRevisedAt: row.lastRevisedAt?.toISOString() ?? null,
  updatedAt: row.updatedAt.toISOString(),
});

/** `GET /v1/me/memorisation`: marked surahs in surah order, and the person's revise setting. */
export async function listMemorisation(
  db: Db,
  userId: string,
): Promise<{ items: MemorisationEntry[]; reviseAfterDays: number }> {
  const rows = await db
    .select()
    .from(memorisation)
    .where(eq(memorisation.userId, userId))
    .orderBy(asc(memorisation.surah));
  const [profile] = await db
    .select({ days: profiles.memorisationReviseAfterDays })
    .from(profiles)
    .where(eq(profiles.userId, userId));
  return {
    items: rows.map(toEntry),
    reviseAfterDays: profile?.days ?? MEMORISATION_REVISE_AFTER_DAYS_DEFAULT,
  };
}

/**
 * `PUT /v1/me/memorisation/{surah}`, one statement: `markRevised` stamps `lastRevisedAt` with now;
 * marking a surah `memorised` that was never revised stamps it too; otherwise it is kept.
 */
export async function putMemorisation(
  db: Db,
  userId: string,
  now: Date,
  surah: number,
  body: MemorisationPut,
): Promise<MemorisationEntry> {
  const stampNow = body.markRevised === true;
  const stampIfNever = !stampNow && body.status === 'memorised';
  const [row] = await db
    .insert(memorisation)
    .values({
      userId,
      surah,
      status: body.status,
      lastRevisedAt: stampNow || stampIfNever ? now : null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [memorisation.userId, memorisation.surah],
      set: {
        status: body.status,
        updatedAt: now,
        ...(stampNow
          ? { lastRevisedAt: now }
          : stampIfNever
            ? {
                lastRevisedAt: sql`coalesce(${memorisation.lastRevisedAt}, excluded.last_revised_at)`,
              }
            : {}),
      },
    })
    .returning();
  if (!row) return fail('internal_error');
  return toEntry(row);
}

/** `DELETE /v1/me/memorisation/{surah}`: always succeeds, marked or not. */
export async function deleteMemorisation(db: Db, userId: string, surah: number): Promise<void> {
  await db
    .delete(memorisation)
    .where(and(eq(memorisation.userId, userId), eq(memorisation.surah, surah)));
}
