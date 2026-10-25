import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { builtInAyahFor } from '@qc/contracts';
import * as fx from '@qc/contracts/fixtures';
import { FIXTURE_NOW, createBackend, ids, meFor, type RoleKind } from '../../test/backend';
import { combos, renderScreen, typeInto } from '../../test/render';
import { DailyAyahScreen } from './DailyAyahScreen';
import { surahName } from './surahName';

const iqra = fx.venues[1]!;
const circleAlNoor = fx.circles[0]!;
const circleLahore = fx.circles[1]!;

const pickerFor = (kind: RoleKind, props: { venueId?: string; circleId?: string }) => {
  const backend = createBackend({ me: meFor(kind) });
  const rendered = renderScreen(<DailyAyahScreen {...props} now={FIXTURE_NOW} />, { backend });
  return { ...rendered, backend };
};

const chooseDay = (date: string) => fireEvent.click(screen.getByTestId(`daily-ayah-day-${date}`));

const listCalls = (backend: ReturnType<typeof createBackend>) =>
  backend.callsTo('adminDailyAyahs.list');

describe.each(combos)('DailyAyahScreen in $name', (combo) => {
  it("shows the venue's pick for today, the fallback and the days", async () => {
    const backend = createBackend({ me: meFor('venue') });
    const { container } = renderScreen(
      <DailyAyahScreen venueId={ids.venueAlNoor} now={FIXTURE_NOW} />,
      { backend, combo },
    );
    await screen.findByTestId('daily-ayah-panel');
    expect(container.querySelector('[dir]')?.getAttribute('dir')).toBe(combo.dir);
    // Al-Noor's fixture pick for 2027-02-15 is 13:28; the national pick that day is 2:255.
    const ref = screen.getByTestId('daily-ayah-current-ref').textContent ?? '';
    expect(ref).toMatch(
      combo.locale === 'en' ? "Surah Ar-Ra'd (13), ayah 28" : 'سورہ الرعد (13)، آیت 28',
    );
    expect(screen.getByTestId('daily-ayah-fallback-national')).toBeTruthy();
    expect(screen.getByTestId('daily-ayah-day-2027-02-15').getAttribute('aria-checked')).toBe(
      'true',
    );
    expect(screen.getByTestId('daily-ayah-day-2027-03-16')).toBeTruthy();
    expect(screen.getByTestId('daily-ayah-save').textContent).toBe(
      combo.locale === 'en' ? 'Replace pick' : 'انتخاب بدلیں',
    );
    expect(screen.getByTestId('daily-ayah-hero').textContent).toContain(
      combo.locale === 'en' ? 'Sample Masjid Al-Noor' : 'روزانہ آیت کا انتخاب',
    );
  });

  it('shows the ayah count hint and the not-in-surah message', async () => {
    renderScreen(<DailyAyahScreen venueId={ids.venueAlNoor} now={FIXTURE_NOW} />, {
      backend: createBackend({ me: meFor('venue') }),
      combo,
    });
    await screen.findByTestId('daily-ayah-panel');
    chooseDay('2027-02-17');
    typeInto('daily-ayah-surah', '1');
    expect(
      await screen.findByText(
        combo.locale === 'en'
          ? 'Surah Al-Fatihah (1) has 7 ayahs.'
          : 'سورہ الفاتحة (1) میں 7 آیات ہیں۔',
      ),
    ).toBeTruthy();
    typeInto('daily-ayah-ayah', '8');
    fireEvent.click(screen.getByTestId('daily-ayah-save'));
    expect(
      await screen.findByText(
        combo.locale === 'en'
          ? 'Surah Al-Fatihah (1) has 7 ayahs. Enter a number from 1 to 7.'
          : /تک نمبر لکھیں/,
      ),
    ).toBeTruthy();
  });
});

describe('DailyAyahScreen: set a pick', () => {
  it('lets a venue coordinator set the pick for a day without one', async () => {
    const { backend } = pickerFor('venue', { venueId: ids.venueAlNoor });
    await screen.findByTestId('daily-ayah-panel');
    chooseDay('2027-02-17');
    expect(screen.getByTestId('daily-ayah-current-none')).toBeTruthy();
    expect(screen.getByTestId('daily-ayah-current-tag').textContent).toBe('No pick');
    expect(screen.getByTestId('daily-ayah-save').textContent).toBe('Save pick');
    // No national pick on the 17th: followers see the built-in ayah for the day.
    const builtIn = builtInAyahFor('2027-02-17');
    expect(screen.getByTestId('daily-ayah-fallback-built_in').textContent).toContain(
      `Surah ${surahName(builtIn.surah, 'en')} (${builtIn.surah}), ayah ${builtIn.ayah}`,
    );

    typeInto('daily-ayah-surah', '1');
    typeInto('daily-ayah-ayah', '5');
    fireEvent.click(screen.getByTestId('daily-ayah-save'));

    expect(await screen.findByTestId('daily-ayah-notice')).toBeTruthy();
    expect(
      screen.getByText('Saved. Followers see Surah Al-Fatihah (1), ayah 5 on Wed 17 Feb.'),
    ).toBeTruthy();
    expect(backend.callsTo('adminDailyAyahs.put')[0]!.body).toEqual({
      date: '2027-02-17',
      scope: { type: 'venue', venueId: ids.venueAlNoor },
      surah: 1,
      ayah: 5,
    });
    await waitFor(() =>
      expect(screen.getByTestId('daily-ayah-current-ref').textContent).toBe(
        'Surah Al-Fatihah (1), ayah 5',
      ),
    );
    expect(screen.getByTestId('daily-ayah-upcoming-2027-02-17')).toBeTruthy();
    expect(
      backend.state.dailyAyahs.some(
        (p) => p.date === '2027-02-17' && p.venueId === ids.venueAlNoor && p.surah === 1,
      ),
    ).toBe(true);
  });

  it("replaces today's pick and keeps the same record", async () => {
    const { backend } = pickerFor('venue', { venueId: ids.venueAlNoor });
    await screen.findByTestId('daily-ayah-panel');
    const input = within(screen.getByTestId('daily-ayah-ayah-field')).getByRole('textbox');
    expect((input as HTMLInputElement).value).toBe('28');
    typeInto('daily-ayah-ayah', '29');
    fireEvent.click(screen.getByTestId('daily-ayah-save'));
    await waitFor(() =>
      expect(screen.getByTestId('daily-ayah-current-ref').textContent).toBe(
        "Surah Ar-Ra'd (13), ayah 29",
      ),
    );
    const held = backend.state.dailyAyahs.find((p) => p.id === ids.dailyAyahAlNoorToday)!;
    expect(held).toMatchObject({ surah: 13, ayah: 29 });
  });

  it('sends nothing when the ayah is already the pick', async () => {
    const { backend } = pickerFor('venue', { venueId: ids.venueAlNoor });
    await screen.findByTestId('daily-ayah-panel');
    fireEvent.click(screen.getByTestId('daily-ayah-save'));
    expect(await screen.findByTestId('daily-ayah-same')).toBeTruthy();
    expect(backend.callsTo('adminDailyAyahs.put')).toHaveLength(0);
  });

  it.each([
    ['0', '1', 'Enter a surah number from 1 to 114.'],
    ['115', '1', 'Enter a surah number from 1 to 114.'],
    ['', '', 'Enter a surah number from 1 to 114.'],
    ['2', '', 'Enter the ayah number.'],
    ['114', '7', 'Surah An-Nas (114) has 6 ayahs. Enter a number from 1 to 6.'],
  ])('refuses surah %j ayah %j and sends nothing', async (surah, ayah, message) => {
    const { backend } = pickerFor('venue', { venueId: ids.venueAlNoor });
    await screen.findByTestId('daily-ayah-panel');
    chooseDay('2027-02-18');
    typeInto('daily-ayah-surah', surah);
    typeInto('daily-ayah-ayah', ayah);
    fireEvent.click(screen.getByTestId('daily-ayah-save'));
    expect(await screen.findByText(message)).toBeTruthy();
    expect(backend.callsTo('adminDailyAyahs.put')).toHaveLength(0);
  });

  it('shows the mapped error when the server refuses', async () => {
    const { backend } = pickerFor('venue', { venueId: ids.venueAlNoor });
    backend.failWith('adminDailyAyahs.put', 'forbidden');
    await screen.findByTestId('daily-ayah-panel');
    chooseDay('2027-02-17');
    typeInto('daily-ayah-surah', '1');
    typeInto('daily-ayah-ayah', '5');
    fireEvent.click(screen.getByTestId('daily-ayah-save'));
    expect(await screen.findByTestId('daily-ayah-save-error')).toBeTruthy();
    expect(screen.queryByTestId('daily-ayah-notice')).toBeNull();
    expect(backend.state.dailyAyahs.some((p) => p.date === '2027-02-17')).toBe(false);
  });

  it('marks the field the server rejected', async () => {
    const { backend } = pickerFor('venue', { venueId: ids.venueAlNoor });
    backend.failWith('adminDailyAyahs.put', 'validation_failed', {
      issues: [{ path: 'ayah', code: 'custom' }],
    });
    await screen.findByTestId('daily-ayah-panel');
    chooseDay('2027-02-17');
    typeInto('daily-ayah-surah', '1');
    typeInto('daily-ayah-ayah', '5');
    fireEvent.click(screen.getByTestId('daily-ayah-save'));
    expect(await screen.findByText('This was not accepted. Check it and try again.')).toBeTruthy();
  });

  it('opens a day from the coming-up list', async () => {
    pickerFor('venue', { venueId: ids.venueAlNoor });
    await screen.findByTestId('daily-ayah-panel');
    chooseDay('2027-02-17');
    fireEvent.click(screen.getByTestId('daily-ayah-upcoming-2027-02-15'));
    expect(screen.getByTestId('daily-ayah-day-2027-02-15').getAttribute('aria-checked')).toBe(
      'true',
    );
    expect(screen.getByTestId('daily-ayah-current-ref').textContent).toBe(
      "Surah Ar-Ra'd (13), ayah 28",
    );
  });
});

describe('DailyAyahScreen: remove a pick', () => {
  it('asks first, removes the pick and shows the fallback', async () => {
    const { backend } = pickerFor('venue', { venueId: ids.venueAlNoor });
    await screen.findByTestId('daily-ayah-panel');
    fireEvent.click(screen.getByTestId('daily-ayah-remove'));
    expect(
      await screen.findByText(
        'On Mon 15 Feb, followers will see Surah Al-Baqarah (2), ayah 255 instead.',
      ),
    ).toBeTruthy();
    fireEvent.click(screen.getByTestId('daily-ayah-remove-confirm-confirm'));
    expect(await screen.findByText('Pick removed.')).toBeTruthy();
    expect(backend.callsTo('adminDailyAyahs.delete')[0]!.path).toBe(
      `/v1/admin/daily-ayahs/${ids.dailyAyahAlNoorToday}`,
    );
    await screen.findByTestId('daily-ayah-current-none');
    expect(screen.getByTestId('daily-ayah-fallback-national')).toBeTruthy();
    expect(screen.getByTestId('daily-ayah-upcoming-empty')).toBeTruthy();
    expect(backend.state.dailyAyahs.some((p) => p.id === ids.dailyAyahAlNoorToday)).toBe(false);
  });

  it('removes nothing when the person cancels', async () => {
    const { backend } = pickerFor('venue', { venueId: ids.venueAlNoor });
    await screen.findByTestId('daily-ayah-panel');
    fireEvent.click(screen.getByTestId('daily-ayah-remove'));
    fireEvent.click(await screen.findByTestId('daily-ayah-remove-confirm-cancel'));
    expect(backend.callsTo('adminDailyAyahs.delete')).toHaveLength(0);
    expect(screen.getByTestId('daily-ayah-current-ref')).toBeTruthy();
  });

  it('shows the error and reloads when the pick is already gone', async () => {
    const { backend } = pickerFor('venue', { venueId: ids.venueAlNoor });
    await screen.findByTestId('daily-ayah-panel');
    const before = listCalls(backend).length;
    backend.failWith('adminDailyAyahs.delete', 'not_found');
    fireEvent.click(screen.getByTestId('daily-ayah-remove'));
    fireEvent.click(await screen.findByTestId('daily-ayah-remove-confirm-confirm'));
    expect(await screen.findByTestId('daily-ayah-remove-error')).toBeTruthy();
    await waitFor(() => expect(listCalls(backend).length).toBeGreaterThan(before));
    expect(screen.queryByText('Pick removed.')).toBeNull();
  });

  it('offers no remove button on a day without a pick', async () => {
    pickerFor('venue', { venueId: ids.venueAlNoor });
    await screen.findByTestId('daily-ayah-panel');
    chooseDay('2027-02-17');
    expect(screen.queryByTestId('daily-ayah-remove')).toBeNull();
  });
});

describe('DailyAyahScreen: circles', () => {
  it("shows and sets a circle's pick with a circle target", async () => {
    const { backend } = pickerFor('venue', { circleId: circleAlNoor.id });
    await screen.findByTestId('daily-ayah-panel');
    // Its fixture pick is on the 16th; today has none for the circle.
    expect(screen.getByTestId('daily-ayah-current-none')).toBeTruthy();
    chooseDay('2027-02-16');
    expect(screen.getByTestId('daily-ayah-current-ref').textContent).toBe(
      'Surah Al-Muzzammil (73), ayah 4',
    );
    expect(screen.getByText('People who follow this circle see this ayah that day.')).toBeTruthy();
    chooseDay('2027-02-15');
    typeInto('daily-ayah-surah', '2');
    typeInto('daily-ayah-ayah', '286');
    fireEvent.click(screen.getByTestId('daily-ayah-save'));
    await screen.findByTestId('daily-ayah-notice');
    expect(backend.callsTo('adminDailyAyahs.put')[0]!.body).toEqual({
      date: '2027-02-15',
      scope: { type: 'circle', circleId: circleAlNoor.id },
      surah: 2,
      ayah: 286,
    });
  });

  it("lists only the circle's picks, not its venue's", async () => {
    const { backend } = pickerFor('venue', { circleId: circleAlNoor.id });
    await screen.findByTestId('daily-ayah-panel');
    expect(listCalls(backend).map((c) => c.query)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ scopeType: 'national' }),
        expect.objectContaining({ scopeType: 'circle', circleId: circleAlNoor.id }),
      ]),
    );
    expect(screen.queryByTestId('daily-ayah-upcoming-2027-02-15')).toBeNull();
    expect(screen.getByTestId('daily-ayah-upcoming-2027-02-16')).toBeTruthy();
  });

  it('says not available for a circle outside the scope', async () => {
    const { backend } = pickerFor('venue', { circleId: circleLahore.id });
    expect(await screen.findByTestId('daily-ayah-data-not-available')).toBeTruthy();
    expect(listCalls(backend)).toHaveLength(0);
  });
});

describe('DailyAyahScreen: who may pick', () => {
  it.each<[RoleKind, string, string]>([
    ['venue', 'own venue', ids.venueAlNoor],
    ['city', 'a venue in their city', ids.venueAlNoor],
    ['city', 'another venue in their city', iqra.id],
    ['admin', 'a venue anywhere', ids.venueLahore],
    ['multi', 'their second venue', ids.venueLahore],
  ])('%s may pick for %s', async (kind, _label, venueId) => {
    const { backend } = pickerFor(kind, { venueId });
    await screen.findByTestId('daily-ayah-panel');
    expect(screen.getByTestId('daily-ayah-save')).toBeTruthy();
    expect(listCalls(backend)).toHaveLength(2);
  });

  it('shows the Lahore pick to the national admin', async () => {
    pickerFor('admin', { venueId: ids.venueLahore });
    await screen.findByTestId('daily-ayah-panel');
    expect(screen.getByTestId('daily-ayah-current-ref').textContent).toBe(
      'Surah Az-Zumar (39), ayah 53',
    );
  });

  it.each<[RoleKind, string, string]>([
    ['venue', 'another venue in the same city', iqra.id],
    ['venue', 'a venue in another city', ids.venueLahore],
    ['city', 'a venue in another city', ids.venueLahore],
    ['multi', 'a venue that is not theirs', iqra.id],
  ])('%s may not pick for %s, and nothing is listed', async (kind, _label, venueId) => {
    const { backend } = pickerFor(kind, { venueId });
    expect(await screen.findByTestId('daily-ayah-forbidden')).toBeTruthy();
    expect(screen.queryByTestId('daily-ayah-save')).toBeNull();
    expect(listCalls(backend)).toHaveLength(0);
  });

  it('is refused by the server too, if the screen were bypassed', async () => {
    const backend = createBackend({ me: meFor('venue') });
    const res = await backend.fetch('http://mock.test/v1/admin/daily-ayahs', {
      method: 'PUT',
      headers: { 'content-type': 'application/json', authorization: 'Bearer mock-staff' },
      body: JSON.stringify({
        date: '2027-02-17',
        scope: { type: 'venue', venueId: ids.venueLahore },
        surah: 1,
        ayah: 1,
      }),
    });
    expect(res.status).toBe(403);
    const national = await backend.fetch(
      `http://mock.test/v1/admin/daily-ayahs/${ids.dailyAyahNationalToday}`,
      { method: 'DELETE', headers: { authorization: 'Bearer mock-staff' } },
    );
    expect(national.status).toBe(403);
  });
});

describe('DailyAyahScreen: flag and failures', () => {
  it('is not available when the ayah_of_the_day flag is off', async () => {
    const backend = createBackend({ me: meFor('venue'), flags: { ayah_of_the_day: false } });
    renderScreen(<DailyAyahScreen venueId={ids.venueAlNoor} now={FIXTURE_NOW} />, { backend });
    expect(await screen.findByTestId('daily-ayah-off')).toBeTruthy();
    expect(listCalls(backend)).toHaveLength(0);
  });

  it("reads the flag for the place's city", async () => {
    const backend = createBackend({
      me: meFor('admin'),
      flagsByCity: { [ids.cityRawalpindi]: { ayah_of_the_day: false } },
    });
    renderScreen(<DailyAyahScreen venueId={ids.venueAlNoor} now={FIXTURE_NOW} />, { backend });
    expect(await screen.findByTestId('daily-ayah-off')).toBeTruthy();
    expect(backend.callsTo('config.get')[0]!.query).toEqual({ cityId: ids.cityRawalpindi });
  });

  it('is on in a city whose flag is on', async () => {
    const backend = createBackend({
      me: meFor('admin'),
      flagsByCity: { [ids.cityRawalpindi]: { ayah_of_the_day: false } },
    });
    renderScreen(<DailyAyahScreen venueId={ids.venueLahore} now={FIXTURE_NOW} />, { backend });
    expect(await screen.findByTestId('daily-ayah-panel')).toBeTruthy();
  });

  it('shows a retry when the config cannot load', async () => {
    const backend = createBackend({ me: meFor('venue') });
    backend.failWith('config.get', 'internal_error');
    renderScreen(<DailyAyahScreen venueId={ids.venueAlNoor} now={FIXTURE_NOW} />, { backend });
    expect(await screen.findByTestId('daily-ayah-data-error')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByTestId('daily-ayah-panel')).toBeTruthy();
  });

  it('shows a retry when the picks cannot load, and recovers', async () => {
    const backend = createBackend({ me: meFor('venue') });
    backend.failWith('adminDailyAyahs.list', 'internal_error');
    renderScreen(<DailyAyahScreen venueId={ids.venueAlNoor} now={FIXTURE_NOW} />, { backend });
    expect(await screen.findByTestId('daily-ayah-picks-error')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(await screen.findByTestId('daily-ayah-panel')).toBeTruthy();
  });

  it('shows the offline state when nothing reaches the server', async () => {
    const backend = createBackend({ me: meFor('venue') });
    backend.setOffline(true);
    renderScreen(<DailyAyahScreen venueId={ids.venueAlNoor} now={FIXTURE_NOW} />, { backend });
    expect(await screen.findByTestId('daily-ayah-data-error')).toBeTruthy();
  });

  it('is not available when no place is named', async () => {
    const backend = createBackend({ me: meFor('venue') });
    renderScreen(<DailyAyahScreen now={FIXTURE_NOW} />, { backend });
    expect(await screen.findByTestId('daily-ayah-off')).toBeTruthy();
    expect(backend.calls).toHaveLength(0);
  });
});
