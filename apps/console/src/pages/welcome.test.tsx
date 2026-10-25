import { describe, expect, it } from 'vitest';
import type { Locale } from '../i18n';
import { renderConsole, screen, text } from '../test/harness';

describe('welcome page', () => {
  it.each<Locale>(['en', 'ur'])(
    'greets a signed-out person and leads to sign in (%s)',
    async (locale) => {
      const { user } = renderConsole({ signedIn: false, path: '/sessions', locale });
      expect(
        await screen.findByRole('heading', {
          level: 1,
          name: text('console.welcome.title', locale),
        }),
      ).toBeTruthy();
      expect(screen.getByText(text('console.welcome.invitedOnly', locale))).toBeTruthy();
      await user.click(screen.getByRole('link', { name: text('console.welcome.signIn', locale) }));
      expect(
        await screen.findByRole('heading', {
          level: 1,
          name: text('console.signIn.title', locale),
        }),
      ).toBeTruthy();
    },
  );

  it('does not show a signed-in person the welcome page', async () => {
    renderConsole({ role: 'national', path: '/welcome' });
    expect(
      await screen.findByRole('heading', { level: 1, name: text('console.sessions.title') }),
    ).toBeTruthy();
  });
});
