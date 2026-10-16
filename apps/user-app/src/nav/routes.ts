/**
 * Where a screen can send the person. Screens use these values and never an address, so the
 * navigation library can change without touching a screen. `routeToHref` maps each route to
 * a file under `src/app/`.
 */
export type Route =
  | { name: 'home' }
  | { name: 'nearby' }
  | { name: 'journey' }
  | { name: 'quran' }
  | { name: 'profile' }
  | { name: 'updates' }
  | { name: 'signIn'; returnTo?: Route }
  | { name: 'venue'; venueId: string }
  | { name: 'session'; sessionId: string }
  | { name: 'register'; sessionId: string; occurrenceId?: string }
  | { name: 'page'; slug: string };

export type RouteName = Route['name'];

export const TAB_ROUTES = ['home', 'nearby', 'journey', 'quran'] as const;
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
      return '/quran';
    case 'profile':
      return '/profile';
    case 'updates':
      return '/updates';
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
    case 'nearby':
    case 'journey':
    case 'quran':
    case 'profile':
    case 'updates':
      return { name: first };
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
    case 'page':
      return second ? { name: 'page', slug: second } : null;
    default:
      return null;
  }
}
