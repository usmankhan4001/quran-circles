import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import * as schema from '../schema/index';
import { createMigratedDb, factory, type TestDb } from '../test/helpers';
import {
  DEFAULT_OCCURRENCE_HORIZON_DAYS,
  planOccurrences,
  scheduleSpecOf,
  topUpAllOccurrences,
  withSeasonEnd,
  type ScheduleSpec,
} from './index';

/** Saturday 17 October 2026, 10:00 in Pakistan. */
const NOW = new Date('2026-10-17T05:00:00Z');
const DAY_MS = 24 * 60 * 60 * 1000;
const later = (days: number) => new Date(NOW.getTime() + days * DAY_MS);

let test: TestDb;
let make: ReturnType<typeof factory>;
let venueId: string;
let programId: string;

beforeAll(async () => {
  test = await createMigratedDb();
});

afterAll(async () => {
  await test.pg.close();
});

beforeEach(async () => {
  const { rows } = await test.pg.query<{ tablename: string }>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'schema_migrations'`,
  );
  await test.pg.exec(
    `TRUNCATE ${rows.map((r) => `"${r.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`,
  );
  make = factory(test);
  const city = await make.city();
  const area = await make.area(city.id);
  venueId = (await make.venue(city.id, area.id)).id;
  programId = (await make.program('circles')).id;
});

/** A weekly Friday session at 19:30 Pakistan time, started in March, by default. */
const session = (v: Partial<schema.NewSessionRow> = {}) => make.session(venueId, programId, v);

const datesOf = async (sessionId: string): Promise<string[]> =>
  (
    await test.db
      .select()
      .from(schema.occurrences)
      .where(eq(schema.occurrences.sessionId, sessionId))
  )
    .map((o) => o.startsAt.toISOString().slice(0, 10))
    .sort();

describe('planOccurrences', () => {
  const weekly: ScheduleSpec = {
    kind: 'recurring',
    localStartTime: '19:30',
    durationMinutes: 60,
    daysOfWeek: [5],
    startsOn: '2026-03-01',
    endsOn: null,
    timezone: 'Asia/Karachi',
  };

  it('places each date at the local start time in the session zone', () => {
    const [first, ...rest] = planOccurrences(weekly, '2026-10-17', '2026-10-31');
    expect(first).toEqual({
      date: '2026-10-23',
      startsAt: new Date('2026-10-23T14:30:00Z'),
      endsAt: new Date('2026-10-23T15:30:00Z'),
    });
    expect(rest.map((p) => p.date)).toEqual(['2026-10-30']);
  });

  it('stops at the session end and plans a one-off only on its date', () => {
    expect(
      planOccurrences({ ...weekly, endsOn: '2026-10-25' }, '2026-10-17', '2026-12-31'),
    ).toHaveLength(1);
    const oneOff = { ...weekly, kind: 'one_off' as const, daysOfWeek: [], startsOn: '2026-11-02' };
    expect(planOccurrences(oneOff, '2026-10-17', '2026-12-31').map((p) => p.date)).toEqual([
      '2026-11-02',
    ]);
    expect(planOccurrences(oneOff, '2026-11-03', '2026-12-31')).toEqual([]);
  });

  it('never plans more than 400 rows, whatever the range', () => {
    const daily = { ...weekly, daysOfWeek: [0, 1, 2, 3, 4, 5, 6] };
    expect(planOccurrences(daily, '2026-01-01', '2030-01-01')).toHaveLength(400);
  });

  it('reads a session row, trimming Postgres seconds from the start time', async () => {
    const row = await session();
    expect(scheduleSpecOf(row)).toEqual({ ...weekly, localStartTime: '19:30' });
    expect(row.localStartTime).toMatch(/^19:30/);
  });
});

describe('topUpAllOccurrences', () => {
  it('uses a 90 day horizon by default, as the API does', () => {
    expect(DEFAULT_OCCURRENCE_HORIZON_DAYS).toBe(90);
  });

  it('fills a live recurring session up to the horizon, and adds nothing on a second run', async () => {
    const weekly = await session();
    const first = await topUpAllOccurrences(test.db, NOW, 28);
    expect(first).toEqual({ sessions: 1, occurrencesAdded: 4 });
    expect(await datesOf(weekly.id)).toEqual([
      '2026-10-23',
      '2026-10-30',
      '2026-11-06',
      '2026-11-13',
    ]);

    expect(await topUpAllOccurrences(test.db, NOW, 28)).toEqual({
      sessions: 1,
      occurrencesAdded: 0,
    });
    expect(await datesOf(weekly.id)).toHaveLength(4);
  });

  it('follows the horizon it is given and moves forward with the clock', async () => {
    const weekly = await session();
    expect((await topUpAllOccurrences(test.db, NOW, 90)).occurrencesAdded).toBe(13);
    expect((await datesOf(weekly.id)).at(-1)).toBe('2027-01-15');
    // A week later one more Friday comes into range.
    expect((await topUpAllOccurrences(test.db, later(7), 90)).occurrencesAdded).toBe(1);
    expect((await datesOf(weekly.id)).at(-1)).toBe('2027-01-22');
  });

  it('includes drafts and skips cancelled, archived, one-off and ended sessions', async () => {
    const draft = await session({ status: 'draft' });
    const cancelled = await session({ status: 'cancelled' });
    const archived = await session({ status: 'archived' });
    const oneOff = await session({ kind: 'one_off', daysOfWeek: [], startsOn: '2026-11-02' });
    const ended = await session({ endsOn: '2026-10-01' });

    const summary = await topUpAllOccurrences(test.db, NOW, 28);
    expect(summary).toEqual({ sessions: 1, occurrencesAdded: 4 });
    expect(await datesOf(draft.id)).toHaveLength(4);
    for (const s of [cancelled, archived, oneOff, ended]) expect(await datesOf(s.id)).toEqual([]);
  });

  it('stops at the last day of the season, or the session end when that comes first', async () => {
    const [season] = await test.db
      .insert(schema.seasons)
      .values({ programId, name: 'Short season', startsOn: '2026-10-01', endsOn: '2026-11-06' })
      .returning();
    const inSeason = await session({ seasonId: season!.id });
    const endsFirst = await session({ seasonId: season!.id, endsOn: '2026-10-30' });

    await topUpAllOccurrences(test.db, NOW, 90);
    expect(await datesOf(inSeason.id)).toEqual(['2026-10-23', '2026-10-30', '2026-11-06']);
    expect(await datesOf(endsFirst.id)).toEqual(['2026-10-23', '2026-10-30']);
  });

  it('only adds dates after the latest one, so a cancelled occurrence is never recreated', async () => {
    const weekly = await session();
    const cancelled = await make.occurrence(weekly.id, {
      startsAt: new Date('2026-10-23T14:30:00Z'),
      endsAt: new Date('2026-10-23T15:30:00Z'),
      status: 'cancelled',
    });
    expect((await topUpAllOccurrences(test.db, NOW, 28)).occurrencesAdded).toBe(3);
    const [row] = await test.db
      .select()
      .from(schema.occurrences)
      .where(eq(schema.occurrences.id, cancelled.id));
    expect(row?.status).toBe('cancelled');
    expect(await datesOf(weekly.id)).toEqual([
      '2026-10-23',
      '2026-10-30',
      '2026-11-06',
      '2026-11-13',
    ]);
  });

  it('does nothing when there are no sessions', async () => {
    expect(await topUpAllOccurrences(test.db, NOW, 90)).toEqual({
      sessions: 0,
      occurrencesAdded: 0,
    });
  });
});

describe('withSeasonEnd', () => {
  const spec: ScheduleSpec = {
    kind: 'recurring',
    localStartTime: '19:00',
    durationMinutes: 60,
    daysOfWeek: [5],
    startsOn: '2026-10-01',
    endsOn: null,
    timezone: 'Asia/Karachi',
  };

  it("ends an open schedule on the season's last day", () => {
    expect(withSeasonEnd(spec, '2026-11-06').endsOn).toBe('2026-11-06');
  });

  it('keeps the earlier of the two end dates', () => {
    expect(withSeasonEnd({ ...spec, endsOn: '2026-10-30' }, '2026-11-06').endsOn).toBe(
      '2026-10-30',
    );
    expect(withSeasonEnd({ ...spec, endsOn: '2026-12-31' }, '2026-11-06').endsOn).toBe(
      '2026-11-06',
    );
  });

  it('changes nothing without a season, and never changes the spec it was given', () => {
    expect(withSeasonEnd(spec, null)).toBe(spec);
    expect(withSeasonEnd(spec, undefined)).toBe(spec);
    withSeasonEnd(spec, '2026-11-06');
    expect(spec.endsOn).toBeNull();
  });
});
