import { ScheduleChangeBody, type Session } from '@qc/contracts';
import type { MessageKey } from '../../i18n/translate';
import { isLocalDate, isLocalTime } from '../../lib/time';

export interface ScheduleForm {
  /** `HH:MM`, 24-hour, Pakistan time. */
  time: string;
  durationMinutes: number;
  /** 0 is Sunday. Only used for a recurring session. */
  days: number[];
  /** First date the change applies to. */
  effectiveFrom: string;
  notify: boolean;
}

export type ScheduleErrors = Partial<
  Record<'time' | 'duration' | 'days' | 'effectiveFrom' | 'nothing', MessageKey>
>;

export const MIN_DURATION = 5;
export const MAX_DURATION = 600;

export function initialScheduleForm(session: Session, effectiveFrom: string): ScheduleForm {
  return {
    time: session.localStartTime,
    durationMinutes: session.durationMinutes,
    days: [...session.daysOfWeek].sort((a, b) => a - b),
    effectiveFrom,
    notify: true,
  };
}

/** Accepts `7:30`, `19:30` and `1930` and returns `HH:MM`, else the input unchanged. */
export function tidyTime(input: string): string {
  const v = input.trim();
  const colon = /^(\d{1,2}):(\d{2})$/.exec(v);
  if (colon) return `${colon[1]!.padStart(2, '0')}:${colon[2]}`;
  const compact = /^(\d{2})(\d{2})$/.exec(v);
  return compact ? `${compact[1]}:${compact[2]}` : v;
}

export interface ValidatedSchedule {
  errors: ScheduleErrors;
  body?: ReturnType<typeof ScheduleChangeBody.parse>;
  /** What changed, for the confirmation. */
  changes: { time: boolean; duration: boolean; days: boolean };
}

/**
 * Checks the form and builds a request that carries only what changed, so an untouched field
 * is never rewritten.
 */
export function validateSchedule(form: ScheduleForm, session: Session): ValidatedSchedule {
  const errors: ScheduleErrors = {};
  const time = tidyTime(form.time);
  if (!isLocalTime(time)) errors.time = 'admin.schedule.error.time';
  if (
    !Number.isInteger(form.durationMinutes) ||
    form.durationMinutes < MIN_DURATION ||
    form.durationMinutes > MAX_DURATION
  ) {
    errors.duration = 'admin.schedule.error.duration';
  }
  const recurring = session.kind === 'recurring';
  const days = [...new Set(form.days)].sort((a, b) => a - b);
  if (recurring && days.length === 0) errors.days = 'admin.schedule.error.days';
  if (!isLocalDate(form.effectiveFrom)) errors.effectiveFrom = 'admin.schedule.error.effectiveFrom';

  const before = [...session.daysOfWeek].sort((a, b) => a - b);
  const changes = {
    time: time !== session.localStartTime,
    duration: form.durationMinutes !== session.durationMinutes,
    days: recurring && JSON.stringify(days) !== JSON.stringify(before),
  };
  if (Object.keys(errors).length === 0 && !changes.time && !changes.duration && !changes.days) {
    errors.nothing = 'admin.schedule.error.nothing';
  }
  if (Object.keys(errors).length > 0) return { errors, changes };

  const parsed = ScheduleChangeBody.safeParse({
    ...(changes.time ? { localStartTime: time } : {}),
    ...(changes.duration ? { durationMinutes: form.durationMinutes } : {}),
    ...(changes.days ? { daysOfWeek: days } : {}),
    effectiveFrom: form.effectiveFrom,
    notify: form.notify,
  });
  if (!parsed.success) return { errors: { nothing: 'errors.validation_failed' }, changes };
  return { errors, body: parsed.data, changes };
}
