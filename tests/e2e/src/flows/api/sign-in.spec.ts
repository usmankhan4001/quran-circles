import { expect, test } from '@playwright/test';
import { ApiClientError } from '@qc/contracts';
import { client } from '../../support/client';
import { stack } from '../../support/env';
import { bootstrapNationalAdmin, signIn, syntheticPhone } from '../../support/people';
import { db } from '../../support/db';
import { SEED } from '../../support/seed';

/** Gate 3: "sign in with a code, as an attendee and as an invited coordinator". */
test.describe('code sign-in', () => {
  test('attendee: new account, refresh, sign-out', async () => {
    const person = await signIn();
    expect(person.isNewAccount).toBe(true);
    expect(person.me.phone).toBe(person.phone);
    expect(person.me.roles).toEqual([]);

    const me = await person.api.me.get();
    expect(me.id).toBe(person.me.id);

    // A second code for the same number straight away is held back by the resend wait.
    const anon = client({ ip: person.ip });
    const tooSoon = await anon.auth
      .requestCode({ body: { phone: person.phone, locale: 'en', channel: 'whatsapp' } })
      .catch((e: unknown) => e);
    expect(tooSoon).toBeInstanceOf(ApiClientError);
    expect((tooSoon as ApiClientError).code).toBe('rate_limited');
    expect((tooSoon as ApiClientError).retryAfterSeconds).toBeGreaterThan(0);

    const refreshed = await anon.auth.refresh({ body: { refreshToken: person.refreshToken } });
    expect(refreshed.accessToken).not.toBe('');
    person.accessToken = refreshed.accessToken;
    await expect(person.api.me.get()).resolves.toMatchObject({ id: person.me.id });

    await person.api.auth.signOut({ body: { refreshToken: refreshed.refreshToken } });
    const after = await person.api.me.get().catch((e: unknown) => e);
    expect(after).toBeInstanceOf(ApiClientError);
    expect((after as ApiClientError).status).toBe(401);
  });

  test('a wrong code is refused and does not sign in', async () => {
    const anon = client({ ip: '10.250.0.1' });
    const challenge = await anon.auth.requestCode({
      body: { phone: syntheticPhone(), locale: 'en', channel: 'whatsapp' },
    });
    const wrong = stack().fixedCode === '000000' ? '111111' : '000000';
    const error = await anon.auth
      .verifyCode({ body: { challengeId: challenge.challengeId, code: wrong } })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiClientError);
    expect((error as ApiClientError).status).toBeGreaterThanOrEqual(400);
    expect((error as ApiClientError).status).toBeLessThan(500);
  });

  test('invited venue coordinator: invite through the API, sign in, hold the role', async () => {
    const admin = await bootstrapNationalAdmin();
    const phone = syntheticPhone();
    const invite = await admin.api.adminRoles.invite({
      body: { role: 'venue_coordinator', venueId: SEED.venueNoor, phone, displayName: 'E2E Coord' },
    });
    expect(invite.status).toBe('pending');

    const coordinator = await signIn(phone);
    const role = coordinator.me.roles.find((r) => r.role === 'venue_coordinator');
    expect(role).toMatchObject({ scopeType: 'venue', venueId: SEED.venueNoor });
    expect(coordinator.me.displayName).toBe('E2E Coord');

    const { rows } = await db().query<{ status: string }>(
      'select status from coordinator_invites where id = $1',
      [invite.id],
    );
    expect(rows[0]?.status).toBe('accepted');

    // The role works at once: the coordinator can list their own venue's sessions.
    const sessions = await coordinator.api.adminSessions.list({ query: {} });
    expect(sessions.items.length).toBeGreaterThan(0);
    expect(sessions.items.every((s) => s.venueId === SEED.venueNoor)).toBe(true);
  });
});
