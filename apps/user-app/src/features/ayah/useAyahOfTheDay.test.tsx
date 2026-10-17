import { describe, expect, it } from 'vitest';
import { builtInAyahFor, pakistanDate } from '@qc/contracts';
import { fixtures } from '@qc/contracts/fixtures';
import { followFor } from '../../test/factories';
import { NOW, renderHookInApp, waitFor } from '../../test/harness';
import { configWith, mine } from '../../test/nextFeatures';
import { ayahOfTheDay } from '../home/ayah';
import { MAX_FOLLOWED_IDS, followedIds, useAyahOfTheDay } from './useAyahOfTheDay';

const VENUE = fixtures.venues[0]!; // has a venue pick on the fixture day (13:28)
const CIRCLE = fixtures.circles[0]!;

describe('followedIds', () => {
  it('splits follows into venue and circle ids, sorted and without repeats', () => {
    const ids = followedIds([
      followFor(VENUE),
      followFor(VENUE, { id: 'again' }),
      followFor(VENUE, { id: 'circle', venueId: null, circleId: CIRCLE.id }),
    ]);
    expect(ids).toEqual({ venueId: [VENUE.id], circleId: [CIRCLE.id] });
    expect(followedIds(undefined)).toEqual({ venueId: [], circleId: [] });
  });

  it('sends at most 50 of each, as the endpoint allows', () => {
    const many = Array.from({ length: 60 }, (_, i) =>
      followFor(VENUE, {
        id: `f${i}`,
        venueId: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
      }),
    );
    expect(followedIds(many).venueId).toHaveLength(MAX_FOLLOWED_IDS);
  });
});

describe('useAyahOfTheDay', () => {
  it("shows the server's national pick to a visitor, sending no ids", async () => {
    const hook = await renderHookInApp(() => useAyahOfTheDay());
    await waitFor(() => expect(hook.result.current.ayah).not.toBeNull());
    expect(hook.result.current.ayah).toMatchObject({ surah: 2, ayah: 255, source: 'national' });
    expect(hook.result.current.enabled).toBe(true);
    const call = hook.world.http.callsTo('GET /v1/ayah-of-the-day')[0]!;
    expect(call.search).toBe('');
  });

  it('sends the followed venue and circle ids, so a coordinator pick can win', async () => {
    const hook = await renderHookInApp(() => useAyahOfTheDay(), {
      signedIn: true,
      mock: {
        handlers: mine({
          follows: [
            followFor(VENUE),
            followFor(VENUE, {
              id: '00000000-0000-4000-8000-0f0000000002',
              venueId: null,
              circleId: CIRCLE.id,
            }),
          ],
        }),
      },
    });
    await waitFor(() => expect(hook.result.current.ayah?.source).toBe('venue'));
    expect(hook.result.current.ayah).toMatchObject({ surah: 13, ayah: 28, venueId: VENUE.id });
    const search = new URLSearchParams(
      hook.world.http.callsTo('GET /v1/ayah-of-the-day')[0]!.search,
    );
    expect(search.getAll('venueId')).toEqual([VENUE.id]);
    expect(search.getAll('circleId')).toEqual([CIRCLE.id]);
  });

  it('waits for the follows before asking, so it asks once', async () => {
    const hook = await renderHookInApp(() => useAyahOfTheDay(), {
      signedIn: true,
      mock: { handlers: mine({ follows: [followFor(VENUE)] }) },
    });
    await waitFor(() => expect(hook.result.current.ayah).not.toBeNull());
    expect(hook.world.http.callsTo('GET /v1/ayah-of-the-day')).toHaveLength(1);
  });

  it("falls back to the contract's built-in ayah for today when the call fails", async () => {
    const hook = await renderHookInApp(() => useAyahOfTheDay(), {
      mock: {
        handlers: {
          'ayahOfTheDay.get': (_c: unknown, id: string) =>
            new Response(
              JSON.stringify({
                error: {
                  code: 'internal_error',
                  messageKey: 'errors.internal_error',
                  requestId: id,
                },
              }),
              { status: 500, headers: { 'content-type': 'application/json' } },
            ),
        },
      },
    });
    await waitFor(() => expect(hook.result.current.ayah).not.toBeNull());
    expect(hook.result.current.ayah).toMatchObject({
      ...builtInAyahFor(pakistanDate(NOW)),
      source: 'built_in',
    });
  });

  it('with the flag off, shows the place the app picked before rc.4 and asks nothing', async () => {
    const hook = await renderHookInApp(() => useAyahOfTheDay(), {
      mock: { handlers: configWith([]) },
    });
    await waitFor(() => expect(hook.result.current.ayah).toEqual(ayahOfTheDay(NOW)));
    expect(hook.result.current.enabled).toBe(false);
    expect(hook.world.http.callsTo('GET /v1/ayah-of-the-day')).toHaveLength(0);
  });

  it('shows nothing while the config is still on its way, so the card does not flash', async () => {
    const seen: unknown[] = [];
    const hook = await renderHookInApp(() => {
      const value = useAyahOfTheDay();
      seen.push(value.ayah);
      return value;
    });
    await waitFor(() => expect(hook.result.current.ayah).not.toBeNull());
    // The first render, before config.get had answered.
    expect(seen[0]).toBeNull();
  });
});
