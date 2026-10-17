import {
  DailyAyahPut,
  addDays,
  can,
  dailyAyahResource,
  resolveDailyAyah,
  type AdminCircle,
  type AyahOfTheDay,
  type DailyAyahEntry,
  type DailyAyahScope,
  type Principal,
  type ResourceScope,
  type Venue,
} from '@qc/contracts';
import { AYAH_COUNTS } from '@qc/contracts/bookmarks';

/**
 * Rules for the console's ayah of the day list (contract 1.0.0-rc.4). The API checks every write
 * with the same `can` and `dailyAyahResource`; the console only hides what would be refused.
 * Numbers only: the console never shows or stores Quran text.
 */

/** How many ayat a surah has (standard Hafs numbering), or undefined for a surah that does not exist. */
export const ayahCount = (surah: number): number | undefined =>
  Number.isInteger(surah) ? AYAH_COUNTS[surah - 1] : undefined;

/** The resource a stored pick is checked at. A venue or circle pick with no place is national-only. */
export function pickResource(
  entry: Pick<DailyAyahEntry, 'scopeType' | 'cityId' | 'venueId'>,
): ResourceScope {
  const place =
    entry.scopeType !== 'national' && entry.cityId && entry.venueId
      ? { cityId: entry.cityId, venueId: entry.venueId }
      : null;
  return dailyAyahResource(entry.scopeType, place);
}

/** Whether the person may change or remove this pick. National picks: national admins only. */
export const canManagePick = (
  principal: Principal | null,
  entry: Pick<DailyAyahEntry, 'scopeType' | 'cityId' | 'venueId'>,
): boolean => can(principal, 'daily_ayah.manage', pickResource(entry));

export const canSetNational = (principal: Principal | null): boolean =>
  can(principal, 'daily_ayah.manage', dailyAyahResource('national', null));

export const venuesFor = (principal: Principal | null, venues: readonly Venue[]): Venue[] =>
  venues.filter((v) =>
    can(
      principal,
      'daily_ayah.manage',
      dailyAyahResource('venue', { cityId: v.cityId, venueId: v.id }),
    ),
  );

export const circlesFor = (
  principal: Principal | null,
  circles: readonly AdminCircle[],
): AdminCircle[] =>
  circles.filter((c) =>
    can(
      principal,
      'daily_ayah.manage',
      dailyAyahResource('circle', { cityId: c.cityId, venueId: c.venueId }),
    ),
  );

/** The scopes the person may set a pick for, in form order. */
export function scopesFor(
  principal: Principal | null,
  venues: readonly Venue[],
  circles: readonly AdminCircle[],
): DailyAyahScope[] {
  const out: DailyAyahScope[] = [];
  if (canSetNational(principal)) out.push('national');
  if (venuesFor(principal, venues).length > 0) out.push('venue');
  if (circlesFor(principal, circles).length > 0) out.push('circle');
  return out;
}

// The form ---------------------------------------------------------------------------------------

/** What the form holds: text as typed, so a half-typed number is not lost. */
export interface PickDraft {
  date: string;
  scopeType: DailyAyahScope | '';
  venueId: string;
  circleId: string;
  surah: string;
  ayah: string;
}

export type DraftField = 'date' | 'scopeType' | 'venueId' | 'circleId' | 'surah' | 'ayah';

/**
 * Why a field was refused. `ayah_not_in_surah` is the shared schema's ayah-in-surah rule
 * (`DailyAyahPut`, `isAyahInSurah`) and carries the surah's ayah count for the message.
 */
export type DraftProblem =
  | { code: 'required' }
  | { code: 'invalid_date' }
  | { code: 'surah_range' }
  | { code: 'ayah_not_in_surah'; surah: number; count: number }
  | { code: 'ayah_number' };

export type DraftResult =
  | { ok: true; body: DailyAyahPut }
  | { ok: false; problems: Partial<Record<DraftField, DraftProblem>> };

const toNumber = (text: string): number => (text.trim() === '' ? Number.NaN : Number(text.trim()));

/** The form field for a schema or server issue path, such as `scope.venueId` or `ayah`. */
export const PICK_FIELD_PATHS: Readonly<Record<string, DraftField>> = {
  date: 'date',
  scope: 'scopeType',
  'scope.type': 'scopeType',
  'scope.venueId': 'venueId',
  'scope.circleId': 'circleId',
  surah: 'surah',
  ayah: 'ayah',
};

export function fieldForPath(path: readonly string[]): DraftField | undefined {
  for (let n = path.length; n > 0; n--) {
    const field = PICK_FIELD_PATHS[path.slice(0, n).join('.')];
    if (field) return field;
  }
  return undefined;
}

/** The problem to show for the ayah field, given the surah typed. */
export function ayahProblem(surahText: string): DraftProblem {
  const surah = toNumber(surahText);
  const count = ayahCount(surah);
  return count === undefined
    ? { code: 'ayah_number' }
    : { code: 'ayah_not_in_surah', surah, count };
}

/**
 * Checks the draft with the shared `DailyAyahPut` schema and builds the request body. Empty
 * fields are reported as required first; then every schema issue is placed at its field. The ayah
 * is only judged once the surah is valid, so one mistake gives one message.
 */
export function buildPut(draft: PickDraft): DraftResult {
  const problems: Partial<Record<DraftField, DraftProblem>> = {};
  if (!draft.date) problems.date = { code: 'required' };
  if (!draft.scopeType) problems.scopeType = { code: 'required' };
  if (draft.scopeType === 'venue' && !draft.venueId) problems.venueId = { code: 'required' };
  if (draft.scopeType === 'circle' && !draft.circleId) problems.circleId = { code: 'required' };
  if (!draft.surah.trim()) problems.surah = { code: 'required' };
  if (!draft.ayah.trim()) problems.ayah = { code: 'required' };
  if (Object.keys(problems).length > 0) return { ok: false, problems };

  const scope =
    draft.scopeType === 'venue'
      ? { type: 'venue' as const, venueId: draft.venueId }
      : draft.scopeType === 'circle'
        ? { type: 'circle' as const, circleId: draft.circleId }
        : { type: 'national' as const };
  const candidate = {
    date: draft.date,
    scope,
    surah: toNumber(draft.surah),
    ayah: toNumber(draft.ayah),
  };
  const parsed = DailyAyahPut.safeParse(candidate);
  if (parsed.success) return { ok: true, body: parsed.data };

  for (const issue of parsed.error.issues) {
    const field = fieldForPath(issue.path.map(String));
    if (!field || problems[field]) continue;
    if (field === 'date') problems.date = { code: 'invalid_date' };
    else if (field === 'surah') problems.surah = { code: 'surah_range' };
    else if (field === 'ayah') problems.ayah = ayahProblem(draft.surah);
    else problems[field] = { code: 'required' };
  }
  // A wrong surah makes any ayah wrong too; say only the first thing to fix.
  if (problems.surah) delete problems.ayah;
  return { ok: false, problems };
}

/** The draft that edits an existing pick: same date and scope, so saving replaces it. */
export const draftFromEntry = (entry: DailyAyahEntry): PickDraft => ({
  date: entry.date,
  scopeType: entry.scopeType,
  venueId: entry.scopeType === 'venue' ? (entry.venueId ?? '') : '',
  circleId: entry.scopeType === 'circle' ? (entry.circleId ?? '') : '',
  surah: String(entry.surah),
  ayah: String(entry.ayah),
});

/** A loaded pick with the same date and scope as the body, which saving would replace. */
export function existingPickFor(
  body: DailyAyahPut,
  picks: readonly DailyAyahEntry[],
): DailyAyahEntry | undefined {
  return picks.find(
    (p) =>
      p.date === body.date &&
      p.scopeType === body.scope.type &&
      (body.scope.type !== 'venue' || p.venueId === body.scope.venueId) &&
      (body.scope.type !== 'circle' || p.circleId === body.scope.circleId),
  );
}

// The fallback -----------------------------------------------------------------------------------

/**
 * What a person who follows no venue or circle with a pick sees on each day from `from`: the
 * national pick, or the built-in list (`resolveDailyAyah`). Only the picks loaded for the range
 * are known, so days past `to` are left out.
 */
export function fallbackDays(
  from: string,
  to: string,
  picks: readonly DailyAyahEntry[],
  days = 7,
): AyahOfTheDay[] {
  const out: AyahOfTheDay[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(from, i);
    if (date > to) break;
    out.push(resolveDailyAyah({ date, picks }));
  }
  return out;
}

/** Sorted by date, then national before venue before circle. */
export function sortPicks(picks: readonly DailyAyahEntry[]): DailyAyahEntry[] {
  const order: Record<DailyAyahScope, number> = { national: 0, venue: 1, circle: 2 };
  return [...picks].sort(
    (a, b) => a.date.localeCompare(b.date) || order[a.scopeType] - order[b.scopeType],
  );
}
