import { describe, expect, it } from 'vitest';
import type { AdminSession } from '@qc/contracts';
import { sessions } from '@qc/contracts/fixtures';
import { formatClock, formatLocalDateTime, formatWeekdays } from '../lib/datetime';
import { renderConsole, screen, text } from '../test/harness';

/** Dates and times on the pages go through lib/datetime, so Urdu figures never touch words. */

const FSI = '\u2068';
const PDI = '\u2069';

const page = <T,>(items: T[]) => ({ items, nextCursor: null });

const [first, second, third] = sessions as [AdminSession, AdminSession, AdminSession];
const listed: AdminSession[] = [
  {
    ...first,
    circleStatus: null,
    kind: 'one_off',
    daysOfWeek: [],
    startsOn: '2027-02-15',
    localStartTime: '19:00',
  },
  { ...second, circleStatus: null, kind: 'recurring', daysOfWeek: [1, 3], localStartTime: '21:30' },
  {
    ...third,
    circleStatus: null,
    kind: 'recurring',
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    localStartTime: '05:15',
  },
];

function digitsAreIsolated(value: string): boolean {
  let depth = 0;
  for (const ch of value) {
    if (ch === FSI) depth += 1;
    else if (ch === PDI) depth -= 1;
    else if (/[0-9]/.test(ch) && depth === 0) return false;
  }
  return depth === 0;
}

describe('session times on the sessions page', () => {
  it('reads in Urdu: no forced left-to-right box, no Latin PM, every figure isolated', async () => {
    renderConsole({
      role: 'national',
      locale: 'ur',
      path: '/sessions',
      handlers: { 'adminSessions.list': () => page(listed) },
    });
    await screen.findByRole('table', { name: text('console.sessions.title', 'ur') });
    const metas = Array.from(document.querySelectorAll<HTMLElement>('.cell-meta'));
    expect(metas).toHaveLength(3);
    for (const meta of metas) {
      expect(meta.getAttribute('dir')).toBeNull();
      expect(meta.textContent ?? '').not.toMatch(/[A-Za-z]/);
      expect(digitsAreIsolated(meta.textContent ?? '')).toBe(true);
    }
    const shown = metas.map((m) => m.textContent);
    expect(shown).toContain(formatLocalDateTime('2027-02-15', '19:00', 'ur'));
    expect(shown).toContain(`${formatWeekdays([1, 3], 'ur')} · ${formatClock('21:30', 'ur')}`);
    expect(shown).toContain(
      `${text('console.sessions.daily', 'ur')} · ${formatClock('05:15', 'ur')}`,
    );
  });

  it('reads in English with the same helper and no isolation marks', async () => {
    renderConsole({
      role: 'national',
      path: '/sessions',
      handlers: { 'adminSessions.list': () => page(listed) },
    });
    await screen.findByRole('table', { name: text('console.sessions.title') });
    const shown = Array.from(document.querySelectorAll('.cell-meta')).map((m) => m.textContent);
    expect(shown).toContain('15 Feb 2027, 7:00 pm');
    expect(shown).toContain('Mon, Wed · 9:30 pm');
    for (const s of shown) expect(s ?? '').not.toMatch(/[\u2066-\u2069]/);
  });
});
