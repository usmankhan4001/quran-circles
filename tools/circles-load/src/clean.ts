export const PRAYERS = ['fajr', 'zuhr', 'asr', 'maghrib', 'isha'] as const;
export type Prayer = (typeof PRAYERS)[number];

/**
 * Placeholder start times for circles that begin "after" a prayer. The app has no prayer-anchored
 * start yet, so these are stand-ins, written into each session's description as such. They are
 * defaults chosen for the test load, not data from the source.
 */
export const PLACEHOLDER_TIMES: Readonly<Record<Prayer, string>> = {
  fajr: '05:30',
  zuhr: '13:15',
  asr: '16:45',
  maghrib: '18:45',
  isha: '20:15',
};

export type ParsedTime =
  | { kind: 'clock'; start: string; end: string | null }
  | { kind: 'prayer'; prayer: Prayer; explicit: string | null };

export interface RawRow {
  id: string;
  city: string;
  halqa_name?: string;
  halqa_code?: string;
  address: string;
  day: string;
  time: string;
  weeks: string;
  contact?: string;
  map_link?: string;
  map_note?: string;
  [column: string]: string | undefined;
}

export type RowStatus = 'import' | 'hold' | 'skip';

export interface CleanRow {
  id: string;
  city: string;
  code: string;
  nameUr: string;
  address: string;
  venueKey: string;
  day: number | null;
  time: ParsedTime | null;
  /** `every` week, or the weeks of the month it meets (1 to 5). */
  weeks: 'every' | number[] | null;
  phone: string | null;
  link: string;
  note: string;
  status: RowStatus;
  /** Codes only (never cell text), so a report can be shared. */
  flags: string[];
}

const DAYS: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

const PRAYER_WORDS: readonly [RegExp, Prayer][] = [
  [/\b(fajar|fajr|fajer)\b/, 'fajr'],
  [/\b(zohar|zuhr|zuhar|zohr|zhr|dhuhr)\b/, 'zuhr'],
  [/\b(asr|asar|asser)\b/, 'asr'],
  [/\b(maghrib|magrib|maghreb|magrab)\b/, 'maghrib'],
  [/\b(isha|esha|ishaa)\b/, 'isha'],
];

const pad = (n: number): string => String(n).padStart(2, '0');

export const normalise = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

export function parseDay(text: string): number | null {
  return DAYS[text.trim().toLowerCase()] ?? null;
}

export function parseWeeks(text: string): 'every' | number[] | null {
  const t = text.trim().toLowerCase();
  if (/^every week$/.test(t)) return 'every';
  const found = [...t.matchAll(/(\d)(?:st|nd|rd|th)/g)].map((m) => Number(m[1]));
  const weeks = [...new Set(found)].filter((n) => n >= 1 && n <= 5).sort();
  return weeks.length > 0 ? weeks : null;
}

/** `03001234567` and `+92 300 1234567` become `+923001234567`; anything else is refused. */
export function parsePhone(text: string): string | null {
  const digits = text.replace(/\D/g, '');
  if (/^03\d{9}$/.test(digits)) return `+92${digits.slice(1)}`;
  if (/^923\d{9}$/.test(digits)) return `+${digits}`;
  return null;
}

interface Clock {
  hour: number;
  minute: number;
  meridiem: 'am' | 'pm' | null;
}

const CLOCK = /(\d{1,2})\s*[:.]\s*(\d{2})\s*-?\s*(am|pm)?/g;

function clocks(text: string): Clock[] {
  return [...text.matchAll(CLOCK)].map((m) => ({
    hour: Number(m[1]),
    minute: Number(m[2]),
    meridiem: (m[3] as 'am' | 'pm' | undefined) ?? null,
  }));
}

function to24(c: Clock, context: 'am' | 'pm' | null): string | null {
  if (c.hour > 23 || c.minute > 59) return null;
  const m = c.meridiem ?? context;
  let h = c.hour;
  if (m) {
    if (h < 1 || h > 12) return null;
    h = (h % 12) + (m === 'pm' ? 12 : 0);
  }
  return `${pad(h)}:${pad(c.minute)}`;
}

/** Returns the time and the flags it raises (`suspect_time`, `ambiguous_time`, `unreadable_time`). */
export function parseTime(text: string): { time: ParsedTime | null; flags: string[] } {
  const t = text.trim().toLowerCase();
  if (!t) return { time: null, flags: ['unreadable_time'] };
  const found = clocks(t);
  const prayer = PRAYER_WORDS.find(([re]) => re.test(t))?.[1] ?? null;
  const context: 'am' | 'pm' | null = /\b(morning|subah|subha)\b/.test(t)
    ? 'am'
    : /\b(evening|night|raat|sham)\b/.test(t)
      ? 'pm'
      : null;

  if (prayer && (/\b(after|aftar|namaz|baad|bad)\b/.test(t) || found.length === 0)) {
    const explicit = found[0] ? to24(found[0], null) : null;
    return { time: { kind: 'prayer', prayer, explicit }, flags: [] };
  }
  if (found.length === 0) return { time: null, flags: ['unreadable_time'] };

  const start = to24(found[0]!, context);
  const end = found[1] ? to24(found[1], found[1].meridiem ?? found[0]!.meridiem ?? context) : null;
  if (!start) return { time: null, flags: ['unreadable_time'] };
  const flags: string[] = [];
  // 12:00 am is midnight: almost certainly a slip for noon in a "Morning" label.
  if (found[0]!.hour === 12 && (found[0]!.meridiem ?? context) === 'am') flags.push('suspect_time');
  // A bare clock with no am, pm or day-part word could be either.
  if (!found[0]!.meridiem && !context && found[0]!.hour <= 12) flags.push('ambiguous_time');
  return { time: { kind: 'clock', start, end }, flags };
}

const minutes = (hhmm: string): number => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));

const HOLD_FLAGS = new Set([
  'suspect_time',
  'ambiguous_time',
  'unreadable_time',
  'unreadable_day',
  'unreadable_weeks',
  'near_duplicate_time',
  'address_names_other_city',
  'missing_city',
  'missing_address',
]);

/** Cleans every row, then compares rows with each other (duplicates, typos, a wrong city). */
export function cleanRows(raw: readonly RawRow[], nearMinutes = 5): CleanRow[] {
  const cityNames = [...new Set(raw.map((r) => normalise(r.city)).filter((c) => c.length >= 4))];

  const rows = raw.map((r): CleanRow => {
    const flags: string[] = [];
    const time = parseTime(r.time);
    flags.push(...time.flags);
    const day = parseDay(r.day);
    if (day === null) flags.push('unreadable_day');
    const weeks = parseWeeks(r.weeks);
    if (weeks === null) flags.push('unreadable_weeks');
    const phoneText = (r.contact ?? '').trim();
    const phone = phoneText ? parsePhone(phoneText) : null;
    if (phoneText && !phone) flags.push('phone_invalid');
    const city = r.city.trim();
    const address = r.address.trim();
    if (!city) flags.push('missing_city');
    if (!address) flags.push('missing_address');
    const ownCity = normalise(city);
    const addr = normalise(address);
    if (
      cityNames.some(
        (c) => c !== ownCity && !ownCity.includes(c) && !c.includes(ownCity) && addr.includes(c),
      )
    )
      flags.push('address_names_other_city');
    return {
      id: r.id,
      city,
      code: (r.halqa_code ?? '').trim(),
      nameUr: (r.halqa_name ?? '').trim(),
      address,
      venueKey: `${ownCity}|${addr}`,
      day,
      time: time.time,
      weeks,
      phone,
      link: (r.map_link ?? '').trim(),
      note: (r.map_note ?? '').trim(),
      status: 'import',
      flags,
    };
  });

  // Same venue, same day, same time and pattern: an exact repeat is skipped. Two clock times at
  // one venue a few minutes apart but not equal (6:15 and 6:16, on the same day or not) are
  // probably one time typed twice: both are held until someone confirms.
  const seen = new Map<string, CleanRow[]>();
  const byVenue = new Map<string, CleanRow[]>();
  for (const row of rows) {
    if (row.day === null || row.time === null) continue;
    const slot = `${row.venueKey}|${row.day}`;
    const earlier = seen.get(slot) ?? [];
    const repeat = earlier.find(
      (o) =>
        JSON.stringify(o.time) === JSON.stringify(row.time) &&
        JSON.stringify(o.weeks) === JSON.stringify(row.weeks),
    );
    if (repeat) {
      row.flags.push(`duplicate_of:${repeat.id}`);
      continue;
    }
    seen.set(slot, [...earlier, row]);
    const venueRows = byVenue.get(row.venueKey) ?? [];
    for (const other of venueRows) {
      if (other.time?.kind !== 'clock' || row.time.kind !== 'clock') continue;
      const gap = Math.abs(minutes(other.time.start) - minutes(row.time.start));
      if (gap > 0 && gap <= nearMinutes) {
        if (!other.flags.includes('near_duplicate_time')) other.flags.push('near_duplicate_time');
        if (!row.flags.includes('near_duplicate_time')) row.flags.push('near_duplicate_time');
      }
    }
    byVenue.set(row.venueKey, [...venueRows, row]);
  }

  for (const row of rows) {
    row.status = row.flags.some((f) => f.startsWith('duplicate_of:'))
      ? 'skip'
      : row.flags.some((f) => HOLD_FLAGS.has(f))
        ? 'hold'
        : 'import';
  }
  return rows;
}
