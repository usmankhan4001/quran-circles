import { describe, expect, it } from 'vitest';
import { ERROR_CODES, makeApiError, type ReadingDay } from '@qc/contracts';
import { NOW, createWorld } from '../../test/harness';
import {
  mergeReadingDay,
  monthStart,
  readingRange,
  recordReadingDay,
  summariseReadingDays,
  todayInPakistan,
  weekStart,
} from './days';

const day = (date: string, sources: ReadingDay['sources'] = ['manual']): ReadingDay => ({
  date,
  sources,
  pages: 0,
  ayahs: 0,
});

function validationAnswer(issue: { path: string; code: string }) {
  return (_c: unknown, id: string) =>
    new Response(JSON.stringify(makeApiError('validation_failed', id, { issues: [issue] })), {
      status: ERROR_CODES.validation_failed,
      headers: { 'content-type': 'application/json' },
    });
}

describe('weeks and months (Pakistan dates)', () => {
  it('starts the week on Monday', () => {
    expect(weekStart('2027-02-15')).toBe('2027-02-15'); // a Monday
    expect(weekStart('2027-02-17')).toBe('2027-02-15');
    expect(weekStart('2027-02-21')).toBe('2027-02-15'); // the Sunday after
    expect(weekStart('2027-02-14')).toBe('2027-02-08'); // a Sunday belongs to the week before
  });

  it('starts the month on the 1st', () => {
    expect(monthStart('2027-02-15')).toBe('2027-02-01');
    expect(monthStart('2027-03-01')).toBe('2027-03-01');
  });

  it('asks for whichever starts first, the week or the month', () => {
    expect(readingRange('2027-02-17')).toEqual({ from: '2027-02-01', to: '2027-02-17' });
    // 2027-03-01 is a Monday, so the week and the month start together.
    expect(readingRange('2027-03-02')).toEqual({ from: '2027-03-01', to: '2027-03-02' });
    expect(readingRange('2027-04-01')).toEqual({ from: '2027-03-29', to: '2027-04-01' });
  });

  it('uses the Pakistan date, which turns at 19:00 UTC', () => {
    expect(todayInPakistan(new Date('2027-02-15T18:59:00Z'))).toBe('2027-02-15');
    expect(todayInPakistan(new Date('2027-02-15T19:00:00Z'))).toBe('2027-02-16');
  });
});

describe('summariseReadingDays', () => {
  it('counts days read this week and this month, with no streak', () => {
    const days = [
      day('2027-03-29'), // last week, last month
      day('2027-04-01'),
      day('2027-04-02', ['reader', 'portion']),
      day('2027-04-05'), // Monday
      day('2027-04-07', ['goal']),
    ];
    const summary = summariseReadingDays(days, '2027-04-07');
    expect(summary).toEqual({
      today: '2027-04-07',
      week: 2,
      month: 4,
      todaySources: ['goal'],
    });
  });

  it('ignores days after today and days with no source', () => {
    const summary = summariseReadingDays(
      [day('2027-02-15'), day('2027-02-16'), { ...day('2027-02-14'), sources: [] }],
      '2027-02-15',
    );
    expect(summary.week).toBe(1);
    expect(summary.month).toBe(1);
  });

  it('says nothing counted yet today when today is missing', () => {
    expect(summariseReadingDays([day('2027-02-14')], '2027-02-15').todaySources).toEqual([]);
  });

  it('puts a recorded day into the list, replacing the same date', () => {
    const merged = mergeReadingDay(
      [day('2027-02-13'), day('2027-02-15', ['reader'])],
      day('2027-02-15', ['reader', 'manual']),
    );
    expect(merged.map((d) => [d.date, d.sources])).toEqual([
      ['2027-02-13', ['manual']],
      ['2027-02-15', ['reader', 'manual']],
    ]);
  });
});

describe('recordReadingDay', () => {
  it('sends the day and answers with the whole day', async () => {
    const world = await createWorld({ signedIn: true });
    const outcome = await recordReadingDay(world.services.api, { source: 'manual' }, NOW);
    expect(outcome.ok).toBe(true);
    const call = world.http.callsTo('POST /v1/me/reading-days')[0]!;
    expect(call.body).toEqual({ source: 'manual' });
  });

  it('does not send a date the server would refuse (out_of_range)', async () => {
    const world = await createWorld({ signedIn: true });
    const outcome = await recordReadingDay(
      world.services.api,
      { source: 'reader', date: '2027-02-12' },
      NOW,
    );
    expect(outcome).toEqual({ ok: false, reason: 'out_of_range' });
    expect(world.http.callsTo('POST /v1/me/reading-days')).toHaveLength(0);
  });

  it("turns the server's out_of_range (a phone clock that is off) into the same outcome", async () => {
    const world = await createWorld({
      signedIn: true,
      mock: {
        handlers: {
          'readingDays.record': validationAnswer({ path: 'date', code: 'out_of_range' }),
        },
      },
    });
    const outcome = await recordReadingDay(world.services.api, { source: 'manual' }, NOW);
    expect(outcome).toEqual({ ok: false, reason: 'out_of_range' });
  });

  it('reports any other refusal as a failure', async () => {
    const world = await createWorld({
      signedIn: true,
      mock: {
        handlers: {
          'readingDays.record': validationAnswer({ path: 'source', code: 'invalid_value' }),
        },
      },
    });
    const outcome = await recordReadingDay(world.services.api, { source: 'manual' }, NOW);
    expect(outcome.ok).toBe(false);
    expect(outcome.ok === false && outcome.reason).toBe('failed');
  });

  it('reports a server error as a failure', async () => {
    const world = await createWorld({ signedIn: true });
    world.http.failNext('POST /v1/me/reading-days', 'internal_error');
    const outcome = await recordReadingDay(world.services.api, { source: 'manual' }, NOW);
    expect(outcome.ok === false && outcome.reason).toBe('failed');
  });
});
