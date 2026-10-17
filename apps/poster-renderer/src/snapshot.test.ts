import { describe, expect, it } from 'vitest';
import {
  posterOutOfDate as outOfDate,
  posterSnapshotFromSession as snapshotFromSession,
  PosterSourceSnapshot as SourceSnapshot,
  type Session,
} from '@qc/contracts';
import { SAMPLE_SESSION } from './sample';

// The snapshot comparison moved to `@qc/contracts` (1.0.0-rc.5). These tests stay here so the
// renderer's own sample sessions keep being checked against the shared rule it now relies on.

const made = SAMPLE_SESSION;
const later = (change: Partial<SourceSnapshot>): SourceSnapshot => ({
  ...made,
  sessionVersion: '2026-10-18T10:00:00.000Z',
  ...change,
});

describe('outOfDate', () => {
  it('is empty while the printed details are unchanged, even if the session version moved on', () => {
    expect(outOfDate(made, made)).toEqual([]);
    expect(outOfDate(made, later({}))).toEqual([]);
  });

  it('flags a new start time, new days or a new timezone as time', () => {
    expect(outOfDate(made, later({ localStartTime: '20:00' }))).toEqual(['time']);
    expect(outOfDate(made, later({ daysOfWeek: [4] }))).toEqual(['time']);
    expect(outOfDate(made, later({ daysOfWeek: [4, 5] }))).toEqual(['time']);
    expect(outOfDate(made, later({ timezone: 'Asia/Dubai' }))).toEqual(['time']);
  });

  it('ignores the order of days and what the poster does not print', () => {
    const multi = { ...made, daysOfWeek: [1, 5] };
    expect(outOfDate(multi, { ...multi, daysOfWeek: [5, 1] })).toEqual([]);
    expect(outOfDate(made, later({ durationMinutes: 90, endsOn: '2027-01-01' }))).toEqual([]);
    // A weekly poster does not print its first date.
    expect(outOfDate(made, later({ startsOn: '2026-11-06' }))).toEqual([]);
  });

  it('flags a moved date for a one-off lecture', () => {
    const oneOff = { ...made, daysOfWeek: [], startsOn: '2026-11-07' };
    expect(outOfDate(oneOff, { ...oneOff, startsOn: '2026-11-14' })).toEqual(['time']);
  });

  it('flags a new venue, a renamed venue or a new area as venue', () => {
    const otherVenue = { ...made.venue, id: '9c1d2e3f-4a5b-4c6d-8e7f-0a1b2c3d4e5f' };
    expect(outOfDate(made, later({ venue: otherVenue }))).toEqual(['venue']);
    expect(
      outOfDate(
        made,
        later({
          venue: { ...made.venue, name: { en: 'Renamed Sample Masjid', ur: made.venue.name.ur } },
        }),
      ),
    ).toEqual(['venue']);
    expect(
      outOfDate(
        made,
        later({ venue: { ...made.venue, name: { en: made.venue.name.en, ur: null } } }),
      ),
    ).toEqual(['venue']);
    expect(outOfDate(made, later({ venue: { ...made.venue, area: null } }))).toEqual(['venue']);
  });

  it('reports both when time and venue changed', () => {
    const otherVenue = { ...made.venue, id: '9c1d2e3f-4a5b-4c6d-8e7f-0a1b2c3d4e5f' };
    expect(outOfDate(made, later({ localStartTime: '20:00', venue: otherVenue }))).toEqual([
      'time',
      'venue',
    ]);
  });

  it('refuses to compare two different sessions', () => {
    expect(() =>
      outOfDate(made, { ...made, sessionId: '7d8e9f0a-1b2c-4d3e-8f4a-5b6c7d8e9f0a' }),
    ).toThrow(RangeError);
  });
});

describe('snapshotFromSession', () => {
  it('takes the printed details from the contract session', () => {
    const session = {
      id: made.sessionId,
      venue: {
        id: made.venue.id,
        cityId: made.venue.id,
        areaId: made.venue.id,
        name: made.venue.name,
        lat: 31.5,
        lng: 74.3,
      },
      localStartTime: '21:30',
      durationMinutes: 60,
      daysOfWeek: [5],
      startsOn: '2026-10-23',
      endsOn: null,
      timezone: 'Asia/Karachi',
    } as unknown as Session;
    const snapshot = snapshotFromSession(session, 'v7', made.venue.area);
    expect(snapshot).toEqual({ ...made, sessionVersion: 'v7' });
    expect(SourceSnapshot.safeParse(snapshot).success).toBe(true);
  });
});
