import { and, asc, desc, eq } from 'drizzle-orm';
import type { Bookmark, BookmarkImport, ReadingPosition } from '@qc/contracts';
import { schema, type Db } from '../../db';
import { fail, invalid, isUniqueViolation } from '../shared/errors';

const { bookmarks, readingPositions, users } = schema;

type Draft = BookmarkImport['items'][number];

const toBookmark = (r: typeof bookmarks.$inferSelect): Bookmark => ({
  id: r.id,
  kind: r.kind,
  surah: r.surah,
  ayah: r.ayah,
  para: r.para,
  note: r.note,
  createdAt: r.createdAt.toISOString(),
});

/** A bookmark points at exactly what its kind says: an ayah, a surah or a para. */
function shapeOk(b: Draft): boolean {
  switch (b.kind) {
    case 'ayah':
      return b.surah !== undefined && b.ayah !== undefined && b.para === undefined;
    case 'surah':
      return b.surah !== undefined && b.ayah === undefined && b.para === undefined;
    case 'para':
      return b.para !== undefined && b.surah === undefined && b.ayah === undefined;
  }
}

const values = (userId: string, b: Draft, now: Date) => ({
  userId,
  kind: b.kind,
  surah: b.surah ?? null,
  ayah: b.ayah ?? null,
  para: b.para ?? null,
  note: b.note ?? null,
  createdAt: now,
});

export async function listBookmarks(db: Db, userId: string): Promise<{ items: Bookmark[] }> {
  const rows = await db
    .select()
    .from(bookmarks)
    .where(eq(bookmarks.userId, userId))
    .orderBy(desc(bookmarks.createdAt), asc(bookmarks.id))
    .limit(1000);
  return { items: rows.map(toBookmark) };
}

export async function createBookmark(db: Db, userId: string, now: Date, input: Draft): Promise<Bookmark> {
  if (!shapeOk(input)) invalid('kind', 'target_mismatch');
  try {
    const [row] = await db.insert(bookmarks).values(values(userId, input, now)).returning();
    return toBookmark(row!);
  } catch (error) {
    if (isUniqueViolation(error)) return fail('conflict');
    throw error;
  }
}

export async function deleteBookmark(db: Db, userId: string, id: string): Promise<void> {
  const removed = await db
    .delete(bookmarks)
    .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)))
    .returning({ id: bookmarks.id });
  if (removed.length === 0) fail('not_found');
}

/** One-time import of V1 browser bookmarks. Bad or duplicate entries are skipped, not fatal. */
export async function importBookmarks(
  db: Db,
  userId: string,
  now: Date,
  input: BookmarkImport,
): Promise<{ imported: number; skipped: number }> {
  let imported = 0;
  let skipped = 0;
  for (const item of input.items) {
    if (!shapeOk(item)) {
      skipped += 1;
      continue;
    }
    const rows = await db
      .insert(bookmarks)
      .values(values(userId, item, now))
      .onConflictDoNothing()
      .returning({ id: bookmarks.id });
    if (rows.length) imported += 1;
    else skipped += 1;
  }
  return { imported, skipped };
}

/** With nothing saved yet, the position is the start of the Quran. */
export async function getReadingPosition(db: Db, userId: string): Promise<ReadingPosition> {
  const [row] = await db.select().from(readingPositions).where(eq(readingPositions.userId, userId));
  if (row) return { surah: row.surah, ayah: row.ayah, updatedAt: row.updatedAt.toISOString() };
  const [user] = await db.select({ createdAt: users.createdAt }).from(users).where(eq(users.id, userId));
  return { surah: 1, ayah: 1, updatedAt: (user?.createdAt ?? new Date(0)).toISOString() };
}

export async function putReadingPosition(
  db: Db,
  userId: string,
  now: Date,
  input: { surah: number; ayah: number },
): Promise<ReadingPosition> {
  const [row] = await db
    .insert(readingPositions)
    .values({ userId, ...input, updatedAt: now })
    .onConflictDoUpdate({
      target: readingPositions.userId,
      set: { ...input, updatedAt: now },
    })
    .returning();
  return { surah: row!.surah, ayah: row!.ayah, updatedAt: row!.updatedAt.toISOString() };
}
