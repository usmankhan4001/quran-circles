import { and, eq } from 'drizzle-orm';
import type { Device, DevicePlatform, Locale, PushProvider } from '@qc/contracts';
import { schema, type Db } from '../../db';
import { fail } from '../shared/errors';

const { devices } = schema;

const toDevice = (r: typeof devices.$inferSelect): Device => ({
  id: r.id,
  platform: r.platform,
  provider: r.provider,
  locale: r.locale,
  createdAt: r.createdAt.toISOString(),
  lastSeenAt: r.lastSeenAt.toISOString(),
});

/**
 * Registering a token again refreshes it. A token that now belongs to a different signed-in
 * person (a shared phone) moves to them, so the previous person stops receiving the pushes.
 */
export async function registerDevice(
  db: Db,
  userId: string,
  now: Date,
  input: { platform: DevicePlatform; provider: PushProvider; token: string; locale: Locale },
): Promise<Device> {
  const [row] = await db
    .insert(devices)
    .values({ userId, ...input, lastSeenAt: now, createdAt: now })
    .onConflictDoUpdate({
      target: [devices.provider, devices.token],
      set: { userId, platform: input.platform, locale: input.locale, lastSeenAt: now, revokedAt: null },
    })
    .returning();
  return toDevice(row!);
}

export async function removeDevice(db: Db, userId: string, deviceId: string): Promise<void> {
  const removed = await db
    .delete(devices)
    .where(and(eq(devices.id, deviceId), eq(devices.userId, userId)))
    .returning({ id: devices.id });
  if (removed.length === 0) fail('not_found');
}
