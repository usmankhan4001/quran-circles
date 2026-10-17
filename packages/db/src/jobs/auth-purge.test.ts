import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import * as schema from '../schema/index';
import { createMigratedDb, factory, nextPhone, type TestDb } from '../test/helpers';
import {
  DEFAULT_CHALLENGE_RETENTION_DAYS,
  DEFAULT_SESSION_RETENTION_DAYS,
  purgeStaleAuthRows,
} from './index';

/** Saturday 17 October 2026, 03:00 in Pakistan: when the worker runs the purge. */
const NOW = new Date('2026-10-16T22:00:00Z');
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const ago = (ms: number) => new Date(NOW.getTime() - ms);
const ahead = (ms: number) => new Date(NOW.getTime() + ms);

let test: TestDb;
let userId: string;
let tokenCounter = 0;

beforeAll(async () => {
  test = await createMigratedDb();
});

afterAll(async () => {
  await test.pg.close();
});

beforeEach(async () => {
  await test.pg.exec('TRUNCATE otp_challenges, auth_sessions, users RESTART IDENTITY CASCADE');
  userId = (await factory(test).user()).id;
});

/** A sign-in code with a synthetic number and a fake hash. */
async function code(expiresAt: Date, consumedAt: Date | null = null): Promise<string> {
  const [row] = await test.db
    .insert(schema.otpChallenges)
    .values({
      phoneE164: nextPhone(),
      channel: 'sms',
      codeHash: 'fake-code-hash',
      expiresAt,
      consumedAt,
      createdAt: new Date(expiresAt.getTime() - 10 * 60 * 1000),
    })
    .returning({ id: schema.otpChallenges.id });
  if (!row) throw new Error('insert returned no row');
  return row.id;
}

/** A refresh-token session with a fake hash. */
async function session(expiresAt: Date, revokedAt: Date | null = null): Promise<string> {
  const [row] = await test.db
    .insert(schema.authSessions)
    .values({
      userId,
      refreshTokenHash: `fake-refresh-hash-${++tokenCounter}`,
      expiresAt,
      revokedAt,
    })
    .returning({ id: schema.authSessions.id });
  if (!row) throw new Error('insert returned no row');
  return row.id;
}

const codeIds = async () =>
  (await test.db.select({ id: schema.otpChallenges.id }).from(schema.otpChallenges))
    .map((r) => r.id)
    .sort();
const sessionIds = async () =>
  (await test.db.select({ id: schema.authSessions.id }).from(schema.authSessions))
    .map((r) => r.id)
    .sort();

describe('purgeStaleAuthRows', () => {
  it('keeps the documented retention defaults', () => {
    expect(DEFAULT_CHALLENGE_RETENTION_DAYS).toBe(1);
    expect(DEFAULT_SESSION_RETENTION_DAYS).toBe(30);
  });

  it('does nothing on an empty database', async () => {
    await test.pg.exec('TRUNCATE users CASCADE');
    expect(await purgeStaleAuthRows(test.db, NOW)).toEqual({ challenges: 0, sessions: 0 });
  });

  it('removes codes more than a day past expiry, used or not, and keeps newer ones', async () => {
    const spentUsed = await code(ago(DAY_MS + HOUR_MS), ago(DAY_MS + 2 * HOUR_MS));
    const spentUnused = await code(ago(3 * DAY_MS));
    const recentExpired = await code(ago(HOUR_MS)); // inside the one-day grace
    const usedNotExpired = await code(ahead(5 * 60 * 1000), ago(60 * 1000));
    const live = await code(ahead(5 * 60 * 1000));

    expect(await purgeStaleAuthRows(test.db, NOW)).toEqual({ challenges: 2, sessions: 0 });
    const kept = await codeIds();
    expect(kept).toEqual([recentExpired, usedNotExpired, live].sort());
    expect(kept).not.toContain(spentUsed);
    expect(kept).not.toContain(spentUnused);
  });

  it('removes sessions expired or revoked more than 30 days ago and keeps live ones', async () => {
    const longExpired = await session(ago(31 * DAY_MS));
    const longRevoked = await session(ahead(10 * DAY_MS), ago(31 * DAY_MS));
    const recentlyExpired = await session(ago(29 * DAY_MS));
    const recentlyRevoked = await session(ahead(10 * DAY_MS), ago(DAY_MS));
    const live = await session(ahead(30 * DAY_MS));

    expect(await purgeStaleAuthRows(test.db, NOW)).toEqual({ challenges: 0, sessions: 2 });
    const kept = await sessionIds();
    expect(kept).toEqual([recentlyExpired, recentlyRevoked, live].sort());
    expect(kept).not.toContain(longExpired);
    expect(kept).not.toContain(longRevoked);
  });

  it('follows rows through their life as time passes, and a second run removes nothing', async () => {
    // As after a sign-in: a used code and a live session; then an unused code a minute later.
    await code(ahead(5 * 60 * 1000), NOW);
    const live = await session(ahead(30 * DAY_MS));
    await code(ahead(6 * 60 * 1000));

    expect(await purgeStaleAuthRows(test.db, NOW)).toEqual({ challenges: 0, sessions: 0 });

    // Two days on: the codes are gone, the live session stays.
    const later = new Date(NOW.getTime() + 2 * DAY_MS);
    expect(await purgeStaleAuthRows(test.db, later)).toEqual({ challenges: 2, sessions: 0 });
    expect(await purgeStaleAuthRows(test.db, later)).toEqual({ challenges: 0, sessions: 0 });
    expect(await sessionIds()).toEqual([live]);

    // Signed out: kept for the retention window, then removed.
    await test.db.update(schema.authSessions).set({ revokedAt: later });
    expect(await purgeStaleAuthRows(test.db, later)).toEqual({ challenges: 0, sessions: 0 });
    const muchLater = new Date(later.getTime() + 31 * DAY_MS);
    expect(await purgeStaleAuthRows(test.db, muchLater)).toEqual({ challenges: 0, sessions: 1 });
    expect(await sessionIds()).toEqual([]);
  });

  it('uses the retention it is given', async () => {
    const codeTwoHoursPast = await code(ago(2 * HOUR_MS));
    const revokedTwoDaysAgo = await session(ahead(DAY_MS), ago(2 * DAY_MS));
    expect(
      await purgeStaleAuthRows(test.db, NOW, {
        challengeRetentionDays: 0,
        sessionRetentionDays: 1,
      }),
    ).toEqual({ challenges: 1, sessions: 1 });
    expect(await codeIds()).not.toContain(codeTwoHoursPast);
    expect(await sessionIds()).not.toContain(revokedTwoDaysAgo);
  });

  it('leaves users and everything else alone', async () => {
    await session(ago(60 * DAY_MS));
    await purgeStaleAuthRows(test.db, NOW);
    expect(await test.db.select().from(schema.users)).toHaveLength(1);
  });
});
