import { describe, expect, it } from 'vitest';
import * as fx from '@qc/contracts/fixtures';
import {
  MAX_DURATION,
  MIN_DURATION,
  initialScheduleForm,
  tidyTime,
  validateSchedule,
  type ScheduleForm,
} from './form';

const recurring = fx.sessions.find((s) => s.kind === 'recurring')!;
const oneOff = fx.sessions.find((s) => s.kind === 'one_off');
const FROM = '2027-02-22';

const base = (patch: Partial<ScheduleForm> = {}): ScheduleForm => ({
  ...initialScheduleForm(recurring, FROM),
  ...patch,
});

describe('tidyTime', () => {
  it.each([
    ['7:30', '07:30'],
    ['19:30', '19:30'],
    ['1930', '19:30'],
    [' 07:05 ', '07:05'],
    ['half past', 'half past'],
  ])('turns %j into %j', (input, expected) => expect(tidyTime(input)).toBe(expected));
});

describe('initialScheduleForm', () => {
  it('starts from the current schedule with notify on', () => {
    const form = initialScheduleForm(recurring, FROM);
    expect(form).toMatchObject({
      time: recurring.localStartTime,
      durationMinutes: recurring.durationMinutes,
      effectiveFrom: FROM,
      notify: true,
    });
    expect(form.days).toEqual([...recurring.daysOfWeek].sort((a, b) => a - b));
  });
});

describe('validateSchedule', () => {
  it('says nothing changed when the form is untouched', () => {
    const result = validateSchedule(base(), recurring);
    expect(result.body).toBeUndefined();
    expect(result.errors.nothing).toBe('admin.schedule.error.nothing');
  });

  it('sends only the time when only the time changed', () => {
    const { body, changes, errors } = validateSchedule(base({ time: '20:15' }), recurring);
    expect(errors).toEqual({});
    expect(changes).toEqual({ time: true, duration: false, days: false });
    expect(body).toEqual({ localStartTime: '20:15', effectiveFrom: FROM, notify: true });
  });

  it('tidies a typed time before comparing', () => {
    const typed = validateSchedule(base({ time: '8:05' }), recurring);
    expect(typed.body?.localStartTime).toBe('08:05');
  });

  it('sends the notify choice', () => {
    const { body } = validateSchedule(base({ time: '20:15', notify: false }), recurring);
    expect(body?.notify).toBe(false);
  });

  it('sends the length and the days when they changed', () => {
    const days = recurring.daysOfWeek.includes(6) ? [0] : [...recurring.daysOfWeek, 6];
    const { body, changes } = validateSchedule(
      base({ durationMinutes: recurring.durationMinutes + 15, days }),
      recurring,
    );
    expect(changes).toEqual({ time: false, duration: true, days: true });
    expect(body).toMatchObject({
      durationMinutes: recurring.durationMinutes + 15,
      daysOfWeek: [...days].sort((a, b) => a - b),
    });
    expect(body).not.toHaveProperty('localStartTime');
  });

  it('ignores the order and repeats of the days', () => {
    const reordered = [...recurring.daysOfWeek].reverse();
    const result = validateSchedule(base({ days: [...reordered, ...reordered] }), recurring);
    expect(result.errors.nothing).toBe('admin.schedule.error.nothing');
  });

  it('reports a bad time, length, day list and date together', () => {
    const { errors, body } = validateSchedule(
      base({
        time: '25:00',
        durationMinutes: MIN_DURATION - 1,
        days: [],
        effectiveFrom: '2027-02-30',
      }),
      recurring,
    );
    expect(body).toBeUndefined();
    expect(errors).toMatchObject({
      time: 'admin.schedule.error.time',
      duration: 'admin.schedule.error.duration',
      days: 'admin.schedule.error.days',
      effectiveFrom: 'admin.schedule.error.effectiveFrom',
    });
  });

  it('bounds the length', () => {
    expect(
      validateSchedule(base({ durationMinutes: MAX_DURATION + 1 }), recurring).errors.duration,
    ).toBeDefined();
    expect(
      validateSchedule(base({ durationMinutes: 12.5 }), recurring).errors.duration,
    ).toBeDefined();
    expect(
      validateSchedule(base({ durationMinutes: MAX_DURATION }), recurring).errors.duration,
    ).toBeUndefined();
  });

  it('does not ask a one-off session for days', () => {
    expect(oneOff).toBeDefined();
    const form = initialScheduleForm(oneOff!, FROM);
    const { errors, body } = validateSchedule({ ...form, days: [], time: '20:15' }, oneOff!);
    expect(errors.days).toBeUndefined();
    expect(body).toMatchObject({ localStartTime: '20:15' });
    expect(body).not.toHaveProperty('daysOfWeek');
  });
});
