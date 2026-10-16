import { within } from '@testing-library/react';
import { ERROR_CODES, makeApiError, type Invite } from '@qc/contracts';
import { describe, expect, it } from 'vitest';
import type { StaffRoleAssignment } from '../api/types';
import type { Locale } from '../i18n';
import { rawalpindi, venueA, venueB } from '../test/people';
import { renderConsole, screen, text, writes, type Call } from '../test/harness';

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

  it('says so when there is nobody to hand over to', async () => {
    const { user } = renderConsole({
      role: 'national',
      path: '/coordinators',
      handlers: { ...data, 'adminRoles.list': () => ({ items: [personA], nextCursor: null }) },
    });
    await user.click(await screen.findByRole('button', { name: text('console.invites.handover') }));
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText(text('console.invites.handover.nobody'))).toBeTruthy();
    expect(
      within(dialog).getByRole('button', { name: text('console.invites.handover.submit') }),
    ).toHaveProperty('disabled', true);
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
