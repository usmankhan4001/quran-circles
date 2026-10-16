import { ayahCountOf, isSurahNumber, SURAHS } from './surahs';

/** 1 to 114. A plain number: the range is checked by `isSurahNumber`. */
export type SurahNumber = number;

export interface AyahRef {
  surah: SurahNumber;
  ayah: number;
}

/** "2:255". The key V1 stored in browser bookmarks and the online source uses. */
export function formatVerseKey(ref: AyahRef): string {
  return `${ref.surah}:${ref.ayah}`;
}

/** Parses "2:255". Returns null for anything that is not an ayah that exists. */
export function parseVerseKey(key: unknown): AyahRef | null {
  if (typeof key !== 'string') return null;
  const match = /^\s*(\d{1,3})\s*:\s*(\d{1,3})\s*$/.exec(key);
  if (!match) return null;
  const ref = { surah: Number(match[1]), ayah: Number(match[2]) };
  return isValidAyah(ref.surah, ref.ayah) ? ref : null;
}

export function isValidAyah(surah: number, ayah: number): boolean {
  return (
    isSurahNumber(surah) && Number.isInteger(ayah) && ayah >= 1 && ayah <= ayahCountOf(surah)
  );
}

/** Keeps an ayah number inside the surah. */
export function clampAyah(surah: number, ayah: number): number {
  const max = ayahCountOf(surah);
  if (max === 0) return 1;
  if (!Number.isFinite(ayah)) return 1;
  return Math.min(Math.max(Math.trunc(ayah), 1), max);
}

const cumulative: number[] = (() => {
  const out: number[] = [0];
  for (const s of SURAHS) out.push((out[out.length - 1] ?? 0) + s.ayahCount);
  return out;
})();

/** The position of an ayah in the whole Quran, 1 to 6236. */
export function absoluteAyahNumber(ref: AyahRef): number {
  return (cumulative[ref.surah - 1] ?? 0) + ref.ayah;
}

/** The ayah that follows, crossing into the next surah. Null after 114:6. */
export function nextAyah(ref: AyahRef): AyahRef | null {
  if (ref.ayah < ayahCountOf(ref.surah)) return { surah: ref.surah, ayah: ref.ayah + 1 };
  if (ref.surah < SURAHS.length) return { surah: ref.surah + 1, ayah: 1 };
  return null;
}
