import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { SignInResponse } from '@qc/contracts';
import { schema } from '@qc/db';
import { PHONE_A, createHarness, type Harness } from '../../auth/testing/harness';
import { loadMe } from './me';

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

/** Signs in and returns the contract-parsed `me.profile` from the sign-in response. */
async function signedInProfile(phone = PHONE_A) {
  const asked = await h.requestCode(phone);
  const { challengeId } = (await asked.json()) as { challengeId: string };
  const verified = await h.post('/v1/auth/verify', {
    challengeId,
    code: h.sender.last?.code ?? '',
  });
  expect(verified.status).toBe(200);
  return SignInResponse.parse(await verified.json()).me.profile;
}

describe('the Me in the sign-in response (contract rc.4 profile fields)', () => {
  it('sends dailyGoal and memorisationReviseAfterDays as null for a new account', async () => {
    const profile = await signedInProfile();
    // Present and null, not left out: the server always sends rc.4 fields.
    expect(profile).toHaveProperty('dailyGoal', null);
    expect(profile).toHaveProperty('memorisationReviseAfterDays', null);
  });

  it('sends a saved daily goal and revision setting', async () => {
    const user = await h.createUser({ phoneE164: PHONE_A });
    await h.db.insert(schema.profiles).values({
      userId: user.id,
      dailyGoalUnit: 'pages',
      dailyGoalAmount: 4,
      memorisationReviseAfterDays: 7,
    });
    const profile = await signedInProfile();
    expect(profile.dailyGoal).toEqual({ unit: 'pages', amount: 4 });
    expect(profile.memorisationReviseAfterDays).toBe(7);
  });

  it('sends null for both when the profile row has neither', async () => {
    const user = await h.createUser({ phoneE164: PHONE_A });
    await h.db.insert(schema.profiles).values({ userId: user.id, ageBand: '25_34' });
    const profile = await signedInProfile();
    expect(profile.ageBand).toBe('25_34');
    expect(profile.dailyGoal).toBeNull();
    expect(profile.memorisationReviseAfterDays).toBeNull();
  });
});

describe('loadMe', () => {
  it('maps every goal unit, and a revision setting without a goal', async () => {
    for (const [unit, amount] of [
      ['rukus', 1],
      ['minutes', 15],
    ] as const) {
      const user = await h.createUser();
      await h.db
        .insert(schema.profiles)
        .values({ userId: user.id, dailyGoalUnit: unit, dailyGoalAmount: amount });
      const me = await loadMe(h.db, user.id);
      expect(me?.profile.dailyGoal).toEqual({ unit, amount });
      expect(me?.profile.memorisationReviseAfterDays).toBeNull();
    }
    const reviser = await h.createUser();
    await h.db
      .insert(schema.profiles)
      .values({ userId: reviser.id, memorisationReviseAfterDays: 30 });
    const me = await loadMe(h.db, reviser.id);
    expect(me?.profile.dailyGoal).toBeNull();
    expect(me?.profile.memorisationReviseAfterDays).toBe(30);
  });

  it('sends null for both when the person has no profile row', async () => {
    const user = await h.createUser();
    const me = await loadMe(h.db, user.id);
    expect(me?.profile).toMatchObject({ dailyGoal: null, memorisationReviseAfterDays: null });
  });

  it('answers null for an unknown user', async () => {
    expect(await loadMe(h.db, '00000000-0000-4000-8000-000000000999')).toBeNull();
  });
});
