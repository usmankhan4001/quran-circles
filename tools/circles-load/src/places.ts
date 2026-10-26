import { normalise } from './clean';

/**
 * Provinces, as the app's fixtures code them. The source file names no province, so each city is
 * assigned one here; a city whose province is not certain is flagged for a person to check.
 */
export const PROVINCES: readonly { code: string; en: string; ur: string }[] = [
  { code: 'PB', en: 'Punjab', ur: 'پنجاب' },
  { code: 'SD', en: 'Sindh', ur: 'سندھ' },
  { code: 'KP', en: 'Khyber Pakhtunkhwa', ur: 'خیبر پختونخوا' },
  { code: 'ICT', en: 'Islamabad Capital Territory', ur: 'وفاقی دارالحکومت اسلام آباد' },
  { code: 'AJK', en: 'Azad Jammu and Kashmir', ur: 'آزاد جموں و کشمیر' },
];

/** English name (as normalised) to province code and Urdu name. `sure: false` marks a guess. */
const KNOWN: Readonly<Record<string, { province: string; ur: string; sure?: false }>> = {
  arifwala: { province: 'PB', ur: 'عارف والا' },
  'azad kashmir': { province: 'AJK', ur: 'آزاد کشمیر' },
  bahawalnagar: { province: 'PB', ur: 'بہاولنگر' },
  bajaur: { province: 'KP', ur: 'باجوڑ' },
  burewala: { province: 'PB', ur: 'بورے والا' },
  chakwal: { province: 'PB', ur: 'چکوال' },
  chishtian: { province: 'PB', ur: 'چشتیاں' },
  'dera ghazi khan': { province: 'PB', ur: 'ڈیرہ غازی خان' },
  dir: { province: 'KP', ur: 'دیر' },
  'dunga bunga': { province: 'PB', ur: 'ڈونگا بونگا' },
  faisalabad: { province: 'PB', ur: 'فیصل آباد' },
  faqirwali: { province: 'PB', ur: 'فقیر والی' },
  ferozewala: { province: 'PB', ur: 'فیروز والا' },
  'gujar khan': { province: 'PB', ur: 'گوجر خان' },
  haroonabad: { province: 'PB', ur: 'ہارون آباد' },
  hayati: { province: 'KP', ur: 'حیاتی', sure: false },
  hyderabad: { province: 'SD', ur: 'حیدرآباد' },
  islamabad: { province: 'ICT', ur: 'اسلام آباد' },
  jatlan: { province: 'AJK', ur: 'جٹلاں' },
  jauharabad: { province: 'PB', ur: 'جوہرآباد' },
  jhang: { province: 'PB', ur: 'جھنگ' },
  jhelum: { province: 'PB', ur: 'جہلم' },
  karachi: { province: 'SD', ur: 'کراچی' },
  lahore: { province: 'PB', ur: 'لاہور' },
  layyah: { province: 'PB', ur: 'لیہ' },
  mamund: { province: 'KP', ur: 'ماموند' },
  mardan: { province: 'KP', ur: 'مردان' },
  mingora: { province: 'KP', ur: 'مینگورہ' },
  multan: { province: 'PB', ur: 'ملتان' },
  muzaffarabad: { province: 'AJK', ur: 'مظفرآباد' },
  muzaffargarh: { province: 'PB', ur: 'مظفرگڑھ' },
  ouch: { province: 'PB', ur: 'اوچ', sure: false },
  peshawar: { province: 'KP', ur: 'پشاور' },
  rawalpindi: { province: 'PB', ur: 'راولپنڈی' },
  sadiqabad: { province: 'PB', ur: 'صادق آباد' },
  'sagri rawat': { province: 'PB', ur: 'ساگری راوت', sure: false },
  sahiwal: { province: 'PB', ur: 'ساہیوال' },
  sargodha: { province: 'PB', ur: 'سرگودھا' },
  shakreela: { province: 'PB', ur: 'شکریلہ', sure: false },
  sheikhupura: { province: 'PB', ur: 'شیخوپورہ' },
  swat: { province: 'KP', ur: 'سوات' },
  yatimwala: { province: 'PB', ur: 'یتیم والا', sure: false },
};

export interface PlaceRow {
  slug: string;
  en: string;
  ur: string;
  province: string;
  /** False when the province was guessed, or the city is not in the known list. */
  sure: boolean;
}

export const slugOf = (name: string): string => normalise(name).replace(/\s+/g, '-');

/** One city per distinct city value in the file, in alphabetical order. */
export function placeRows(cityNames: readonly string[]): PlaceRow[] {
  const seen = new Map<string, string>();
  for (const name of cityNames) {
    const key = normalise(name);
    if (key && !seen.has(key)) seen.set(key, name.trim());
  }
  return [...seen.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, en]) => {
      const known = KNOWN[key];
      return {
        slug: slugOf(en),
        en,
        ur: known?.ur ?? en,
        province: known?.province ?? 'PB',
        sure: known !== undefined && known.sure !== false,
      };
    });
}

const q = (text: string): string => `'${text.replace(/'/g, "''")}'`;

/**
 * Idempotent SQL that creates the provinces, one city per row and one area per city (the area is
 * the city itself: the source names no areas, and the app requires one). Safe to run twice:
 * every insert skips rows that already exist by their natural key.
 */
export function placesSql(rows: readonly PlaceRow[]): string {
  const lines: string[] = [
    '-- Provinces, cities and one area per city for the circles load. Idempotent.',
    'BEGIN;',
    'INSERT INTO provinces (code, name_en, name_ur) VALUES',
    PROVINCES.map((p) => `  (${q(p.code)}, ${q(p.en)}, ${q(p.ur)})`).join(',\n'),
    'ON CONFLICT (code) DO NOTHING;',
    '',
  ];
  for (const r of rows) {
    lines.push(
      `INSERT INTO cities (province_id, slug, name_en, name_ur)`,
      `  SELECT id, ${q(r.slug)}, ${q(r.en)}, ${q(r.ur)} FROM provinces WHERE code = ${q(r.province)}`,
      `  ON CONFLICT (slug) DO NOTHING;${r.sure ? '' : ' -- province guessed: check'}`,
      `INSERT INTO areas (city_id, slug, name_en, name_ur)`,
      `  SELECT id, ${q(`${r.slug}-city`)}, ${q(r.en)}, ${q(r.ur)} FROM cities WHERE slug = ${q(r.slug)}`,
      `  ON CONFLICT (city_id, slug) DO NOTHING;`,
    );
  }
  lines.push(
    'COMMIT;',
    "SELECT 'provinces' AS t, count(*) FROM provinces UNION ALL SELECT 'cities', count(*) FROM cities UNION ALL SELECT 'areas', count(*) FROM areas;",
    '',
  );
  return lines.join('\n');
}
