import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@qc/ui';
import { createTestServices } from '../test/render';
import { fakeVerse } from '../test/fakes';
import { ContentProvider } from './context';
import { POSITION_SAVE_DELAY_MS, usePositionTracker } from './positionTracker';
import type { ReaderRow } from './reader';

const verseRow = (surah: number, ayah: number): ReaderRow => ({
  type: 'verse',
  key: `${surah}:${ayah}`,
  verse: fakeVerse(surah, ayah),
  text: `FAKE-AR ${surah}:${ayah}`,
});
const headingRow: ReaderRow = { type: 'heading', key: 'h-2', surah: null, bismillah: null };

function setup() {
  const t = createTestServices();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ThemeProvider>
      <ContentProvider services={t.services}>{children}</ContentProvider>
    </ThemeProvider>
  );
  const hook = renderHook(() => usePositionTracker(), { wrapper });
  return { t, hook };
}

const view = (...rows: ReaderRow[]) => ({ viewableItems: rows.map((item) => ({ item })) });

describe('usePositionTracker', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('saves the top verse on screen a moment after scrolling stops', async () => {
    const { t, hook } = setup();
    act(() => hook.result.current.setTracking(true));
    act(() =>
      hook.result.current.onViewableItemsChanged(
        view(headingRow, verseRow(2, 40), verseRow(2, 41)),
      ),
    );
    expect(await t.services.readingPosition.getLocal()).toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POSITION_SAVE_DELAY_MS);
    });
    expect(await t.services.readingPosition.getLocal()).toMatchObject({ surah: 2, ayah: 40 });
  });

  it('saves only the last place while the person keeps scrolling', async () => {
    const { t, hook } = setup();
    act(() => hook.result.current.setTracking(true));
    for (const ayah of [10, 20, 30]) {
      act(() => hook.result.current.onViewableItemsChanged(view(verseRow(2, ayah))));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(POSITION_SAVE_DELAY_MS - 100);
      });
    }
    expect(await t.services.readingPosition.getLocal()).toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(await t.services.readingPosition.getLocal()).toMatchObject({ surah: 2, ayah: 30 });
  });

  it('does not overwrite the saved place while the reader is still scrolling to it', async () => {
    const { t, hook } = setup();
    await t.services.readingPosition.save(18, 60);
    // Tracking is off until the reader has reached the place it was asked to open.
    act(() => hook.result.current.onViewableItemsChanged(view(verseRow(18, 1))));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POSITION_SAVE_DELAY_MS * 2);
    });
    expect(await t.services.readingPosition.getLocal()).toMatchObject({ surah: 18, ayah: 60 });
  });

  it('drops what was seen before tracking began', async () => {
    const { t, hook } = setup();
    act(() => hook.result.current.onViewableItemsChanged(view(verseRow(18, 1))));
    act(() => hook.result.current.setTracking(true));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POSITION_SAVE_DELAY_MS * 2);
    });
    expect(await t.services.readingPosition.getLocal()).toBeNull();
  });

  it('ignores headings, and saves a chosen place at once', async () => {
    const { t, hook } = setup();
    act(() => hook.result.current.setTracking(true));
    act(() => hook.result.current.onViewableItemsChanged(view(headingRow)));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POSITION_SAVE_DELAY_MS * 2);
    });
    expect(await t.services.readingPosition.getLocal()).toBeNull();
    await act(async () => {
      hook.result.current.saveNow({ surah: 36, ayah: 5 });
      await Promise.resolve();
    });
    expect(await t.services.readingPosition.getLocal()).toMatchObject({ surah: 36, ayah: 5 });
  });

  it('saves what is waiting when the reader closes', async () => {
    const { t, hook } = setup();
    act(() => hook.result.current.setTracking(true));
    act(() => hook.result.current.onViewableItemsChanged(view(verseRow(55, 9))));
    hook.unmount();
    await act(async () => {
      await Promise.resolve();
    });
    expect(await t.services.readingPosition.getLocal()).toMatchObject({ surah: 55, ayah: 9 });
  });
});
