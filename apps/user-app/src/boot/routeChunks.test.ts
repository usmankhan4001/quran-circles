import { afterEach, describe, expect, it, vi } from 'vitest';
import { TAB_ROUTES, type TabRoute } from '../nav/routes';
import {
  prefetchStartRoute,
  prefetchTab,
  prefetchTabLater,
  startTab,
  type ChunkLoader,
} from './routeChunks';

function fakeChunks(fail = false) {
  const loaded: string[] = [];
  const loader =
    (name: string): ChunkLoader =>
    () => {
      loaded.push(name);
      return fail ? Promise.reject(new Error(`${name} did not download`)) : Promise.resolve({});
    };
  const tabs = Object.fromEntries(TAB_ROUTES.map((t) => [t, loader(t)])) as Record<
    TabRoute,
    ChunkLoader
  >;
  return { loaded, chunks: { tabsLayout: loader('tabs-layout'), tabs } };
}

describe('route chunks', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('knows the tab a start path opens, with / as Home', () => {
    expect(startTab('/')).toBe('home');
    expect(startTab('')).toBe('home');
    expect(startTab('/home')).toBe('home');
    expect(startTab('/nearby')).toBe('nearby');
    expect(startTab('/quran/2')).toBe('quran');
    expect(startTab('/journey/')).toBe('journey');
    expect(startTab('/session/abc')).toBeNull();
    expect(startTab('/sign-in')).toBeNull();
  });

  it('starts the tabs and the start tab, and nothing outside the tabs', () => {
    const start = fakeChunks();
    prefetchStartRoute('/nearby', start.chunks);
    expect(start.loaded).toEqual(['tabs-layout', 'nearby']);
    const outside = fakeChunks();
    prefetchStartRoute('/session/abc', outside.chunks);
    expect(outside.loaded).toEqual([]);
  });

  it('ignores a download that fails: the route loads it again when opened', async () => {
    const failing = fakeChunks(true);
    expect(() => prefetchStartRoute('/', failing.chunks)).not.toThrow();
    expect(() => prefetchTab('quran', failing.chunks.tabs)).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(failing.loaded).toEqual(['tabs-layout', 'home', 'quran']);
  });

  it('starts a tab later, or not at all when cancelled first', () => {
    vi.useFakeTimers();
    const later = fakeChunks();
    prefetchTabLater('nearby', 1500, later.chunks.tabs);
    vi.advanceTimersByTime(1499);
    expect(later.loaded).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(later.loaded).toEqual(['nearby']);

    const cancelled = fakeChunks();
    const cancel = prefetchTabLater('nearby', 1500, cancelled.chunks.tabs);
    cancel();
    vi.advanceTimersByTime(5000);
    expect(cancelled.loaded).toEqual([]);
  });
});
