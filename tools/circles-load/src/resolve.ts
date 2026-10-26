import { inPakistan, parseCoords, type LatLng } from './coords';

export type ResolveFailure =
  'no_link' | 'not_a_map_link' | 'no_coordinates' | 'outside_pakistan' | 'fetch_failed';

export type Resolution =
  { ok: true; point: LatLng; via: 'row' | 'link' | 'page' } | { ok: false; reason: ResolveFailure };

export interface ResolveOptions {
  fetchImpl?: typeof fetch;
  maxHops?: number;
  /**
   * Look in the final page's text when the address itself carries no position. Off by default:
   * on real data it returns Google's default map centre, the same pin for dozens of venues.
   */
  readPage?: boolean;
}

const MAP_HOSTS = [
  'maps.app.goo.gl',
  'goo.gl',
  'maps.google.com',
  'www.google.com',
  'google.com',
  'earth.google.com',
  'share.google',
  'g.co',
];

const hostOk = (url: string): boolean => {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && MAP_HOSTS.includes(u.hostname.toLowerCase());
  } catch {
    return false;
  }
};

const accept = (p: LatLng | null, via: 'row' | 'link' | 'page'): Resolution =>
  p && inPakistan(p)
    ? { ok: true, point: p, via }
    : { ok: false, reason: p ? 'outside_pakistan' : 'no_coordinates' };

/**
 * Turns one map link into a position. Only Google's own hosts are ever contacted; a link to any
 * other host is refused, so a bad cell cannot send the tool somewhere else. Redirects are
 * followed by hand, a few hops at most. Never guesses: no coordinates in the link, no pin.
 */
export async function resolveLink(
  link: string,
  { fetchImpl = fetch, maxHops = 6, readPage = false }: ResolveOptions = {},
): Promise<Resolution> {
  const first = link.trim();
  if (!first) return { ok: false, reason: 'no_link' };
  if (!hostOk(first)) return { ok: false, reason: 'not_a_map_link' };

  const direct = parseCoords(first);
  if (direct) return accept(direct, 'row');

  let url = first;
  try {
    for (let hop = 0; hop < maxHops; hop++) {
      const res = await fetchImpl(url, {
        redirect: 'manual',
        headers: { 'user-agent': 'Mozilla/5.0 (compatible; circles-load)' },
        signal: AbortSignal.timeout(15_000),
      });
      const location = res.headers.get('location');
      if (location && res.status >= 300 && res.status < 400) {
        url = new URL(location, url).href;
        if (!hostOk(url)) return { ok: false, reason: 'not_a_map_link' };
        const found = parseCoords(url);
        if (found) return accept(found, 'link');
        continue;
      }
      if (readPage && res.ok) {
        const body = (await res.text()).slice(0, 400_000);
        const found = parseCoords(body);
        if (found) return accept(found, 'page');
      }
      return { ok: false, reason: 'no_coordinates' };
    }
  } catch {
    return { ok: false, reason: 'fetch_failed' };
  }
  return { ok: false, reason: 'no_coordinates' };
}

/** Resolves each distinct link once, a few at a time. */
export async function resolveAll(
  links: readonly string[],
  opts: ResolveOptions & { concurrency?: number } = {},
): Promise<Map<string, Resolution>> {
  const out = new Map<string, Resolution>();
  const todo = [...new Set(links.map((l) => l.trim()).filter(Boolean))];
  let next = 0;
  const worker = async () => {
    while (next < todo.length) {
      const link = todo[next++]!;
      out.set(link, await resolveLink(link, opts));
    }
  };
  await Promise.all(Array.from({ length: opts.concurrency ?? 4 }, worker));
  return out;
}
