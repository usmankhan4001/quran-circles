import { within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { AdminSession, AuditEntry, Invite, StaffRegistration } from '@qc/contracts';
import { sessions, venues } from '@qc/contracts/fixtures';
import type { Locale } from '../i18n';
import { renderConsole, screen, shellReady, text, waitFor, type Call } from '../test/harness';
import { venueA } from '../test/people';

/**
 * The drawn table pages (C2): numbers on top, then one card with the search, the filters and the
 * add action over the table. Numbers come only from the rows the list endpoints return.
 */

const page = <T,>(items: T[], nextCursor: string | null = null) => ({ items, nextCursor });

const adminSessions: AdminSession[] = sessions.map((s, i) => ({
  ...s,
  circleStatus: i === 1 ? 'pending_approval' : null,
  registration:
    i === 0 ? { enabled: true, capacity: 20, seatsTaken: 20, full: true } : s.registration,
}));
const fullCount = adminSessions.filter((s) => s.registration.full).length;

/** The number shown on a card, by its label. */
/** A message with its {placeholders} filled, as the page writes it. */
const fill = (message: string, params: Record<string, number>) =>
  message.replace(/\{(\w+)\}/g, (_, k: string) => String(params[k]));

function statValue(label: string): string {
  const term = screen.getByText(label, { selector: 'dt' });
  return term.parentElement?.querySelector('dd')?.textContent ?? '';
}

const listCalls = (calls: Call[], path: string) =>
  calls.filter((c) => c.method === 'GET' && c.path === path);

describe.each<Locale>(['en', 'ur'])('sessions page as drawn (%s)', (locale) => {
  it('shows the numbers on top and the table in one card with search and add', async () => {
    renderConsole({
      role: 'national',
      locale,
      path: '/sessions',
      handlers: { 'adminSessions.list': () => page(adminSessions) },
    });
    await screen.findByRole('table', { name: text('console.sessions.title', locale) });
    const stats = screen.getByRole('region', { name: text('console.kpi.label', locale) });
    // Masjids, circles and seats; the drawn check-in card has no data behind it and is left out.
    expect(within(stats).getAllByRole('term')).toHaveLength(3);
    expect(statValue(text('console.sessions.kpi.total', locale))).toContain(
      fill(text('console.sessions.kpi.totalValue', locale), { count: adminSessions.length }),
    );
    // Full sessions are counted on the demand card's line; approvals waiting sit in the gold tag.
    const demand = screen.getByText(text('console.sessions.kpi.demand', locale), {
      selector: 'dt',
    }).parentElement;
    expect(demand?.querySelector('.stat-sub')?.textContent).toContain(
      fill(text('console.sessions.kpi.demandSub', locale), { full: fullCount, week: 0 }).split(
        ' · ',
      )[0],
    );
    expect(
      screen.getByText(fill(text('console.sessions.awaiting', locale), { count: 1 })).classList,
    ).toContain('tag-amber');
    expect(screen.getByRole('searchbox', { name: text('console.sessions.search', locale) }));
    const add = screen.getByRole('link', { name: text('console.sessions.add', locale) });
    expect(add.getAttribute('href')).toBe('/import?kind=sessions');
    expect(screen.queryByText(text('console.kpi.partial', locale))).toBeNull();
    expect(document.documentElement.dir).toBe(locale === 'ur' ? 'rtl' : 'ltr');
  });
});

describe('searching a table', () => {
  it('filters the loaded sessions in the browser, without asking the API again', async () => {
    const { user, calls } = renderConsole({
      role: 'national',
      path: '/sessions',
      handlers: { 'adminSessions.list': () => page(adminSessions) },
    });
    const table = await screen.findByRole('table', { name: text('console.sessions.title') });
    expect(within(table).getAllByRole('row')).toHaveLength(adminSessions.length + 1);
    const before = listCalls(calls, '/v1/admin/sessions').length;
    const target = adminSessions[2]!;
    await user.type(
      screen.getByRole('searchbox', { name: text('console.sessions.search') }),
      target.title.en,
    );
    const narrowed = screen.getByRole('table', { name: text('console.sessions.title') });
    // Each row names its masjid in the row header; the session title sits in the program cell.
    const rowsLeft = within(narrowed).getAllByRole('row').slice(1);
    expect(rowsLeft.some((r) => r.textContent?.includes(target.title.en))).toBe(true);
    expect(rowsLeft.length).toBeLessThan(adminSessions.length);
    expect(listCalls(calls, '/v1/admin/sessions')).toHaveLength(before);
  });

  it('says when nothing matches, and that only loaded rows were searched when there are more', async () => {
    const { user } = renderConsole({
      role: 'national',
      path: '/sessions',
      handlers: { 'adminSessions.list': () => page(adminSessions, 'next-page') },
    });
    await screen.findByRole('table', { name: text('console.sessions.title') });
    expect(screen.getByText(text('console.kpi.partial'))).toBeTruthy();
    await user.type(
      screen.getByRole('searchbox', { name: text('console.sessions.search') }),
      'zzzz-no-such-session',
    );
    expect(screen.getByText('Nothing matches “zzzz-no-such-session”')).toBeTruthy();
    expect(screen.getByText(text('console.search.noMatch.partial'))).toBeTruthy();
    expect(screen.queryByRole('table', { name: text('console.sessions.title') })).toBeNull();
    // Loading more is still offered.
    expect(screen.getByRole('button', { name: text('console.shell.loadMore') })).toBeTruthy();
  });

  it('finds a registrant by the number however it is typed', async () => {
    const reg = (n: number, name: string): StaffRegistration => ({
      id: `00000000-0000-4000-8000-0f100000000${n}`,
      name,
      phone: `+92300000009${n}`,
      areaId: '00000000-0000-4000-8000-030000000001',
      section: 'women',
      partySize: 1,
      status: 'confirmed',
      occurrenceId: null,
      allowsWhatsapp: false,
      createdAt: '2027-02-10T05:00:00Z',
    });
    const { user } = renderConsole({
      role: 'national',
      path: `/sessions/${sessions[0]!.id}/registrations`,
      handlers: {
        'registrations.forSession': () => ({
          ...page([reg(1, 'Test Registrant A'), reg(2, 'Test Registrant B')]),
          totals: { registrations: 2, people: 2, waitlisted: 0 },
        }),
      },
    });
    await screen.findByText('Test Registrant A');
    expect(
      document
        .querySelector('.table-card-sub')
        ?.textContent?.includes(
          text('console.registrations.sub').split(' · ')[0]!.replace('{registrations}', '2'),
        ),
    ).toBe(true);
    await user.type(
      screen.getByRole('searchbox', { name: text('console.exports.registrations.search') }),
      '0300 0000092',
    );
    expect(screen.queryByText('Test Registrant A')).toBeNull();
    expect(screen.getByText('Test Registrant B')).toBeTruthy();
  });
});

describe('add actions', () => {
  it('opens the bulk import with the right kind chosen', async () => {
    const { user } = renderConsole({ role: 'national', path: '/sessions' });
    await screen.findByRole('table', { name: text('console.sessions.title') });
    await user.click(screen.getByRole('link', { name: text('console.sessions.add') }));
    const kind = (await screen.findByLabelText(
      text('console.import.kind.label'),
    )) as HTMLSelectElement;
    expect(kind.value).toBe('sessions');
  });

  it('opens the venue import from the venues page', async () => {
    const { user } = renderConsole({ role: 'city', path: '/venues' });
    await screen.findByRole('table', { name: text('console.venues.title') });
    await user.click(screen.getByRole('link', { name: text('console.venues.add') }));
    const kind = (await screen.findByLabelText(
      text('console.import.kind.label'),
    )) as HTMLSelectElement;
    expect(kind.value).toBe('venues');
  });

  it('offers a venue coordinator no add action, since the import is not theirs', async () => {
    renderConsole({ role: 'venue', path: '/sessions' });
    await screen.findByRole('table', { name: text('console.sessions.title') });
    expect(screen.queryByRole('link', { name: text('console.sessions.add') })).toBeNull();
    expect(screen.getByRole('region', { name: text('console.kpi.label') })).toBeTruthy();
  });

  it('ignores a kind in the address that the person may not import', async () => {
    renderConsole({ role: 'national', path: '/import?kind=nonsense' });
    const kind = (await screen.findByLabelText(
      text('console.import.kind.label'),
    )) as HTMLSelectElement;
    expect(kind.value).toBe('venues');
  });
});

describe('venues page', () => {
  it('counts venues from the loaded rows and searches them', async () => {
    const { user } = renderConsole({ role: 'national', path: '/venues' });
    const table = await screen.findByRole('table', { name: text('console.venues.title') });
    const active = venues.filter((v) => v.status === 'active');
    expect(statValue(text('console.venues.kpi.active'))).toBe(String(active.length));
    expect(statValue(text('console.venues.kpi.noContact'))).toBe(
      String(active.filter((v) => !v.contactPhone).length),
    );
    // Archived venues get a card only when they are shown.
    expect(screen.queryByText(text('console.venues.kpi.archived'), { selector: 'dt' })).toBeNull();
    expect(within(table).getAllByRole('row')).toHaveLength(venues.length + 1);
    await user.type(
      screen.getByRole('searchbox', { name: text('console.venues.search') }),
      venueA!.name.en,
    );
    expect(
      within(screen.getByRole('table', { name: text('console.venues.title') }))
        .getAllByRole('rowheader')
        .map((r) => r.textContent),
    ).toContain(venueA!.name.en);
  });
});

/* Invites, import and audit are admin pages: hidden for a venue coordinator, drawn for an admin. */

const invite = (n: number, status: Invite['status'], displayName: string): Invite => ({
  id: `00000000-0000-4000-8000-0e500000000${n}`,
  phone: `+92300000004${n}`,
  displayName,
  role: 'venue_coordinator',
  scopeType: 'venue',
  cityId: null,
  venueId: venueA!.id,
  status,
  createdAt: '2027-02-10T00:00:00Z',
  expiresAt: '2027-02-17T00:00:00Z',
});

const audit = (n: number, actorName: string | null, action: string): AuditEntry => ({
  id: `audit-${n}`,
  actorName,
  action,
  entityType: action.split('.')[0] ?? 'record',
  entityId: null,
  scopeType: 'national',
  cityId: null,
  venueId: null,
  createdAt: '2027-02-10T05:00:00Z',
});

describe.each<Locale>(['en', 'ur'])('admin pages for a national admin (%s)', (locale) => {
  it('lists invites, import and audit in the menu', async () => {
    renderConsole({ role: 'national', locale, path: '/sessions' });
    await shellReady(locale);
    const nav = screen.getByRole('navigation', { name: text('console.shell.navLabel', locale) });
    for (const id of ['coordinators', 'import', 'audit'] as const) {
      expect(within(nav).getByRole('link', { name: text(`console.nav.${id}`, locale) }));
    }
  });

  it('draws the coordinators page: the scoped table with the invite form beside it, then the invites', async () => {
    const { user } = renderConsole({
      role: 'national',
      locale,
      path: '/coordinators',
      handlers: {
        'adminRoles.invites': () => ({
          items: [
            invite(1, 'pending', 'Test Waiting'),
            invite(2, 'accepted', 'Test Accepted'),
            invite(3, 'expired', 'Test Expired'),
          ],
        }),
      },
    });
    const table = await screen.findByRole('table', {
      name: text('console.invites.list.title', locale),
    });
    // The counts sit in the scoped table's grey line, as drawn; there are no number cards.
    expect(screen.queryByRole('region', { name: text('console.kpi.label', locale) })).toBeNull();
    const card = (
      await screen.findByRole('heading', {
        level: 2,
        name: text('console.invites.active.title', locale),
      })
    ).closest('.table-card') as HTMLElement;
    expect(card.querySelector('.table-card-sub')?.textContent).toBe(
      fill(text('console.invites.active.sub', locale), { active: 0, waiting: 1 }),
    );
    expect(within(card).getByText(text('console.invites.rbacTag', locale))).toBeTruthy();
    expect(
      screen.getByRole('group', { name: text('console.invites.filter.label', locale) }),
    ).toBeTruthy();
    // The invite form stands beside the scoped table; the invites table follows below.
    const form = screen.getByRole('form', { name: text('console.invites.new', locale) });
    expect(form.closest('.split')).toBe(card.closest('.split'));
    expect(table.closest('.split')).toBeNull();
    await user.type(
      screen.getByRole('searchbox', { name: text('console.invites.search', locale) }),
      'Test Expired',
    );
    expect(
      within(screen.getByRole('table', { name: text('console.invites.list.title', locale) }))
        .getAllByRole('rowheader')
        .map((r) => r.textContent),
    ).toEqual(['Test Expired']);
  });

  it('draws the audit page with its numbers and a searchable table', async () => {
    const { user } = renderConsole({
      role: 'national',
      locale,
      path: '/audit',
      handlers: {
        'adminAudit.list': () =>
          page([
            audit(1, 'Test Person One', 'registration.export'),
            audit(2, 'Test Person Two', 'venue.update'),
            audit(3, null, 'session.archive'),
          ]),
      },
    });
    const table = await screen.findByRole('table', { name: text('console.audit.title', locale) });
    expect(within(table).getAllByRole('row')).toHaveLength(4);
    // The counts are on the card's grey line, as drawn.
    expect(table.closest('.table-card')?.querySelector('.table-card-sub')?.textContent).toBe(
      fill(text('console.audit.card.sub', locale), { entries: 3, people: 2, exports: 1 }),
    );
    await user.type(
      screen.getByRole('searchbox', { name: text('console.audit.search', locale) }),
      'export',
    );
    expect(
      within(screen.getByRole('table', { name: text('console.audit.title', locale) })).getAllByRole(
        'row',
      ),
    ).toHaveLength(2);
  });

  it('draws the import page with its steps and the kind choice', async () => {
    renderConsole({ role: 'national', locale, path: '/import' });
    expect(
      await screen.findByRole('heading', { level: 1, name: text('console.import.title', locale) }),
    ).toBeTruthy();
    expect(
      screen.getByRole('list', { name: text('console.import.steps.label', locale) }),
    ).toBeTruthy();
    expect(screen.getByLabelText(text('console.import.kind.label', locale))).toBeTruthy();
  });
});

describe('admin pages stay hidden for a venue coordinator', () => {
  it.each(['/coordinators', '/import', '/audit'])('refuses %s', async (path) => {
    const { calls } = renderConsole({ role: 'venue', path });
    expect(await screen.findByText(text('console.shell.forbidden.title'))).toBeTruthy();
    await waitFor(() => expect(calls.some((c) => c.path === '/v1/admin/audit')).toBe(false));
    expect(screen.queryByRole('region', { name: text('console.kpi.label') })).toBeNull();
  });
});
