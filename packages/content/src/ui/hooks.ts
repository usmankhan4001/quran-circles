import { useCallback, useEffect, useRef, useState } from 'react';
import type { BookmarkEntry } from '../bookmarks/service';
import type { AyahRef } from '../meta/ayah';
import { nextPrayer, toCountdown, type Countdown, type NextPrayer } from '../prayer/next';
import type { PrayerPlace } from '../prayer/calc';
import { DEFAULT_READER_PREFS, clampZoomIndex, type ReaderPrefs } from '../quran/prefs';
import type { MushafPage } from '../quran/pages';
import {
  isAbortError,
  type PassageRef,
  type QuranAyah,
  type QuranPassage,
  type QuranSourceError,
} from '../quran/types';
import type { ReadingPositionValue } from '../reading/position';
import { DEFAULT_VIEW_STATE, type ViewState } from '../state/viewState';
import { PAKISTAN_CITIES } from '../prayer/places';
import { useContent } from './context';

/** The current time, refreshed every `intervalMs`. The clock comes from the services. */
export function useNow(intervalMs = 1000): Date {
  const { services } = useContent();
  const [now, setNow] = useState(() => services.now());
  useEffect(() => {
    setNow(services.now());
    const id = setInterval(() => setNow(services.now()), intervalMs);
    return () => clearInterval(id);
  }, [services, intervalMs]);
  return now;
}

export interface BookmarksState {
  items: BookmarkEntry[];
  loading: boolean;
  isBookmarked: (ref: AyahRef) => boolean;
  toggleAyah: (ref: AyahRef) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export function useBookmarks(): BookmarksState {
  const { services } = useContent();
  const [items, setItems] = useState<BookmarkEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = () =>
      services.bookmarks.list().then((list) => {
        if (!active) return;
        setItems(list);
        setLoading(false);
      });
    void load();
    const unsubscribe = services.bookmarks.subscribe(() => void load());
    return () => {
      active = false;
      unsubscribe();
    };
  }, [services]);

  const isBookmarked = useCallback(
    (ref: AyahRef) =>
      items.some((b) => b.kind === 'ayah' && b.surah === ref.surah && b.ayah === ref.ayah),
    [items],
  );
  const toggleAyah = useCallback(
    async (ref: AyahRef) => {
      await services.bookmarks.toggleAyah(ref);
    },
    [services],
  );
  const remove = useCallback((id: string) => services.bookmarks.remove(id), [services]);
  return { items, loading, isBookmarked, toggleAyah, remove };
}

export interface ReadingPositionState {
  position: ReadingPositionValue | null;
  loading: boolean;
  save: (surah: number, ayah: number) => Promise<void>;
}

export function useReadingPosition(): ReadingPositionState {
  const { services } = useContent();
  const [position, setPosition] = useState<ReadingPositionValue | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = () =>
      services.readingPosition.getLocal().then((value) => {
        if (!active) return;
        setPosition(value);
        setLoading(false);
      });
    void load();
    const unsubscribe = services.readingPosition.subscribe(() => void load());
    return () => {
      active = false;
      unsubscribe();
    };
  }, [services]);

  const save = useCallback(
    async (surah: number, ayah: number) => {
      await services.readingPosition.save(surah, ayah);
    },
    [services],
  );
  return { position, loading, save };
}

export interface ReaderPrefsState {
  prefs: ReaderPrefs;
  loaded: boolean;
  setShowTranslation: (show: boolean) => void;
  setZoomIndex: (index: number) => void;
  /** Changes several settings at once (the layout switch also turns the translation on). */
  update: (patch: Partial<ReaderPrefs>) => void;
}

export function useReaderPrefs(): ReaderPrefsState {
  const { services } = useContent();
  const [prefs, setPrefs] = useState<ReaderPrefs>(DEFAULT_READER_PREFS);
  const [loaded, setLoaded] = useState(false);
  const latest = useRef(prefs);
  latest.current = prefs;

  useEffect(() => {
    let active = true;
    void services.prefs.load().then((value) => {
      if (!active) return;
      setPrefs(value);
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, [services]);

  const change = useCallback(
    (patch: Partial<ReaderPrefs>) => {
      const next = { ...latest.current, ...patch };
      next.arabicZoomIndex = clampZoomIndex(next.arabicZoomIndex);
      latest.current = next;
      setPrefs(next);
      void services.prefs.save(next);
    },
    [services],
  );
  return {
    prefs,
    loaded,
    setShowTranslation: useCallback((show: boolean) => change({ showTranslation: show }), [change]),
    setZoomIndex: useCallback((index: number) => change({ arabicZoomIndex: index }), [change]),
    update: change,
  };
}

export type PassageState =
  | { status: 'loading'; previous: QuranPassage | null; reload: () => void }
  | { status: 'ready'; passage: QuranPassage; reload: () => void }
  | {
      status: 'error';
      error: QuranSourceError | Error;
      previous: QuranPassage | null;
      reload: () => void;
    };

/**
 * Loads a surah or a juz. While the next one loads, `previous` still holds the last one shown,
 * so the screen does not go blank (docs/design/screens/quran-and-prayer.md, States).
 */
export function usePassage(ref: PassageRef): PassageState {
  const { services } = useContent();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'ready'; passage: QuranPassage }
    | { status: 'error'; error: QuranSourceError | Error }
  >({ status: 'loading' });
  const lastReady = useRef<QuranPassage | null>(null);
  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading' });
    const load =
      ref.kind === 'juz'
        ? services.source.getJuz(ref.id, { signal: controller.signal })
        : services.source.getSurah(ref.id, { signal: controller.signal });
    load.then(
      (passage) => {
        if (controller.signal.aborted) return;
        lastReady.current = passage;
        setState({ status: 'ready', passage });
      },
      (error: unknown) => {
        if (controller.signal.aborted || isAbortError(error)) return;
        setState({
          status: 'error',
          error: error instanceof Error ? error : new Error(String(error)),
        });
      },
    );
    return () => controller.abort();
  }, [services, ref.kind, ref.id, attempt]);

  if (state.status === 'ready') return { status: 'ready', passage: state.passage, reload };
  if (state.status === 'error') {
    return { status: 'error', error: state.error, previous: lastReady.current, reload };
  }
  return { status: 'loading', previous: lastReady.current, reload };
}

export type AyahState =
  | { status: 'loading' }
  | { status: 'ready'; ayah: QuranAyah }
  | { status: 'error'; error: QuranSourceError | Error };

/**
 * One ayah, read through the same source and cache as the reader but without fetching its whole
 * surah (`services.source.getAyah`). For a card that shows a single ayah.
 */
export function useAyah(surah: number, ayah: number): AyahState {
  const { services } = useContent();
  const [state, setState] = useState<AyahState>({ status: 'loading' });
  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading' });
    services.source.getAyah(surah, ayah, { signal: controller.signal }).then(
      (result) => {
        if (!controller.signal.aborted) setState({ status: 'ready', ayah: result });
      },
      (error: unknown) => {
        if (controller.signal.aborted || isAbortError(error)) return;
        setState({
          status: 'error',
          error: error instanceof Error ? error : new Error(String(error)),
        });
      },
    );
    return () => controller.abort();
  }, [services, surah, ayah]);
  return state;
}

/**
 * The surahs kept on this phone by the text cache, so the list can mark them as readable
 * offline. Read once when the list mounts (the list mounts again when the reader closes).
 */
export function useSavedSurahs(): ReadonlySet<number> {
  const { services } = useContent();
  const [saved, setSaved] = useState<ReadonlySet<number>>(() => new Set());
  useEffect(() => {
    let active = true;
    services.source.cachedPassages().then(
      (refs) => {
        if (!active) return;
        setSaved(new Set(refs.filter((r) => r.kind === 'surah').map((r) => r.id)));
      },
      () => undefined,
    );
    return () => {
      active = false;
    };
  }, [services]);
  return saved;
}

export interface ViewStateHook extends ViewState {
  loaded: boolean;
  update: (change: Partial<ViewState>) => void;
}

export function useViewState(): ViewStateHook {
  const { services } = useContent();
  const [state, setState] = useState<ViewState>(DEFAULT_VIEW_STATE);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let active = true;
    void services.viewState.load().then((value) => {
      if (!active) return;
      setState(value);
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, [services]);
  const update = useCallback(
    (change: Partial<ViewState>) => {
      setState((current) => ({ ...current, ...change }));
      void services.viewState.update(change);
    },
    [services],
  );
  return { ...state, loaded, update };
}

/** The chosen city as a place, or null before the person has chosen. */
export function placeById(id: string | null): (PrayerPlace & { id: string }) | null {
  if (!id) return null;
  return PAKISTAN_CITIES.find((city) => city.id === id) ?? null;
}

export interface NextPrayerState {
  next: NextPrayer;
  /** The time left, recalculated at every tick. */
  countdown: Countdown;
  now: Date;
}

/**
 * The next prayer for a place, with a countdown that ticks every second. The prayer is worked
 * out again only when its time has passed or the place changes, not at every tick.
 */
export function useNextPrayer(place: PrayerPlace): NextPrayerState {
  const now = useNow(1000);
  const cache = useRef<{ place: PrayerPlace; value: NextPrayer } | null>(null);
  let cached = cache.current;
  if (
    !cached ||
    cached.place !== place ||
    now.getTime() >= cached.value.at.getTime() ||
    // The clock moved backwards (the person changed the phone's time).
    cached.value.at.getTime() - now.getTime() > 36 * 3_600_000
  ) {
    cached = { place, value: nextPrayer(place, now) };
    cache.current = cached;
  }
  const next: NextPrayer = { ...cached.value, msUntil: cached.value.at.getTime() - now.getTime() };
  return { next, countdown: toCountdown(next.msUntil), now };
}

export type MushafPageState =
  | { status: 'loading'; previous: MushafPage | null }
  | { status: 'ready'; page: MushafPage }
  | {
      status: 'error';
      error: QuranSourceError | Error;
      previous: MushafPage | null;
      reload: () => void;
    };

/**
 * One mushaf page (Arabic only). While the next page loads, `previous` still holds the last one
 * shown, so turning the page does not blank the screen.
 */
export function useMushafPage(page: number | null): MushafPageState & { reload: () => void } {
  const { services } = useContent();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'ready'; page: MushafPage }
    | { status: 'error'; error: QuranSourceError | Error }
  >({ status: 'loading' });
  const lastReady = useRef<MushafPage | null>(null);
  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    if (page === null) return;
    const controller = new AbortController();
    setState({ status: 'loading' });
    services.pages.getPage(page, { signal: controller.signal }).then(
      (result) => {
        if (controller.signal.aborted) return;
        lastReady.current = result;
        setState({ status: 'ready', page: result });
      },
      (error: unknown) => {
        if (controller.signal.aborted || isAbortError(error)) return;
        setState({
          status: 'error',
          error: error instanceof Error ? error : new Error(String(error)),
        });
      },
    );
    return () => controller.abort();
  }, [services, page, attempt]);

  if (state.status === 'ready') return { status: 'ready', page: state.page, reload };
  if (state.status === 'error') {
    return { status: 'error', error: state.error, previous: lastReady.current, reload };
  }
  return { status: 'loading', previous: lastReady.current, reload };
}

export interface MushafPageLookup {
  /** The page, or null while it is being looked up (or if it could not be). */
  page: number | null;
  /** Set when the lookup failed, such as with no connection. */
  error: Error | null;
  reload: () => void;
}

/** The mushaf page an ayah is printed on. Nothing is asked while `enabled` is false. */
export function useMushafPageOf(surah: number, ayah: number, enabled = true): MushafPageLookup {
  const { services } = useContent();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ page: number | null; error: Error | null }>({
    page: null,
    error: null,
  });
  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  useEffect(() => {
    setState({ page: null, error: null });
    if (!enabled) return;
    const controller = new AbortController();
    services.pages.pageOf(surah, ayah, { signal: controller.signal }).then(
      (result) => {
        if (!controller.signal.aborted) setState({ page: result, error: null });
      },
      (error: unknown) => {
        if (controller.signal.aborted || isAbortError(error)) return;
        setState({ page: null, error: error instanceof Error ? error : new Error(String(error)) });
      },
    );
    return () => controller.abort();
  }, [services, surah, ayah, enabled, attempt]);
  return { page: state.page, error: state.error, reload };
}
