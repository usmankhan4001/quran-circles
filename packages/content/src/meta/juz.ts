import { absoluteAyahNumber, type AyahRef } from './ayah';
import { ayahCountOf, JUZ_COUNT, SURAHS } from './surahs';

/**
 * Where each juz (para) starts, as surah and ayah. Boundaries follow the standard 30-part
 * division of the Madinah mushaf. Static metadata, not Quran text.
 */
export const JUZ_STARTS: readonly AyahRef[] = [
  [1, 1],
  [2, 142],
  [2, 253],
  [3, 93],
  [4, 24],
  [4, 148],
  [5, 82],
  [6, 111],
  [7, 88],
  [8, 41],
  [9, 93],
  [11, 6],
  [12, 53],
  [15, 1],
  [17, 1],
  [18, 75],
  [21, 1],
  [23, 1],
  [25, 21],
  [27, 56],
  [29, 46],
  [33, 31],
  [36, 28],
  [39, 32],
  [41, 47],
  [46, 1],
  [51, 31],
  [58, 1],
  [67, 1],
  [78, 1],
].map(([surah, ayah]) => ({ surah: surah as number, ayah: ayah as number }));

export function isJuzNumber(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= JUZ_COUNT;
}

export function juzStart(juz: number): AyahRef {
  const start = JUZ_STARTS[juz - 1];
  if (!start) throw new RangeError(`Juz ${juz} does not exist`);
  return start;
}

/** The last ayah of a juz. */
export function juzEnd(juz: number): AyahRef {
  if (juz === JUZ_COUNT) {
    const last = SURAHS[SURAHS.length - 1];
    return { surah: 114, ayah: last?.ayahCount ?? 6 };
  }
  const next = juzStart(juz + 1);
  if (next.ayah > 1) return { surah: next.surah, ayah: next.ayah - 1 };
  return { surah: next.surah - 1, ayah: ayahCountOf(next.surah - 1) };
}

/** Which juz an ayah belongs to, 1 to 30. */
export function juzOf(ref: AyahRef): number {
  const at = absoluteAyahNumber(ref);
  let found = 1;
  for (let i = 0; i < JUZ_STARTS.length; i++) {
    const start = JUZ_STARTS[i];
    if (start && absoluteAyahNumber(start) <= at) found = i + 1;
  }
  return found;
}

export interface JuzSegment {
  surah: number;
  fromAyah: number;
  toAyah: number;
}

/** The surah parts a juz covers, in reading order. */
export function juzSegments(juz: number): JuzSegment[] {
  const start = juzStart(juz);
  const end = juzEnd(juz);
  const segments: JuzSegment[] = [];
  for (let surah = start.surah; surah <= end.surah; surah++) {
    segments.push({
      surah,
      fromAyah: surah === start.surah ? start.ayah : 1,
      toAyah: surah === end.surah ? end.ayah : ayahCountOf(surah),
    });
  }
  return segments;
}
