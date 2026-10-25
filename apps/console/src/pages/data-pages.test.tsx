import { within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ERROR_CODES,
  REGISTRATION_EXPORT_COLUMNS,
  makeApiError,
  type StaffRegistration,
} from '@qc/contracts';
import { sessions } from '@qc/contracts/fixtures';
import type { Locale } from '../i18n';
import { rawalpindi, venueA } from '../test/people';
import { renderConsole, screen, SETTINGS, text, waitFor, writes, type Call } from '../test/harness';

const BOM = '﻿';

/** Captures what the console saves, without a browser download. */
function captureDownloads() {
  const saved: Blob[] = [];
  vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
    saved.push(blob as Blob);
    return 'blob:test';
  });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  return {
    saved,
    read: async (i = 0) => {
      const blob = saved[i];
      if (!blob) throw new Error('nothing saved');
      // Read the bytes, so the byte order mark is not silently dropped by a text decoder.
      const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(blob);
      });
      return new TextDecoder('utf-8', { ignoreBOM: true }).decode(buffer);
    },
  };
}

afterEach(() => vi.restoreAllMocks());

const reg = (n: number, over: Partial<StaffRegistration> = {}): StaffRegistration => ({
  id: `00000000-0000-4000-8000-0f00000000${String(n).padStart(2, '0')}`,
  name: `Test Registrant ${n}`,
  phone: `+9230000001${String(n).padStart(2, '0')}`,
  areaId: '00000000-0000-4000-8000-030000000001',
  section: 'women',
  partySize: 2,
  status: 'confirmed',
  occurrenceId: null,
  allowsWhatsapp: true,
  createdAt: '2027-02-10T05:00:00Z',
  ...over,
});

describe.each<Locale>(['en', 'ur'])('sessions page (%s)', (locale) => {
  it('lists sessions in a table with a link to each registration list', async () => {
    renderConsole({ role: 'national', locale, path: '/sessions' });
    const table = await screen.findByRole('table', {
      name: text('console.sessions.title', locale),
    });
    expect(within(table).getAllByRole('row')).toHaveLength(sessions.length + 1);
    // The first row is open in the inspector beside the table, with its registrations link.
    const inspector = screen.getByRole('complementary', {
      name: text('console.sessions.inspector.label', locale),
    });
    const link = within(inspector).getAllByRole('link', {
      name: new RegExp(text('console.sessions.registrations', locale)),
    })[0];
    expect(link?.getAttribute('href')).toBe(`/sessions/${sessions[0]!.id}/registrations`);
    expect(document.documentElement.dir).toBe(locale === 'ur' ? 'rtl' : 'ltr');
  });
});

describe('scope filters', () => {
  it('narrows sessions by city and venue through the API', async () => {
    const { user, calls } = renderConsole({ role: 'national', path: '/sessions' });
    await screen.findByRole('table');
    // The city is chosen with the pills in the top bar.
    await user.click(
      within(screen.getByRole('group', { name: text('console.shell.cityPills') })).getByRole(
        'button',
        { name: rawalpindi!.name.en },
      ),
    );
    await waitFor(() =>
      expect(
        calls.some(
          (c) => c.path === '/v1/admin/sessions' && c.search.includes(`cityId=${rawalpindi!.id}`),
        ),
      ).toBe(true),
    );
    const venue = screen.getByLabelText(text('console.shell.filter.venue'));
    await user.selectOptions(venue, venueA!.id);
    await waitFor(() =>
      expect(
        calls.some(
          (c) => c.path === '/v1/admin/sessions' && c.search.includes(`venueId=${venueA!.id}`),
        ),
      ).toBe(true),
    );
  });

  it('offers only the venues of the chosen city', async () => {
    const { user } = renderConsole({ role: 'national', path: '/sessions' });
    await screen.findByRole('table');
    // The city is chosen with the pills in the top bar.
    await user.click(
      within(screen.getByRole('group', { name: text('console.shell.cityPills') })).getByRole(
        'button',
        { name: rawalpindi!.name.en },
      ),
    );
    const venue = screen.getByLabelText(text('console.shell.filter.venue'));
    const labels = within(venue)
      .getAllByRole('option')
      .map((o) => o.textContent);
    expect(labels).toContain(venueA!.name.en);
    expect(labels).not.toContain('Sample Masjid Hira');
  });

  it('shows an empty state with a plain next step', async () => {
    renderConsole({
      role: 'national',
      path: '/sessions',
      handlers: { 'adminSessions.list': () => ({ items: [], nextCursor: null }) },
    });
    expect(await screen.findByText(text('console.sessions.empty.title'))).toBeTruthy();
  });

  it('shows the error message for a failed list and lets the person retry', async () => {
    let fail = true;
    const { user } = renderConsole({
      role: 'national',
      path: '/sessions',
      forceError: (c) =>
        fail && c.path === '/v1/admin/sessions' ? 'service_unavailable' : undefined,
    });
    expect(await screen.findByText(text('errors.service_unavailable'))).toBeTruthy();
    fail = false;
    await user.click(screen.getByRole('button', { name: text('ui.retry') }));
    expect(await screen.findByRole('table')).toBeTruthy();
  });
});

describe('venues page', () => {
  it('lists venues and asks the API for archived ones only when asked', async () => {
    const { user, calls } = renderConsole({ role: 'city', path: '/venues' });
    const table = await screen.findByRole('table', { name: text('console.venues.title') });
    expect(within(table).getByText(venueA!.name.en)).toBeTruthy();
    expect(
      calls
        .filter((c) => c.path === '/v1/admin/venues')
        .every((c) => !c.search.includes('includeArchived=true')),
    ).toBe(true);
    await user.click(
      screen.getByRole('checkbox', { name: text('console.venues.includeArchived') }),
    );
    await waitFor(() =>
      expect(
        calls.some(
          (c) => c.path === '/v1/admin/venues' && c.search.includes('includeArchived=true'),
        ),
      ).toBe(true),
    );
  });
});

describe.each<Locale>(['en', 'ur'])('registrations page (%s)', (locale) => {
  const sessionId = sessions[0]!.id;
  const handlers = {
    'registrations.forSession': () => ({
      items: [reg(1), reg(2, { name: null, status: 'waitlisted', allowsWhatsapp: false })],
      nextCursor: null,
      totals: { registrations: 2, people: 4, waitlisted: 1 },
    }),
  };

  it('shows the registrants, totals and privacy note', async () => {
    renderConsole({
      role: 'venue',
      locale,
      path: `/sessions/${sessionId}/registrations`,
      handlers,
    });
    const table = await screen.findByRole('table', {
      name: text('console.exports.registrations.title', locale),
    });
    expect(within(table).getByRole('rowheader', { name: 'Test Registrant 1' })).toBeTruthy();
    expect(within(table).getByText(text('console.exports.noName', locale))).toBeTruthy();
    expect(within(table).getByText(text('console.exports.status.waitlisted', locale))).toBeTruthy();
    // The totals sit in the card's grey line, as drawn; the privacy note is its foot.
    const card = table.closest('.table-card') as HTMLElement;
    await waitFor(() => expect(card.querySelector('.table-card-sub')?.textContent).toMatch(/·/));
    const sub = card.querySelector('.table-card-sub')?.textContent ?? '';
    expect(sub).toContain(
      text('console.registrations.sub', locale).split(' · ')[1]!.replace('{people}', '4'),
    );
    expect(
      within(card).getByText(text('console.exports.registrations.sensitive', locale)),
    ).toBeTruthy();
  });

  it('exports the session as CSV through the audited endpoint, with a byte order mark', async () => {
    const downloads = captureDownloads();
    const { user, calls } = renderConsole({
      role: 'venue',
      locale,
      path: `/sessions/${sessionId}/registrations`,
      handlers,
    });
    await screen.findByRole('table');
    await user.click(
      screen.getByRole('button', { name: text('console.registrations.export', locale) }),
    );
    expect(await screen.findByText(text('console.exports.saved', locale))).toBeTruthy();
    expect(
      calls.filter((c) => c.path === `/v1/admin/sessions/${sessionId}/registrations/export`),
    ).toHaveLength(1);
    const body = await downloads.read();
    expect(body.charCodeAt(0)).toBe(0xfeff);
    expect(body.startsWith(`${BOM}name,phone`)).toBe(true);
  });

  it('shows why an export failed and saves nothing', async () => {
    const downloads = captureDownloads();
    const { user } = renderConsole({
      role: 'venue',
      locale,
      path: `/sessions/${sessionId}/registrations`,
      handlers,
      forceError: (c) => (c.path.endsWith('/export') ? 'forbidden' : undefined),
    });
    await screen.findByRole('table');
    await user.click(
      screen.getByRole('button', { name: text('console.registrations.export', locale) }),
    );
    expect(await screen.findByText(text('errors.forbidden', locale))).toBeTruthy();
    expect(downloads.saved).toHaveLength(0);
  });
});

const exportCalls = (calls: Call[]) =>
  calls.filter((c) => c.method === 'GET' && c.path === '/v1/admin/registrations/export');
const queryOf = (c: Call | undefined) => Object.fromEntries(new URLSearchParams(c?.search ?? ''));

const validationError = (issues: { path: string; code: string }[]) => (_c: unknown, id: string) =>
  new Response(JSON.stringify(makeApiError('validation_failed', id, { issues })), {
    status: ERROR_CODES.validation_failed,
    headers: { 'content-type': 'application/json' },
  });

describe.each<Locale>(['en', 'ur'])('exports page (%s)', (locale) => {
  it('exports a venue for a date range in one audited call, saved with a byte order mark', async () => {
    const downloads = captureDownloads();
    const { user, calls } = renderConsole({ role: 'national', locale, path: '/exports' });
    await user.selectOptions(
      await screen.findByLabelText(text('console.exports.filter.city', locale)),
      rawalpindi!.id,
    );
    await user.selectOptions(
      screen.getByLabelText(text('console.exports.filter.venue', locale)),
      venueA!.id,
    );
    await user.type(
      screen.getByLabelText(new RegExp(text('console.exports.filter.from', locale))),
      '2027-02-01',
    );
    await user.type(
      screen.getByLabelText(new RegExp(text('console.exports.filter.to', locale))),
      '2027-02-28',
    );
    await user.click(
      screen.getByRole('button', { name: text('console.exports.generate', locale) }),
    );
    expect(
      await screen.findByText(
        text('console.exports.savedRows.other', locale).replace('{count}', '2'),
      ),
    ).toBeTruthy();
    expect(exportCalls(calls)).toHaveLength(1);
    expect(queryOf(exportCalls(calls)[0])).toEqual({
      venueId: venueA!.id,
      from: '2027-02-01',
      to: '2027-02-28',
    });
    // No per-session fan-out any more.
    expect(
      calls.some((c) => c.path.endsWith('/registrations/export') && c.path.includes('/sessions/')),
    ).toBe(false);
    const body = await downloads.read();
    expect(body.charCodeAt(0)).toBe(0xfeff);
    const lines = body.slice(1).split('\r\n').filter(Boolean);
    expect(lines[0]).toBe(REGISTRATION_EXPORT_COLUMNS.join(','));
    expect(lines).toHaveLength(3);
    expect(document.documentElement.dir).toBe(locale === 'ur' ? 'rtl' : 'ltr');
  });
});

describe('exports page', () => {
  it('exports a whole city when all venues are chosen', async () => {
    captureDownloads();
    const { user, calls } = renderConsole({ role: 'national', path: '/exports' });
    await user.selectOptions(
      await screen.findByLabelText(text('console.exports.filter.city')),
      rawalpindi!.id,
    );
    const venue = screen.getByLabelText(text('console.exports.filter.venue')) as HTMLSelectElement;
    expect(venue.value).toBe('');
    expect(within(venue).getAllByRole('option')[0]?.textContent).toBe(
      text('console.exports.allVenues'),
    );
    await user.click(screen.getByRole('button', { name: text('console.exports.generate') }));
    await screen.findByText(/Your file is saved/);
    expect(queryOf(exportCalls(calls)[0])).toEqual({ cityId: rawalpindi!.id });
  });

  it('checks the date order before asking the API', async () => {
    const { user, calls } = renderConsole({ role: 'national', path: '/exports' });
    await user.selectOptions(
      await screen.findByLabelText(text('console.exports.filter.city')),
      rawalpindi!.id,
    );
    await user.type(
      screen.getByLabelText(new RegExp(text('console.exports.filter.from'))),
      '2027-03-01',
    );
    await user.type(
      screen.getByLabelText(new RegExp(text('console.exports.filter.to'))),
      '2027-02-01',
    );
    await user.click(screen.getByRole('button', { name: text('console.exports.generate') }));
    expect(await screen.findByText(text('console.exports.dates.order'))).toBeTruthy();
    expect(exportCalls(calls)).toEqual([]);
  });

  it('points a date the server refused at its field', async () => {
    const downloads = captureDownloads();
    const { user } = renderConsole({
      role: 'national',
      path: '/exports',
      handlers: {
        'adminRegistrations.export': validationError([{ path: 'from', code: 'invalid_format' }]),
      },
    });
    await user.selectOptions(
      await screen.findByLabelText(text('console.exports.filter.city')),
      rawalpindi!.id,
    );
    await user.type(
      screen.getByLabelText(new RegExp(text('console.exports.filter.from'))),
      '2027-02-01',
    );
    await user.click(screen.getByRole('button', { name: text('console.exports.generate') }));
    const message = await screen.findByText(text('console.exports.dates.invalid'));
    const from = screen.getByLabelText(new RegExp(text('console.exports.filter.from')));
    expect(from.getAttribute('aria-invalid')).toBe('true');
    expect(from.getAttribute('aria-describedby')).toContain(message.id);
    expect(screen.getByText(text('errors.validation_failed'))).toBeTruthy();
    expect(downloads.saved).toHaveLength(0);
  });

  it('asks for fewer rows when the file would be too large', async () => {
    const { user } = renderConsole({
      role: 'national',
      path: '/exports',
      handlers: {
        'adminRegistrations.export': validationError([{ path: 'cityId', code: 'too_many_rows' }]),
      },
    });
    await user.selectOptions(
      await screen.findByLabelText(text('console.exports.filter.city')),
      rawalpindi!.id,
    );
    await user.click(screen.getByRole('button', { name: text('console.exports.generate') }));
    expect(await screen.findByText(/more than 50,000 rows/)).toBeTruthy();
  });

  it('says when there is nothing to export, and saves nothing', async () => {
    const downloads = captureDownloads();
    const { user } = renderConsole({ role: 'national', path: '/exports' });
    await user.selectOptions(
      await screen.findByLabelText(text('console.exports.filter.city')),
      rawalpindi!.id,
    );
    await user.type(
      screen.getByLabelText(new RegExp(text('console.exports.filter.from'))),
      '2027-03-01',
    );
    await user.click(screen.getByRole('button', { name: text('console.exports.generate') }));
    expect(await screen.findByText(text('console.exports.empty'))).toBeTruthy();
    expect(downloads.saved).toHaveLength(0);
  });

  it('shows why an export failed and saves nothing', async () => {
    const downloads = captureDownloads();
    const { user } = renderConsole({
      role: 'national',
      path: '/exports',
      forceError: (c) => (c.path === '/v1/admin/registrations/export' ? 'rate_limited' : undefined),
    });
    await user.selectOptions(
      await screen.findByLabelText(text('console.exports.filter.city')),
      rawalpindi!.id,
    );
    await user.click(screen.getByRole('button', { name: text('console.exports.generate') }));
    expect(await screen.findByText(text('errors.rate_limited'))).toBeTruthy();
    expect(downloads.saved).toHaveLength(0);
  });

  it('keeps a venue coordinator to their own venue and asks only for it', async () => {
    captureDownloads();
    const { user, calls } = renderConsole({ role: 'venue', path: '/exports' });
    const city = (await screen.findByLabelText(
      text('console.exports.filter.city'),
    )) as HTMLSelectElement;
    expect(within(city).getAllByRole('option')).toHaveLength(1);
    const venue = screen.getByLabelText(text('console.exports.filter.venue')) as HTMLSelectElement;
    expect(
      within(venue)
        .getAllByRole('option')
        .map((o) => (o as HTMLOptionElement).value),
    ).toEqual([venueA!.id]);
    expect(within(venue).queryByText(text('console.exports.allVenues'))).toBeNull();
    await user.click(screen.getByRole('button', { name: text('console.exports.generate') }));
    await screen.findByText(/Your file is saved/);
    expect(queryOf(exportCalls(calls)[0])).toEqual({ venueId: venueA!.id });
  });

  it('does not send anything until a city is chosen', async () => {
    const { calls } = renderConsole({ role: 'national', path: '/exports' });
    const button = await screen.findByRole('button', { name: text('console.exports.generate') });
    expect(button).toHaveProperty('disabled', true);
    expect(writes(calls)).toEqual([]);
    expect(calls.some((c) => c.path.endsWith('/export'))).toBe(false);
  });
});

describe.each<Locale>(['en', 'ur'])('audit log (%s)', (locale) => {
  const entry = {
    id: 'a1',
    actorName: 'Test Admin',
    action: 'registration.export',
    entityType: 'session',
    entityId: sessions[0]!.id,
    scopeType: 'venue' as const,
    cityId: venueA!.cityId,
    venueId: venueA!.id,
    createdAt: '2027-02-10T05:00:00Z',
  };

  it('shows entries as a table without personal details', async () => {
    renderConsole({
      role: 'city',
      locale,
      path: '/audit',
      handlers: { 'adminAudit.list': () => ({ items: [entry], nextCursor: null }) },
    });
    const table = await screen.findByRole('table', { name: text('console.audit.title', locale) });
    expect(within(table).getByText('registration.export')).toBeTruthy();
    expect(within(table).getByText('Test Admin')).toBeTruthy();
  });

  it('turns the date filters into a whole-day range in Pakistan time', async () => {
    const { user, calls } = renderConsole({
      role: 'city',
      locale,
      path: '/audit',
      handlers: { 'adminAudit.list': () => ({ items: [], nextCursor: null }) },
    });
    await screen.findByText(text('console.audit.empty.title', locale));
    await user.type(screen.getByLabelText(text('console.audit.filter.from', locale)), '2027-02-10');
    await user.type(screen.getByLabelText(text('console.audit.filter.to', locale)), '2027-02-11');
    await waitFor(() => {
      const last = calls.filter((c) => c.path === '/v1/admin/audit').at(-1);
      expect(decodeURIComponent(last?.search ?? '')).toContain('from=2027-02-09T19:00:00Z');
      expect(decodeURIComponent(last?.search ?? '')).toContain('to=2027-02-11T19:00:00Z');
    });
  });
});

describe('settings page', () => {
  it('shows the current values and saves only what changed', async () => {
    const { user, calls } = renderConsole({
      role: 'national',
      path: '/settings',
      handlers: {
        'adminSettings.update': (c: { body: unknown }) => ({ ...SETTINGS, ...(c.body as object) }),
      },
    });
    const hijri = await screen.findByRole('group', { name: text('console.settings.hijri.label') });
    const save = screen.getByRole('button', { name: text('console.settings.save') });
    expect(save).toHaveProperty('disabled', true);
    await user.click(within(hijri).getByRole('button', { name: '−1' }));
    await user.click(save);
    expect(await screen.findByText(text('console.settings.saved'))).toBeTruthy();
    const patch = calls.filter((c) => c.method === 'PATCH' && c.path === '/v1/admin/settings');
    expect(patch).toHaveLength(1);
    expect(patch[0]?.body).toEqual({ hijriOffsetDays: -1 });
  });

  it('rejects values outside the allowed range before calling the API', async () => {
    const { user, calls } = renderConsole({ role: 'national', path: '/settings' });
    const cap = await screen.findByLabelText(text('console.settings.cap.label'));
    await user.clear(cap);
    await user.type(cap, '9');
    await user.click(screen.getByRole('button', { name: text('console.settings.save') }));
    expect(await screen.findByText(text('console.settings.cap.invalid'))).toBeTruthy();
    expect(writes(calls)).toEqual([]);
  });

  it('points a value the server refused at its field', async () => {
    const { user } = renderConsole({
      role: 'national',
      path: '/settings',
      handlers: {
        'adminSettings.update': validationError([
          { path: 'reminderLeadMinutes.circles', code: 'too_big' },
        ]),
      },
    });
    const circles = await screen.findByLabelText(text('console.settings.lead.circles'));
    await user.clear(circles);
    await user.type(circles, '120');
    await user.click(screen.getByRole('button', { name: text('console.settings.save') }));
    expect(await screen.findByText(text('console.settings.lead.invalid'))).toBeTruthy();
    expect(circles.getAttribute('aria-invalid')).toBe('true');
  });

  it('shows an API refusal in the page', async () => {
    const { user } = renderConsole({
      role: 'national',
      path: '/settings',
      forceError: (c) => (c.method === 'PATCH' ? 'forbidden' : undefined),
    });
    await user.click(
      within(
        await screen.findByRole('group', { name: text('console.settings.hijri.label') }),
      ).getByRole('button', { name: '+1' }),
    );
    await user.click(screen.getByRole('button', { name: text('console.settings.save') }));
    expect(await screen.findByText(text('errors.forbidden'))).toBeTruthy();
  });
});

describe.each<Locale>(['en', 'ur'])('reminder lead times in settings (%s)', (locale) => {
  it('shows both lead times and sends only the one that changed', async () => {
    const { user, calls } = renderConsole({
      role: 'national',
      locale,
      path: '/settings',
      handlers: {
        'adminSettings.update': (c: { body: unknown }) => {
          const body = c.body as { reminderLeadMinutes?: { dora?: number } };
          return {
            ...SETTINGS,
            reminderLeadMinutes: { ...SETTINGS.reminderLeadMinutes, ...body.reminderLeadMinutes },
          };
        },
      },
    });
    const dora = (await screen.findByLabelText(
      text('console.settings.lead.dora', locale),
    )) as HTMLInputElement;
    const circles = screen.getByLabelText(
      text('console.settings.lead.circles', locale),
    ) as HTMLInputElement;
    expect(dora.value).toBe('60');
    expect(circles.value).toBe('45');
    expect(dora.min).toBe('5');
    expect(dora.max).toBe('1440');
    expect(dora.closest('fieldset')?.querySelector('legend')?.textContent).toBe(
      text('console.settings.lead.legend', locale),
    );
    await user.clear(dora);
    await user.type(dora, '90');
    await user.click(screen.getByRole('button', { name: text('console.settings.save', locale) }));
    expect(await screen.findByText(text('console.settings.saved', locale))).toBeTruthy();
    const patch = calls.filter((c) => c.method === 'PATCH' && c.path === '/v1/admin/settings');
    expect(patch.map((c) => c.body)).toEqual([{ reminderLeadMinutes: { dora: 90 } }]);
    expect(dora.value).toBe('90');
    expect(document.documentElement.dir).toBe(locale === 'ur' ? 'rtl' : 'ltr');
  });

  it('refuses a lead time outside 5 to 1440 minutes before calling the API', async () => {
    const { user, calls } = renderConsole({ role: 'national', locale, path: '/settings' });
    const circles = await screen.findByLabelText(text('console.settings.lead.circles', locale));
    await user.clear(circles);
    await user.type(circles, '4');
    await user.click(screen.getByRole('button', { name: text('console.settings.save', locale) }));
    expect(await screen.findByText(text('console.settings.lead.invalid', locale))).toBeTruthy();
    await user.clear(circles);
    await user.type(circles, '1441');
    await user.click(screen.getByRole('button', { name: text('console.settings.save', locale) }));
    expect(screen.getByText(text('console.settings.lead.invalid', locale))).toBeTruthy();
    expect(writes(calls)).toEqual([]);
  });

  it('keeps the settings page from anyone but a national admin', async () => {
    renderConsole({ role: 'city', locale, path: '/settings' });
    expect(await screen.findByText(text('console.shell.forbidden.title', locale))).toBeTruthy();
    expect(screen.queryByLabelText(text('console.settings.lead.dora', locale))).toBeNull();
  });
});
