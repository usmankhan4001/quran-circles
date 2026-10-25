import { within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { builtInAyahFor, ERROR_CODES, makeApiError } from '@qc/contracts';
import * as fx from '@qc/contracts/fixtures';
import type { Locale } from '../i18n';
import { surahLabel } from '../lib/surahs';
import { venueA } from '../test/people';
import {
  renderConsole,
  screen,
  shellReady,
  text,
  waitFor,
  writes,
  type HarnessOptions,
  type TestRole,
} from '../test/harness';

/**
 * The ayah of the day list (contract 1.0.0-rc.4) against the contract mock, whose config has the
 * `ayah_of_the_day` flag on and whose fixtures hold five picks around 2027-02-15. "Today" is the
 * fixture's today, so the default range covers them.
 */
const PATH = '/ayah-of-the-day';
const [nationalPick, , venuePick, circlePick, lahorePick] = fx.dailyAyahs;
const LAHORE_VENUE = fx.venues.find((v) => v.id === lahorePick!.venueId)!;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(fx.FIXTURE_NOW));
});
afterEach(() => {
  vi.useRealTimers();
});

const isList = (c: { method: string; path: string }) =>
  c.method === 'GET' && c.path === '/v1/admin/daily-ayahs';

const ref = (surah: number, ayah: number, locale: Locale = 'en') =>
  text('console.dailyAyahs.ref', locale)
    .replace('{surah}', surahLabel(surah, locale))
    .replace('{ayah}', String(ayah));

/** Opens the page and waits until the list has answered and the form has its places. */
async function openPage(options: HarnessOptions = {}) {
  const view = renderConsole({ path: PATH, ...options });
  await shellReady(options.locale);
  await screen.findByRole('heading', {
    level: 1,
    name: text('console.dailyAyahs.title', options.locale),
  });
  await screen.findByRole('form', { name: text('console.dailyAyahs.form.title', options.locale) });
  await waitFor(() => expect(document.querySelector('main .loading')).toBeNull());
  return view;
}

/** The table row that shows a reference, such as "Surah Ar-Ra'd (13), ayah 28". */
const rowWith = (table: HTMLElement, reference: string) => {
  const row = within(table)
    .getAllByRole('row')
    .find((r) => r.textContent?.includes(reference));
  if (!row) throw new Error(`no row for ${reference}`);
  return row;
};

const flagOff = (): NonNullable<HarnessOptions['handlers']> => ({
  'config.get': () => ({
    seasonMode: 'dora',
    hijriOffsetDays: 0,
    featureFlags: {
      circle_requests: true,
      session_companion: true,
      invite_friends: true,
      poster_sharing: false,
      quran_offline_copy: false,
      whatsapp_fallback_reminders: false,
      ayah_of_the_day: false,
    },
    supportedLocales: ['en', 'ur'],
    minimumAppVersion: { ios: '1.0.0', android: '1.0.0' },
    serverTime: fx.FIXTURE_NOW,
  }),
});

const apiError = (
  code: keyof typeof ERROR_CODES,
  id: string,
  issues?: { path: string; code: string }[],
) =>
  new Response(JSON.stringify(makeApiError(code, id, issues ? { issues } : {})), {
    status: ERROR_CODES[code],
    headers: { 'content-type': 'application/json' },
  });

describe.each<Locale>(['en', 'ur'])('ayah of the day list (%s)', (locale) => {
  it('lists picks in date order with the fallback for days without one', async () => {
    const { calls } = await openPage({ locale });
    expect(document.documentElement.dir).toBe(locale === 'ur' ? 'rtl' : 'ltr');
    expect(
      screen.getByRole('heading', { level: 1, name: text('console.dailyAyahs.title', locale) }),
    ).toBeTruthy();
    const list = calls.find(isList)!;
    expect(new URLSearchParams(list.search).get('from')).toBe('2027-02-15');
    expect(new URLSearchParams(list.search).get('to')).toBe('2027-03-17');

    const table = screen.getByRole('table', {
      name: text('console.dailyAyahs.list.title', locale),
    });
    const bodyRows = within(table).getAllByRole('row').slice(1);
    expect(bodyRows.map((r) => within(r).getAllByRole('cell')[0]!.textContent)).toEqual([
      ref(2, 255, locale),
      ref(13, 28, locale),
      ref(39, 53, locale),
      ref(94, 5, locale),
      ref(73, 4, locale),
    ]);

    // The fallback: national picks on the first two days, then the built-in list.
    const fallback = screen.getByRole('table', {
      name: text('console.dailyAyahs.fallback.caption', locale),
    });
    const rows = within(fallback).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(7);
    expect(rows[0]!.textContent).toContain(ref(2, 255, locale));
    expect(rows[0]!.textContent).toContain(
      text('console.dailyAyahs.fallback.source.national', locale),
    );
    const third = builtInAyahFor('2027-02-17');
    expect(rows[2]!.textContent).toContain(ref(third.surah, third.ayah, locale));
    expect(rows[2]!.textContent).toContain(
      text('console.dailyAyahs.fallback.source.builtIn', locale),
    );
    // The numbers: three place picks, two national, and 29 of 31 days on the built-in list.
    // They sit on the curation card's gold tag, as drawn.
    expect(
      screen.getByText(text('console.dailyAyahs.curation.gaps', locale).replace('{count}', '29')),
    ).toBeTruthy();
  });

  it.each<TestRole>(['national', 'city', 'venue'])(
    'lets a %s change only the picks in scope',
    async (role) => {
      await openPage({ role, locale });
      const table = screen.getByRole('table', {
        name: text('console.dailyAyahs.list.title', locale),
      });
      const viewOnly = text('console.dailyAyahs.viewOnly', locale);
      const national = rowWith(table, ref(nationalPick!.surah, nationalPick!.ayah, locale));
      const venue = rowWith(table, ref(venuePick!.surah, venuePick!.ayah, locale));
      const circle = rowWith(table, ref(circlePick!.surah, circlePick!.ayah, locale));
      const lahore = rowWith(table, ref(lahorePick!.surah, lahorePick!.ayah, locale));
      const editable = (row: HTMLElement) => !row.textContent?.includes(viewOnly);

      expect(editable(national)).toBe(role === 'national');
      expect(editable(venue)).toBe(true);
      expect(editable(circle)).toBe(true);
      // Another city's pick: only a national admin may touch it.
      expect(editable(lahore)).toBe(role === 'national');
      const lahoreName = (locale === 'ur' ? LAHORE_VENUE.name.ur : null) ?? LAHORE_VENUE.name.en;
      expect(lahore.textContent).toContain(lahoreName);
    },
  );

  it('draws at the largest text size in dark mode', async () => {
    await openPage({ locale, textStep: 3, theme: 'dark' });
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.dataset.textStep).toBe('3');
    expect(document.querySelectorAll('h1')).toHaveLength(1);
    expect(document.querySelector('.ayah-preview')).toBeTruthy();
  });
});

describe('when the page is hidden', () => {
  it('leaves it out of the menu and does not load it while the flag is off', async () => {
    const { calls } = renderConsole({ role: 'national', path: PATH, handlers: flagOff() });
    expect(await screen.findByText(text('console.shell.featureOff.title'))).toBeTruthy();
    const nav = screen.getByRole('navigation', { name: text('console.shell.navLabel') });
    expect(within(nav).queryByRole('link', { name: text('console.nav.dailyAyahs') })).toBeNull();
    expect(calls.some(isList)).toBe(false);
  });

  it('treats a config that cannot load as off', async () => {
    const { calls } = renderConsole({
      role: 'city',
      path: PATH,
      forceError: (c) => (c.path === '/v1/config' ? 'service_unavailable' : undefined),
    });
    expect(await screen.findByText(text('console.shell.featureOff.title'))).toBeTruthy();
    expect(calls.some(isList)).toBe(false);
  });

  it('reads the flags for a coordinator city', async () => {
    const { calls } = await openPage({ role: 'city' });
    const config = calls.find((c) => c.path === '/v1/config')!;
    expect(new URLSearchParams(config.search).get('cityId')).toBe(venueA!.cityId);
  });

  it.each<TestRole>(['national', 'city', 'venue'])('puts it in the %s menu', async (role) => {
    renderConsole({ role, path: '/sessions' });
    await shellReady();
    const nav = screen.getByRole('navigation', { name: text('console.shell.navLabel') });
    expect(
      await within(nav).findByRole('link', { name: text('console.nav.dailyAyahs') }),
    ).toBeTruthy();
  });
});

describe('setting a pick', () => {
  it('a national admin sets a national pick, checked with the shared schema', async () => {
    const { user, calls } = await openPage({ role: 'national' });
    const form = screen.getByRole('form', { name: text('console.dailyAyahs.form.title') });
    expect(
      within(form)
        .getAllByRole('option')
        .filter((o) => o.closest('#pick-scope'))
        .map((o) => o.getAttribute('value')),
    ).toEqual(['', 'national', 'venue', 'circle']);

    await user.clear(within(form).getByLabelText(text('console.dailyAyahs.form.date')));
    await user.type(
      within(form).getByLabelText(text('console.dailyAyahs.form.date')),
      '2027-02-20',
    );
    await user.selectOptions(
      within(form).getByLabelText(text('console.dailyAyahs.form.scope')),
      'national',
    );
    await user.selectOptions(
      within(form).getByLabelText(text('console.dailyAyahs.form.surah')),
      '1',
    );
    await user.type(within(form).getByLabelText(text('console.dailyAyahs.form.ayah')), '8');
    await user.click(
      within(form).getByRole('button', { name: text('console.dailyAyahs.form.save') }),
    );

    // Al-Fatiha has seven ayat: refused here, nothing sent.
    expect(
      await within(form).findByText(
        'Surah Al-Fatihah (1) has 7 ayahs. Enter a number from 1 to 7.',
      ),
    ).toBeTruthy();
    expect(writes(calls)).toHaveLength(0);

    await user.selectOptions(
      within(form).getByLabelText(text('console.dailyAyahs.form.surah')),
      '2',
    );
    await user.clear(within(form).getByLabelText(text('console.dailyAyahs.form.ayah')));
    await user.type(within(form).getByLabelText(text('console.dailyAyahs.form.ayah')), '255');
    expect(within(form).getByText(ref(2, 255))).toBeTruthy();
    const listsBefore = calls.filter(isList).length;
    await user.click(
      within(form).getByRole('button', { name: text('console.dailyAyahs.form.save') }),
    );

    await screen.findByText(/Pick saved for/);
    expect(writes(calls)).toEqual([
      expect.objectContaining({
        method: 'PUT',
        path: '/v1/admin/daily-ayahs',
        body: { date: '2027-02-20', scope: { type: 'national' }, surah: 2, ayah: 255 },
      }),
    ]);
    await waitFor(() => expect(calls.filter(isList).length).toBeGreaterThan(listsBefore));
  });

  it('asks for each missing field and sends nothing', async () => {
    const { user, calls } = await openPage({ role: 'national' });
    const form = screen.getByRole('form', { name: text('console.dailyAyahs.form.title') });
    await user.click(
      within(form).getByRole('button', { name: text('console.dailyAyahs.form.save') }),
    );
    expect(
      await within(form).findByText(text('console.dailyAyahs.error.scope.required')),
    ).toBeTruthy();
    expect(within(form).getByText(text('console.dailyAyahs.error.surah.required'))).toBeTruthy();
    expect(within(form).getByText(text('console.dailyAyahs.error.ayah.required'))).toBeTruthy();
    expect(writes(calls)).toHaveLength(0);
  });

  it('a venue coordinator gets no national choice and only their own venue', async () => {
    const { user, calls } = await openPage({ role: 'venue' });
    const form = screen.getByRole('form', { name: text('console.dailyAyahs.form.title') });
    const scope = within(form).getByLabelText(text('console.dailyAyahs.form.scope'));
    expect(
      within(scope)
        .getAllByRole('option')
        .map((o) => o.getAttribute('value')),
    ).toEqual(['', 'venue', 'circle']);
    await user.selectOptions(scope, 'venue');
    const venue = within(form).getByLabelText(text('console.dailyAyahs.form.venue'));
    expect(
      within(venue)
        .getAllByRole('option')
        .map((o) => o.getAttribute('value')),
    ).toEqual(['', venueA!.id]);
    await user.selectOptions(venue, venueA!.id);
    await user.selectOptions(
      within(form).getByLabelText(text('console.dailyAyahs.form.surah')),
      '94',
    );
    await user.type(within(form).getByLabelText(text('console.dailyAyahs.form.ayah')), '6');
    await user.click(
      within(form).getByRole('button', { name: text('console.dailyAyahs.form.save') }),
    );
    await screen.findByText(/Pick saved for/);
    expect(writes(calls)[0]?.body).toEqual({
      date: '2027-02-15',
      scope: { type: 'venue', venueId: venueA!.id },
      surah: 94,
      ayah: 6,
    });
  });

  it('a city coordinator gets the venues and circles of their city only', async () => {
    const { user } = await openPage({ role: 'city' });
    const form = screen.getByRole('form', { name: text('console.dailyAyahs.form.title') });
    const scope = within(form).getByLabelText(text('console.dailyAyahs.form.scope'));
    expect(
      within(scope).queryByRole('option', { name: text('console.scope.national') }),
    ).toBeNull();
    await user.selectOptions(scope, 'venue');
    const venueOptions = within(within(form).getByLabelText(text('console.dailyAyahs.form.venue')))
      .getAllByRole('option')
      .map((o) => o.getAttribute('value'))
      .filter(Boolean);
    expect(venueOptions).toEqual(
      fx.venues.filter((v) => v.cityId === venueA!.cityId).map((v) => v.id),
    );
    await user.selectOptions(scope, 'circle');
    const circleOptions = within(
      within(form).getByLabelText(text('console.dailyAyahs.form.circle')),
    )
      .getAllByRole('option')
      .map((o) => o.getAttribute('value'))
      .filter(Boolean);
    expect(circleOptions.length).toBeGreaterThan(0);
    for (const id of circleOptions) {
      expect(fx.circles.find((c) => c.id === id)?.cityId).toBe(venueA!.cityId);
    }
  });

  it('changing a pick fills the form and says it replaces the existing one', async () => {
    const { user, calls } = await openPage({ role: 'venue' });
    const table = screen.getByRole('table', { name: text('console.dailyAyahs.list.title') });
    const row = rowWith(table, ref(13, 28));
    await user.click(within(row).getByRole('button', { name: /^Change the pick/ }));
    const form = screen.getByRole('form', { name: text('console.dailyAyahs.form.title') });
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(form).getByLabelText(text('console.dailyAyahs.form.date')),
      ),
    );
    expect(
      (within(form).getByLabelText(text('console.dailyAyahs.form.ayah')) as HTMLInputElement).value,
    ).toBe('28');
    expect(within(form).getByText(/already has Surah Ar-Ra'd \(13\), ayah 28/)).toBeTruthy();
    await user.clear(within(form).getByLabelText(text('console.dailyAyahs.form.ayah')));
    await user.type(within(form).getByLabelText(text('console.dailyAyahs.form.ayah')), '29');
    await user.click(
      within(form).getByRole('button', { name: text('console.dailyAyahs.form.save') }),
    );
    await screen.findByText(/Pick saved for/);
    expect(writes(calls)[0]?.body).toEqual({
      date: venuePick!.date,
      scope: { type: 'venue', venueId: venuePick!.venueId },
      surah: 13,
      ayah: 29,
    });
  });

  it('shows forbidden from the server and keeps the form', async () => {
    const { user } = await openPage({
      role: 'city',
      forceError: (c) => (c.method === 'PUT' ? 'forbidden' : undefined),
    });
    const form = screen.getByRole('form', { name: text('console.dailyAyahs.form.title') });
    await user.selectOptions(
      within(form).getByLabelText(text('console.dailyAyahs.form.scope')),
      'venue',
    );
    await user.selectOptions(
      within(form).getByLabelText(text('console.dailyAyahs.form.venue')),
      venueA!.id,
    );
    await user.selectOptions(
      within(form).getByLabelText(text('console.dailyAyahs.form.surah')),
      '2',
    );
    await user.type(within(form).getByLabelText(text('console.dailyAyahs.form.ayah')), '1');
    await user.click(
      within(form).getByRole('button', { name: text('console.dailyAyahs.form.save') }),
    );
    expect(await within(form).findByText(text('errors.forbidden'))).toBeTruthy();
    expect(
      (within(form).getByLabelText(text('console.dailyAyahs.form.ayah')) as HTMLInputElement).value,
    ).toBe('1');
  });

  it('marks the venue when the server says it no longer exists', async () => {
    const { user } = await openPage({
      role: 'national',
      handlers: { 'adminDailyAyahs.put': (_c, id) => apiError('not_found', id) },
    });
    const form = screen.getByRole('form', { name: text('console.dailyAyahs.form.title') });
    await user.selectOptions(
      within(form).getByLabelText(text('console.dailyAyahs.form.scope')),
      'venue',
    );
    await user.selectOptions(
      within(form).getByLabelText(text('console.dailyAyahs.form.venue')),
      venueA!.id,
    );
    await user.selectOptions(
      within(form).getByLabelText(text('console.dailyAyahs.form.surah')),
      '2',
    );
    await user.type(within(form).getByLabelText(text('console.dailyAyahs.form.ayah')), '1');
    await user.click(
      within(form).getByRole('button', { name: text('console.dailyAyahs.form.save') }),
    );
    expect(await within(form).findByText(text('console.dailyAyahs.error.placeGone'))).toBeTruthy();
    expect(within(form).getByText(text('errors.not_found'))).toBeTruthy();
  });

  it('puts a server validation issue at its field', async () => {
    const { user } = await openPage({
      role: 'national',
      handlers: {
        'adminDailyAyahs.put': (_c, id) =>
          apiError('validation_failed', id, [{ path: 'ayah', code: 'custom' }]),
      },
    });
    const form = screen.getByRole('form', { name: text('console.dailyAyahs.form.title') });
    await user.selectOptions(
      within(form).getByLabelText(text('console.dailyAyahs.form.scope')),
      'national',
    );
    await user.selectOptions(
      within(form).getByLabelText(text('console.dailyAyahs.form.surah')),
      '112',
    );
    await user.type(within(form).getByLabelText(text('console.dailyAyahs.form.ayah')), '4');
    await user.click(
      within(form).getByRole('button', { name: text('console.dailyAyahs.form.save') }),
    );
    expect(
      await within(form).findByText(
        'Surah Al-Ikhlas (112) has 4 ayahs. Enter a number from 1 to 4.',
      ),
    ).toBeTruthy();
    expect(within(form).getByText(text('errors.validation_failed'))).toBeTruthy();
  });
});

describe('removing a pick', () => {
  it('asks first, then removes it and reloads the list', async () => {
    const { user, calls } = await openPage({ role: 'national' });
    const table = screen.getByRole('table', { name: text('console.dailyAyahs.list.title') });
    await user.click(
      within(rowWith(table, ref(2, 255))).getByRole('button', { name: /^Remove the pick/ }),
    );
    const dialog = await screen.findByRole('dialog', {
      name: text('console.dailyAyahs.remove.title'),
    });
    // The safe choice comes first and sends nothing.
    await user.click(
      within(dialog).getByRole('button', { name: text('console.dailyAyahs.remove.keep') }),
    );
    expect(writes(calls)).toHaveLength(0);

    await user.click(
      within(rowWith(table, ref(2, 255))).getByRole('button', { name: /^Remove the pick/ }),
    );
    const again = await screen.findByRole('dialog');
    const listsBefore = calls.filter(isList).length;
    await user.click(
      within(again).getByRole('button', { name: text('console.dailyAyahs.remove.confirm') }),
    );
    expect(await screen.findByText(text('console.dailyAyahs.removed'))).toBeTruthy();
    expect(writes(calls)).toEqual([
      expect.objectContaining({
        method: 'DELETE',
        path: `/v1/admin/daily-ayahs/${nationalPick!.id}`,
      }),
    ]);
    await waitFor(() => expect(calls.filter(isList).length).toBeGreaterThan(listsBefore));
  });

  it('says so when the pick was already gone', async () => {
    const { user } = await openPage({
      role: 'venue',
      forceError: (c) => (c.method === 'DELETE' ? 'not_found' : undefined),
    });
    const table = screen.getByRole('table', { name: text('console.dailyAyahs.list.title') });
    await user.click(
      within(rowWith(table, ref(13, 28))).getByRole('button', { name: /^Remove the pick/ }),
    );
    const dialog = await screen.findByRole('dialog');
    await user.click(
      within(dialog).getByRole('button', { name: text('console.dailyAyahs.remove.confirm') }),
    );
    expect(await screen.findByText(text('console.dailyAyahs.remove.gone'))).toBeTruthy();
  });

  it('shows forbidden from the server', async () => {
    const { user } = await openPage({
      role: 'city',
      forceError: (c) => (c.method === 'DELETE' ? 'forbidden' : undefined),
    });
    const table = screen.getByRole('table', { name: text('console.dailyAyahs.list.title') });
    await user.click(
      within(rowWith(table, ref(73, 4))).getByRole('button', { name: /^Remove the pick/ }),
    );
    const dialog = await screen.findByRole('dialog');
    await user.click(
      within(dialog).getByRole('button', { name: text('console.dailyAyahs.remove.confirm') }),
    );
    expect(await screen.findByText(text('errors.forbidden'))).toBeTruthy();
  });

  it('offers no remove button on a pick out of scope', async () => {
    await openPage({ role: 'venue' });
    const table = screen.getByRole('table', { name: text('console.dailyAyahs.list.title') });
    expect(within(rowWith(table, ref(2, 255))).queryByRole('button')).toBeNull();
  });
});

describe('the date range and list states', () => {
  it('refuses a backwards range without asking the server', async () => {
    const { user, calls } = await openPage({ role: 'national' });
    const before = calls.filter(isList).length;
    const from = screen.getByLabelText(text('console.dailyAyahs.filter.from'));
    await user.clear(from);
    await user.type(from, '2027-04-01');
    expect(await screen.findAllByText(text('console.dailyAyahs.range.invalid'))).not.toHaveLength(
      0,
    );
    expect(calls.filter(isList).length).toBe(before);
  });

  it('refuses more than 366 days', async () => {
    const { user } = await openPage({ role: 'national' });
    const to = screen.getByLabelText(text('console.dailyAyahs.filter.to'));
    await user.clear(to);
    await user.type(to, '2028-03-01');
    expect(await screen.findAllByText('Show at most 366 days at once.')).not.toHaveLength(0);
  });

  it('sends the scope filter to the server', async () => {
    const { user, calls } = await openPage({ role: 'national' });
    const group = screen.getByRole('group', { name: text('console.dailyAyahs.filter.scope') });
    await user.click(
      within(group).getByRole('button', { name: text('console.dailyAyahs.filter.circle') }),
    );
    await waitFor(() =>
      expect(
        calls.some((c) => isList(c) && new URLSearchParams(c.search).get('scopeType') === 'circle'),
      ).toBe(true),
    );
    const table = await screen.findByRole('table', { name: text('console.dailyAyahs.list.title') });
    await waitFor(() => expect(within(table).getAllByRole('row')).toHaveLength(2));
  });

  it('shows an empty state for dates with no picks', async () => {
    await openPage({
      role: 'national',
      handlers: { 'adminDailyAyahs.list': () => ({ items: [] }) },
    });
    expect(await screen.findByText(text('console.dailyAyahs.empty.title'))).toBeTruthy();
  });

  it('shows a failed load with a retry', async () => {
    renderConsole({
      role: 'national',
      path: PATH,
      forceError: (c) => (isList(c) ? 'internal_error' : undefined),
    });
    const alert = await screen.findByText(text('errors.internal_error'));
    expect(alert).toBeTruthy();
    expect(screen.getByRole('button', { name: text('ui.retry') })).toBeTruthy();
  });

  it('shows a forbidden answer to the list from the server', async () => {
    const { calls } = await openPage({
      role: 'national',
      forceError: (c) => (isList(c) ? 'forbidden' : undefined),
    });
    expect(await screen.findByText(text('errors.forbidden'))).toBeTruthy();
    expect(writes(calls)).toHaveLength(0);
  });
});
