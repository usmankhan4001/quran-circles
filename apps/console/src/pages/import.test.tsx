import { within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Locale } from '../i18n';
import { parseCsv } from '../lib/csv';
import { rawalpindi, venueA } from '../test/people';
import { renderConsole, screen, text, waitFor, writes, type Call } from '../test/harness';

const HEADER =
  'city,area,name_en,name_ur,address_en,address_ur,lat,lng,contact_phone,women_section';
const venue = (name: string, over: Record<string, string> = {}) => {
  const v = {
    city: 'rawalpindi',
    area: 'saddar',
    name_en: name,
    name_ur: '',
    address_en: 'Road 1 (test)',
    address_ur: '',
    lat: '33.6',
    lng: '73.05',
    contact_phone: '0300 0000011',
    women_section: 'yes',
    ...over,
  };
  return Object.values(v).join(',');
};
const csvFile = (rows: string[], header = HEADER, name = 'venues.csv') =>
  new File([[header, ...rows].join('\r\n')], name, { type: 'text/csv' });

const creates = (calls: Call[]) =>
  calls.filter((c) => c.method === 'POST' && c.path === '/v1/admin/venues');

function captureDownloads() {
  const saved: Blob[] = [];
  vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
    saved.push(blob as Blob);
    return 'blob:test';
  });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  const read = (i = 0) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () =>
        resolve(new TextDecoder('utf-8', { ignoreBOM: true }).decode(reader.result as ArrayBuffer));
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(saved[i] as Blob);
    });
  return { saved, read };
}

afterEach(() => vi.restoreAllMocks());

const choose = async (
  user: ReturnType<typeof renderConsole>['user'],
  file: File,
  locale: Locale = 'en',
) => user.upload(await screen.findByLabelText(text('console.import.file.choose', locale)), file);

const applyLabel = (count: number, locale: Locale = 'en') =>
  text(count === 1 ? 'console.import.apply.one' : 'console.import.apply.other', locale).replace(
    '{count}',
    String(count),
  );

describe.each<Locale>(['en', 'ur'])('bulk import dry run (%s)', (locale) => {
  it('checks a good file and sends nothing until the person confirms', async () => {
    const { user, calls } = renderConsole({ role: 'national', locale, path: '/import' });
    await choose(user, csvFile([venue('Test Masjid One'), venue('Test Masjid Two')]), locale);

    expect(await screen.findByText(text('console.import.nothingSaved', locale))).toBeTruthy();
    expect(
      screen.getByText(text('console.import.result.ready.other', locale).replace('{count}', '2')),
    ).toBeTruthy();
    // Nothing was written: the check only reads.
    expect(writes(calls)).toEqual([]);
    const importButton = screen.getByRole('button', { name: applyLabel(2, locale) });
    expect(importButton).toHaveProperty('disabled', false);
    await user.click(importButton);

    // The confirmation dialog is still a pause: nothing has been sent yet.
    const dialog = await screen.findByRole('dialog', {
      name: text('console.import.confirm.title', locale),
    });
    expect(writes(calls)).toEqual([]);
    await user.click(within(dialog).getByRole('button', { name: applyLabel(2, locale) }));

    await waitFor(() => expect(creates(calls)).toHaveLength(2));
    expect(creates(calls).map((c) => (c.body as { name: { en: string } }).name.en)).toEqual([
      'Test Masjid One',
      'Test Masjid Two',
    ]);
    expect(creates(calls)[0]?.body).toMatchObject({
      cityId: rawalpindi!.id,
      contactPhone: '+923000000011',
      facilities: { womenSection: true },
    });
    expect(await screen.findByText(text('console.import.result', locale))).toBeTruthy();
    expect(document.documentElement.dir).toBe(locale === 'ur' ? 'rtl' : 'ltr');
  });
});

describe('bulk import report', () => {
  it('lists every problem with its line and column, and blocks the import', async () => {
    const { user, calls } = renderConsole({ role: 'national', path: '/import' });
    await choose(
      user,
      csvFile([
        venue('Test Masjid One'),
        venue('Test Masjid Two', { city: 'atlantis' }),
        venue('Test Masjid Three', { contact_phone: '12345' }),
        venue('Test Masjid Four', { lat: 'north' }),
      ]),
    );
    const table = await screen.findByRole('table', { name: text('console.import.table.caption') });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(3);
    expect(within(rows[0] as HTMLElement).getByRole('rowheader').textContent).toBe('3');
    expect(within(table).getByText(/city.*not on our list/i)).toBeTruthy();
    expect(within(table).getByText(/contact_phone.*not a valid phone number/i)).toBeTruthy();
    expect(within(table).getByText(/lat.*must be a number/i)).toBeTruthy();
    expect(screen.getByText(text('console.import.blocked.title'))).toBeTruthy();
    expect(screen.getByText('3 rows need fixing')).toBeTruthy();
    // The one good row is not sent alone: a file with errors never half-applies.
    const confirm = screen
      .getAllByRole('button')
      .find((b) => /^Import \d+ rows?$/.test(b.textContent ?? ''));
    expect(confirm).toHaveProperty('disabled', true);
    expect(writes(calls)).toEqual([]);
  });

  it('never repeats cell contents in the report', async () => {
    const { user } = renderConsole({ role: 'national', path: '/import' });
    await choose(user, csvFile([venue('Test Masjid One', { contact_phone: '0300SECRETX9' })]));
    await screen.findByRole('table', { name: text('console.import.table.caption') });
    expect(document.body.textContent).not.toContain('SECRETX9');
  });

  it('downloads the problems as a CSV with line numbers', async () => {
    const downloads = captureDownloads();
    const { user } = renderConsole({ role: 'national', path: '/import' });
    await choose(user, csvFile([venue('Test Masjid One', { city: 'atlantis' })]));
    await user.click(
      await screen.findByRole('button', { name: text('console.import.errors.download') }),
    );
    const report = parseCsv(await downloads.read());
    expect(report.header).toEqual(['Line', 'Status', 'Kind', 'Column', 'Message']);
    expect(report.records[0]?.cells.slice(0, 4)).toEqual(['2', 'invalid', 'error', 'city']);
  });

  it('explains a malformed file instead of guessing', async () => {
    const { user, calls } = renderConsole({ role: 'national', path: '/import' });
    await choose(
      user,
      new File([`${HEADER}\r\n"never closed,x\r\n`], 'bad.csv', { type: 'text/csv' }),
    );
    expect(await screen.findByText(/quotation mark opened here is never closed/i)).toBeTruthy();
    expect(screen.getByText(text('console.import.blocked.title'))).toBeTruthy();
    expect(writes(calls)).toEqual([]);
  });

  it('reports a file with missing required columns', async () => {
    const { user } = renderConsole({ role: 'national', path: '/import' });
    await choose(
      user,
      new File(['city,area\r\nrawalpindi,saddar\r\n'], 'short.csv', { type: 'text/csv' }),
    );
    expect(await screen.findByText(/The column “name_en” is missing/)).toBeTruthy();
  });

  it('skips venues that already exist, and still lets the rest through', async () => {
    const { user, calls } = renderConsole({ role: 'national', path: '/import' });
    await choose(user, csvFile([venue(venueA!.name.en), venue('Test Masjid One')]));
    await screen.findByText(text('console.import.nothingSaved'));
    expect(screen.getByText(text('console.import.status.duplicate'))).toBeTruthy();
    const confirm = screen.getByRole('button', { name: 'Import 1 row' });
    await user.click(confirm);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('1 row will be added.')).toBeTruthy();
    expect(within(dialog).getByText('1 row is already there and will be skipped.')).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Import 1 row' }));
    await waitFor(() => expect(creates(calls)).toHaveLength(1));
    expect(await screen.findByText(/1 row was already there and was skipped/)).toBeTruthy();
  });

  it('cancelling the confirmation sends nothing', async () => {
    const { user, calls } = renderConsole({ role: 'national', path: '/import' });
    await choose(user, csvFile([venue('Test Masjid One')]));
    await user.click(await screen.findByRole('button', { name: 'Import 1 row' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: text('console.shell.cancel') }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(writes(calls)).toEqual([]);
  });

  it('stops at the first failure and says how far it got', async () => {
    let n = 0;
    const { user, calls } = renderConsole({
      role: 'national',
      path: '/import',
      forceError: (c) =>
        c.method === 'POST' && c.path === '/v1/admin/venues' && ++n === 2 ? 'conflict' : undefined,
    });
    await choose(
      user,
      csvFile([venue('Test Masjid One'), venue('Test Masjid Two'), venue('Test Masjid Three')]),
    );
    await user.click(await screen.findByRole('button', { name: 'Import 3 rows' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Import 3 rows' }));
    expect(await screen.findByText(text('console.import.stopped.title'))).toBeTruthy();
    expect(screen.getByText(text('errors.conflict'))).toBeTruthy();
    expect(
      screen.getByText('1 rows were added. 2 rows were not added. It stopped at line 3.'),
    ).toBeTruthy();
    expect(creates(calls)).toHaveLength(2);
  });
});

describe('bulk import by role', () => {
  it('offers a city coordinator all three kinds, scoped to their city', async () => {
    renderConsole({ role: 'city', path: '/import' });
    const kind = await screen.findByLabelText(text('console.import.kind.label'));
    const options = within(kind)
      .getAllByRole('option')
      .map((o) => (o as HTMLOptionElement).value);
    expect(options).toEqual(['venues', 'coordinators', 'sessions']);
  });

  it('refuses a city coordinator a venue in another city before anything is sent', async () => {
    const { user, calls } = renderConsole({ role: 'city', path: '/import' });
    await choose(user, csvFile([venue('Test Masjid One', { city: 'islamabad', area: 'f-7' })]));
    expect(await screen.findByText(/outside the places you look after/)).toBeTruthy();
    expect(writes(calls)).toEqual([]);
  });

  it('checks coordinator files against the existing invites and people', async () => {
    const { user, calls } = renderConsole({ role: 'national', path: '/import' });
    await user.selectOptions(
      await screen.findByLabelText(text('console.import.kind.label')),
      'coordinators',
    );
    const file = new File(
      [
        [
          'phone,name,role,city,venue',
          `0300 0000081,Test One,venue_coordinator,,${venueA!.name.en}`,
          `0300 0000081,Test Dup,venue_coordinator,,${venueA!.name.en}`,
          '12345,Test Bad,city_coordinator,rawalpindi,',
        ].join('\r\n'),
      ],
      'people.csv',
      { type: 'text/csv' },
    );
    await choose(user, file);
    const table = await screen.findByRole('table', { name: text('console.import.table.caption') });
    expect(within(table).getByText(/same entry is already on line 2/)).toBeTruthy();
    expect(within(table).getByText(/phone.*not a valid phone number/)).toBeTruthy();
    expect(writes(calls)).toEqual([]);
    // Labels show a masked number only.
    expect(document.body.textContent).not.toContain('0000081');
  });

  it('sends invites one by one after confirmation', async () => {
    const { user, calls } = renderConsole({
      role: 'national',
      path: '/import',
      handlers: {
        'adminRoles.invite': (c: { body: unknown }) => ({
          id: '00000000-0000-4000-8000-0e0000000099',
          displayName: null,
          status: 'pending',
          scopeType: 'venue',
          cityId: null,
          venueId: null,
          createdAt: '2027-02-10T05:00:00Z',
          expiresAt: '2027-02-17T05:00:00Z',
          role: 'venue_coordinator',
          ...(c.body as object),
        }),
      },
    });
    await user.selectOptions(
      await screen.findByLabelText(text('console.import.kind.label')),
      'coordinators',
    );
    await choose(
      user,
      new File(
        [
          `phone,name,role,city,venue\r\n0300 0000091,Test One,venue_coordinator,,${venueA!.name.en}\r\n`,
        ],
        'people.csv',
        { type: 'text/csv' },
      ),
    );
    await user.click(await screen.findByRole('button', { name: 'Import 1 row' }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Import 1 row' }),
    );
    await waitFor(() =>
      expect(
        calls.filter((c) => c.path === '/v1/admin/invites' && c.method === 'POST'),
      ).toHaveLength(1),
    );
    expect(calls.find((c) => c.path === '/v1/admin/invites' && c.method === 'POST')?.body).toEqual({
      role: 'venue_coordinator',
      venueId: venueA!.id,
      phone: '+923000000091',
      displayName: 'Test One',
    });
  });

  it('keeps venue coordinators out', async () => {
    renderConsole({ role: 'venue', path: '/import' });
    expect(await screen.findByText(text('console.shell.forbidden.title'))).toBeTruthy();
  });

  it('downloads a template with the right headers', async () => {
    const downloads = captureDownloads();
    const { user } = renderConsole({ role: 'national', path: '/import' });
    await user.click(
      await screen.findByRole('button', { name: text('console.import.template.download') }),
    );
    const template = parseCsv(await downloads.read());
    expect(template.header.slice(0, 3)).toEqual(['city', 'area', 'name_en']);
    expect(template.errors).toEqual([]);
  });
});
