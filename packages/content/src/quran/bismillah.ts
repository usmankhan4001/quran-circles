import type { QuranVerse } from './types';

/** The opening formula is its own line in the reader, not part of the first ayah. */
export interface SplitVerse {
  /** The ayah text without the opening formula. */
  text: string;
  /** The opening formula as the source wrote it, when the ayah began with it. */
  bismillah: string | null;
}

const WORDS_IN_BISMILLAH = 4;

/**
 * The online text puts the opening formula at the start of ayah 1 of every surah except
 * Al-Fatihah (where it is ayah 1 itself) and At-Tawbah (which has none). V1 cut it off and
 * showed it once at the top. This does the same, by position: the formula is the first four
 * words. That way the formula is read from the fetched text and not kept in this repository.
 */
export function splitBismillah(verse: Pick<QuranVerse, 'surah' | 'ayah' | 'arabic'>): SplitVerse {
  if (verse.ayah !== 1 || verse.surah === 1 || verse.surah === 9) {
    return { text: verse.arabic, bismillah: null };
  }
  const words = verse.arabic.trim().split(/\s+/);
  if (words.length <= WORDS_IN_BISMILLAH) return { text: verse.arabic, bismillah: null };
  return {
    bismillah: words.slice(0, WORDS_IN_BISMILLAH).join(' '),
    text: words.slice(WORDS_IN_BISMILLAH).join(' '),
  };
}

/** The opening formula of a passage, taken from the first surah in it that has one. */
export function passageBismillah(verses: readonly QuranVerse[]): string | null {
  for (const verse of verses) {
    const { bismillah } = splitBismillah(verse);
    if (bismillah) return bismillah;
  }
  return null;
}
