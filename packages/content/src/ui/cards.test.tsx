import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { messages } from '@qc/i18n';
import { scriptSizeFactor, semanticColors, textScale, typeRoles } from '@qc/ui';
import { hijriDate } from '../prayer/hijri';
import { DEFAULT_PLACE, PAKISTAN_CITIES } from '../prayer/places';
import { createTestServices, matrix, renderContent } from '../test/render';
import { ContinueReadingCard } from './ContinueReadingCard';
import { NextPrayerCard } from './NextPrayerCard';

// 2026-10-16 in Karachi (UTC+5), from the calculation in prayer/calc.ts:
// Asr 16:27, Maghrib 18:04, Isha 19:20, and the next Fajr 05:xx on the 17th.
const AT_17_00 = '2026-10-16T12:00:00.000Z';

/** Strips the invisible isolates that keep a time as one left-to-right run. */
const plain = (text: string | null) => (text ?? '').replace(/[⁦⁩]/g, '');
/** The wording from the translation files, so a reviewed Urdu change does not break the tests. */
const msg = (locale: 'en' | 'ur', key: string, params: Record<string, string | number> = {}) =>
  ((messages[locale] as Record<string, string>)[key] as string).replace(
    /\{(\w+)\}/g,
    (_, name: string) => String(params[name]),
  );

const tick = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

describe.each(matrix)('NextPrayerCard in $name', (combo) => {
  it('shows the next prayer, the time left, and the Hijri date', () => {
    const { services } = createTestServices({ now: AT_17_00 });
    renderContent(<NextPrayerCard place={DEFAULT_PLACE} />, services, { combo });

    const line = plain(screen.getByTestId('next-prayer-countdown').textContent);
    expect(line).toBe(
      msg(combo.locale, 'prayer.countdown', {
        prayer: msg(combo.locale, 'prayer.maghrib'),
        time: msg(combo.locale, 'prayer.countdown.hoursMinutes', { hours: 1, minutes: 4 }),
      }),
    );
    if (combo.locale === 'en') expect(line).toBe('Maghrib in 1 h 4 min');
    expect(plain(screen.getByTestId('next-prayer-time').textContent)).toContain(
      `6:04 ${msg(combo.locale, 'prayer.pm')}`,
    );
    // Western digits in both languages, and the Hijri date is there.
    expect(screen.getByTestId('next-prayer-hijri').textContent).toContain('1448');
  });

  it('follows the colour mode and the text size', () => {
    const { services } = createTestServices({ now: AT_17_00 });
    renderContent(<NextPrayerCard place={DEFAULT_PLACE} onPress={vi.fn()} />, services, { combo });
    const rgbOf = (hex: string) => {
      const n = parseInt(hex.slice(1), 16);
      return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
    };
    const card = screen.getByRole('button');
    expect(getComputedStyle(card).backgroundColor).toBe(rgbOf(semanticColors[combo.mode].surface));
    const line = screen.getByTestId('next-prayer-countdown');
    expect(getComputedStyle(line).color).toBe(rgbOf(semanticColors[combo.mode].text));
    // title3 at step 0, set larger for Urdu script, and scaled by the text size.
    const script = combo.locale === 'ur' ? scriptSizeFactor.urdu : scriptSizeFactor.latin;
    expect(parseFloat(line.style.fontSize)).toBe(
      Math.round(typeRoles.title3.size * script * textScale[combo.textSize]),
    );
  });

  it('is one pressable card with a spoken name, in the screen direction', () => {
    const { services } = createTestServices({ now: AT_17_00 });
    const onPress = vi.fn();
    renderContent(<NextPrayerCard place={DEFAULT_PLACE} onPress={onPress} />, services, { combo });
    const card = screen.getByRole('button');
    expect(card.getAttribute('aria-label')).toContain(msg(combo.locale, 'prayer.next'));
    fireEvent.click(card);
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(document.querySelector(`[dir="${combo.direction}"]`)).not.toBeNull();
  });
});

describe('NextPrayerCard behaviour', () => {
  // The countdown is driven by the test: a fake clock plus fake timers. Promises stay real.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('asks for a city when there is none', () => {
    const { services } = createTestServices({ now: AT_17_00 });
    renderContent(<NextPrayerCard place={null} />, services);
    expect(screen.getByText(msg('en', 'prayer.noCity.title'))).toBeTruthy();
    expect(screen.getByText(msg('en', 'prayer.noCity.body'))).toBeTruthy();
  });

  it('counts down every second and switches prayer when the time arrives', async () => {
    const t = createTestServices({ now: '2026-10-16T13:03:00.000Z' }); // 18:03, one minute to Maghrib
    renderContent(<NextPrayerCard place={DEFAULT_PLACE} />, t.services);
    const countdown = () => plain(screen.getByTestId('next-prayer-countdown').textContent);

    expect(countdown()).toBe('Maghrib in 1 min 0 s');
    t.clock.advance(1000);
    await tick(1000);
    expect(countdown()).toBe('Maghrib in 59 s');

    t.clock.advance(58_000);
    await tick(58_000);
    expect(countdown()).toBe('Maghrib in 1 s');

    t.clock.advance(1000);
    await tick(1000);
    // Maghrib has begun: the next prayer is Isha, 1 h 16 min away.
    expect(countdown()).toBe('Isha in 1 h 16 min');
  });

  it('rolls over from Isha to the next Fajr, and keeps Fajr across midnight', async () => {
    const t = createTestServices({ now: '2026-10-16T14:19:00.000Z' }); // 19:19, one minute to Isha
    renderContent(<NextPrayerCard place={DEFAULT_PLACE} />, t.services);
    const countdown = () => plain(screen.getByTestId('next-prayer-countdown').textContent);
    expect(countdown()).toBe('Isha in 1 min 0 s');

    t.clock.advance(60_000);
    await tick(60_000);
    expect(countdown()).toMatch(/^Fajr in 9 h \d+ min$/);

    // 23:59:00 on the 16th, then 00:01:00 on the 17th: still the same Fajr, a little closer.
    t.clock.set('2026-10-16T18:59:00.000Z');
    await tick(1000);
    const before = countdown();
    expect(before).toMatch(/^Fajr in 5 h \d+ min$/);
    t.clock.set('2026-10-16T19:01:00.000Z');
    await tick(1000);
    const after = countdown();
    expect(after).toMatch(/^Fajr in 5 h \d+ min$/);
    expect(after).not.toBe(before);
    expect(screen.getByTestId('next-prayer-time').textContent).toContain(msg('en', 'prayer.fajr'));
  });

  it.each([-2, -1, 0, 1, 2])('moves the Hijri date by the admin offset of %i day(s)', (offset) => {
    const { services } = createTestServices({ now: AT_17_00 });
    renderContent(<NextPrayerCard place={DEFAULT_PLACE} />, services, { hijriOffsetDays: offset });
    const expected = hijriDate({ year: 2026, month: 10, day: 16 }, offset);
    expect(expected).toEqual({ year: 1448, month: 5, day: 5 + offset });
    expect(screen.getByTestId('next-prayer-hijri').textContent).toBe(
      `${msg('en', 'prayer.hijri')}: ${5 + offset} Jumada al-awwal 1448 AH`,
    );
  });

  it('shows Karachi for the default place and works for every listed city', () => {
    for (const city of PAKISTAN_CITIES) {
      const { services } = createTestServices({ now: AT_17_00 });
      const view = renderContent(<NextPrayerCard place={city} />, services);
      expect(plain(screen.getByTestId('next-prayer-countdown').textContent)).toMatch(
        / in \d+ (h|min|s)/,
      );
      view.unmount();
    }
  });
});

describe('ContinueReadingCard', () => {
  it('invites a first read when nothing has been read', async () => {
    const { services } = createTestServices();
    const onOpen = vi.fn();
    renderContent(<ContinueReadingCard onOpen={onOpen} />, services);
    const start = await screen.findByRole('button', { name: msg('en', 'home.reading.start') });
    fireEvent.click(start);
    expect(onOpen).toHaveBeenCalledWith({ surah: 1, ayah: 1 });
  });

  it('shows the saved place and opens the reader there', async () => {
    const { services } = createTestServices();
    await services.readingPosition.save(2, 255);
    const onOpen = vi.fn();
    renderContent(<ContinueReadingCard onOpen={onOpen} />, services);
    const place = await screen.findByTestId('continue-reading-place');
    expect(place.textContent).toBe('Al-Baqarah, verse 255');
    fireEvent.click(screen.getByRole('button'));
    expect(onOpen).toHaveBeenCalledWith({ surah: 2, ayah: 255 });
  });

  it('updates when the position changes', async () => {
    const { services } = createTestServices();
    renderContent(<ContinueReadingCard onOpen={vi.fn()} />, services);
    await screen.findByRole('button', { name: msg('en', 'home.reading.start') });
    await act(async () => {
      await services.readingPosition.save(36, 1);
    });
    await waitFor(() => {
      expect(screen.getByTestId('continue-reading-place').textContent).toBe('Ya-Sin, verse 1');
    });
  });

  it('names the surah in Arabic script on an Urdu screen', async () => {
    const { services } = createTestServices();
    await services.readingPosition.save(36, 12);
    renderContent(<ContinueReadingCard onOpen={vi.fn()} />, services, { combo: { locale: 'ur' } });
    const place = await screen.findByTestId('continue-reading-place');
    expect(place.textContent).toContain('12');
    expect(place.textContent).toMatch(/[\u0600-\u06FF]/);
    expect(place.textContent).not.toContain('Ya-Sin');
  });

  it('on the Quran tab it stays hidden until something was read, then offers Continue', async () => {
    const { services } = createTestServices();
    const onOpen = vi.fn();
    const view = renderContent(<ContinueReadingCard variant="tab" onOpen={onOpen} />, services);
    await act(async () => {
      await Promise.resolve();
    });
    expect(view.container.textContent).toBe('');
    await act(async () => {
      await services.readingPosition.save(18, 10);
    });
    const button = await screen.findByRole('button', { name: msg('en', 'quran.continue') });
    fireEvent.click(button);
    expect(onOpen).toHaveBeenCalledWith({ surah: 18, ayah: 10 });
  });
});
