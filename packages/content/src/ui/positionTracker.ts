import { useCallback, useEffect, useRef } from 'react';
import type { AyahRef } from '../meta/ayah';
import { useContent } from './context';
import type { ReaderRow } from './reader';

export const POSITION_SAVE_DELAY_MS = 1200;

/** The part of a list's viewable item that the tracker reads. */
export interface ViewableToken {
  item?: unknown;
}

export interface PositionTracker {
  /** Pass to the list's `onViewableItemsChanged`. It is stable between renders. */
  onViewableItemsChanged: (info: { viewableItems: ViewableToken[] }) => void;
  viewabilityConfig: { itemVisiblePercentThreshold: number };
  /** Saves at once, for a place the person chose (a jump, an opened bookmark). */
  saveNow: (ref: AyahRef) => void;
  /**
   * While off, scrolling is not saved. The reader turns it off while it scrolls to the place it
   * was asked to open, so that the first screen of the surah does not overwrite the saved place.
   */
  setTracking: (on: boolean) => void;
  /** Saves what is waiting. Called when the reader closes. */
  flush: () => void;
}

/**
 * Saves the last place reached while the person scrolls: the top verse on screen, a moment
 * after they stop. The device keeps it at once; the account is told when signed in.
 */
export function usePositionTracker(delayMs = POSITION_SAVE_DELAY_MS): PositionTracker {
  const { services } = useContent();
  const pending = useRef<AyahRef | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tracking = useRef(false);

  const write = useCallback(
    (ref: AyahRef) => {
      void services.readingPosition.save(ref.surah, ref.ayah).catch(() => undefined);
    },
    [services],
  );

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const ref = pending.current;
    pending.current = null;
    if (ref && tracking.current) write(ref);
  }, [write]);

  const note = useCallback(
    (ref: AyahRef) => {
      if (!tracking.current) return;
      pending.current = ref;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, delayMs);
    },
    [delayMs, flush],
  );

  const noteRef = useRef(note);
  noteRef.current = note;

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewableToken[] }) => {
    const top = viewableItems.find(
      (token) => (token.item as ReaderRow | undefined)?.type === 'verse',
    );
    const row = top?.item as Extract<ReaderRow, { type: 'verse' }> | undefined;
    if (row) noteRef.current({ surah: row.verse.surah, ayah: row.verse.ayah });
  }).current;

  const saveNow = useCallback(
    (ref: AyahRef) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      pending.current = null;
      write(ref);
    },
    [write],
  );

  const setTracking = useCallback((on: boolean) => {
    tracking.current = on;
    if (on) pending.current = null;
    else {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      pending.current = null;
    }
  }, []);

  useEffect(() => flush, [flush]);

  return {
    onViewableItemsChanged,
    viewabilityConfig: useRef({ itemVisiblePercentThreshold: 40 }).current,
    saveNow,
    setTracking,
    flush,
  };
}
