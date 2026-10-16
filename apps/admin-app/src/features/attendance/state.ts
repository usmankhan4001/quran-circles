import { AttendancePut, type ApiClient } from '@qc/contracts';

/** What the server holds for one occurrence (the contract exports the schema, not the type). */
export type Attendance = Awaited<ReturnType<ApiClient['adminAttendance']['get']>>;
import type { MessageKey } from '../../i18n/translate';

export interface DropIn {
  /** Local id for the list. Not sent. */
  id: string;
  name: string | null;
  count: number;
}

export interface AttendanceState {
  headcount: number;
  /** Registered people who came, by registration id, with how many came with them. */
  ticked: Record<string, number>;
  dropIns: DropIn[];
  dirty: boolean;
  nextId: number;
}

export type AttendanceAction =
  | { type: 'load'; attendance: Attendance }
  | { type: 'setHeadcount'; value: number }
  | { type: 'tick'; registrationId: string; count: number }
  | { type: 'untick'; registrationId: string }
  | { type: 'tickAll'; people: readonly { registrationId: string; count: number }[] }
  | { type: 'clearTicks' }
  | { type: 'addDropIn'; name: string | null; count: number }
  | { type: 'removeDropIn'; id: string }
  | { type: 'saved' };

export const MAX_HEADCOUNT = 5000;
export const MAX_ENTRY_COUNT = 50;

export const initialAttendanceState: AttendanceState = {
  headcount: 0,
  ticked: {},
  dropIns: [],
  dirty: false,
  nextId: 1,
};

export const entriesTotal = (s: AttendanceState): number =>
  Object.values(s.ticked).reduce((a, b) => a + b, 0) + s.dropIns.reduce((a, d) => a + d.count, 0);

const clampHeadcount = (v: number): number => Math.min(MAX_HEADCOUNT, Math.max(0, Math.trunc(v)));

/**
 * The tick list as pure state. The headcount is the number that matters at the end of a
 * session, so ticking a person or adding a name moves it by that person's count, and the
 * coordinator can still set it directly for people who did not register.
 */
export function attendanceReducer(s: AttendanceState, a: AttendanceAction): AttendanceState {
  switch (a.type) {
    case 'load': {
      const ticked: Record<string, number> = {};
      const dropIns: DropIn[] = [];
      let id = 1;
      for (const e of a.attendance.entries) {
        if (e.registrationId) ticked[e.registrationId] = e.count;
        else dropIns.push({ id: `d${id++}`, name: e.name, count: e.count });
      }
      const base: AttendanceState = { headcount: 0, ticked, dropIns, dirty: false, nextId: id };
      return { ...base, headcount: a.attendance.headcount ?? entriesTotal(base) };
    }
    case 'setHeadcount':
      return { ...s, headcount: clampHeadcount(a.value), dirty: true };
    case 'tick': {
      if (a.registrationId in s.ticked) return s;
      const count = Math.min(MAX_ENTRY_COUNT, Math.max(1, a.count));
      return {
        ...s,
        ticked: { ...s.ticked, [a.registrationId]: count },
        headcount: clampHeadcount(s.headcount + count),
        dirty: true,
      };
    }
    case 'untick': {
      const count = s.ticked[a.registrationId];
      if (count === undefined) return s;
      const rest = { ...s.ticked };
      delete rest[a.registrationId];
      return { ...s, ticked: rest, headcount: clampHeadcount(s.headcount - count), dirty: true };
    }
    case 'tickAll': {
      const ticked = { ...s.ticked };
      let added = 0;
      for (const p of a.people) {
        if (p.registrationId in ticked) continue;
        const count = Math.min(MAX_ENTRY_COUNT, Math.max(1, p.count));
        ticked[p.registrationId] = count;
        added += count;
      }
      return added === 0
        ? s
        : { ...s, ticked, headcount: clampHeadcount(s.headcount + added), dirty: true };
    }
    case 'clearTicks': {
      const removed = Object.values(s.ticked).reduce((x, y) => x + y, 0);
      return removed === 0 && Object.keys(s.ticked).length === 0
        ? s
        : { ...s, ticked: {}, headcount: clampHeadcount(s.headcount - removed), dirty: true };
    }
    case 'addDropIn': {
      const count = Math.min(MAX_ENTRY_COUNT, Math.max(1, a.count));
      const name = a.name?.trim() ? a.name.trim().slice(0, 80) : null;
      return {
        ...s,
        dropIns: [...s.dropIns, { id: `d${s.nextId}`, name, count }],
        nextId: s.nextId + 1,
        headcount: clampHeadcount(s.headcount + count),
        dirty: true,
      };
    }
    case 'removeDropIn': {
      const found = s.dropIns.find((d) => d.id === a.id);
      if (!found) return s;
      return {
        ...s,
        dropIns: s.dropIns.filter((d) => d.id !== a.id),
        headcount: clampHeadcount(s.headcount - found.count),
        dirty: true,
      };
    }
    case 'saved':
      return { ...s, dirty: false };
  }
}

export interface ValidatedAttendance {
  error?: MessageKey;
  body?: ReturnType<typeof AttendancePut.parse>;
}

export function validateAttendance(s: AttendanceState): ValidatedAttendance {
  if (s.headcount < entriesTotal(s)) return { error: 'admin.attendance.error.lessThanTicked' };
  const parsed = AttendancePut.safeParse({
    headcount: s.headcount,
    entries: [
      ...Object.entries(s.ticked).map(([registrationId, count]) => ({
        registrationId,
        name: null,
        count,
      })),
      ...s.dropIns.map((d) => ({ registrationId: null, name: d.name, count: d.count })),
    ],
  });
  if (!parsed.success) return { error: 'errors.validation_failed' };
  return { body: parsed.data };
}
