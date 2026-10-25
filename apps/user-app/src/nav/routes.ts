/**
 * Where a screen can send the person. Screens use these values and never an address, so the
 * navigation library can change without touching a screen. `routeToHref` maps each route to
 * a file under `src/app/`.
 */
export type Route =
  | { name: 'home' }
  | { name: 'nearby' }
  | { name: 'journey' }
  | { name: 'quran'; reader?: { surah: number; ayah: number; at?: number } }
  | { name: 'profile' }
  | { name: 'credits' }
  | { name: 'store' }
  | { name: 'privacy' }
  | { name: 'terms' }
  | { name: 'deleteAccount' }
  | { name: 'support' }
  | { name: 'memorisation' }
  | { name: 'updates' }
  | { name: 'welcome' }
  | { name: 'map'; venueId?: string }
  | { name: 'features' }
  | { name: 'signUp'; returnTo?: Route }
  | { name: 'signIn'; returnTo?: Route }
  | { name: 'venue'; venueId: string }
  | { name: 'session'; sessionId: string }
  | { name: 'register'; sessionId: string; occurrenceId?: string }
  | { name: 'page'; slug: string };

export type RouteName = Route['name'];

/** The tabs in the order of the bar (D12): Home, Nearby, Quran, Journey. */
export const TAB_ROUTES = ['home', 'nearby', 'quran', 'journey'] as const;
export type TabRoute = (typeof TAB_ROUTES)[number];

export function routeToHref(route: Route): string {
  switch (route.name) {
    case 'home':
      return '/home';
    case 'nearby':
      return '/nearby';
    case 'journey':
      return '/journey';
    case 'quran':
      return route.reader
        ? `/quran?surah=${route.reader.surah}&ayah=${route.reader.ayah}${route.reader.at ? `&at=${route.reader.at}` : ''}`
        : '/quran';
    case 'profile':
      return '/profile';
    case 'credits':
      return '/credits';
    case 'store':
      return '/store';
    case 'privacy':
      return '/privacy';
    case 'terms':
      return '/terms';
    case 'deleteAccount':
      return '/delete-account';
    case 'support':
      return '/support';
    case 'memorisation':
      return '/memorisation';
    case 'updates':
      return '/updates';
    case 'welcome':
      return '/welcome';
    case 'map':
      return route.venueId ? `/map?venueId=${encodeURIComponent(route.venueId)}` : '/map';
    case 'features':
      return '/features';
    case 'signUp':
      return route.returnTo
        ? `/sign-up?returnTo=${encodeURIComponent(routeToHref(route.returnTo))}`
        : '/sign-up';
    case 'signIn':
      return route.returnTo
        ? `/sign-in?returnTo=${encodeURIComponent(routeToHref(route.returnTo))}`
        : '/sign-in';
    case 'venue':
      return `/venue/${encodeURIComponent(route.venueId)}`;
    case 'session':
      return `/session/${encodeURIComponent(route.sessionId)}`;
    case 'register':
      return route.occurrenceId
        ? `/register/${encodeURIComponent(route.sessionId)}?occurrenceId=${encodeURIComponent(route.occurrenceId)}`
        : `/register/${encodeURIComponent(route.sessionId)}`;
    case 'page':
      return `/page/${encodeURIComponent(route.slug)}`;
  }
}

/** Reads an address back into a route, for the sign-in `returnTo` and for deep links. */
export function hrefToRoute(href: string): Route | null {
  let url: URL;
  try {
    url = new URL(href, 'https://app.invalid');
  } catch {
    return null;
  }
  const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
  const [first, second] = parts;
  switch (first) {
    case undefined:
    case 'home':
      return { name: 'home' };
    case 'quran': {
      const surah = Number(url.searchParams.get('surah'));
      const ayah = Number(url.searchParams.get('ayah') ?? 1);
      const at = Number(url.searchParams.get('at'));
      if (!Number.isInteger(surah) || surah < 1 || surah > 114) return { name: 'quran' };
      return {
        name: 'quran',
        reader: {
          surah,
          ayah: Number.isInteger(ayah) && ayah >= 1 ? ayah : 1,
          ...(Number.isInteger(at) && at > 0 ? { at } : {}),
        },
      };
    }
    case 'nearby':
    case 'journey':
    case 'profile':
    case 'credits':
    case 'store':
    case 'privacy':
    case 'terms':
    case 'support':
    case 'memorisation':
    case 'updates':
    case 'welcome':
    case 'features':
      return { name: first };
    case 'delete-account':
      return { name: 'deleteAccount' };
    case 'venue':
      return second ? { name: 'venue', venueId: second } : null;
    case 'session':
      return second ? { name: 'session', sessionId: second } : null;
    case 'register': {
      if (!second) return null;
      const occurrenceId = url.searchParams.get('occurrenceId');
      return occurrenceId
        ? { name: 'register', sessionId: second, occurrenceId }
        : { name: 'register', sessionId: second };
    }
    case 'map': {
      const venueId = url.searchParams.get('venueId');
      return venueId ? { name: 'map', venueId } : { name: 'map' };
    }
    case 'page':
      return second ? { name: 'page', slug: second } : null;
    default:
      return null;
  }
}
