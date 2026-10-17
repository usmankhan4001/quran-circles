import { fixtures } from '@qc/contracts/fixtures';
import { NEXT_FEATURE_FLAGS, type Follow, type Me, type Registration } from '@qc/contracts';
import type { MockOptions } from '@qc/contracts/mock';

/**
 * Test helpers for the rc.4 features (days read, community total, ayah of the day,
 * memorisation, read along). The mock server has all five flags on; these switch them per test.
 */
export type Handlers = NonNullable<MockOptions['handlers']>;
export type NextFlag = (typeof NEXT_FEATURE_FLAGS)[number];
export const ALL_NEXT_FLAGS: readonly NextFlag[] = NEXT_FEATURE_FLAGS;

/** A `config.get` answer with the rc.4 flags as given (every one not listed is off). */
export function configWith(on: readonly NextFlag[]): Handlers {
  return {
    'config.get': () => ({
      seasonMode: 'dora',
      hijriOffsetDays: 0,
      featureFlags: {
        circle_requests: false,
        session_companion: false,
        invite_friends: false,
        poster_sharing: false,
        quran_offline_copy: false,
        whatsapp_fallback_reminders: false,
        ...Object.fromEntries(NEXT_FEATURE_FLAGS.map((k) => [k, on.includes(k)])),
      },
      supportedLocales: ['en', 'ur'],
      minimumAppVersion: { ios: '1.0.0', android: '1.0.0' },
      serverTime: '2027-02-15T08:00:00Z',
    }),
  };
}

/** Lists the signed-in person's own data: nothing unless given. */
export function mine(
  options: { follows?: Follow[]; registrations?: Registration[] } = {},
): Handlers {
  return {
    'follows.list': () => ({ items: options.follows ?? [] }),
    'registrations.listMine': () => ({ items: options.registrations ?? [], nextCursor: null }),
  };
}

/** `me.get` with a changed profile. */
export function meWith(profile: Partial<Me['profile']>): Handlers {
  return { 'me.get': () => ({ ...fixtures.me, profile: { ...fixtures.me.profile, ...profile } }) };
}
