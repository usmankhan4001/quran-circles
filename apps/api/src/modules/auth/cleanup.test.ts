import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { schema } from '@qc/db';
import { PHONE_A, createHarness, type Harness } from '../../auth/testing/harness';
import { purgeStaleAuthRows } from './cleanup';

vi.setConfig({ testTimeout: 30_000, hookTimeout: 60_000 });

let h: Harness;
beforeAll(async () => {
  h = await createHarness();
}, 60_000);
afterAll(async () => {
  await h.close();
});
beforeEach(async () => {
  await h.reset();
});

const DAY = 86400;

// The rule itself is tested row by row in `@qc/db` (packages/db/src/jobs/auth-purge.test.ts). This
// suite checks the API's re-export against rows made by the real sign-in and sign-out flow.

describe('purgeStaleAuthRows', () => {
  it('removes old codes and finished sessions and keeps the rest', async () => {
    const signedIn = await h.signIn(PHONE_A); // a live session and a used code
    h.clock.advance(61);
    await h.requestCode(PHONE_A); // an unused, soon-expired code

    // Nothing is old enough yet.
    expect(await purgeStaleAuthRows(h.db, h.clock.now())).toEqual({ challenges: 0, sessions: 0 });

    // Two days on: the codes are gone, the live session (30 day sliding expiry) stays.
    h.clock.advance(2 * DAY);
    expect(await purgeStaleAuthRows(h.db, h.clock.now())).toEqual({ challenges: 2, sessions: 0 });
    expect(await h.db.select().from(schema.authSessions)).toHaveLength(1);

    // Sign out, then wait out the retention: the revoked session goes too.
    const out = await h.post('/v1/auth/sign-out', undefined, { token: signedIn.body.accessToken });
    expect(out.status).toBe(401); // the access token had expired by now
    await h.db.update(schema.authSessions).set({ revokedAt: h.clock.now() });
    expect(await purgeStaleAuthRows(h.db, h.clock.now())).toEqual({ challenges: 0, sessions: 0 });
    h.clock.advance(31 * DAY);
    expect(await purgeStaleAuthRows(h.db, h.clock.now())).toEqual({ challenges: 0, sessions: 1 });
    expect(await h.db.select().from(schema.authSessions)).toHaveLength(0);
  });
});
