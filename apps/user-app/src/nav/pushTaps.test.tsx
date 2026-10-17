import { Text } from 'react-native';
import { describe, expect, it } from 'vitest';
import { buildDeepLink, PushPayload } from '@qc/contracts';
import { act, createWorld, renderHookInApp, renderScreen, waitFor } from '../test/harness';
import { configWith } from '../test/nextFeatures';
import { QuranPrayerScreen } from '../screens/QuranPrayerScreen';
import { useAppConfig } from '../features/config/useAppConfig';
import { pushTapRoute, usePushTaps, type PushTapSource } from './pushTaps';
import { hrefToRoute, routeToHref } from './routes';

const SESSION_ID = '00000000-0000-4000-8000-0a0000000001';
const WEB_BASE = 'https://app.example.test';

/** The data of the worker's morning push (`buildAyahPush` in apps/worker), checked by the contract. */
function ayahPushData(surah: number, ayah: number, webBase?: string): unknown {
  return PushPayload.parse({
    title: 'Ayah of the day',
    body: `Surah ${surah}, ayah ${ayah}`,
    data: {
      type: 'ayah_of_the_day',
      deepLink: buildDeepLink({ type: 'quran', surah, ayah }, webBase),
    },
    collapseKey: 'ayah_daily',
    ttlSeconds: 6 * 3600,
  }).data;
}

/** A notification source the test taps by hand. */
function fakeTaps() {
  let listener: ((data: unknown) => void) | null = null;
  let removed = 0;
  const source: PushTapSource = (onTap) => {
    listener = onTap;
    return {
      remove: () => {
        listener = null;
        removed += 1;
      },
    };
  };
  return {
    source,
    tap: (data: unknown) => {
      if (!listener) throw new Error('nothing is listening for taps');
      listener(data);
    },
    get removed() {
      return removed;
    },
  };
}

describe('pushTapRoute', () => {
  it('opens the reader at the ayah of an ayah_of_the_day push (app scheme link)', () => {
    expect(pushTapRoute(ayahPushData(2, 255))).toEqual({
      name: 'quran',
      reader: { surah: 2, ayah: 255 },
    });
  });

  it('opens the reader for a link on the public web origin too', () => {
    expect(pushTapRoute(ayahPushData(18, 10, WEB_BASE))).toEqual({
      name: 'quran',
      reader: { surah: 18, ayah: 10 },
    });
  });

  it('goes to /quran?surah=…&ayah=… in the router', () => {
    const route = pushTapRoute(ayahPushData(36, 1));
    expect(route && routeToHref(route)).toBe('/quran?surah=36&ayah=1');
  });

  it.each<[string, unknown]>([
    ['no data', undefined],
    ['null', null],
    ['a string', 'qurancircles://quran?surah=2&ayah=255'],
    ['a number', 42],
    ['an unknown type', { type: 'something_new', deepLink: 'qurancircles://quran?surah=2&ayah=1' }],
    ['a deep link that is not a string', { type: 'ayah_of_the_day', deepLink: 7 }],
    ['no deep link', { type: 'ayah_of_the_day' }],
    ['a deep link that is not a URL', { type: 'ayah_of_the_day', deepLink: 'not a url' }],
    [
      'a surah out of range',
      { type: 'ayah_of_the_day', deepLink: 'qurancircles://quran?surah=115&ayah=1' },
    ],
    [
      'an ayah of zero',
      { type: 'ayah_of_the_day', deepLink: 'qurancircles://quran?surah=2&ayah=0' },
    ],
    [
      'a surah that is not a number',
      { type: 'ayah_of_the_day', deepLink: 'qurancircles://quran?surah=abc&ayah=1' },
    ],
    ['no ayah', { type: 'ayah_of_the_day', deepLink: 'qurancircles://quran?surah=2' }],
    [
      'a deep link to somewhere other than the reader',
      {
        type: 'ayah_of_the_day',
        deepLink: buildDeepLink({ type: 'session', sessionId: SESSION_ID }),
      },
    ],
    ['an empty session id', { sessionId: '' }],
    ['a session id that is not a string', { sessionId: 12 }],
  ])('ignores %s', (_label, data) => {
    expect(pushTapRoute(data)).toBeNull();
  });

  it('still opens the session of an on-device reminder', () => {
    expect(pushTapRoute({ sessionId: SESSION_ID })).toEqual({
      name: 'session',
      sessionId: SESSION_ID,
    });
  });

  it.each([
    'update',
    'reminder',
    'session_changed',
    'session_cancelled',
    'waitlist_promoted',
    'circle_opened',
  ] as const)('opens the session of a %s push that names one, as before', (type) => {
    const deepLink = buildDeepLink({ type: 'session', sessionId: SESSION_ID });
    expect(pushTapRoute({ type, deepLink, sessionId: SESSION_ID })).toEqual({
      name: 'session',
      sessionId: SESSION_ID,
    });
    expect(pushTapRoute({ type, deepLink: buildDeepLink({ type: 'updates' }) })).toBeNull();
  });
});

describe('usePushTaps', () => {
  it('opens the reader when the morning ayah is tapped, and stops listening on unmount', async () => {
    const taps = fakeTaps();
    const world = await createWorld();
    const hook = await renderHookInApp(() => usePushTaps(taps.source, world.nav), { world });
    act(() => taps.tap(ayahPushData(2, 255)));
    expect(hook.world.nav.last()).toEqual({
      type: 'go',
      route: { name: 'quran', reader: { surah: 2, ayah: 255 } },
    });
    hook.unmount();
    expect(taps.removed).toBe(1);
  });

  it('does nothing for a malformed payload', async () => {
    const taps = fakeTaps();
    const world = await createWorld();
    const hook = await renderHookInApp(() => usePushTaps(taps.source, world.nav), { world });
    act(() => {
      taps.tap({ type: 'ayah_of_the_day', deepLink: 'qurancircles://quran?surah=999&ayah=1' });
      taps.tap({ type: 'ayah_of_the_day' });
      taps.tap(null);
    });
    expect(hook.world.nav.calls).toEqual([]);
  });

  it('listens for nothing on the web', async () => {
    const world = await createWorld();
    const hook = await renderHookInApp(() => usePushTaps(null, world.nav), { world });
    expect(hook.world.nav.calls).toEqual([]);
  });

  it('opens the reader with the ayah_of_the_day flag off: the push only arrives when the server allowed it', async () => {
    const taps = fakeTaps();
    const world = await createWorld({ mock: { handlers: configWith([]) } });
    const hook = await renderHookInApp(
      () => {
        usePushTaps(taps.source, world.nav);
        return useAppConfig();
      },
      { world },
    );
    await waitFor(() => expect(hook.result.current.data).toBeDefined());
    expect(hook.result.current.featureFlags.ayah_of_the_day).toBe(false);

    act(() => taps.tap(ayahPushData(55, 13)));
    const opened = world.nav.last()?.route;
    expect(opened).toEqual({ name: 'quran', reader: { surah: 55, ayah: 13 } });
    if (!opened) throw new Error('the tap opened nothing');

    // The Quran tab reads the address back (as `app/(tabs)/quran.tsx` does) and asks the reader
    // for that ayah, with the flag still off.
    const route = hrefToRoute(routeToHref(opened));
    expect(route).toEqual({ name: 'quran', reader: { surah: 55, ayah: 13 } });
    const seen: unknown[] = [];
    const view = await renderScreen(
      <QuranPrayerScreen
        {...(route?.name === 'quran' && route.reader ? { reader: route.reader } : {})}
      />,
      {
        mock: { handlers: configWith([]) },
        content: {
          QuranPrayerScreen: ({ reader }) => {
            seen.push(reader);
            return <Text>Reader</Text>;
          },
        },
      },
    );
    expect(view.getByText('Reader')).toBeTruthy();
    expect(seen.at(-1)).toEqual({ surah: 55, ayah: 13 });
  });
});
