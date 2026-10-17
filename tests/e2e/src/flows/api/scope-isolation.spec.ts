import { expect, test } from '@playwright/test';
import { ApiClientError } from '@qc/contracts';
import {
  bootstrapNationalAdmin,
  inviteVenueCoordinator,
  signIn,
  syntheticPhone,
  type Person,
} from '../../support/people';
import { SEED } from '../../support/seed';

/** What a refused call answered. Refusals must be 403 or 404 and never leak data. */
async function refusal(call: Promise<unknown>): Promise<number> {
  const result = await call.then(
    () => null,
    (e: unknown) => e,
  );
  if (!(result instanceof ApiClientError)) throw new Error('expected the call to be refused');
  return result.status;
}

/**
 * Brief WP11: "scope isolation: a venue coordinator cannot reach another venue's data", through
 * the real sign-in and real role resolution (the API's own matrix tests use an injected principal).
 */
test.describe('scope isolation', () => {
  let coordinator: Person;
  let otherVenueSession: string;

  test.beforeAll(async () => {
    const admin = await bootstrapNationalAdmin();
    coordinator = await inviteVenueCoordinator(admin, SEED.venueNoor);
    otherVenueSession = SEED.sessionWomenIqra; // Iqra: same city, different venue.
  });

  test('lists only show the coordinator’s own venue', async () => {
    const venues = await coordinator.api.adminVenues.list({ query: {} });
    expect(venues.items.map((v) => v.id)).toEqual([SEED.venueNoor]);
    const sessions = await coordinator.api.adminSessions.list({ query: {} });
    expect(sessions.items.length).toBeGreaterThan(0);
    expect(sessions.items.every((s) => s.venueId === SEED.venueNoor)).toBe(true);
    const filtered = await coordinator.api.adminSessions
      .list({ query: { venueId: SEED.venueIqra } })
      .then((r) => r.items.length)
      .catch((e: unknown) => (e instanceof ApiClientError ? e.status : -1));
    expect([0, 403]).toContain(filtered);
  });

  test('another venue’s session, registrants and export are refused', async () => {
    expect([403, 404]).toContain(
      await refusal(
        coordinator.api.adminSessions.get({ params: { sessionId: otherVenueSession } }),
      ),
    );
    expect([403, 404]).toContain(
      await refusal(
        coordinator.api.registrations.forSession({
          params: { sessionId: otherVenueSession },
          query: {},
        }),
      ),
    );
    expect([403, 404]).toContain(
      await refusal(
        coordinator.api.adminRegistrations.export({ query: { venueId: SEED.venueIqra } }),
      ),
    );
  });

  test('cannot post to, change, or staff another venue', async () => {
    expect([403, 404]).toContain(
      await refusal(
        coordinator.api.adminUpdates.post({
          body: {
            scope: { type: 'venue', venueId: SEED.venueIqra },
            title: { en: 'Should not post' },
            body: { en: 'Out of scope.' },
          },
        }),
      ),
    );
    expect([403, 404]).toContain(
      await refusal(
        coordinator.api.adminUpdates.post({
          body: {
            scope: { type: 'city', cityId: SEED.rawalpindi },
            title: { en: 'Should not post' },
            body: { en: 'City scope is above a venue coordinator.' },
          },
        }),
      ),
    );
    expect([403, 404]).toContain(
      await refusal(
        coordinator.api.adminSessions.changeSchedule({
          params: { sessionId: otherVenueSession },
          body: { localStartTime: '05:00', effectiveFrom: '2027-02-15', notify: false },
        }),
      ),
    );
    expect([403, 404]).toContain(
      await refusal(
        coordinator.api.adminRoles.invite({
          body: { role: 'venue_coordinator', venueId: SEED.venueIqra, phone: syntheticPhone() },
        }),
      ),
    );
  });

  test('an attendee reaches no staff endpoint', async () => {
    const attendee = await signIn();
    expect(await refusal(attendee.api.adminSessions.list({ query: {} }))).toBe(403);
    expect(await refusal(attendee.api.adminVenues.list({ query: {} }))).toBe(403);
    expect(
      await refusal(
        attendee.api.registrations.forSession({
          params: { sessionId: SEED.sessionTaraweehNoor },
          query: {},
        }),
      ),
    ).toBe(403);
  });
});
