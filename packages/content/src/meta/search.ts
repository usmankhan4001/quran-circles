import { SURAHS, type SurahInfo } from './surahs';

/**
 * Search by surah name. People type names the way they say them, so the search accepts the
 * English transliteration ("Al-Baqarah"), the common Roman Urdu spellings ("Yaseen", "Rehman",
 * "Kausar"), the English meaning ("The Cow") and the Arabic or Urdu script ("البقرہ"). It never
 * searches Quran text.
 */

/** Spellings that do not follow from the transliteration or its sound, mostly alternative names. */
const ALIASES: Readonly<Record<number, readonly string[]>> = {
  1: ['Fateha', 'Al-Hamd', 'Alhamd', 'Umm al-Kitab'],
  2: ['Baqra', 'Bakra'],
  3: ['Aal-e-Imran', 'Ale Imran', 'Aal Imran'],
  5: ['Maida', 'Maidah'],
  9: ['Tauba', 'Toba', 'Tobah', 'Bara-at', 'Baraat'],
  17: ['Bani Israel', 'Bani Israil'],
  18: ['Kahaf'],
  36: ['Yaseen', 'Yasin'],
  55: ['Rehman', 'Rahmaan'],
  56: ['Waqia', 'Waqiah'],
  67: ['Tabarak', 'Tabarakallazi'],
  96: ['Iqra', 'Alaq'],
  108: ['Kausar', 'Kosar', 'Kauser', 'Kowsar'],
  111: ['Lahab', 'Tabbat'],
  112: ['Ikhlaas', 'Qul Huwallahu'],
  113: ['Falaq', 'Falak'],
  114: ['Naas', 'Nas'],
};

const ARTICLE = /^(?:al|an|ar|as|ash|at|ad|az|adh|ath)(?=[\s\-'’ʻ])/i;

function letters(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
}

/** "Al-Baqarah" gives "albaqarah" and "baqarah"; "Ali 'Imran" gives "aliimran" and "imran". */
function nameKeys(name: string): string[] {
  const keys = new Set<string>();
  const whole = letters(name);
  if (whole) keys.add(whole);
  const withoutArticle = letters(name.replace(ARTICLE, ''));
  if (withoutArticle) keys.add(withoutArticle);
  for (const word of name.split(/[\s-]+/)) {
    const key = letters(word);
    if (key.length >= 2) keys.add(key);
  }
  return [...keys];
}

/**
 * A rough sound of a Latin spelling, so "Yaseen" meets "Ya-Sin" and "Rehman" meets "Rahman":
 * vowels, a later "w" or "y" and a final "h" go, "th" and "dh" become "s" and "z", "q" becomes
 * "k", and repeated letters collapse.
 */
export function soundKey(value: string): string {
  let text = letters(value).replace(/th/g, 's').replace(/dh/g, 'z').replace(/q/g, 'k');
  const first = text.charAt(0);
  text = first + text.slice(1).replace(/[wy]/g, '');
  text = text.replace(/(?!^)[aeiou]/g, '').replace(/^[aeiou]+/, '');
  text = text.replace(/(.)\1+/g, '$1');
  return text.replace(/h$/, '');
}

const ARABIC_MARKS = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;

/** Folds Arabic and Urdu spellings of the same letters together and drops marks and spaces. */
export function normalizeScript(value: string): string {
  return value
    .normalize('NFC')
    .replace(ARABIC_MARKS, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/[ةۃہھ]/g, 'ه')
    .replace(/[ىيیێ]/g, 'ي')
    .replace(/[كک]/g, 'ك')
    .replace(/\s+/g, '')
    .replace(/^(?:سورة|سورۃ|سوره|سورہ)/, '')
    .replace(/^ال/, '');
}

const hasArabicScript = (value: string) => /[؀-ۿ]/.test(value);

interface Index {
  surah: SurahInfo;
  names: string[];
  sounds: string[];
  meaning: string;
  script: string;
}

const index: readonly Index[] = SURAHS.map((surah) => {
  const labels = [surah.nameSimple, ...(ALIASES[surah.id] ?? [])];
  const names = [...new Set(labels.flatMap(nameKeys))];
  return {
    surah,
    names,
    sounds: [...new Set(names.map(soundKey).filter(Boolean))],
    meaning: letters(surah.nameEnglish),
    script: normalizeScript(surah.nameArabic),
  };
});

export type SurahMatch = 'all' | 'number' | 'name' | 'sound' | 'meaning' | 'script';

export interface SurahSearchResult {
  surah: SurahInfo;
  matchedBy: SurahMatch;
}

/**
 * Finds surahs by number or name. An empty query returns all 114 in order. Results are ordered
 * by how close the match is, then by surah number.
 */
export function searchSurahs(query: string): SurahSearchResult[] {
  const raw = query.trim();
  if (!raw) return SURAHS.map((surah) => ({ surah, matchedBy: 'all' }));

  if (/^\d{1,3}$/.test(raw)) {
    const id = Number(raw);
    const hit = SURAHS.find((s) => s.id === id);
    return hit ? [{ surah: hit, matchedBy: 'number' }] : [];
  }

  if (hasArabicScript(raw)) {
    const needle = normalizeScript(raw);
    if (!needle) return [];
    return index
      .filter((entry) => entry.script.includes(needle))
      .map((entry) => ({ surah: entry.surah, matchedBy: 'script' as const }));
  }

  const needle = letters(raw.replace(/^(?:surah|surat|sura|soorah|soorat)[\s-]+/i, ''));
  if (!needle) return [];
  const needleSound = soundKey(needle);

  const ranked: { entry: Index; tier: number; matchedBy: SurahMatch }[] = [];
  for (const entry of index) {
    const exact = entry.names.includes(needle);
    const prefix = entry.names.some((key) => key.startsWith(needle));
    const inside = needle.length >= 3 && entry.names.some((key) => key.includes(needle));
    if (exact) ranked.push({ entry, tier: 0, matchedBy: 'name' });
    else if (prefix) ranked.push({ entry, tier: 1, matchedBy: 'name' });
    else if (inside) ranked.push({ entry, tier: 2, matchedBy: 'name' });
    else if (needleSound.length >= 2 && entry.sounds.includes(needleSound)) {
      ranked.push({ entry, tier: 3, matchedBy: 'sound' });
    } else if (needleSound.length >= 2 && entry.sounds.some((s) => s.startsWith(needleSound))) {
      ranked.push({ entry, tier: 4, matchedBy: 'sound' });
    } else if (needle.length >= 3 && entry.meaning.includes(needle)) {
      ranked.push({ entry, tier: 5, matchedBy: 'meaning' });
    }
  }
  ranked.sort((a, b) => a.tier - b.tier || a.entry.surah.id - b.entry.surah.id);
  return ranked.map(({ entry, matchedBy }) => ({ surah: entry.surah, matchedBy }));
}
