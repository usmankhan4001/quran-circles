/**
 * The ayah of the day. The Quran text lives in `@qc/content`, which the screens do not import,
 * so Home shows the place (surah and ayah) and opens the reader there.
 * TODO(content): show the Arabic and translation once the package exports an ayah card.
 */
export interface AyahPlace {
  surah: number;
  ayah: number;
}

// Well-known places, in a fixed order. The same place shows all day, for everyone.
export const DAILY_AYAHS: readonly AyahPlace[] = [
  { surah: 2, ayah: 255 },
  { surah: 1, ayah: 5 },
  { surah: 18, ayah: 10 },
  { surah: 94, ayah: 5 },
  { surah: 112, ayah: 1 },
  { surah: 3, ayah: 139 },
  { surah: 24, ayah: 35 },
  { surah: 59, ayah: 22 },
  { surah: 55, ayah: 13 },
  { surah: 93, ayah: 3 },
  { surah: 2, ayah: 286 },
  { surah: 67, ayah: 2 },
  { surah: 103, ayah: 3 },
  { surah: 36, ayah: 1 },
];

const DAY_MS = 86_400_000;

/** The place for a date. It changes at midnight UTC, so the whole day shows the same one. */
export function ayahOfTheDay(now: Date): AyahPlace {
  const day = Math.floor(now.getTime() / DAY_MS);
  const index = ((day % DAILY_AYAHS.length) + DAILY_AYAHS.length) % DAILY_AYAHS.length;
  return DAILY_AYAHS[index]!;
}
