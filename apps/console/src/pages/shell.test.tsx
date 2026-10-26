import { within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  renderConsole,
  screen,
  emailField,
  shellReady,
  text,
  waitFor,
  writes,
  type TestRole,
} from '../test/harness';
import type { Locale } from '../i18n';

// The mock config has the rc.4 flags on, so the ayah of the day page is in every staff menu.
// The menu follows the console artboard's order.
// Registrations and QR posters open the sessions list first; they belong to one session each.
const NAV: Record<Exclude<TestRole, 'none'>, string[]> = {
  venue: ['venues', 'sessions', 'registrations', 'dailyAyahs', 'posters', 'exports'],
  city: [
    'venues',
    'sessions',
    'coordinators',
    'registrations',
    'dailyAyahs',
    'posters',
    'import',
    'exports',
    'audit',
  ],
  national: [
    'venues',
    'sessions',
    'coordinators',
    'registrations',
    'dailyAyahs',
    'posters',
    'import',
    'exports',
    'audit',
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
          .map((a) => a.querySelector('.nav-label')?.textContent),
      ).toEqual(expected),
    );
  });

  it('puts everything on the screen in a landmark (A-08)', async () => {
    renderConsole({ role: 'national', locale, path: '/sessions' });
    await shellReady(locale);
    // The page's own header sits inside main, where it is no banner; the sidebar is the one.
    const banner = document.querySelector('header.sidebar') as HTMLElement;
    expect(banner.closest('main')).toBeNull();
    expect(within(banner).getByText(text('app.name', locale))).toBeTruthy();
    expect(
      within(banner).getByRole('navigation', { name: text('console.shell.navLabel', locale) }),
    ).toBeTruthy();
    expect(
      within(banner).getByRole('button', { name: text('console.shell.signOut', locale) }),
    ).toBeTruthy();
    const tools = screen.getByRole('region', { name: text('console.shell.toolsLabel', locale) });
    expect(within(tools).getByLabelText(text('console.shell.language', locale))).toBeTruthy();
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getByRole('contentinfo')).toBeTruthy();
    // Nothing with text sits directly in the shell outside those landmarks.
    const shell = document.querySelector('.shell') as HTMLElement;
    const outside = [...shell.children].filter(
      (el) =>
        !el.matches('header, main, nav, footer, section[aria-label], .skip-link') &&
        !el.querySelector('header, main, nav, footer, section[aria-label]') &&
        (el.textContent ?? '').trim() !== '',
    );
    expect(outside).toEqual([]);
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
  it('sends a signed-out person to sign in and rejects a bad email before any request', async () => {
    const { user, calls } = renderConsole({ signedIn: false, path: '/sessions' });
    const email = await emailField(user);
    await user.type(email, 'coordinator@');
    await user.click(screen.getByRole('button', { name: text('console.signIn.sendCode') }));
    expect(await screen.findByText(text('console.signIn.email.invalid'))).toBeTruthy();
    expect(writes(calls)).toEqual([]);
  });

  it('signs in with the email code and lands on the first allowed page', async () => {
    const { user, calls, tokenStore } = renderConsole({
      role: 'city',
      signedIn: false,
      path: '/sessions',
    });
    await user.type(await emailField(user), 'coordinator@example.com');
    await user.click(screen.getByRole('button', { name: text('console.signIn.sendCode') }));
    const code = await screen.findByLabelText(new RegExp(text('console.signIn.code.label')));
    expect(calls.find((c) => c.path === '/v1/auth/code')?.body).toMatchObject({
      email: 'coordinator@example.com',
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
    await user.type(await emailField(user), 'coordinator@example.com');
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
    await user.type(await emailField(user), 'coordinator@example.com');
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
    await user.type(await emailField(user), 'coordinator@example.com');
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
    expect(await emailField(user)).toBeTruthy();
    expect(tokenStore.get('qc.console.refresh')).toBeNull();
  });
});
