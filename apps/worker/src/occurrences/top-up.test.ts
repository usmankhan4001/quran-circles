import { eq } from 'drizzle-orm';
import { createMemoryLogger, type MemoryLogger } from '@qc/messaging';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { tables } from '../db';
import { createTestDb, type TestDb } from '../test/db';
import { TestClock } from '../test/harness';
import { seedUser, seedWorld } from '../test/seed';
import { runOccurrenceTopUp } from './top-up';

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

const occurrenceCount = async (sessionId: string) =>
  (
    await test.db
      .select()
      .from(tables.occurrences)
      .where(eq(tables.occurrences.sessionId, sessionId))
  ).length;

const run = (horizonDays: number) =>
  runOccurrenceTopUp({ db: test.db, logger, now: clock.now, horizonDays });

describe('the daily occurrence top-up job', () => {
  it('fills a weekly session to the horizon with the injected clock, and adds nothing on a second run', async () => {
    const world = await seedWorld(test.db);
    // 2 November 2026 + 28 days: the Fridays 6, 13, 20 and 27 November.
    expect(await run(28)).toEqual({ sessions: 1, occurrencesAdded: 4 });
    expect(await occurrenceCount(world.session.id)).toBe(4);

    expect(await run(28)).toEqual({ sessions: 1, occurrencesAdded: 0 });
    expect(await occurrenceCount(world.session.id)).toBe(4);

    // A week on, one more Friday is inside the horizon.
    clock.advance(7 * 24 * 3_600_000);
    expect(await run(28)).toEqual({ sessions: 1, occurrencesAdded: 1 });
  });

  it('uses the horizon it is given', async () => {
    const world = await seedWorld(test.db);
    expect((await run(90)).occurrencesAdded).toBe(13);
    expect(await occurrenceCount(world.session.id)).toBe(13);
  });

  it('logs counts only: no names, titles or phone numbers', async () => {
    await seedWorld(test.db);
    const user = await seedUser(test.db);
    await run(28);
    await run(28);
    const lines = logger.lines.filter((l) => l.event === 'occurrences.topped_up');
    expect(lines.map((l) => l.fields)).toEqual([
      { sessions: 1, occurrencesAdded: 4, horizonDays: 28 },
      { sessions: 1, occurrencesAdded: 0, horizonDays: 28 },
    ]);
    const dump = logger.dump();
    for (const secret of [user.phoneE164, 'Test Person', 'Weekly tafsir', 'Test Masjid']) {
      expect(dump).not.toContain(secret);
    }
  });
});
