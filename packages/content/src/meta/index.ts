// `@qc/content/meta`: surah, ayah and juz facts (names and counts only: no Quran text).
export {
  SURAHS,
  SURAH_COUNT,
  JUZ_COUNT,
  TOTAL_AYAHS,
  getSurah,
  ayahCountOf,
  isSurahNumber,
  type SurahInfo,
} from './surahs';
export {
  absoluteAyahNumber,
  clampAyah,
  formatVerseKey,
  isValidAyah,
  nextAyah,
  parseVerseKey,
  type AyahRef,
} from './ayah';
export {
  JUZ_STARTS,
  isJuzNumber,
  juzEnd,
  juzOf,
  juzSegments,
  juzStart,
  type JuzSegment,
} from './juz';
export { searchSurahs, type SurahMatch, type SurahSearchResult } from './search';
