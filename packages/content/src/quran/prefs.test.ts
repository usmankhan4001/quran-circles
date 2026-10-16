import { describe, expect, it } from 'vitest';
import { createMemoryStorage } from '../storage/memory';
import {
  ARABIC_ZOOM_STEPS,
  arabicZoom,
  clampZoomIndex,
  createReaderPrefsStore,
  DEFAULT_ARABIC_ZOOM_INDEX,
  DEFAULT_READER_PREFS,
  zoomIndexFromV1Rem,
} from './prefs';

describe('reader preferences', () => {
  it('starts with the translation on and the default size', async () => {
    const store = createReaderPrefsStore(createMemoryStorage());
    expect(await store.load()).toEqual(DEFAULT_READER_PREFS);
    expect(DEFAULT_READER_PREFS.showTranslation).toBe(true);
    expect(arabicZoom(DEFAULT_ARABIC_ZOOM_INDEX)).toBe(1);
  });

  it('remembers the choice', async () => {
    const storage = createMemoryStorage();
    await createReaderPrefsStore(storage).save({ showTranslation: false, arabicZoomIndex: 4 });
    expect(await createReaderPrefsStore(storage).load()).toEqual({
      showTranslation: false,
      arabicZoomIndex: 4,
    });
  });

  it('keeps the size inside the available steps', async () => {
    expect(clampZoomIndex(-3)).toBe(0);
    expect(clampZoomIndex(99)).toBe(ARABIC_ZOOM_STEPS.length - 1);
    expect(clampZoomIndex(2.9)).toBe(2);
    expect(clampZoomIndex(Number.NaN)).toBe(DEFAULT_ARABIC_ZOOM_INDEX);
    const store = createReaderPrefsStore(createMemoryStorage());
    expect((await store.save({ showTranslation: true, arabicZoomIndex: 50 })).arabicZoomIndex).toBe(
      ARABIC_ZOOM_STEPS.length - 1,
    );
  });

  it('falls back to defaults for damaged data', async () => {
    const storage = createMemoryStorage({ 'qc.quran.prefs.v1': '{"showTranslation":"yes"}' });
    expect(await createReaderPrefsStore(storage).load()).toEqual(DEFAULT_READER_PREFS);
  });

  it('maps a V1 size in rem to the nearest step', () => {
    expect(zoomIndexFromV1Rem(2.4)).toBe(DEFAULT_ARABIC_ZOOM_INDEX);
    expect(zoomIndexFromV1Rem(1.5)).toBe(0);
    expect(zoomIndexFromV1Rem(5)).toBe(ARABIC_ZOOM_STEPS.length - 1);
    expect(zoomIndexFromV1Rem(3.6)).toBe(3); // 1.5 times the default
    expect(zoomIndexFromV1Rem(Number.NaN)).toBe(DEFAULT_ARABIC_ZOOM_INDEX);
    expect(zoomIndexFromV1Rem(-1)).toBe(DEFAULT_ARABIC_ZOOM_INDEX);
  });
});
