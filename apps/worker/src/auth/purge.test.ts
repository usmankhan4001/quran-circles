import { createMemoryLogger, type MemoryLogger } from '@qc/messaging';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { tables } from '../db';
import { createTestDb, type TestDb } from '../test/db';
import { TestClock } from '../test/harness';
import { seedAuthSession, seedOtpChallenge, seedUser } from '../test/seed';
import { runAuthPurge } from './purge';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

let test: TestDb;
let clock: TestClock;
let logger: MemoryLogger;

beforeAll(async () => {
  test = await createTestDb();
}, 120_000);

afterAll(async () => {
  await test.pg.close();
});

beforeEach(async () => {
  await test.reset();
  clock = new TestClock();
  logger = createMemoryLogger();
});

const at = (offsetMs: number) => new Date(clock.now().getTime() + offsetMs);
const run = () => runAuthPurge({ db: test.db, logger, now: clock.now });
const ids = async (table: typeof tables.otpChallenges | typeof tables.authSessions) =>
  (await test.db.select({ id: table.id }).from(table)).map((r) => r.id).sort();

/** One of each kind of row; returns the ids that must survive a run now. */
async function seedMix() {
  const user = await seedUser(test.db);
  // Spent codes: used, or expired more than a day ago.
  await seedOtpChallenge(test.db, { expiresAt: at(-2 * DAY), consumedAt: at(-2 * DAY - HOUR) });
  await seedOtpChallenge(test.db, { expiresAt: at(-3 * DAY) });
  // Codes still inside the grace day, or not expired yet.
  const keptCodes = [
    (await seedOtpChallenge(test.db, { expiresAt: at(-HOUR) })).id,
    (await seedOtpChallenge(test.db, { expiresAt: at(5 * 60_000) })).id,
  ];
  // Sessions expired or revoked more than 30 days ago.
  await seedAuthSession(test.db, { userId: user.id, expiresAt: at(-31 * DAY) });
  await seedAuthSession(test.db, {
    userId: user.id,
    expiresAt: at(10 * DAY),
    revokedAt: at(-31 * DAY),
  });
  // A live session and a recently revoked one (kept so a replayed token is seen as reuse).
  const keptSessions = [
    (await seedAuthSession(test.db, { userId: user.id, expiresAt: at(30 * DAY) })).id,
    (
      await seedAuthSession(test.db, {
        userId: user.id,
        expiresAt: at(10 * DAY),
        revokedAt: at(-DAY),
      })
    ).id,
  ];
  return { user, keptCodes: keptCodes.sort(), keptSessions: keptSessions.sort() };
}

describe('the daily sign-in purge job', () => {
  it('deletes spent codes and expired or revoked sessions, keeps live ones, and a second run deletes nothing', async () => {
    const { keptCodes, keptSessions } = await seedMix();
    expect(await run()).toEqual({ challenges: 2, sessions: 2 });
    expect(await ids(tables.otpChallenges)).toEqual(keptCodes);
    expect(await ids(tables.authSessions)).toEqual(keptSessions);

    expect(await run()).toEqual({ challenges: 0, sessions: 0 });
    expect(await ids(tables.authSessions)).toEqual(keptSessions);
  });

  it('uses the injected clock', async () => {
    const user = await seedUser(test.db);
    await seedOtpChallenge(test.db, { expiresAt: at(-HOUR) });
    await seedAuthSession(test.db, { userId: user.id, expiresAt: at(DAY), revokedAt: at(0) });
    expect(await run()).toEqual({ challenges: 0, sessions: 0 });
    clock.advance(31 * DAY);
    expect(await run()).toEqual({ challenges: 1, sessions: 1 });
  });

  it('logs one line per run with counts only: no numbers, names, hashes or ids', async () => {
    const { user, keptSessions } = await seedMix();
    await run();
    await run();
    const lines = logger.lines.filter((l) => l.event === 'auth.purged');
    expect(lines.map((l) => l.fields)).toEqual([
      { challenges: 2, sessions: 2 },
      { challenges: 0, sessions: 0 },
    ]);
    expect(logger.lines).toHaveLength(2);
    const dump = logger.dump();
    for (const secret of [user.phoneE164, user.id, 'Test Person', 'fake-', ...keptSessions]) {
      expect(dump).not.toContain(secret);
    }
  });

  it('fails loudly when the database fails, without logging a success', async () => {
    await test.pg.exec('ALTER TABLE auth_sessions RENAME TO auth_sessions_gone');
    try {
      await expect(run()).rejects.toThrow();
      expect(logger.lines.filter((l) => l.event === 'auth.purged')).toHaveLength(0);
    } finally {
      await test.pg.exec('ALTER TABLE auth_sessions_gone RENAME TO auth_sessions');
    }
  });
});
