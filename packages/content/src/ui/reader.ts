import { ayahCountOf } from '../meta/surahs';
import { parseVerseKey } from '../meta/ayah';
import { splitBismillah } from '../quran/bismillah';
import type { PassageKind, QuranPassage, QuranVerse } from '../quran/types';

/** A verse's translation in the screen language, with the language it is written in. */
export interface VerseTranslation {
  lang: 'en' | 'ur';
  /** Null when this ayah has no translation in that language. */
  text: string | null;
}

/**
 * The translation a screen shows under the Arabic: Maududi's Urdu on an Urdu screen, his
 * English on an English screen. The other language's translation is never shown in its place.
 */
export function verseTranslation(verse: QuranVerse, locale: 'en' | 'ur'): VerseTranslation {
  return locale === 'ur' ? { lang: 'ur', text: verse.urdu } : { lang: 'en', text: verse.english };
}

/** What the reader is asked to open. */
export interface ReaderTarget {
  kind: PassageKind;
  /** The surah (1 to 114) or juz (1 to 30). */
  id: number;
  /** The ayah to scroll to. For a surah: its number. For a juz: a number inside the juz. */
  ayah?: number;
  /** For a juz target that came from an ayah bookmark: the surah the ayah is in. */
  surah?: number;
}

/** One line of the reader's list. */
export type ReaderRow =
  | {
      type: 'heading';
      key: string;
      /** The surah that starts here, shown by name in a juz. Null in a surah, where the header names it. */
      surah: number | null;
      /** The opening formula, from the fetched text. */
      bismillah: string | null;
    }
  | { type: 'verse'; key: string; verse: QuranVerse; text: string };

/**
 * Lays a passage out as rows. The opening formula of each surah becomes its own row (as V1 did),
 * cut from the first ayah by position. In a juz, every surah gets a heading with its name.
 */
export function buildRows(passage: Pick<QuranPassage, 'kind' | 'verses'>): ReaderRow[] {
  const rows: ReaderRow[] = [];
  let lastSurah = -1;
  for (const verse of passage.verses) {
    const split = splitBismillah(verse);
    const newSurah = verse.surah !== lastSurah;
    if (passage.kind === 'juz' && newSurah) {
      rows.push({
        type: 'heading',
        key: `h-${verse.surah}`,
        surah: verse.surah,
        bismillah: split.bismillah,
      });
    } else if (passage.kind === 'surah' && split.bismillah) {
      rows.push({
        type: 'heading',
        key: `h-${verse.surah}`,
        surah: null,
        bismillah: split.bismillah,
      });
    }
    lastSurah = verse.surah;
    rows.push({ type: 'verse', key: `${verse.surah}:${verse.ayah}`, verse, text: split.text });
  }
  return rows;
}

/** The row to scroll to for a target, or 0. */
export function rowIndexFor(
  rows: readonly ReaderRow[],
  target: Pick<ReaderTarget, 'surah' | 'ayah' | 'id' | 'kind'>,
): number {
  if (target.ayah === undefined) return 0;
  const surah = target.kind === 'surah' ? target.id : target.surah;
  const index = rows.findIndex(
    (row) =>
      row.type === 'verse' &&
      row.verse.ayah === target.ayah &&
      (surah === undefined || row.verse.surah === surah),
  );
  if (index < 0) return 0;
  // Land on the formula or heading above the first ayah, so it is not hidden.
  const above = rows[index - 1];
  return above && above.type === 'heading' && target.ayah === 1 ? index - 1 : index;
}

export type JumpResult =
  { ok: true; surah: number; ayah: number } | { ok: false; reason: 'invalid' };

/**
 * Reads what the person typed in "Go to an ayah". In a surah: a number from 1 to the surah's last
 * ayah. In a juz: "255" (the first ayah with that number in the juz) or "2:255".
 */
export function resolveJump(
  input: string,
  passage: Pick<QuranPassage, 'kind' | 'id' | 'verses'>,
): JumpResult {
  const text = input.trim();
  if (passage.kind === 'surah') {
    if (!/^\d{1,3}$/.test(text)) return { ok: false, reason: 'invalid' };
    const ayah = Number(text);
    if (ayah < 1 || ayah > ayahCountOf(passage.id)) return { ok: false, reason: 'invalid' };
    return { ok: true, surah: passage.id, ayah };
  }
  const key = parseVerseKey(text);
  if (key) {
    const found = passage.verses.some((v) => v.surah === key.surah && v.ayah === key.ayah);
    return found ? { ok: true, ...key } : { ok: false, reason: 'invalid' };
  }
  if (!/^\d{1,3}$/.test(text)) return { ok: false, reason: 'invalid' };
  const ayah = Number(text);
  const hit = passage.verses.find((v) => v.ayah === ayah);
  return hit ? { ok: true, surah: hit.surah, ayah } : { ok: false, reason: 'invalid' };
}

/** The reader target for a saved bookmark. */
export function targetForBookmark(b: {
  kind: 'ayah' | 'surah' | 'para';
  surah: number | null;
  ayah: number | null;
  para: number | null;
}): ReaderTarget | null {
  if (b.kind === 'ayah' && b.surah !== null && b.ayah !== null) {
    return { kind: 'surah', id: b.surah, ayah: b.ayah };
  }
  if (b.kind === 'surah' && b.surah !== null) return { kind: 'surah', id: b.surah };
  if (b.kind === 'para' && b.para !== null) return { kind: 'juz', id: b.para };
  return null;
}
