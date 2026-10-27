/**
 * Marks that the bundled KFGQPC Uthmanic Script HAFS (v0.09) cannot draw. It has a glyph for each
 * code point the Tanzil text uses, but for these it is a filled dotted circle on the baseline
 * instead of a small sign over or under the letter (checked by rendering the text with the font).
 *
 * - U+06DF small high rounded zero (the silent alef after a waw, about 4,000 times) shows as the
 *   small zero U+06E0, which this font does draw above the letter.
 * - U+06ED small low meem (about 4,800 times), U+06EA and U+06EB are left out: the font has no
 *   sign for them, and a missing recitation sign is better than a black dot inside a word.
 *
 * The letters and vowels are never touched. Replacing the font with one that draws all of Tanzil's
 * signs (for example Amiri Quran, SIL OFL) is the full fix and a UI-kit change.
 */
const SUBSTITUTES: Record<string, string> = {
  '۟': '۠',
  'ۭ': '',
  '۪': '',
  '۫': '',
};

/** The Arabic text with the marks the bundled font cannot draw changed or removed. */
export function forQuranFont(text: string): string {
  return text.replace(/[ۭ۪۟۫]/g, (mark) => SUBSTITUTES[mark] ?? mark);
}
