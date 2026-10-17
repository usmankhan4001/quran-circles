import { within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Locale } from '../i18n';
import { parseCsv } from '../lib/csv';
import { rawalpindi, venueA } from '../test/people';
import { isDryRun, renderConsole, screen, text, waitFor, writes, type Call } from '../test/harness';

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

type ImportCall = { dryRun: boolean; rows: Record<string, unknown>[] };

/** Calls to the bulk import endpoint of one kind, dry runs and imports alike. */
const importCalls = (calls: Call[], kind = 'venues') =>
  calls.filter((c) => c.method === 'POST' && c.path === `/v1/admin/import/${kind}`);
/** The real imports (`dryRun: false`), with their bodies. */
const imports = (calls: Call[], kind = 'venues') =>
  importCalls(calls, kind)
    .filter((c) => !isDryRun(c))
    .map((c) => c.body as ImportCall);

/** A mock import endpoint that refuses some rows (by index) with the given issue. */
const refusing =
  (when: 'dryRun' | 'import' | 'both', bad: Record<number, { path: string; code: string }>) =>
  (c: { body: unknown }) => {
    const body = c.body as ImportCall;
    const active = when === 'both' || (when === 'dryRun') === body.dryRun;
    const rows = body.rows.map((_r, index) => {
      const issue = active ? bad[index] : undefined;
      return issue
        ? { index, status: 'invalid', issues: [issue] }
        : { index, status: 'created', issues: [] };
    });
    const invalid = rows.filter((r) => r.status === 'invalid').length;
    return {
      dryRun: body.dryRun,
      applied: !body.dryRun && invalid === 0,
      counts: { created: rows.length - invalid, duplicate: 0, invalid },
      rows,
    };
  };

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
    // Nothing was written: the console's check reads, and the server's check is a dry run.
    expect(writes(calls)).toEqual([]);
    const checks = importCalls(calls);
    expect(checks).toHaveLength(1);
    expect(checks[0]?.body).toMatchObject({ dryRun: true });
    expect((checks[0]?.body as ImportCall).rows).toHaveLength(2);
    expect(screen.getByText(text('console.import.serverChecked', locale))).toBeTruthy();
    const importButton = screen.getByRole('button', { name: applyLabel(2, locale) });
    expect(importButton).toHaveProperty('disabled', false);
    await user.click(importButton);

    // The confirmation dialog is still a pause: nothing has been sent yet.
    const dialog = await screen.findByRole('dialog', {
      name: text('console.import.confirm.title', locale),
    });
    expect(writes(calls)).toEqual([]);
    await user.click(within(dialog).getByRole('button', { name: applyLabel(2, locale) }));

    // One call imports the whole file; there is no per-row create any more.
    await waitFor(() => expect(imports(calls)).toHaveLength(1));
    const sent = imports(calls)[0] as ImportCall;
    expect(sent.dryRun).toBe(false);
    expect(sent.rows.map((r) => (r.name as { en: string }).en)).toEqual([
      'Test Masjid One',
      'Test Masjid Two',
    ]);
    expect(sent.rows[0]).toMatchObject({
      cityId: rawalpindi!.id,
      contactPhone: '+923000000011',
      facilities: { womenSection: true },
    });
    expect(calls.some((c) => c.method === 'POST' && c.path === '/v1/admin/venues')).toBe(false);
    expect(await screen.findByText(text('console.import.result', locale))).toBeTruthy();
    expect(
      screen.getByText(text('console.import.done', locale).replace('{count}', '2')),
    ).toBeTruthy();
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
    // Both rows go to the server, which skips the one that is already there.
    await waitFor(() => expect(imports(calls)).toHaveLength(1));
    expect(imports(calls)[0]?.rows).toHaveLength(2);
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

  it('takes the server dry run as the authority, and shows its problems by line and column', async () => {
    const { user, calls } = renderConsole({
      role: 'national',
      path: '/import',
      handlers: {
        'adminImport.venues': refusing('dryRun', {
          1: { path: 'areaId', code: 'area_not_in_city' },
          2: { path: 'cityId', code: 'forbidden' },
        }),
      },
    });
    await choose(
      user,
      csvFile([
        venue('Test Masjid One'),
        venue('Test Masjid Two', { address_en: 'SECRETADDRESS7' }),
        venue('Test Masjid Three'),
      ]),
    );
    const table = await screen.findByRole('table', { name: text('console.import.table.caption') });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows.map((r) => within(r).getByRole('rowheader').textContent)).toEqual(['3', '4']);
    expect(within(table).getByText(/area.*belongs to another city/i)).toBeTruthy();
    expect(within(table).getByText(/outside the places you look after/)).toBeTruthy();
    expect(screen.getByText('2 rows need fixing')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Import 1 row' })).toHaveProperty('disabled', true);
    expect(document.body.textContent).not.toContain('SECRETADDRESS7');
    expect(writes(calls)).toEqual([]);
  });

  it('marks a row the server already has as skipped, even when the console thought it new', async () => {
    const { user } = renderConsole({
      role: 'national',
      path: '/import',
      handlers: {
        'adminImport.venues': (c: { body: unknown }) => {
          const body = c.body as ImportCall;
          return {
            dryRun: body.dryRun,
            applied: false,
            counts: { created: 1, duplicate: 1, invalid: 0 },
            rows: [
              { index: 0, status: 'duplicate', issues: [] },
              { index: 1, status: 'created', issues: [] },
            ],
          };
        },
      },
    });
    await choose(user, csvFile([venue('Test Masjid One'), venue('Test Masjid Two')]));
    await screen.findByText(text('console.import.nothingSaved'));
    expect(screen.getByText(text('console.import.status.duplicate'))).toBeTruthy();
    expect(screen.getByText(text('console.import.issue.alreadyThere'))).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Import 1 row' })).toHaveProperty('disabled', false);
  });

  it('writes nothing when the server refuses a row at import time, and shows which', async () => {
    const { user, calls } = renderConsole({
      role: 'national',
      path: '/import',
      handlers: {
        'adminImport.venues': refusing('import', {
          1: { path: 'areaId', code: 'invalid_reference' },
        }),
      },
    });
    await choose(user, csvFile([venue('Test Masjid One'), venue('Test Masjid Two')]));
    await user.click(await screen.findByRole('button', { name: 'Import 2 rows' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(text('console.import.confirm.allOrNothing'))).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Import 2 rows' }));
    expect(await screen.findByText(text('console.import.refused.title'))).toBeTruthy();
    expect(screen.getByText(text('console.import.refused.body'))).toBeTruthy();
    const table = screen.getByRole('table', { name: text('console.import.table.caption') });
    expect(within(table).getByRole('rowheader').textContent).toBe('3');
    expect(within(table).getByText(/area.*not on our list/i)).toBeTruthy();
    expect(screen.queryByText(text('console.import.result'))).toBeNull();
    expect(imports(calls)).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Import 1 row' })).toHaveProperty('disabled', true);
  });

  it('says nothing was imported when the import call fails, and lets the person try again', async () => {
    let fail = true;
    const { user, calls } = renderConsole({
      role: 'national',
      path: '/import',
      forceError: (c) =>
        fail && c.path === '/v1/admin/import/venues' && !isDryRun(c) ? 'rate_limited' : undefined,
    });
    await choose(user, csvFile([venue('Test Masjid One'), venue('Test Masjid Two')]));
    await user.click(await screen.findByRole('button', { name: 'Import 2 rows' }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Import 2 rows' }),
    );
    expect(await screen.findByText(text('errors.rate_limited'))).toBeTruthy();
    expect(screen.getByText(text('console.import.failed.nothingSaved'))).toBeTruthy();
    fail = false;
    await user.click(screen.getByRole('button', { name: 'Import 2 rows' }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Import 2 rows' }),
    );
    expect(await screen.findByText(text('console.import.result'))).toBeTruthy();
    expect(imports(calls)).toHaveLength(2);
  });

  it('does not ask the server about a file with a broken header', async () => {
    const { user, calls } = renderConsole({ role: 'national', path: '/import' });
    await choose(
      user,
      new File(['city,area\r\nrawalpindi,saddar\r\n'], 'short.csv', { type: 'text/csv' }),
    );
    expect(await screen.findByText(/The column “name_en” is missing/)).toBeTruthy();
    expect(importCalls(calls)).toEqual([]);
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

  it('sends the invites in one import call after confirmation', async () => {
    const { user, calls } = renderConsole({ role: 'national', path: '/import' });
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
    await waitFor(() => expect(imports(calls, 'coordinators')).toHaveLength(1));
    expect(imports(calls, 'coordinators')[0]).toEqual({
      dryRun: false,
      rows: [
        {
          role: 'venue_coordinator',
          venueId: venueA!.id,
          phone: '+923000000091',
          displayName: 'Test One',
        },
      ],
    });
    expect(calls.some((c) => c.path === '/v1/admin/invites' && c.method === 'POST')).toBe(false);
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
