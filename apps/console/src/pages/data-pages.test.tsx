import { within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { StaffRegistration } from '@qc/contracts';
import { sessions } from '@qc/contracts/fixtures';
import type { Locale } from '../i18n';
import { rawalpindi, venueA } from '../test/people';
import { renderConsole, screen, SETTINGS, text, waitFor, writes } from '../test/harness';

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
    const link = within(table).getAllByRole('link', {
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
    await user.selectOptions(
      screen.getByLabelText(text('console.shell.filter.city')),
      rawalpindi!.id,
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
    await user.selectOptions(
      screen.getByLabelText(text('console.shell.filter.city')),
      rawalpindi!.id,
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
    const people = await screen.findByText(text('console.exports.totals.people', locale), {
      selector: 'dt',
    });
    expect(people.closest('div')?.textContent).toContain('4');
    expect(
      screen.getByText(text('console.exports.totals.waitlisted', locale), { selector: 'dt' }),
    ).toBeTruthy();
    expect(screen.getByText(text('console.exports.registrations.sensitive', locale))).toBeTruthy();
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
      screen.getByRole('button', { name: text('console.exports.generate', locale) }),
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
      screen.getByRole('button', { name: text('console.exports.generate', locale) }),
    );
    expect(await screen.findByText(text('errors.forbidden', locale))).toBeTruthy();
    expect(downloads.saved).toHaveLength(0);
  });
});

describe('exports page', () => {
  it('merges the sessions of a venue into one file with a session column', async () => {
    const downloads = captureDownloads();
    const { user, calls } = renderConsole({ role: 'national', path: '/exports' });
    await user.selectOptions(
      await screen.findByLabelText(text('console.exports.target.label')),
      'venue',
    );
    await user.selectOptions(
      screen.getByLabelText(text('console.exports.filter.venue')),
      venueA!.id,
    );
    expect(screen.getByText('2 sessions will be exported.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: text('console.exports.generate') }));
    expect(await screen.findByText('Your file is saved, with 2 sessions.')).toBeTruthy();
    const exported = calls
      .filter((c) => c.path.endsWith('/registrations/export'))
      .map((c) => c.path);
    expect(exported.sort()).toEqual(
      [sessions[0]!.id, sessions[3]!.id]
        .map((id) => `/v1/admin/sessions/${id}/registrations/export`)
        .sort(),
    );
    const body = (await downloads.read()).slice(1).split('\r\n');
    expect(body[0]).toBe('session_id,name,phone,party_size,section,status');
    expect(body).toHaveLength(4);
  });

  it('saves nothing when one of the sessions fails, and says how far it got', async () => {
    const downloads = captureDownloads();
    let n = 0;
    const { user } = renderConsole({
      role: 'national',
      path: '/exports',
      forceError: (c) =>
        c.path.endsWith('/registrations/export') && ++n === 2 ? 'rate_limited' : undefined,
    });
    await user.selectOptions(
      await screen.findByLabelText(text('console.exports.target.label')),
      'venue',
    );
    await user.selectOptions(
      screen.getByLabelText(text('console.exports.filter.venue')),
      venueA!.id,
    );
    await user.click(screen.getByRole('button', { name: text('console.exports.generate') }));
    expect(await screen.findByText(text('errors.rate_limited'))).toBeTruthy();
    expect(screen.getByText(/1 of 2 sessions were exported before it stopped/)).toBeTruthy();
    expect(downloads.saved).toHaveLength(0);
  });

  it('offers a venue coordinator only their own sessions, even if the list had more', async () => {
    const { user } = renderConsole({ role: 'venue', path: '/exports' });
    const choice = await screen.findByLabelText(text('console.exports.target.session'));
    const labels = within(choice)
      .getAllByRole('option')
      .map((o) => o.textContent ?? '');
    expect(labels.filter((l) => l.includes('Taraweeh')).length).toBe(1);
    expect(labels.some((l) => l.includes('Johar Town'))).toBe(false);
    await user.selectOptions(screen.getByLabelText(text('console.exports.target.label')), 'city');
    expect(
      within(screen.getByLabelText(text('console.exports.filter.city'))).getAllByRole('option'),
    ).toHaveLength(2);
  });

  it('does not send anything until a choice is made', async () => {
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
    const hijri = await screen.findByLabelText(text('console.settings.hijri.label'));
    const save = screen.getByRole('button', { name: text('console.settings.save') });
    expect(save).toHaveProperty('disabled', true);
    await user.selectOptions(hijri, '-1');
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

  it('shows an API refusal in the page', async () => {
    const { user } = renderConsole({
      role: 'national',
      path: '/settings',
      forceError: (c) => (c.method === 'PATCH' ? 'forbidden' : undefined),
    });
    await user.selectOptions(
      await screen.findByLabelText(text('console.settings.hijri.label')),
      '1',
    );
    await user.click(screen.getByRole('button', { name: text('console.settings.save') }));
    expect(await screen.findByText(text('errors.forbidden'))).toBeTruthy();
  });
});
