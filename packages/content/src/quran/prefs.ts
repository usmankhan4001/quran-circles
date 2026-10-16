import { z } from 'zod';
import { readJson, writeJson } from '../storage/json';
import type { KeyValueStorage } from '../storage/types';

/**
 * The Arabic size the reader offers, as a multiplier on the Quran type role. The app-wide text
 * size (four steps) scales on top of this, so the two controls stack. Index 1 is the default.
 */
export const ARABIC_ZOOM_STEPS = [0.8, 1, 1.25, 1.5, 1.85, 2.2] as const;
export const DEFAULT_ARABIC_ZOOM_INDEX = 1;

export interface ReaderPrefs {
  /** Show the Urdu translation under each ayah. */
  showTranslation: boolean;
  /** An index into ARABIC_ZOOM_STEPS. */
  arabicZoomIndex: number;
}

export const DEFAULT_READER_PREFS: ReaderPrefs = {
  showTranslation: true,
  arabicZoomIndex: DEFAULT_ARABIC_ZOOM_INDEX,
};

const PrefsSchema = z.object({
  showTranslation: z.boolean(),
  arabicZoomIndex: z.number().int(),
});
const KEY = 'qc.quran.prefs.v1';

export function clampZoomIndex(index: number): number {
  if (!Number.isFinite(index)) return DEFAULT_ARABIC_ZOOM_INDEX;
  return Math.min(Math.max(Math.trunc(index), 0), ARABIC_ZOOM_STEPS.length - 1);
}

export function arabicZoom(index: number): number {
  return ARABIC_ZOOM_STEPS[clampZoomIndex(index)] ?? 1;
}

/**
 * V1 kept the Arabic size in rem (1.5 to 5, default 2.4). The nearest V2 step is the one whose
 * ratio to the V1 default is closest.
 */
export function zoomIndexFromV1Rem(rem: number): number {
  if (!Number.isFinite(rem) || rem <= 0) return DEFAULT_ARABIC_ZOOM_INDEX;
  const ratio = rem / 2.4;
  let best = DEFAULT_ARABIC_ZOOM_INDEX;
  let bestGap = Number.POSITIVE_INFINITY;
  ARABIC_ZOOM_STEPS.forEach((step, i) => {
    const gap = Math.abs(step - ratio);
    if (gap < bestGap) {
      best = i;
      bestGap = gap;
    }
  });
  return best;
}

export interface ReaderPrefsStore {
  load(): Promise<ReaderPrefs>;
  save(prefs: ReaderPrefs): Promise<ReaderPrefs>;
}

export function createReaderPrefsStore(storage: KeyValueStorage): ReaderPrefsStore {
  return {
    async load() {
      const saved = await readJson(storage, KEY, PrefsSchema);
      if (!saved) return DEFAULT_READER_PREFS;
      return { showTranslation: saved.showTranslation, arabicZoomIndex: clampZoomIndex(saved.arabicZoomIndex) };
    },
    async save(prefs) {
      const clean = { showTranslation: prefs.showTranslation, arabicZoomIndex: clampZoomIndex(prefs.arabicZoomIndex) };
      await writeJson(storage, KEY, clean);
      return clean;
    },
  };
}
