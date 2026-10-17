import { fireEvent, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Text } from 'react-native';
import { messages } from '@qc/i18n';
import { juzStart } from '@qc/content';
import {
  ERROR_CODES,
  buildDeepLink,
  builtInAyahFor,
  makeApiError,
  pakistanDate,
} from '@qc/contracts';
import { fixtures } from '@qc/contracts/fixtures';
import { formatNumber } from '@qc/ui';
import { CITY_RAWALPINDI, SESSIONS, followFor, registrationFor } from '../test/factories';
import {
  MATRIX,
  NOW,
  createWorld,
  directionOf,
  expectGreenHeader,
  renderScreen,
  waitFor,
} from '../test/harness';
import { ALL_NEXT_FLAGS, configWith, meWith, mine, type Handlers } from '../test/nextFeatures';
import { hrefToRoute, routeToHref } from '../nav/routes';
import { HomeScreen } from './HomeScreen';

const en = messages.en;
const ur = messages.ur;

function errorAnswer(code: keyof typeof ERROR_CODES, issues?: { path: string; code: string }[]) {
  return (_c: unknown, id: string) =>
    new Response(JSON.stringify(makeApiError(code, id, issues ? { issues } : {})), {
      status: ERROR_CODES[code],
      headers: { 'content-type': 'application/json' },
    });
}

/** Days read without today, so "I read today" shows. */
const notYetToday: Handlers = {
  'readingDays.list': () => ({
    items: [
      { date: '2027-02-11', sources: ['reader'], pages: 2, ayahs: 31 },
      { date: '2027-02-13', sources: ['goal'], pages: 1, ayahs: 0 },
    ],
  }),
};

async function home(
  handlers: Handlers = {},
  options: { signedIn?: boolean; locale?: 'en' | 'ur' } = {},
) {
  return renderScreen(<HomeScreen />, {
    signedIn: options.signedIn ?? true,
    cityId: CITY_RAWALPINDI.id,
    ...(options.locale ? { locale: options.locale } : {}),
    mock: { handlers: { ...mine(), ...handlers } },
  });
}

describe('Home: days read (reading_days)', () => {
  it('counts the days read this week and this month, with no streak', async () => {
    const view = await home();
    // The fixture day is a Monday: this week is today only; February has four days read.
    const week = await view.findByTestId('days-read-week');
    expect(week.textContent).toBe(
      en['daysRead.week'].replace('{read}', '1').replace('{total}', '7'),
    );
    expect(view.getByTestId('days-read-month').textContent).toBe(
      en['daysRead.month.other'].replace('{count}', '4'),
    );
    // Today already has the reader and the portion: no button, just a quiet note.
    expect(view.getByTestId('days-read-today-done')).toBeTruthy();
    expect(view.queryByTestId('days-read-mark')).toBeNull();
    expect(view.container.textContent?.toLowerCase()).not.toContain('streak');
    const call = view.world.http.callsTo('GET /v1/me/reading-days')[0]!;
    expect(call.search).toBe('?from=2027-02-01&to=2027-02-15');
  });

  it('records "I read today" and counts it at once', async () => {
    const view = await home(notYetToday);
    fireEvent.click(await view.findByTestId('days-read-mark'));
    expect(await view.findByTestId('days-read-today-done')).toBeTruthy();
    expect(view.world.http.callsTo('POST /v1/me/reading-days')[0]!.body).toEqual({
      source: 'manual',
    });
    expect(view.getByTestId('days-read-week').textContent).toBe(
      en['daysRead.week'].replace('{read}', '1').replace('{total}', '7'),
    );
    expect(view.getAllByText(en['daysRead.countedToday']).length).toBeGreaterThan(0);
  });

  it('says so in plain words when the server refuses the date (out_of_range)', async () => {
    const view = await home({
      ...notYetToday,
      'readingDays.record': errorAnswer('validation_failed', [
        { path: 'date', code: 'out_of_range' },
      ]),
    });
    fireEvent.click(await view.findByTestId('days-read-mark'));
    expect(await view.findByText(en['daysRead.error.outOfRange'])).toBeTruthy();
    expect(view.getByTestId('days-read-mark')).toBeTruthy();
  });

  it('shows the error when recording fails, and keeps the button', async () => {
    const view = await home({
      ...notYetToday,
      'readingDays.record': errorAnswer('internal_error'),
    });
    fireEvent.click(await view.findByTestId('days-read-mark'));
    expect((await view.findByTestId('days-read-error')).textContent).toBe(
      en['errors.internal_error'],
    );
    expect(view.getByTestId('days-read-mark')).toBeTruthy();
  });

  it('offers Try again when the days cannot be loaded', async () => {
    const view = await home({ 'readingDays.list': errorAnswer('service_unavailable') });
    const card = await view.findByTestId('home-days-read');
    expect(await within(card).findByText(en['ui.retry'])).toBeTruthy();
  });

  it('with a daily goal, records "I met today\'s goal" with the pages', async () => {
    const view = await home({
      ...notYetToday,
      ...meWith({ dailyGoal: { unit: 'pages', amount: 2 } }),
    });
    expect((await view.findByTestId('days-read-goal')).textContent).toBe(
      en['daysRead.goal'].replace('{goal}', '2 pages'),
    );
    fireEvent.click(view.getByTestId('days-read-goal-met'));
    expect(await view.findByTestId('days-read-goal-done')).toBeTruthy();
    expect(view.world.http.callsTo('POST /v1/me/reading-days')[0]!.body).toEqual({
      source: 'goal',
      pages: 2,
    });
  });

  it('sends a minutes goal without pages', async () => {
    const view = await home({
      ...notYetToday,
      ...meWith({ dailyGoal: { unit: 'minutes', amount: 10 } }),
    });
    fireEvent.click(await view.findByTestId('days-read-goal-met'));
    await waitFor(() =>
      expect(view.world.http.callsTo('POST /v1/me/reading-days')[0]?.body).toEqual({
        source: 'goal',
      }),
    );
  });

  it('without a goal, offers to set one in Profile', async () => {
    const view = await home();
    fireEvent.click(await view.findByTestId('days-read-set-goal'));
    expect(view.world.nav.last()).toEqual({ type: 'go', route: { name: 'profile' } });
  });

  it('asks a visitor to sign in, and asks the server nothing personal', async () => {
    const view = await home({}, { signedIn: false });
    fireEvent.click(await view.findByTestId('days-read-sign-in'));
    expect(view.world.nav.last()).toEqual({
      type: 'go',
      route: { name: 'signIn', returnTo: { name: 'home' } },
    });
    expect(view.world.http.callsTo('GET /v1/me/reading-days')).toHaveLength(0);
  });

  it('is not shown with reading_days off', async () => {
    const view = await home(configWith(ALL_NEXT_FLAGS.filter((f) => f !== 'reading_days')));
    await view.findByTestId('home-community');
    expect(view.queryByTestId('home-days-read')).toBeNull();
    expect(view.world.http.callsTo('GET /v1/me/reading-days')).toHaveLength(0);
  });
});

describe('Home: read together today (community_today)', () => {
  it('shows the one national number', async () => {
    const view = await home({}, { signedIn: false });
    const readers = await view.findByTestId('community-readers');
    expect(readers.textContent).toBe(
      en['communityToday.readers.other'].replace('{count}', formatNumber(1240, 'en')),
    );
    expect(view.getByTestId('community-pages').textContent).toBe(
      en['communityToday.pages.other'].replace('{count}', formatNumber(3815, 'en')),
    );
  });

  it('uses the singular for one person', async () => {
    const view = await home({
      'community.today': () => ({ date: '2027-02-15', readersToday: 1, pagesTogether: 1 }),
    });
    expect((await view.findByTestId('community-readers')).textContent).toBe(
      en['communityToday.readers.one'],
    );
  });

  it('stays away when the number cannot be had', async () => {
    const view = await home({ 'community.today': errorAnswer('internal_error') });
    await view.findByTestId('home-days-read');
    await waitFor(() => expect(view.world.http.callsTo('GET /v1/community/today')).toHaveLength(1));
    expect(view.queryByTestId('home-community')).toBeNull();
  });

  it('is not shown, nor asked for, with community_today off', async () => {
    const view = await home(configWith(['reading_days']));
    await view.findByTestId('home-days-read');
    expect(view.queryByTestId('home-community')).toBeNull();
    expect(view.world.http.callsTo('GET /v1/community/today')).toHaveLength(0);
  });

  it('hides the whole reading block when both flags are off', async () => {
    const view = await home(configWith([]));
    await view.findByTestId('home-ayah-read');
    expect(view.queryByTestId('home-reading')).toBeNull();
  });
});

/** A registration whose session is today at 20:00 in Pakistan, reading the given portion. */
function registrationToday(
  portion: NonNullable<typeof SESSIONS.taraweeh.nextOccurrence>['portion'],
) {
  const session = SESSIONS.taraweeh;
  return registrationFor({
    ...session,
    nextOccurrence: {
      ...session.nextOccurrence!,
      startsAt: '2027-02-15T15:00:00Z',
      endsAt: '2027-02-15T16:30:00Z',
      status: 'scheduled',
      portion,
    },
  });
}

describe("Home: read tonight's portion (read_along)", () => {
  it('opens the reader at the first ayah of the portion', async () => {
    const view = await home(
      mine({ registrations: [registrationToday({ kind: 'para', para: 5 })] }),
    );
    const card = await view.findByTestId('home-read-along');
    expect(within(card).getByText(en['readAlong.title'])).toBeTruthy();
    expect(within(card).getByTestId('read-along-portion').textContent).toBe(
      en['session.portion.para'].replace('{number}', '5'),
    );
    fireEvent.click(within(card).getByTestId('read-along-open'));
    const start = juzStart(5);
    expect(view.world.nav.last()).toEqual({
      type: 'tab',
      route: { name: 'quran', reader: { surah: start.surah, ayah: start.ayah, at: NOW.getTime() } },
    });
  });

  it("asks a followed masjid for today's sessions", async () => {
    const venue = fixtures.venues[0]!;
    const view = await home(mine({ follows: [followFor(venue)] }));
    await waitFor(() =>
      expect(
        view.world.http
          .callsTo('GET /v1/occurrences')
          .some((c) => c.search.includes(`venueId=${venue.id}`)),
      ).toBe(true),
    );
    const call = view.world.http
      .callsTo('GET /v1/occurrences')
      .find((c) => c.search.includes(`venueId=${venue.id}`))!;
    const search = new URLSearchParams(call.search);
    // The whole Pakistan day: 00:00 to 23:59:59 at UTC+5.
    expect(search.get('from')).toBe('2027-02-14T19:00:00Z');
    expect(search.get('to')).toBe('2027-02-15T18:59:59Z');
  });

  it('is not shown for a lesson, which has no place in the Quran', async () => {
    const lesson = await home(
      mine({ registrations: [registrationToday({ kind: 'lesson', title: 'Seerah' })] }),
    );
    await lesson.findByTestId('home-days-read');
    expect(lesson.queryByTestId('home-read-along')).toBeNull();
  });

  it('is not shown on another day', async () => {
    const reg = registrationToday({ kind: 'surah', surah: 36 });
    const tomorrow = registrationFor({
      ...reg.session,
      nextOccurrence: {
        ...reg.session.nextOccurrence!,
        startsAt: '2027-02-16T15:00:00Z',
        endsAt: '2027-02-16T16:00:00Z',
      },
    });
    const later = await home(mine({ registrations: [tomorrow] }));
    await later.findByTestId('home-days-read');
    expect(later.queryByTestId('home-read-along')).toBeNull();
  });

  it('is not shown with read_along off', async () => {
    const reg = registrationToday({ kind: 'surah', surah: 36 });
    const off = await home({
      ...mine({ registrations: [reg] }),
      ...configWith(ALL_NEXT_FLAGS.filter((f) => f !== 'read_along')),
    });
    await off.findByTestId('home-days-read');
    expect(off.queryByTestId('home-read-along')).toBeNull();
  });
});

describe('Home: ayah of the day (ayah_of_the_day)', () => {
  it("shows the server's pick with the words and credit from the content mount", async () => {
    const asked: { surah: number; ayah: number }[] = [];
    const view = await renderScreen(<HomeScreen />, {
      cityId: CITY_RAWALPINDI.id,
      content: {
        AyahText: (place) => {
          asked.push(place);
          return <Text testID="ayah-words">words</Text>;
        },
      },
    });
    const card = await view.findByTestId('home-ayah');
    await within(card).findByTestId('ayah-words');
    expect(asked.at(-1)).toEqual({ surah: 2, ayah: 255 });
    expect(within(card).getByTestId('home-ayah-reference').textContent).toBe(
      en['home.ayah.reference'].replace('{surah}', '2').replace('{ayah}', '255'),
    );
    // The national pick is the default: no "chosen by" line.
    expect(within(card).queryByTestId('home-ayah-from')).toBeNull();
  });

  it('says which followed masjid chose it', async () => {
    const venue = fixtures.venues[0]!;
    const view = await home(mine({ follows: [followFor(venue)] }));
    const from = await view.findByTestId('home-ayah-from');
    expect(from.textContent).toBe(en['home.ayah.from'].replace('{name}', venue.name.en));
    expect(view.getByTestId('home-ayah-reference').textContent).toBe(
      en['home.ayah.reference'].replace('{surah}', '13').replace('{ayah}', '28'),
    );
  });

  it('opens the quran route at the ayah, the same path the contract deep link uses', async () => {
    const view = await home();
    fireEvent.click(await view.findByTestId('home-ayah-read'));
    const route = view.world.nav.last()?.route;
    expect(route).toEqual({ name: 'quran', reader: { surah: 2, ayah: 255, at: NOW.getTime() } });
    expect(routeToHref(route!)).toBe(`/quran?surah=2&ayah=255&at=${NOW.getTime()}`);
    expect(
      hrefToRoute(buildDeepLink({ type: 'quran', surah: 2, ayah: 255 }, 'https://example.org')),
    ).toEqual({
      name: 'quran',
      reader: { surah: 2, ayah: 255 },
    });
  });

  it("falls back to today's built-in ayah when the call fails", async () => {
    const view = await home({ 'ayahOfTheDay.get': errorAnswer('service_unavailable') });
    const place = builtInAyahFor(pakistanDate(NOW));
    expect((await view.findByTestId('home-ayah-reference')).textContent).toBe(
      en['home.ayah.reference']
        .replace('{surah}', String(place.surah))
        .replace('{ayah}', String(place.ayah)),
    );
  });
});

describe.each(MATRIX)('Home with the rc.4 cards in $name', ({ locale, color, textSize }) => {
  it('draws days read, the community total, the portion and the ayah', async () => {
    const world = await createWorld({
      signedIn: true,
      cityId: CITY_RAWALPINDI.id,
      locale,
      color,
      textSize,
      mock: {
        handlers: {
          ...mine({ registrations: [registrationToday({ kind: 'surah', surah: 36 })] }),
          ...notYetToday,
          ...meWith({ dailyGoal: { unit: 'rukus', amount: 1 } }),
        },
      },
    });
    const view = await renderScreen(<HomeScreen />, { world });
    const words = locale === 'ur' ? ur : en;
    await view.findByTestId('days-read-mark');
    await view.findByTestId('community-readers');
    await view.findByTestId('home-read-along');
    await view.findByTestId('home-ayah-read');
    expect(directionOf(view.container)).toBe(locale === 'ur' ? 'rtl' : 'ltr');
    expectGreenHeader(view.container, color);
    expect(view.getByText(words['daysRead.title'])).toBeTruthy();
    expect(view.getByText(words['daysRead.markToday'])).toBeTruthy();
    expect(view.getByText(words['communityToday.title'])).toBeTruthy();
    expect(view.getByText(words['readAlong.title'])).toBeTruthy();
    expect(view.getByTestId('days-read-goal').textContent).toBe(
      words['daysRead.goal'].replace('{goal}', words['daysRead.unit.rukus.one']),
    );
  });
});
