import { and, desc, eq, lt } from 'drizzle-orm';
import type { CircleRequest } from '@qc/contracts';
import type { CircleRequestCreate } from '../shared/types';
import { schema, type Db } from '../../db';
import { fail, invalid, isUniqueViolation } from '../shared/errors';
import { MS_PER_DAY } from '../shared/time';

const { circleRequests, areas } = schema;
type Row = typeof circleRequests.$inferSelect;

/** A request past its expiry reads as expired even before the sweep marks it. */
const toRequest = (r: Row, now: Date): CircleRequest => ({
  id: r.id,
  areaId: r.areaId,
  days: [...r.days].sort((a, b) => a - b),
  section: r.section,
  language: r.language,
  status: r.status === 'active' && r.expiresAt <= now ? 'expired' : r.status,
  expiresAt: r.expiresAt.toISOString(),
  createdAt: r.createdAt.toISOString(),
});

export async function listCircleRequests(
  db: Db,
  userId: string,
  now: Date,
): Promise<{ items: CircleRequest[] }> {
  const rows = await db
    .select()
    .from(circleRequests)
    .where(eq(circleRequests.userId, userId))
    .orderBy(desc(circleRequests.createdAt), desc(circleRequests.id))
    .limit(100);
  return { items: rows.map((r) => toRequest(r, now)) };
}

/** Area-level demand only: the person's area is the only location kept. One active request per area. */
export async function createCircleRequest(
  db: Db,
  userId: string,
  now: Date,
  ttlDays: number,
  input: CircleRequestCreate,
): Promise<CircleRequest> {
  const [area] = await db.select({ id: areas.id }).from(areas).where(eq(areas.id, input.areaId));
  if (!area) invalid('areaId');
  try {
    const row = await db.transaction(async (tx) => {
      // An expired request must not block a new one.
      await tx
        .update(circleRequests)
        .set({ status: 'expired' })
        .where(
          and(
            eq(circleRequests.userId, userId),
            eq(circleRequests.areaId, input.areaId),
            eq(circleRequests.status, 'active'),
            lt(circleRequests.expiresAt, now),
          ),
        );
      const [created] = await tx
        .insert(circleRequests)
        .values({
          userId,
          areaId: input.areaId,
          days: [...new Set<number>(input.days)].sort((a, b) => a - b),
          section: input.section ?? null,
          language: input.language ?? null,
          expiresAt: new Date(now.getTime() + ttlDays * MS_PER_DAY),
          createdAt: now,
        })
        .returning();
      return created!;
    });
    return toRequest(row, now);
  } catch (error) {
    if (isUniqueViolation(error)) return fail('circle_request_exists');
    throw error;
  }
}

export async function cancelCircleRequest(
  db: Db,
  userId: string,
  now: Date,
  requestId: string,
): Promise<CircleRequest> {
  const [current] = await db
    .select()
    .from(circleRequests)
    .where(and(eq(circleRequests.id, requestId), eq(circleRequests.userId, userId)));
  if (!current) return fail('not_found');
  if (current.status !== 'active') return toRequest(current, now);
  if (current.expiresAt <= now) {
    const [expired] = await db
      .update(circleRequests)
      .set({ status: 'expired' })
      .where(eq(circleRequests.id, requestId))
      .returning();
    return toRequest(expired!, now);
  }
  const [cancelled] = await db
    .update(circleRequests)
    .set({ status: 'cancelled', cancelledAt: now })
    .where(eq(circleRequests.id, requestId))
    .returning();
  return toRequest(cancelled!, now);
}
