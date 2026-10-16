import { describe, expect, it } from 'vitest';
import { renderConsole, screen, text, waitFor } from '../test/harness';

describe('keeping the sign-in alive', () => {
  it('refreshes once and retries when the access token has expired', async () => {
    let refreshes = 0;
    const { calls } = renderConsole({
      role: 'national',
      path: '/sessions',
      handlers: {
        // The first token is already expired; the second one works.
        'auth.refresh': () => {
          refreshes += 1;
          return {
            accessToken: refreshes === 1 ? 'mock-expired' : 'mock-staff',
            accessTokenExpiresAt: '2027-02-15T09:00:00Z',
            refreshToken: `mock-refresh-token-${refreshes}`,
            refreshTokenExpiresAt: '2027-03-15T08:00:00Z',
          };
        },
      },
    });
    expect(await screen.findByRole('table', { name: text('console.sessions.title') })).toBeTruthy();
    expect(refreshes).toBe(2);
    expect(calls.filter((c) => c.path === '/v1/me')).toHaveLength(2);
  });

  it('sends the person to sign in when the refresh token is refused, and forgets it', async () => {
    const { tokenStore } = renderConsole({
      role: 'national',
      path: '/sessions',
      forceError: (c) => (c.path === '/v1/auth/refresh' ? 'refresh_token_invalid' : undefined),
    });
    expect(
      await screen.findByLabelText(new RegExp(text('console.signIn.phone.label'))),
    ).toBeTruthy();
    await waitFor(() => expect(tokenStore.get('qc.console.refresh')).toBeNull());
  });

  it('keeps the refresh token when only the network failed', async () => {
    const { tokenStore } = renderConsole({
      role: 'national',
      path: '/sessions',
      forceError: (c) => (c.path === '/v1/auth/refresh' ? 'service_unavailable' : undefined),
    });
    expect(
      await screen.findByLabelText(new RegExp(text('console.signIn.phone.label'))),
    ).toBeTruthy();
    expect(tokenStore.get('qc.console.refresh')).toBe('mock-refresh-token-0000');
  });

  it('signs out when a later request shows the sign-in is gone', async () => {
    let fail = false;
    const { user } = renderConsole({
      role: 'national',
      path: '/venues',
      forceError: (c) => (fail && c.path === '/v1/admin/sessions' ? 'unauthenticated' : undefined),
    });
    await screen.findByRole('table');
    fail = true;
    await user.click(screen.getByRole('link', { name: text('console.nav.sessions') }));
    expect(
      await screen.findByLabelText(new RegExp(text('console.signIn.phone.label'))),
    ).toBeTruthy();
  });
});
