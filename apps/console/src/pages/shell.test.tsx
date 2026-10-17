import { within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  renderConsole,
  screen,
  shellReady,
  text,
  waitFor,
  writes,
  type TestRole,
} from '../test/harness';
import type { Locale } from '../i18n';

// The mock config has the rc.4 flags on, so the ayah of the day page is in every staff menu.
const NAV: Record<Exclude<TestRole, 'none'>, string[]> = {
  venue: ['sessions', 'venues', 'exports', 'dailyAyahs'],
  city: ['sessions', 'venues', 'exports', 'coordinators', 'import', 'audit', 'dailyAyahs'],
  national: [
    'sessions',
    'venues',
    'exports',
    'coordinators',
    'import',
    'audit',
    'dailyAyahs',
    'settings',
  ],
};

describe.each<Locale>(['en', 'ur'])('console shell (%s)', (locale) => {
  it.each(Object.keys(NAV) as (keyof typeof NAV)[])('shows only what a %s can do', async (role) => {
    renderConsole({ role, locale, path: '/sessions' });
    await shellReady(locale);
    const nav = screen.getByRole('navigation', { name: text('console.shell.navLabel', locale) });
    const expected = NAV[role].map((id) =>
      text(`console.nav.${id}` as 'console.nav.audit', locale),
    );
    // Flagged pages join the menu once the config has loaded.
    await waitFor(() =>
      expect(
        within(nav)
          .getAllByRole('link')
          .map((a) => a.textContent),
      ).toEqual(expected),
    );
  });

  it('sets the page language and direction', async () => {
    renderConsole({ role: 'national', locale, path: '/sessions' });
    await shellReady(locale);
    expect(document.documentElement.lang).toBe(locale);
    expect(document.documentElement.dir).toBe(locale === 'ur' ? 'rtl' : 'ltr');
  });
});

describe('page guards', () => {
  it('shows a plain explanation, not the page, when the role does not unlock it', async () => {
    const { calls } = renderConsole({ role: 'venue', path: '/settings' });
    expect(await screen.findByText(text('console.shell.forbidden.title'))).toBeTruthy();
    expect(calls.some((c) => c.path === '/v1/admin/settings')).toBe(false);
  });

  it('keeps a city coordinator out of settings but lets a national admin in', async () => {
    const city = renderConsole({ role: 'city', path: '/settings' });
    expect(await screen.findByText(text('console.shell.forbidden.title'))).toBeTruthy();
    city.unmount();
    renderConsole({ role: 'national', path: '/settings' });
    expect(await screen.findByLabelText(text('console.settings.hijri.label'))).toBeTruthy();
  });

  it('keeps a venue coordinator out of the import and the audit log', async () => {
    const first = renderConsole({ role: 'venue', path: '/import' });
    expect(await screen.findByText(text('console.shell.forbidden.title'))).toBeTruthy();
    first.unmount();
    renderConsole({ role: 'venue', path: '/audit' });
    expect(await screen.findByText(text('console.shell.forbidden.title'))).toBeTruthy();
  });

  it('opens the first page the person can use from the home address', async () => {
    renderConsole({ role: 'venue', path: '/' });
    expect(
      await screen.findByRole('heading', { level: 1, name: text('console.sessions.title') }),
    ).toBeTruthy();
  });

  it('shows a not found page for an unknown address', async () => {
    renderConsole({ role: 'national', path: '/nope' });
    expect(await screen.findByText(text('console.shell.notFound.title'))).toBeTruthy();
  });
});

describe('sign in', () => {
  it('sends a signed-out person to sign in and rejects a bad number before any request', async () => {
    const { user, calls } = renderConsole({ signedIn: false, path: '/sessions' });
    const phone = await screen.findByLabelText(new RegExp(text('console.signIn.phone.label')));
    await user.type(phone, '12345');
    await user.click(screen.getByRole('button', { name: text('console.signIn.sendCode') }));
    expect(await screen.findByText(text('console.phone.error.invalid'))).toBeTruthy();
    expect(writes(calls)).toEqual([]);
  });

  it('signs in with the phone code and lands on the first allowed page', async () => {
    const { user, calls, tokenStore } = renderConsole({
      role: 'city',
      signedIn: false,
      path: '/sessions',
    });
    await user.type(
      await screen.findByLabelText(new RegExp(text('console.signIn.phone.label'))),
      '0300 0000099',
    );
    await user.click(screen.getByRole('button', { name: text('console.signIn.sendCode') }));
    const code = await screen.findByLabelText(new RegExp(text('console.signIn.code.label')));
    expect(calls.find((c) => c.path === '/v1/auth/code')?.body).toMatchObject({
      phone: '+923000000099',
    });
    await user.type(code, '123456');
    await user.click(screen.getByRole('button', { name: text('console.signIn.verify') }));
    expect(
      await screen.findByRole('heading', { level: 1, name: text('console.sessions.title') }),
    ).toBeTruthy();
    expect(tokenStore.get('qc.console.refresh')).toBe('mock-refresh-token-2222');
  });

  it('maps a wrong code to the otp_invalid message', async () => {
    const { user } = renderConsole({ signedIn: false });
    await user.type(
      await screen.findByLabelText(new RegExp(text('console.signIn.phone.label'))),
      '03000000099',
    );
    await user.click(screen.getByRole('button', { name: text('console.signIn.sendCode') }));
    await user.type(
      await screen.findByLabelText(new RegExp(text('console.signIn.code.label'))),
      '000000',
    );
    await user.click(screen.getByRole('button', { name: text('console.signIn.verify') }));
    expect(await screen.findByText(text('errors.otp_invalid'))).toBeTruthy();
  });

  it('refuses a code with fewer than 6 digits without calling the API', async () => {
    const { user, calls } = renderConsole({ signedIn: false });
    await user.type(
      await screen.findByLabelText(new RegExp(text('console.signIn.phone.label'))),
      '03000000099',
    );
    await user.click(screen.getByRole('button', { name: text('console.signIn.sendCode') }));
    await user.type(
      await screen.findByLabelText(new RegExp(text('console.signIn.code.label'))),
      '123',
    );
    await user.click(screen.getByRole('button', { name: text('console.signIn.verify') }));
    expect(await screen.findByText(text('console.signIn.code.invalid'))).toBeTruthy();
    expect(calls.some((c) => c.path === '/v1/auth/verify')).toBe(false);
  });

  it('tells an account with no console role that it has no access, and signs it out', async () => {
    const { user, tokenStore } = renderConsole({ role: 'none', signedIn: false });
    await user.type(
      await screen.findByLabelText(new RegExp(text('console.signIn.phone.label'))),
      '03000000099',
    );
    await user.click(screen.getByRole('button', { name: text('console.signIn.sendCode') }));
    await user.type(
      await screen.findByLabelText(new RegExp(text('console.signIn.code.label'))),
      '123456',
    );
    await user.click(screen.getByRole('button', { name: text('console.signIn.verify') }));
    expect(await screen.findByText(text('console.signIn.noAccess.title'))).toBeTruthy();
    expect(tokenStore.get('qc.console.refresh')).toBeNull();
  });

  it('signs out and returns to sign in', async () => {
    const { user, tokenStore } = renderConsole({ role: 'national', path: '/sessions' });
    await shellReady();
    await user.click(screen.getByRole('button', { name: text('console.shell.signOut') }));
    expect(
      await screen.findByLabelText(new RegExp(text('console.signIn.phone.label'))),
    ).toBeTruthy();
    expect(tokenStore.get('qc.console.refresh')).toBeNull();
  });
});
