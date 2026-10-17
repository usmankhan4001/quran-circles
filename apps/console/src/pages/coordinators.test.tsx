import { within } from '@testing-library/react';
import { ERROR_CODES, makeApiError, type Invite, type StaffRoleAssignment } from '@qc/contracts';
import { venues } from '@qc/contracts/fixtures';
import { describe, expect, it } from 'vitest';
import type { Locale } from '../i18n';
import { rawalpindi, venueA, venueB } from '../test/people';
import { renderConsole, screen, text, waitFor, writes, type Call } from '../test/harness';

const uuid = (n: number) => `00000000-0000-4000-8000-0e00000000${String(n).padStart(2, '0')}`;

const personA: StaffRoleAssignment = {
  id: uuid(1),
  userId: uuid(11),
  userName: 'Test Person One',
  phone: '+923000000051',
  role: 'venue_coordinator',
  scopeType: 'venue',
  cityId: venueA!.cityId,
  venueId: venueA!.id,
  scopeName: venueA!.name,
  createdAt: '2027-02-01T05:00:00Z',
  revokedAt: null,
};
const personB: StaffRoleAssignment = {
  ...personA,
  id: uuid(2),
  userId: uuid(12),
  userName: 'Test Person Two',
  phone: '+923000000052',
  venueId: venueB!.id,
  scopeName: venueB!.name,
};
const cityPerson: StaffRoleAssignment = {
  ...personA,
  id: uuid(3),
  userId: uuid(13),
  userName: 'Test Person Three',
  phone: '+923000000053',
  role: 'city_coordinator',
  scopeType: 'city',
  cityId: rawalpindi!.id,
  venueId: null,
  scopeName: rawalpindi!.name,
};
const invite: Invite = {
  id: uuid(21),
  phone: '+923000000061',
  displayName: 'Test Invitee',
  role: 'venue_coordinator',
  scopeType: 'venue',
  cityId: null,
  venueId: venueA!.id,
  status: 'pending',
  createdAt: '2027-02-10T05:00:00Z',
  expiresAt: '2027-02-17T05:00:00Z',
};

const data = {
  'adminRoles.list': () => ({ items: [personA, personB, cityPerson], nextCursor: null }),
  'adminRoles.invites': () => ({ items: [invite] }),
};

const errorResponse = (code: keyof typeof ERROR_CODES) => (_c: unknown, id: string) =>
  new Response(JSON.stringify(makeApiError(code, id)), {
    status: ERROR_CODES[code],
    headers: { 'content-type': 'application/json' },
  });

const find = (calls: Call[], method: string, path: string) =>
  calls.filter((c) => c.method === method && c.path === path);

const validationError = (issues: { path: string; code: string }[]) => (_c: unknown, id: string) =>
  new Response(JSON.stringify(makeApiError('validation_failed', id, { issues })), {
    status: ERROR_CODES.validation_failed,
    headers: { 'content-type': 'application/json' },
  });

const expired: Invite = {
  ...invite,
  id: uuid(22),
  phone: '+923000000062',
  displayName: 'Test Expired',
  status: 'expired',
};
const accepted: Invite = {
  ...invite,
  id: uuid(23),
  phone: '+923000000063',
  displayName: 'Test Accepted',
  status: 'accepted',
};
const allInvites = {
  ...data,
  'adminRoles.invites': () => ({ items: [invite, expired, accepted] }),
};

describe.each<Locale>(['en', 'ur'])('coordinators page (%s)', (locale) => {
  it('lists invites and people as accessible tables', async () => {
    renderConsole({ role: 'national', locale, path: '/coordinators', handlers: data });
    const invites = await screen.findByRole('table', {
      name: text('console.invites.list.title', locale),
    });
    expect(within(invites).getAllByRole('columnheader').length).toBeGreaterThan(3);
    expect(within(invites).getByRole('rowheader', { name: 'Test Invitee' })).toBeTruthy();
    const people = await screen.findByRole('table', {
      name: text('console.invites.active.title', locale),
    });
    expect(within(people).getAllByRole('row')).toHaveLength(4);
    expect(within(people).getByText('Test Person One')).toBeTruthy();
    expect(document.documentElement.dir).toBe(locale === 'ur' ? 'rtl' : 'ltr');
  });

  it('hides the middle of the number in the invites table but not for the people who hold roles', async () => {
    renderConsole({ role: 'national', path: '/coordinators', handlers: data });
    const invites = await screen.findByRole('table', { name: text('console.invites.list.title') });
    expect(within(invites).getByText('+92••••061')).toBeTruthy();
    expect(within(invites).queryByText(/0000061/)).toBeNull();
  });

  it('draws the handover dialog with a left to right phone field and the resend action', async () => {
    const { user } = renderConsole({
      role: 'national',
      locale,
      path: '/coordinators',
      handlers: data,
    });
    expect(
      await screen.findByRole('button', {
        name: new RegExp(`^${text('console.invites.resend', locale)}`),
      }),
    ).toBeTruthy();
    const row = (await screen.findByText('Test Person One')).closest('tr') as HTMLElement;
    await user.click(
      within(row).getByRole('button', { name: text('console.invites.handover', locale) }),
    );
    const dialog = await screen.findByRole('dialog');
    await user.selectOptions(
      within(dialog).getByLabelText(text('console.invites.handover.mode.label', locale)),
      'phone',
    );
    const phone = within(dialog).getByLabelText(
      new RegExp(text('console.invites.phone.label', locale)),
    );
    expect(phone.getAttribute('dir')).toBe('ltr');
    expect(document.documentElement.dir).toBe(locale === 'ur' ? 'rtl' : 'ltr');
  });

  it('keeps phone numbers left to right even in Urdu', async () => {
    renderConsole({ role: 'national', locale, path: '/coordinators', handlers: data });
    const people = await screen.findByRole('table', {
      name: text('console.invites.active.title', locale),
    });
    const bdi = within(people).getByText('+92 300 0000051');
    expect(bdi.closest('bdi')?.getAttribute('dir')).toBe('ltr');
  });
});

describe('inviting a coordinator', () => {
  it('shows errors and sends nothing when the form is empty', async () => {
    const { user, calls } = renderConsole({
      role: 'national',
      path: '/coordinators',
      handlers: data,
    });
    await user.click(await screen.findByRole('button', { name: text('console.invites.new') }));
    const dialog = await screen.findByRole('dialog', { name: text('console.invites.new') });
    await user.click(within(dialog).getByRole('button', { name: text('console.invites.send') }));
    expect(within(dialog).getByText(text('console.invites.form.role.required'))).toBeTruthy();
    expect(within(dialog).getByText(text('console.phone.error.empty'))).toBeTruthy();
    expect(writes(calls)).toEqual([]);
  });

  it('rejects a number that is not a Pakistan mobile', async () => {
    const { user, calls } = renderConsole({
      role: 'national',
      path: '/coordinators',
      handlers: data,
    });
    await user.click(await screen.findByRole('button', { name: text('console.invites.new') }));
    const dialog = await screen.findByRole('dialog');
    await user.selectOptions(
      within(dialog).getByLabelText(new RegExp(text('console.invites.role.label'))),
      'national_admin',
    );
    await user.type(
      within(dialog).getByLabelText(new RegExp(text('console.invites.phone.label'))),
      '051 2345678',
    );
    await user.click(within(dialog).getByRole('button', { name: text('console.invites.send') }));
    expect(within(dialog).getByText(text('console.phone.error.notMobile'))).toBeTruthy();
    expect(writes(calls)).toEqual([]);
  });

  it('previews the number in international form and sends E.164', async () => {
    const { user, calls } = renderConsole({
      role: 'national',
      path: '/coordinators',
      handlers: {
        ...data,
        'adminRoles.invite': (c: { body: unknown }) => ({ ...invite, ...(c.body as object) }),
      },
    });
    await user.click(await screen.findByRole('button', { name: text('console.invites.new') }));
    const dialog = await screen.findByRole('dialog');
    await user.selectOptions(
      within(dialog).getByLabelText(new RegExp(text('console.invites.role.label'))),
      'city_coordinator',
    );
    await user.selectOptions(
      within(dialog).getByLabelText(new RegExp(text('console.invites.scope.city'))),
      rawalpindi!.id,
    );
    await user.type(
      within(dialog).getByLabelText(new RegExp(text('console.invites.phone.label'))),
      '0300 0000071',
    );
    expect(within(dialog).getByText('Will be saved as +92 300 0000071.')).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: text('console.invites.send') }));
    expect(await screen.findByText(text('console.invites.sent'))).toBeTruthy();
    const sent = find(calls, 'POST', '/v1/admin/invites');
    expect(sent).toHaveLength(1);
    expect(sent[0]?.body).toEqual({
      role: 'city_coordinator',
      cityId: rawalpindi!.id,
      phone: '+923000000071',
    });
  });

  it('points a field the server rejected at that field', async () => {
    const { user } = renderConsole({
      role: 'national',
      path: '/coordinators',
      handlers: {
        ...data,
        'adminRoles.invite': validationError([{ path: 'cityId', code: 'invalid_reference' }]),
      },
    });
    await user.click(await screen.findByRole('button', { name: text('console.invites.new') }));
    const dialog = await screen.findByRole('dialog');
    await user.selectOptions(
      within(dialog).getByLabelText(new RegExp(text('console.invites.role.label'))),
      'city_coordinator',
    );
    const city = within(dialog).getByLabelText(new RegExp(text('console.invites.scope.city')));
    await user.selectOptions(city, rawalpindi!.id);
    await user.type(
      within(dialog).getByLabelText(new RegExp(text('console.invites.phone.label'))),
      '0300 0000073',
    );
    await user.click(within(dialog).getByRole('button', { name: text('console.invites.send') }));
    expect(await within(dialog).findByText(text('console.invites.form.rejected'))).toBeTruthy();
    expect(city.getAttribute('aria-invalid')).toBe('true');
    expect(within(dialog).getByText(text('errors.validation_failed'))).toBeTruthy();
  });

  it('maps a server error code to its errors.* message', async () => {
    const { user } = renderConsole({
      role: 'national',
      path: '/coordinators',
      handlers: { ...data, 'adminRoles.invite': errorResponse('role_already_assigned') },
    });
    await user.click(await screen.findByRole('button', { name: text('console.invites.new') }));
    const dialog = await screen.findByRole('dialog');
    await user.selectOptions(
      within(dialog).getByLabelText(new RegExp(text('console.invites.role.label'))),
      'national_admin',
    );
    await user.type(
      within(dialog).getByLabelText(new RegExp(text('console.invites.phone.label'))),
      '0300 0000072',
    );
    await user.click(within(dialog).getByRole('button', { name: text('console.invites.send') }));
    expect(await within(dialog).findByText(text('errors.role_already_assigned'))).toBeTruthy();
  });

  it('offers a city coordinator only the roles they may give, inside their own city', async () => {
    const { user } = renderConsole({ role: 'city', path: '/coordinators', handlers: data });
    await user.click(await screen.findByRole('button', { name: text('console.invites.new') }));
    const dialog = await screen.findByRole('dialog');
    const role = within(dialog).getByLabelText(
      new RegExp(text('console.invites.role.label')),
    ) as HTMLSelectElement;
    const options = within(role)
      .getAllByRole('option')
      .map((o) => (o as HTMLOptionElement).value)
      .filter(Boolean);
    expect(options).toEqual(['venue_coordinator']);
    const venue = await within(dialog).findByLabelText(
      new RegExp(text('console.invites.scope.venue')),
    );
    const venues = within(venue)
      .getAllByRole('option')
      .map((o) => (o as HTMLOptionElement).value)
      .filter(Boolean);
    expect(venues).toContain(venueA!.id);
    expect(venues.length).toBeGreaterThan(0);
  });

  it('does not offer to invite anyone to a venue coordinator', async () => {
    renderConsole({ role: 'venue', path: '/coordinators', handlers: data });
    expect(await screen.findByText(text('console.shell.forbidden.title'))).toBeTruthy();
  });
});

describe('handover and removal', () => {
  it('hands a venue to someone who already has a role, replacing the old assignment', async () => {
    const { user, calls } = renderConsole({
      role: 'national',
      path: '/coordinators',
      handlers: { ...data, 'adminRoles.assign': () => ({ ...personB, id: uuid(9) }) },
    });
    const people = await screen.findByRole('table', { name: text('console.invites.active.title') });
    const row = within(people).getByText('Test Person One').closest('tr') as HTMLElement;
    await user.click(within(row).getByRole('button', { name: text('console.invites.handover') }));
    const dialog = await screen.findByRole('dialog');
    const select = await within(dialog).findByLabelText(
      new RegExp(text('console.invites.handover.person.label')),
    );
    // The person being replaced is not offered.
    expect(within(select).queryByText(/Test Person One/)).toBeNull();
    await user.click(
      within(dialog).getByRole('button', { name: text('console.invites.handover.submit') }),
    );
    expect(within(dialog).getByText(text('console.invites.handover.person.required'))).toBeTruthy();
    expect(writes(calls)).toEqual([]);

    await user.selectOptions(select, personB.userId);
    await user.click(
      within(dialog).getByRole('button', { name: text('console.invites.handover.submit') }),
    );
    expect(await screen.findByText(text('console.invites.handedOver'))).toBeTruthy();
    const posts = find(calls, 'POST', '/v1/admin/role-assignments');
    expect(posts).toHaveLength(1);
    expect(posts[0]?.body).toEqual({
      role: 'venue_coordinator',
      venueId: venueA!.id,
      userId: personB.userId,
      replacesAssignmentId: personA.id,
    });
  });

  it('offers a phone number when nobody else holds a role, and says so', async () => {
    const { user } = renderConsole({
      role: 'national',
      path: '/coordinators',
      handlers: { ...data, 'adminRoles.list': () => ({ items: [personA], nextCursor: null }) },
    });
    await user.click(await screen.findByRole('button', { name: text('console.invites.handover') }));
    const dialog = await screen.findByRole('dialog');
    const mode = within(dialog).getByLabelText(
      text('console.invites.handover.mode.label'),
    ) as HTMLSelectElement;
    await waitFor(() => expect(mode.value).toBe('phone'));
    expect(
      within(dialog).getByLabelText(new RegExp(text('console.invites.phone.label'))),
    ).toBeTruthy();
    await user.selectOptions(mode, 'existing');
    expect(
      await within(dialog).findByText(text('console.invites.handover.nobodyYet')),
    ).toBeTruthy();
    expect(
      within(dialog).getByRole('button', { name: text('console.invites.handover.submit') }),
    ).toHaveProperty('disabled', true);
  });

  it('hands a venue over to a phone number with an invite that replaces the old assignment', async () => {
    const { user, calls } = renderConsole({
      role: 'national',
      path: '/coordinators',
      handlers: {
        ...data,
        'adminRoles.invite': (c: { body: unknown }) => ({ ...invite, ...(c.body as object) }),
      },
    });
    const people = await screen.findByRole('table', { name: text('console.invites.active.title') });
    const row = within(people).getByText('Test Person One').closest('tr') as HTMLElement;
    await user.click(within(row).getByRole('button', { name: text('console.invites.handover') }));
    const dialog = await screen.findByRole('dialog');
    await user.selectOptions(
      within(dialog).getByLabelText(text('console.invites.handover.mode.label')),
      'phone',
    );
    expect(within(dialog).getByText(/When they accept it, they get access/)).toBeTruthy();
    const send = within(dialog).getByRole('button', {
      name: text('console.invites.handover.sendInvite'),
    });
    await user.click(send);
    expect(within(dialog).getByText(text('console.phone.error.empty'))).toBeTruthy();
    expect(writes(calls)).toEqual([]);

    await user.type(
      within(dialog).getByLabelText(new RegExp(text('console.invites.phone.label'))),
      '0300 0000074',
    );
    await user.click(send);
    expect(await screen.findByText(text('console.invites.handoverInvited'))).toBeTruthy();
    const sent = find(calls, 'POST', '/v1/admin/invites');
    expect(sent).toHaveLength(1);
    expect(sent[0]?.body).toEqual({
      role: 'venue_coordinator',
      venueId: venueA!.id,
      phone: '+923000000074',
      replacesAssignmentId: personA.id,
    });
    expect(find(calls, 'POST', '/v1/admin/role-assignments')).toEqual([]);
  });

  it('points a handover number the server refused at the phone field', async () => {
    const { user } = renderConsole({
      role: 'national',
      path: '/coordinators',
      handlers: {
        ...data,
        'adminRoles.invite': validationError([{ path: 'phone', code: 'invalid_format' }]),
      },
    });
    const row = (await screen.findByText('Test Person Two')).closest('tr') as HTMLElement;
    await user.click(within(row).getByRole('button', { name: text('console.invites.handover') }));
    const dialog = await screen.findByRole('dialog');
    await user.selectOptions(
      within(dialog).getByLabelText(text('console.invites.handover.mode.label')),
      'phone',
    );
    const phone = within(dialog).getByLabelText(new RegExp(text('console.invites.phone.label')));
    await user.type(phone, '0300 0000075');
    await user.click(
      within(dialog).getByRole('button', { name: text('console.invites.handover.sendInvite') }),
    );
    expect(await within(dialog).findByText(text('console.phone.error.invalid'))).toBeTruthy();
    expect(phone.getAttribute('aria-invalid')).toBe('true');
  });

  it('does not offer a national admin a handover, only removal', async () => {
    const admin: StaffRoleAssignment = {
      ...personA,
      id: uuid(4),
      userName: 'Test Admin',
      role: 'national_admin',
      scopeType: 'national',
      cityId: null,
      venueId: null,
      scopeName: null,
    };
    renderConsole({
      role: 'national',
      path: '/coordinators',
      handlers: { ...data, 'adminRoles.list': () => ({ items: [admin], nextCursor: null }) },
    });
    const row = (await screen.findByText('Test Admin')).closest('tr') as HTMLElement;
    expect(
      within(row).queryByRole('button', { name: text('console.invites.handover') }),
    ).toBeNull();
    expect(within(row).getByRole('button', { name: text('console.invites.remove') })).toBeTruthy();
  });

  it('does not offer city coordinators a way to remove or hand over their own city', async () => {
    renderConsole({ role: 'city', path: '/coordinators', handlers: data });
    const row = (await screen.findByText('Test Person Three')).closest('tr') as HTMLElement;
    expect(within(row).queryByRole('button')).toBeNull();
    const venueRow = screen.getByText('Test Person One').closest('tr') as HTMLElement;
    expect(
      within(venueRow).getByRole('button', { name: text('console.invites.handover') }),
    ).toBeTruthy();
  });

  it('asks before removing access, and keeps it when the person backs out', async () => {
    const { user, calls } = renderConsole({
      role: 'national',
      path: '/coordinators',
      handlers: { ...data, 'adminRoles.revoke': () => new Response(null, { status: 204 }) },
    });
    const row = (await screen.findByText('Test Person Two')).closest('tr') as HTMLElement;
    await user.click(within(row).getByRole('button', { name: text('console.invites.remove') }));
    let dialog = await screen.findByRole('dialog', { name: text('console.invites.remove.title') });
    await user.click(within(dialog).getByRole('button', { name: text('console.shell.keep') }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(writes(calls)).toEqual([]);

    await user.click(within(row).getByRole('button', { name: text('console.invites.remove') }));
    dialog = await screen.findByRole('dialog', { name: text('console.invites.remove.title') });
    await user.click(
      within(dialog).getByRole('button', { name: text('console.invites.remove.confirm') }),
    );
    expect(await screen.findByText(text('console.invites.removed'))).toBeTruthy();
    expect(find(calls, 'DELETE', `/v1/admin/role-assignments/${personB.id}`)).toHaveLength(1);
  });

  it('cancels an invite only after confirmation', async () => {
    const { user, calls } = renderConsole({
      role: 'national',
      path: '/coordinators',
      handlers: { ...data, 'adminRoles.revokeInvite': () => new Response(null, { status: 204 }) },
    });
    await user.click(
      await screen.findByRole('button', {
        name: `${text('console.invites.revoke')} for the number ending 061`,
      }),
    );
    expect(writes(calls)).toEqual([]);
    const dialog = await screen.findByRole('dialog', {
      name: text('console.invites.revoke.title'),
    });
    await user.click(
      within(dialog).getByRole('button', { name: text('console.invites.revoke.confirm') }),
    );
    expect(await screen.findByText(text('console.invites.revoked'))).toBeTruthy();
    expect(find(calls, 'DELETE', `/v1/admin/invites/${invite.id}`)).toHaveLength(1);
  });

  it('shows why a removal failed inside the dialog', async () => {
    const { user } = renderConsole({
      role: 'national',
      path: '/coordinators',
      handlers: data,
      forceError: (c) => (c.method === 'DELETE' ? 'last_national_admin' : undefined),
    });
    const row = (await screen.findByText('Test Person Two')).closest('tr') as HTMLElement;
    await user.click(within(row).getByRole('button', { name: text('console.invites.remove') }));
    const dialog = await screen.findByRole('dialog');
    await user.click(
      within(dialog).getByRole('button', { name: text('console.invites.remove.confirm') }),
    );
    expect(await within(dialog).findByText(text('errors.last_national_admin'))).toBeTruthy();
  });
});

describe('invite status and resend', () => {
  it('filters invites by status, showing all of them at first', async () => {
    const { user } = renderConsole({
      role: 'national',
      path: '/coordinators',
      handlers: allInvites,
    });
    const table = await screen.findByRole('table', { name: text('console.invites.list.title') });
    expect(within(table).getAllByRole('row')).toHaveLength(4);
    const filter = screen.getByLabelText(text('console.invites.filter.label'));
    await user.selectOptions(filter, 'accepted');
    const narrowed = screen.getByRole('table', { name: text('console.invites.list.title') });
    expect(
      within(narrowed)
        .getAllByRole('rowheader')
        .map((r) => r.textContent),
    ).toEqual(['Test Accepted']);
    await user.selectOptions(filter, 'revoked');
    expect(screen.getByText(text('console.invites.filter.empty'))).toBeTruthy();
  });

  it('offers Send again for waiting and expired invites, and Cancel only while waiting', async () => {
    renderConsole({ role: 'national', path: '/coordinators', handlers: allInvites });
    const resend = (digits: string) =>
      screen.queryByRole('button', {
        name: `${text('console.invites.resend')} for the number ending ${digits}`,
      });
    const cancel = (digits: string) =>
      screen.queryByRole('button', {
        name: `${text('console.invites.revoke')} for the number ending ${digits}`,
      });
    await screen.findByRole('table', { name: text('console.invites.list.title') });
    expect(resend('061')).toBeTruthy();
    expect(cancel('061')).toBeTruthy();
    expect(resend('062')).toBeTruthy();
    expect(cancel('062')).toBeNull();
    expect(resend('063')).toBeNull();
    expect(cancel('063')).toBeNull();
  });

  it('sends an invite again as a new invite for the same number, role and place', async () => {
    const { user, calls } = renderConsole({
      role: 'national',
      path: '/coordinators',
      handlers: {
        ...allInvites,
        'adminRoles.invite': (c: { body: unknown }) => ({ ...invite, ...(c.body as object) }),
      },
    });
    await user.click(
      await screen.findByRole('button', {
        name: `${text('console.invites.resend')} for the number ending 062`,
      }),
    );
    expect(await screen.findByText(text('console.invites.resent'))).toBeTruthy();
    const sent = find(calls, 'POST', '/v1/admin/invites');
    expect(sent).toHaveLength(1);
    expect(sent[0]?.body).toEqual({
      role: 'venue_coordinator',
      venueId: venueA!.id,
      phone: '+923000000062',
      displayName: 'Test Expired',
    });
  });

  it('shows why sending again failed', async () => {
    const { user } = renderConsole({
      role: 'national',
      path: '/coordinators',
      handlers: allInvites,
      forceError: (c) =>
        c.method === 'POST' && c.path === '/v1/admin/invites' ? 'rate_limited' : undefined,
    });
    await user.click(
      await screen.findByRole('button', {
        name: `${text('console.invites.resend')} for the number ending 061`,
      }),
    );
    expect(await screen.findByText(text('errors.rate_limited'))).toBeTruthy();
  });

  it('lets a city coordinator send again only the invites in their city', async () => {
    const elsewhere: Invite = {
      ...invite,
      id: uuid(24),
      phone: '+923000000064',
      displayName: 'Test Elsewhere',
      venueId: venues[2]!.id,
    };
    renderConsole({
      role: 'city',
      path: '/coordinators',
      handlers: { ...data, 'adminRoles.invites': () => ({ items: [invite, elsewhere] }) },
    });
    await screen.findByRole('table', { name: text('console.invites.list.title') });
    const resendFor = (digits: string) =>
      screen.queryByRole('button', {
        name: `${text('console.invites.resend')} for the number ending ${digits}`,
      });
    expect(resendFor('061')).toBeTruthy();
    // The other invite is for a venue in another city.
    expect(venues[2]!.cityId).not.toBe(rawalpindi!.id);
    expect(resendFor('064')).toBeNull();
  });
});
