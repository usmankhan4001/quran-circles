import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { AREA_SADDAR, CITY_RAWALPINDI } from '../test/factories';
import { createWorld, renderScreen, type TestWorld } from '../test/harness';
import { HomeScreen } from '../screens/HomeScreen';
import { NearbyScreen } from '../screens/NearbyScreen';
import { needsStartData, prefetchNearbyList, prefetchStartQueries } from './startQueries';

const OCCURRENCES = 'GET /v1/occurrences';
const MINE = 'GET /v1/registrations/mine';
const CONFIG = 'GET /v1/config';
const FOLLOWS = 'GET /v1/me/follows';

async function settle(world: TestWorld): Promise<void> {
  await world.services.cache.flush();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

async function homeRequests(world: TestWorld) {
  const view = await renderScreen(createElement(HomeScreen), { world });
  await view.findAllByTestId('home-lead-card');
  await settle(world);
  return {
    occurrences: world.http.callsTo(OCCURRENCES).length,
    mine: world.http.callsTo(MINE).length,
    config: world.http.callsTo(CONFIG).length,
    follows: world.http.callsTo(FOLLOWS).length,
  };
}

describe('prefetchStartQueries', () => {
  it('asks for what Home shows first, with the same keys, so Home asks nothing twice', async () => {
    const plain = await homeRequests(
      await createWorld({ signedIn: true, cityId: CITY_RAWALPINDI.id }),
    );

    const world = await createWorld({ signedIn: true, cityId: CITY_RAWALPINDI.id });
    void prefetchStartQueries(world.services, 'home');
    expect(world.http.callsTo(OCCURRENCES)).toHaveLength(0); // starts on the next tick
    await settle(world);
    expect(world.http.callsTo(OCCURRENCES)).toHaveLength(1);
    expect(world.http.callsTo(OCCURRENCES)[0]!.search).toContain(`cityId=${CITY_RAWALPINDI.id}`);
    expect(world.http.callsTo(MINE)).toHaveLength(1);
    expect(world.http.callsTo(CONFIG)).toHaveLength(1);
    expect(world.http.callsTo(FOLLOWS)).toHaveLength(1);
    expect(world.services.cache.get('me:follows')).toBeDefined();
    expect(world.services.cache.get(`config:${CITY_RAWALPINDI.id}`)).toBeDefined();
    expect(world.services.cache.get(`occurrences:next:${CITY_RAWALPINDI.id}`)).toBeDefined();
    expect(world.services.cache.get('me:registrations')).toBeDefined();

    expect(await homeRequests(world)).toEqual(plain);
  });

  it('is joined by Home while the requests are still under way', async () => {
    const plain = await homeRequests(
      await createWorld({ signedIn: true, cityId: CITY_RAWALPINDI.id }),
    );
    const world = await createWorld({ signedIn: true, cityId: CITY_RAWALPINDI.id });
    void prefetchStartQueries(world.services, 'home');
    expect(await homeRequests(world)).toEqual(plain);
  });

  it('asks only for public sessions when nobody is signed in', async () => {
    const world = await createWorld({ cityId: CITY_RAWALPINDI.id });
    void prefetchStartQueries(world.services, 'home');
    await settle(world);
    expect(world.http.callsTo(OCCURRENCES)).toHaveLength(1);
    expect(world.http.callsTo(MINE)).toHaveLength(0);
    expect(world.http.callsTo(FOLLOWS)).toHaveLength(0);
    expect(world.services.cache.get('me:registrations')).toBeUndefined();
  });

  it('asks only for the config on a start outside Home', async () => {
    const world = await createWorld({ signedIn: true });
    await Promise.all([
      prefetchStartQueries(world.services, 'nearby'),
      prefetchStartQueries(world.services, null),
    ]);
    expect(world.http.callsTo(CONFIG)).toHaveLength(1);
    expect(world.http.callsTo(OCCURRENCES)).toHaveLength(0);
    expect(world.http.callsTo(MINE)).toHaveLength(0);
    expect(world.services.cache.get('config:default')).toBeDefined();
  });

  it('asks without a city when none is chosen', async () => {
    const world = await createWorld({});
    void prefetchStartQueries(world.services, 'home');
    await settle(world);
    expect(world.http.callsTo(OCCURRENCES)[0]!.search).not.toContain('cityId');
    expect(world.services.cache.get('occurrences:next:any')).toBeDefined();
  });

  it('never throws and caches nothing when a request fails, so Home asks again', async () => {
    const world = await createWorld({ signedIn: true, cityId: CITY_RAWALPINDI.id });
    world.http.failNext(OCCURRENCES, 'internal_error');
    world.http.failNext(MINE, 'internal_error');
    await expect(prefetchStartQueries(world.services, 'home')).resolves.toBeUndefined();
    expect(world.services.cache.get(`occurrences:next:${CITY_RAWALPINDI.id}`)).toBeUndefined();
    expect(world.services.cache.get('me:registrations')).toBeUndefined();
    const view = await renderScreen(createElement(HomeScreen), { world });
    await view.findAllByTestId('home-lead-card');
    expect(world.http.callsTo(OCCURRENCES).length).toBeGreaterThan(1);
  });
});

describe('needsStartData', () => {
  it('is true on a Home start with nothing saved, and false once the data is in', async () => {
    const world = await createWorld({ signedIn: true, cityId: CITY_RAWALPINDI.id });
    expect(needsStartData(world.services, 'home')).toBe(true);
    await prefetchStartQueries(world.services, 'home');
    expect(needsStartData(world.services, 'home')).toBe(false);
  });

  it('is false outside Home', async () => {
    const world = await createWorld({ signedIn: true });
    expect(needsStartData(world.services, 'nearby')).toBe(false);
    expect(needsStartData(world.services, null)).toBe(false);
  });

  it('is true again for another city', async () => {
    const world = await createWorld({ cityId: CITY_RAWALPINDI.id });
    await prefetchStartQueries(world.services, 'home');
    await world.services.preferences.update({ cityId: null });
    expect(needsStartData(world.services, 'home')).toBe(true);
  });
});

const SESSIONS_LIST = 'GET /v1/sessions';

async function nearbyListRequests(world: TestWorld): Promise<number> {
  const view = await renderScreen(createElement(NearbyScreen), { world });
  await view.findByTestId('nearby-list');
  await settle(world);
  return world.http.callsTo(SESSIONS_LIST).length;
}

describe('prefetchNearbyList', () => {
  it('asks for the list Nearby opens on, under its key, so Nearby asks nothing more', async () => {
    const world = await createWorld({ cityId: CITY_RAWALPINDI.id });
    await prefetchNearbyList(world.services);
    expect(world.http.callsTo(SESSIONS_LIST)).toHaveLength(1);
    expect(world.http.callsTo(SESSIONS_LIST)[0]!.search).toContain(`cityId=${CITY_RAWALPINDI.id}`);
    expect(await nearbyListRequests(world)).toBe(1);
  });

  it('measures from the chosen area once its list is in the cache', async () => {
    const world = await createWorld({ cityId: CITY_RAWALPINDI.id, areaId: AREA_SADDAR.id });
    await prefetchNearbyList(world.services);
    expect(world.http.callsTo(SESSIONS_LIST)).toHaveLength(0); // no area list yet: no guess
    const areas = await world.services.api.places.areas({ query: { cityId: CITY_RAWALPINDI.id } });
    world.services.cache.set(`places:areas:${CITY_RAWALPINDI.id}`, areas.items, true);
    await prefetchNearbyList(world.services);
    expect(world.http.callsTo(SESSIONS_LIST)).toHaveLength(1);
    expect(world.http.callsTo(SESSIONS_LIST)[0]!.search).toContain('lat=');
    expect(await nearbyListRequests(world)).toBe(1);
  });

  it('asks nothing while the list is fresh, and never throws', async () => {
    const world = await createWorld({ cityId: CITY_RAWALPINDI.id });
    await prefetchNearbyList(world.services);
    await prefetchNearbyList(world.services);
    expect(world.http.callsTo(SESSIONS_LIST)).toHaveLength(1);

    const failing = await createWorld({ cityId: CITY_RAWALPINDI.id });
    failing.http.failNext(SESSIONS_LIST, 'internal_error');
    await expect(prefetchNearbyList(failing.services)).resolves.toBeUndefined();
    expect(await nearbyListRequests(failing)).toBe(2);
  });
});
