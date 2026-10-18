import { act, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { messages } from '@qc/i18n';
import { useState } from 'react';
import { computeDay } from '../prayer/calc';
import { PAKISTAN_CITIES } from '../prayer/places';
import type { CalendarView } from '../state/viewState';
import { createTestServices, matrix, renderContent } from '../test/render';
import { PrayerTimesScreen } from './PrayerTimesScreen';

const AT_17_00 = '2026-10-16T12:00:00.000Z'; // 17:00 in Karachi, between Asr and Maghrib
const AFTER_ISHA = '2026-10-16T16:00:00.000Z'; // 21:00 in Karachi

const msg = (locale: 'en' | 'ur', key: string, params: Record<string, string | number> = {}) =>
  ((messages[locale] as Record<string, string>)[key] as string).replace(
    /\{(\w+)\}/g,
    (_, name: string) => String(params[name]),
  );
const plain = (text: string | null) => (text ?? '').replace(/[\u2066\u2069]/g, '');

function Harness({
  initialPlace = 'karachi',
  initialView = 'week',
  onPlace,
}: {
  initialPlace?: string | null;
  initialView?: CalendarView;
  onPlace?: (id: string) => void;
}) {
  const [placeId, setPlaceId] = useState<string | null>(initialPlace);
  const [view, setView] = useState<CalendarView>(initialView);
  return (
    <PrayerTimesScreen
      placeId={placeId}
      onPlaceChange={(id) => {
        setPlaceId(id);
        onPlace?.(id);
      }}
      calendarView={view}
      onCalendarViewChange={setView}
    />
  );
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] });
});
afterEach(() => {
  vi.useRealTimers();
});

describe.each(matrix)('PrayerTimesScreen in $name', (combo) => {
  it("shows the next prayer, today's six times and the Hijri date", () => {
    const { services } = createTestServices({ now: AT_17_00 });
    renderContent(<Harness />, services, { combo });
    const L = combo.locale;

    expect(plain(screen.getByTestId('next-prayer-countdown').textContent)).toBe(
      msg(L, 'prayer.countdown', {
        prayer: msg(L, 'prayer.maghrib'),
        time: msg(L, 'prayer.countdown.hoursMinutes', { hours: 1, minutes: 4 }),
      }),
    );
    const times: Record<string, string> = {
      fajr: '5:14 AM',
      sunrise: '6:30 AM',
      dhuhr: '12:18 PM',
      asr: '4:27 PM',
      maghrib: '6:04 PM',
      isha: '7:20 PM',
    };
    for (const [prayer, expected] of Object.entries(times)) {
      const row = screen.getByTestId(`time-${prayer}`);
      const [hm, period] = expected.split(' ') as [string, 'AM' | 'PM'];
      expect(row.textContent).toContain(hm);
      expect(row.textContent).toContain(msg(L, period === 'AM' ? 'prayer.am' : 'prayer.pm'));
      expect(row.textContent).toContain(msg(L, `prayer.${prayer}`));
    }
    expect(screen.getByTestId('hijri-today').textContent).toContain('1448');
    // D17: the date line reads "Today, <Hijri date> · <city>", as on the artboard.
    expect(screen.getByTestId('prayer-city').textContent).toBe(msg(L, 'prayer.cityName.karachi'));
    expect(screen.getByTestId('next-prayer-time').textContent).toContain(msg(L, 'prayer.maghrib'));
    expect(screen.getByTestId('hijri-note').textContent).toBe(msg(L, 'prayer.hijriNote'));
  });

  it('marks the next prayer with the word, not just a colour', () => {
    const { services } = createTestServices({ now: AT_17_00 });
    renderContent(<Harness />, services, { combo });
    const next = msg(combo.locale, 'prayer.badge.next');
    expect(screen.getByTestId('time-maghrib').textContent).toContain(next);
    for (const other of ['fajr', 'sunrise', 'dhuhr', 'asr', 'isha']) {
      expect(screen.getByTestId(`time-${other}`).textContent).not.toContain(next);
    }
  });
});

describe('PrayerTimesScreen', () => {
  it('moves on to tomorrow after Isha and marks no row as next', () => {
    const { services } = createTestServices({ now: AFTER_ISHA });
    renderContent(<Harness />, services);
    expect(plain(screen.getByTestId('next-prayer-countdown').textContent)).toMatch(
      /^Fajr in 8 h \d+ min$/,
    );
    expect(screen.getByTestId('next-prayer-card').textContent).toContain(
      msg('en', 'prayer.next.tomorrow'),
    );
    for (const prayer of ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha']) {
      expect(screen.getByTestId(`time-${prayer}`).textContent).not.toContain(
        msg('en', 'prayer.badge.next'),
      );
    }
  });

  it('keeps counting down while the screen is open', async () => {
    const t = createTestServices({ now: '2026-10-16T13:00:00.000Z' });
    renderContent(<Harness />, t.services);
    expect(plain(screen.getByTestId('next-prayer-countdown').textContent)).toBe(
      'Maghrib in 4 min 0 s',
    );
    t.clock.advance(60_000);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(plain(screen.getByTestId('next-prayer-countdown').textContent)).toBe(
      'Maghrib in 3 min 0 s',
    );
  });

  it('asks for a city first, and shows the times once one is chosen', () => {
    const { services } = createTestServices({ now: AT_17_00 });
    const onPlace = vi.fn();
    renderContent(<Harness initialPlace={null} onPlace={onPlace} />, services);
    expect(screen.getByText(msg('en', 'prayer.noCity.title'))).toBeTruthy();
    expect(screen.getByText(msg('en', 'prayer.noCity.body'))).toBeTruthy();
    expect(screen.queryByTestId('today-times')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: msg('en', 'prayer.noCity.action') }));
    fireEvent.click(within(screen.getByTestId('city-sheet')).getByTestId('city-lahore'));
    expect(onPlace).toHaveBeenCalledWith('lahore');
    expect(screen.getByTestId('prayer-city').textContent).toBe('Lahore');
  });

  it('shows a skeleton until the saved city has been read', () => {
    const { services } = createTestServices({ now: AT_17_00 });
    renderContent(
      <PrayerTimesScreen
        placeId={null}
        ready={false}
        onPlaceChange={vi.fn()}
        calendarView="week"
        onCalendarViewChange={vi.fn()}
        testID="prayer"
      />,
      services,
    );
    expect(screen.queryByText(msg('en', 'prayer.noCity.title'))).toBeNull();
    expect(screen.getByTestId('prayer-loading')).toBeTruthy();
  });

  it('changes city with the selector and recalculates', () => {
    const { services } = createTestServices({ now: AT_17_00 });
    renderContent(<Harness />, services);
    const before = screen.getByTestId('time-fajr').textContent;
    fireEvent.click(screen.getByTestId('city-select'));
    fireEvent.click(screen.getByTestId('city-select-option-quetta'));
    expect(screen.getByTestId('prayer-city').textContent).toBe('Quetta');
    expect(screen.getByTestId('time-fajr').textContent).not.toBe(before);
  });

  it.each([-2, 2])('applies the Hijri offset of %i day(s) to the date shown', (offset) => {
    const { services } = createTestServices({ now: AT_17_00 });
    renderContent(<Harness />, services, { hijriOffsetDays: offset });
    expect(screen.getByTestId('hijri-today').textContent).toBe(
      `${5 + offset} Jumada al-awwal 1448 AH`,
    );
    // The calendar rows use the same offset.
    expect(screen.getByTestId('day-2026-10-16').textContent).toContain(
      `${5 + offset} Jumada al-awwal 1448 AH`,
    );
  });

  it('works for every listed city, with no network', () => {
    for (const city of PAKISTAN_CITIES) {
      const { services } = createTestServices({ now: AT_17_00 });
      const view = renderContent(<Harness initialPlace={city.id} />, services);
      expect(screen.getByTestId('time-fajr').textContent).toMatch(/\d:\d\d/);
      view.unmount();
    }
  });

  describe('calendar', () => {
    it('shows the seven days of this week, today marked in words', () => {
      const { services } = createTestServices({ now: AT_17_00 });
      renderContent(<Harness />, services);
      // 2026-10-16 is a Friday. Weeks start on Sunday: 11 to 17 October.
      const days = [11, 12, 13, 14, 15, 16, 17].map((d) => screen.getByTestId(`day-2026-10-${d}`));
      expect(days).toHaveLength(7);
      expect(screen.queryByTestId('day-2026-10-18')).toBeNull();
      expect(screen.getByTestId('day-2026-10-16').textContent).toContain(
        msg('en', 'prayer.calendar.today'),
      );
      expect(screen.getByTestId('day-2026-10-15').textContent).not.toContain(
        msg('en', 'prayer.calendar.today'),
      );
      expect(screen.getByTestId('calendar-title').textContent).toBe(
        msg('en', 'prayer.calendar.weekTitle', { from: '11 October', to: '17 October' }),
      );
    });

    it("shows each day's times as calculated for that day", () => {
      const { services } = createTestServices({ now: AT_17_00 });
      renderContent(<Harness />, services);
      const place = PAKISTAN_CITIES[0]!;
      const day = computeDay(place, { year: 2026, month: 10, day: 12 });
      const asr = new Date(day.times.asr.getTime() + 5 * 3_600_000);
      const hour = asr.getUTCHours() % 12 || 12;
      const minute = String(asr.getUTCMinutes()).padStart(2, '0');
      expect(screen.getByTestId('day-2026-10-12-asr').textContent).toContain(`${hour}:${minute}`);
    });

    it('moves a week at a time, and back to today', () => {
      const { services } = createTestServices({ now: AT_17_00 });
      renderContent(<Harness />, services);
      fireEvent.click(screen.getByTestId('calendar-next'));
      expect(screen.getByTestId('day-2026-10-18')).toBeTruthy();
      expect(screen.getByTestId('day-2026-10-24')).toBeTruthy();
      expect(screen.queryByTestId('day-2026-10-16')).toBeNull();
      fireEvent.click(screen.getByTestId('calendar-previous'));
      fireEvent.click(screen.getByTestId('calendar-previous'));
      expect(screen.getByTestId('day-2026-10-04')).toBeTruthy();
      fireEvent.click(screen.getByTestId('calendar-today'));
      expect(screen.getByTestId('day-2026-10-16')).toBeTruthy();
    });

    it('crosses a month boundary in the week view', () => {
      const { services } = createTestServices({ now: '2026-10-29T12:00:00.000Z' });
      renderContent(<Harness />, services);
      // 25 to 31 October, then 1 to 7 November.
      fireEvent.click(screen.getByTestId('calendar-next'));
      expect(screen.getByTestId('day-2026-11-01')).toBeTruthy();
      expect(screen.getByTestId('calendar-title').textContent).toBe(
        msg('en', 'prayer.calendar.weekTitle', { from: '1 November', to: '7 November' }),
      );
    });

    it('shows a whole month and steps through months, including the year end', () => {
      const { services } = createTestServices({ now: AT_17_00 });
      renderContent(<Harness initialView="month" />, services);
      expect(screen.getByTestId('calendar-title').textContent).toBe('October 2026');
      expect(screen.getByTestId('day-2026-10-01')).toBeTruthy();
      expect(screen.getByTestId('day-2026-10-31')).toBeTruthy();
      fireEvent.click(screen.getByTestId('calendar-previous'));
      expect(screen.getByTestId('calendar-title').textContent).toBe('September 2026');
      expect(screen.getByTestId('day-2026-09-30')).toBeTruthy();
      expect(screen.queryByTestId('day-2026-09-31')).toBeNull();
      for (let i = 0; i < 4; i++) fireEvent.click(screen.getByTestId('calendar-next'));
      expect(screen.getByTestId('calendar-title').textContent).toBe('January 2027');
    });

    it('switches between week and month', () => {
      const { services } = createTestServices({ now: AT_17_00 });
      renderContent(<Harness />, services);
      fireEvent.click(screen.getByRole('radio', { name: msg('en', 'prayer.view.month') }));
      expect(screen.getByTestId('day-2026-10-01')).toBeTruthy();
      fireEvent.click(screen.getByRole('radio', { name: msg('en', 'prayer.view.week') }));
      expect(screen.queryByTestId('day-2026-10-01')).toBeNull();
    });

    it('gives each day one spoken label with the date, the Hijri date and the times', () => {
      const { services } = createTestServices({ now: AT_17_00 });
      renderContent(<Harness />, services);
      const label = screen.getByTestId('day-2026-10-16').getAttribute('aria-label') ?? '';
      expect(label).toContain('Friday, 16 October 2026');
      expect(label).toContain('Hijri 5 Jumada al-awwal 1448 AH');
      expect(label).toContain('Maghrib 6:04 PM');
    });
  });
});
