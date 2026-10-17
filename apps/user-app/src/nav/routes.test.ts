import { describe, expect, it } from 'vitest';
import { hrefToRoute, routeToHref, type Route } from './routes';

const ID = '00000000-0000-4000-8000-060000000001';

const routes: Route[] = [
  { name: 'home' },
  { name: 'nearby' },
  { name: 'journey' },
  { name: 'quran' },
  { name: 'quran', reader: { surah: 2, ayah: 255 } },
  { name: 'quran', reader: { surah: 18, ayah: 1, at: 1800000000000 } },
  { name: 'profile' },
  { name: 'credits' },
  { name: 'memorisation' },
  { name: 'updates' },
  { name: 'signIn' },
  { name: 'signIn', returnTo: { name: 'register', sessionId: ID, occurrenceId: 'occ 1' } },
  { name: 'venue', venueId: ID },
  { name: 'session', sessionId: ID },
  { name: 'register', sessionId: ID },
  { name: 'register', sessionId: ID, occurrenceId: 'abc' },
  { name: 'page', slug: 'how-it-works' },
];

describe('routes', () => {
  it.each(routes)('reads back the address of %j', (route) => {
    const href = routeToHref(route);
    if (route.name === 'signIn') {
      // The address of a sign-in route carries where to go next; the screen reads it.
      expect(hrefToRoute(href)).toBeNull();
      return;
    }
    expect(hrefToRoute(href)).toEqual(route);
  });

  it('puts the place to return to in the sign-in address, safely encoded', () => {
    const href = routeToHref({ name: 'signIn', returnTo: { name: 'session', sessionId: ID } });
    const returnTo = new URL(href, 'https://x.invalid').searchParams.get('returnTo');
    expect(hrefToRoute(returnTo ?? '')).toEqual({ name: 'session', sessionId: ID });
  });

  it('opens Home for the empty address and nothing for an unknown one', () => {
    expect(hrefToRoute('/')).toEqual({ name: 'home' });
    expect(hrefToRoute('/unknown/thing')).toBeNull();
    expect(hrefToRoute('/venue')).toBeNull();
  });

  it('does not let an address in a reminder or link point anywhere but the app', () => {
    expect(hrefToRoute('https://evil.example/session/abc')).toEqual({
      name: 'session',
      sessionId: 'abc',
    });
    expect(routeToHref({ name: 'venue', venueId: '../admin' })).toBe('/venue/..%2Fadmin');
  });

  it('ignores a reader request that is not a real place', () => {
    expect(hrefToRoute('/quran?surah=0&ayah=1')).toEqual({ name: 'quran' });
    expect(hrefToRoute('/quran?surah=200&ayah=1')).toEqual({ name: 'quran' });
    expect(hrefToRoute('/quran?surah=abc')).toEqual({ name: 'quran' });
    expect(hrefToRoute('/quran?surah=3&ayah=-4')).toEqual({
      name: 'quran',
      reader: { surah: 3, ayah: 1 },
    });
  });
});

describe('tabs', () => {
  it('are in the order of the bar: Home, Nearby, Quran, Journey', async () => {
    const { TAB_ROUTES } = await import('./routes');
    expect([...TAB_ROUTES]).toEqual(['home', 'nearby', 'quran', 'journey']);
  });
});
