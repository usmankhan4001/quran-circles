import { TAB_ROUTES, type TabRoute } from '../nav/routes';

/**
 * The web build loads each route's code on demand (expo-router's async routes), one round trip
 * after the screen that needs it. These start the downloads earlier: the start route's while the
 * saved choices and the first font load, and the next likely tab once Home has settled. A failed
 * download is ignored here; the router asks again when the route is opened.
 */
export type ChunkLoader = () => Promise<unknown>;

export const tabsLayoutChunk: ChunkLoader = () => import('../app/(tabs)/_layout');

export const tabChunks: Record<TabRoute, ChunkLoader> = {
  home: () => import('../app/(tabs)/home'),
  nearby: () => import('../app/(tabs)/nearby'),
  quran: () => import('../app/(tabs)/quran'),
  journey: () => import('../app/(tabs)/journey'),
};

/** The tab a start path opens, or null for a page outside the tabs. `/` redirects to Home. */
export function startTab(pathname: string): TabRoute | null {
  const first = pathname.split('/').filter(Boolean)[0] ?? 'home';
  return (TAB_ROUTES as readonly string[]).includes(first) ? (first as TabRoute) : null;
}

function quietly(load: ChunkLoader): void {
  load().catch(() => undefined);
}

/** Starts the downloads for the route the page was opened at. */
export function prefetchStartRoute(
  pathname: string,
  chunks: { tabsLayout: ChunkLoader; tabs: Record<TabRoute, ChunkLoader> } = {
    tabsLayout: tabsLayoutChunk,
    tabs: tabChunks,
  },
): void {
  const tab = startTab(pathname);
  if (!tab) return;
  quietly(chunks.tabsLayout);
  quietly(chunks.tabs[tab]);
}

/** Starts the download for one tab, such as Nearby once Home has settled. */
export function prefetchTab(tab: TabRoute, chunks: Record<TabRoute, ChunkLoader> = tabChunks) {
  quietly(chunks[tab]);
}

/**
 * Starts the download for one tab after `delayMs`, once the first screen has had time to
 * settle. Returns a function that cancels it, for when the screen goes away first.
 */
export function prefetchTabLater(
  tab: TabRoute,
  delayMs: number,
  chunks: Record<TabRoute, ChunkLoader> = tabChunks,
): () => void {
  const timer = setTimeout(() => prefetchTab(tab, chunks), delayMs);
  return () => clearTimeout(timer);
}
