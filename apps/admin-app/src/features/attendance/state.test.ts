import { describe, expect, it } from 'vitest';
import {
  attendanceReducer,
  entriesTotal,
  initialAttendanceState,
  MAX_ENTRY_COUNT,
  MAX_HEADCOUNT,
  validateAttendance,
  type Attendance,
} from './state';

const A = '00000000-0000-4000-8000-0b0000001001';
const B = '00000000-0000-4000-8000-0b0000001002';

const run = (actions: Parameters<typeof attendanceReducer>[1][]) =>
  actions.reduce(attendanceReducer, initialAttendanceState);

describe('attendance reducer', () => {
  it('moves the headcount with each tick, by the size of the party', () => {
    const s = run([
      { type: 'tick', registrationId: A, count: 3 },
      { type: 'tick', registrationId: B, count: 1 },
    ]);
    expect(s.headcount).toBe(4);
    expect(entriesTotal(s)).toBe(4);
    expect(s.dirty).toBe(true);
  });

  it('ticks everyone at once without counting anyone twice', () => {
    const s = run([
      { type: 'tick', registrationId: A, count: 3 },
      {
        type: 'tickAll',
        people: [
          { registrationId: A, count: 3 },
          { registrationId: B, count: 2 },
        ],
      },
    ]);
    expect(s.ticked).toEqual({ [A]: 3, [B]: 2 });
    expect(s.headcount).toBe(5);
  });

  it('clears every tick and takes their people off the headcount, keeping others', () => {
    const s = run([
      { type: 'setHeadcount', value: 10 },
      { type: 'tick', registrationId: A, count: 3 },
      { type: 'tick', registrationId: B, count: 2 },
      { type: 'clearTicks' },
    ]);
    expect(s.ticked).toEqual({});
    expect(s.headcount).toBe(10);
  });

  it('ignores a second tick of the same person', () => {
    const s = run([
      { type: 'tick', registrationId: A, count: 3 },
      { type: 'tick', registrationId: A, count: 3 },
    ]);
    expect(s.headcount).toBe(3);
  });

  it('takes the count off again when a tick is removed', () => {
    const s = run([
      { type: 'tick', registrationId: A, count: 3 },
      { type: 'untick', registrationId: A },
    ]);
    expect(s.headcount).toBe(0);
    expect(s.ticked).toEqual({});
  });

  it('never goes below zero or above the limit', () => {
    expect(run([{ type: 'setHeadcount', value: -5 }]).headcount).toBe(0);
    expect(run([{ type: 'setHeadcount', value: 999_999 }]).headcount).toBe(MAX_HEADCOUNT);
    expect(run([{ type: 'untick', registrationId: A }]).headcount).toBe(0);
  });

  it('keeps a party size between 1 and 50', () => {
    const s = run([
      { type: 'tick', registrationId: A, count: 500 },
      { type: 'addDropIn', name: null, count: 0 },
    ]);
    expect(s.ticked[A]).toBe(MAX_ENTRY_COUNT);
    expect(s.dropIns[0]!.count).toBe(1);
  });

  it('adds a drop-in with an optional trimmed name and removes it again', () => {
    let s = run([
      { type: 'addDropIn', name: '  Sample Visitor  ', count: 2 },
      { type: 'addDropIn', name: '   ', count: 1 },
    ]);
    expect(s.dropIns.map((d) => d.name)).toEqual(['Sample Visitor', null]);
    expect(s.headcount).toBe(3);
    s = attendanceReducer(s, { type: 'removeDropIn', id: s.dropIns[0]!.id });
    expect(s.headcount).toBe(1);
    expect(s.dropIns).toHaveLength(1);
  });

  it('loads what the server holds and starts clean', () => {
    const attendance: Attendance = {
      occurrenceId: '00000000-0000-4000-8000-070000000101',
      headcount: 12,
      entries: [
        { registrationId: A, name: null, count: 2 },
        { registrationId: null, name: 'Sample Visitor', count: 1 },
      ],
      markedAt: '2027-02-15T20:00:00Z',
    };
    const s = attendanceReducer(initialAttendanceState, { type: 'load', attendance });
    expect(s.headcount).toBe(12);
    expect(s.ticked).toEqual({ [A]: 2 });
    expect(s.dropIns).toEqual([{ id: 'd1', name: 'Sample Visitor', count: 1 }]);
    expect(s.dirty).toBe(false);
  });

  it('uses the ticked total as the headcount when none was recorded', () => {
    const attendance: Attendance = {
      occurrenceId: '00000000-0000-4000-8000-070000000101',
      headcount: null,
      entries: [{ registrationId: A, name: null, count: 4 }],
      markedAt: null,
    };
    expect(attendanceReducer(initialAttendanceState, { type: 'load', attendance }).headcount).toBe(
      4,
    );
  });
});

describe('validateAttendance', () => {
  it('builds the request from ticks and names', () => {
    const s = run([
      { type: 'tick', registrationId: A, count: 2 },
      { type: 'addDropIn', name: 'Sample Visitor', count: 1 },
      { type: 'setHeadcount', value: 10 },
    ]);
    expect(validateAttendance(s).body).toEqual({
      headcount: 10,
      entries: [
        { registrationId: A, name: null, count: 2 },
        { registrationId: null, name: 'Sample Visitor', count: 1 },
      ],
    });
  });

  it('accepts a bare headcount with no names', () => {
    expect(validateAttendance(run([{ type: 'setHeadcount', value: 25 }])).body).toEqual({
      headcount: 25,
      entries: [],
    });
  });

  it('refuses a headcount lower than the people named', () => {
    const s = run([
      { type: 'tick', registrationId: A, count: 5 },
      { type: 'setHeadcount', value: 2 },
    ]);
    expect(validateAttendance(s)).toEqual({ error: 'admin.attendance.error.lessThanTicked' });
  });
});
