import {
  DailyAyahPut,
  addDays,
  can,
  dailyAyahResource,
  pakistanDate,
  resolveDailyAyah,
  type AyahOfTheDay,
  type DailyAyahEntry,
  type DailyAyahTarget,
  type Localized,
  type Principal,
} from '@qc/contracts';
import { AYAH_COUNTS } from '@qc/contracts/bookmarks';

/**
 * The coordinator's ayah of the day pick (contract 1.0.0-rc.4): one venue or one circle, one date.
 * Pure rules, so the screen and its tests agree. The server checks everything again.
 */

/** A place a coordinator can pick for. A circle is checked at its venue (`dailyAyahResource`). */
export type AyahPlace =
  | { type: 'venue'; venueId: string; cityId: string; name: Localized }
  | { type: 'circle'; circleId: string; venueId: string; cityId: string; name: Localized };

/** How many days, starting today, the screen offers. */
export const PICK_DAYS = 30;

/** May this person set or remove picks for this place? National picks are the console's job. */
export function canPickFor(principal: Principal, place: AyahPlace): boolean {
  return can(
    principal,
    'daily_ayah.manage',
    dailyAyahResource(place.type, { cityId: place.cityId, venueId: place.venueId }),
  );
}

export function targetOf(place: AyahPlace): DailyAyahTarget {
  return place.type === 'venue'
    ? { type: 'venue', venueId: place.venueId }
    : { type: 'circle', circleId: place.circleId };
}

/** The list query for this place's own picks (a venue filter alone would also match its circles). */
export function placeQuery(place: AyahPlace): {
  scopeType: 'venue' | 'circle';
  venueId?: string;
  circleId?: string;
} {
  return place.type === 'venue'
    ? { scopeType: 'venue', venueId: place.venueId }
    : { scopeType: 'circle', circleId: place.circleId };
}

/** The dates the screen offers: today in Pakistan and the days after it. */
export function pickWindow(now: Date, days: number = PICK_DAYS): { from: string; to: string } {
  const from = pakistanDate(now);
  return { from, to: addDays(from, days - 1) };
}

export function datesIn(window: { from: string; to: string }): string[] {
  const out: string[] = [];
  for (let d = window.from; d <= window.to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** This place's pick for a date, if any. */
export function pickOn(
  date: string,
  picks: readonly DailyAyahEntry[],
  place: AyahPlace,
): DailyAyahEntry | undefined {
  return picks.find(
    (p) =>
      p.date === date &&
      p.scopeType === place.type &&
      (place.type === 'venue' ? p.venueId === place.venueId : p.circleId === place.circleId),
  );
}

/**
 * What followers see on a date when this place has no pick: the national pick, else the built-in
 * list. Same rule as the API and the push (`resolveDailyAyah`), given no followed place.
 * Someone who follows two places that both have a pick that day sees this too.
 */
export function fallbackOn(date: string, nationalPicks: readonly DailyAyahEntry[]): AyahOfTheDay {
  return resolveDailyAyah({
    date,
    picks: nationalPicks.filter((p) => p.scopeType === 'national'),
  });
}

/** Ayat in a surah, or null for a surah number that does not exist. */
export function ayahCountOf(surah: number): number | null {
  return Number.isInteger(surah) ? (AYAH_COUNTS[surah - 1] ?? null) : null;
}

export interface AyahForm {
  surah: string;
  ayah: string;
}

export const ayahFormOf = (pick: DailyAyahEntry | undefined): AyahForm =>
  pick ? { surah: String(pick.surah), ayah: String(pick.ayah) } : { surah: '', ayah: '' };

/**
 * `surah`: not a surah number. `ayah`: missing, or not in the surah (the screen says how many
 * ayat the surah has). `same`: that ayah is already the pick. `invalid`: the request itself
 * failed the schema for another reason (not the person's input).
 */
export type AyahErrors = Partial<Record<'surah' | 'ayah' | 'same' | 'invalid', true>>;

/** A typed number, or NaN so the schema refuses it. Only plain digits count. */
const typed = (text: string): number => {
  const v = text.trim();
  return /^\d{1,4}$/.test(v) ? Number(v) : Number.NaN;
};

/** The surah number of the form when it is a real surah, for the "has N ayat" hint. */
export function typedSurah(form: AyahForm): number | null {
  const n = typed(form.surah);
  return ayahCountOf(n) === null ? null : n;
}

/**
 * Checks the form with the contract's own schema (`DailyAyahPut`: surah 1 to 114, the ayah must
 * exist in that surah) and builds the request body.
 */
export function validatePick(
  form: AyahForm,
  date: string,
  place: AyahPlace,
  existing: DailyAyahEntry | undefined,
): { errors: AyahErrors; body?: DailyAyahPut } {
  const parsed = DailyAyahPut.safeParse({
    date,
    scope: targetOf(place),
    surah: typed(form.surah),
    ayah: typed(form.ayah),
  });
  if (!parsed.success) {
    const errors: AyahErrors = {};
    for (const issue of parsed.error.issues) {
      if (issue.path[0] === 'surah') errors.surah = true;
      else if (issue.path[0] === 'ayah') errors.ayah = true;
    }
    // Anything else (date, scope) is ours, not the person's: show the general message.
    if (!errors.surah && !errors.ayah) errors.invalid = true;
    return { errors };
  }
  if (existing && existing.surah === parsed.data.surah && existing.ayah === parsed.data.ayah) {
    return { errors: { same: true } };
  }
  return { errors: {}, body: parsed.data };
}
