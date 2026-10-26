import { DEFAULTS, sessionRow, venueRow, type LoadDefaults } from './build';
import { normalise, type CleanRow } from './clean';
import type { PlanFile } from './import';

/** A placeholder: the console import matches cities, areas and venues by name, not by id. */
const NIL = '00000000-0000-4000-8000-000000000000';

const DAY_NAMES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

const cell = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'boolean' ? (value ? 'yes' : 'no') : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const line = (values: unknown[]): string => values.map(cell).join(',');

/** The console's venue file columns (`apps/console/src/import/venues.ts`). */
export const VENUE_HEADER = [
  'city',
  'area',
  'name_en',
  'name_ur',
  'address_en',
  'address_ur',
  'lat',
  'lng',
  'contact_phone',
  'entrance_notes_en',
] as const;

/** The console's session file columns (`apps/console/src/import/sessions.ts`). */
export const SESSION_HEADER = [
  'city',
  'venue',
  'title_en',
  'title_ur',
  'description_en',
  'kind',
  'program',
  'section',
  'language',
  'start_time',
  'duration_minutes',
  'days',
  'starts_on',
  'status',
] as const;

/**
 * The same rows `load` sends to the API, as the two CSV files the console's import screen takes:
 * venues first (one row per pinned venue, the area being the city itself), then sessions (one row
 * per circle, naming its venue). Venue names are made unique within a city here exactly as `load`
 * does, so the session file finds the right venue.
 */
export function exportCsv(
  plan: PlanFile,
  startsOn: string,
  defaults: Omit<LoadDefaults, 'startsOn'> = DEFAULTS,
): { venues: string; sessions: string; counts: { venues: number; sessions: number } } {
  const rowById = new Map(plan.rows.map((r) => [r.id, r]));
  const namesUsed = new Map<string, number>();
  const venueLines: string[] = [line([...VENUE_HEADER])];
  const sessionLines: string[] = [line([...SESSION_HEADER])];
  let sessions = 0;

  for (const v of plan.venues.filter((x) => x.importable)) {
    const row = venueRow(v, { cityId: NIL, areaId: NIL });
    if (!row) continue;
    const key = `${normalise(v.city)}|${normalise(row.body.name.en)}`;
    const n = (namesUsed.get(key) ?? 0) + 1;
    namesUsed.set(key, n);
    const name = n > 1 ? `${row.body.name.en} (${n})` : row.body.name.en;
    const facilities = row.body.facilities as { entranceNotes?: { en: string } };
    venueLines.push(
      line([
        v.city,
        v.city,
        name,
        '',
        row.body.address.en,
        '',
        row.body.lat,
        row.body.lng,
        row.body.contactPhone ?? '',
        facilities.entranceNotes?.en ?? '',
      ]),
    );
    for (const id of v.sessionRows) {
      const clean: CleanRow | undefined = rowById.get(id);
      const s = clean ? sessionRow(clean, NIL, { ...defaults, startsOn }) : null;
      if (!s || s.kind !== 'recurring') continue;
      sessions++;
      sessionLines.push(
        line([
          v.city,
          name,
          s.title.en,
          s.title.ur ?? '',
          s.description?.en ?? '',
          'recurring',
          s.program,
          s.section,
          s.language,
          s.localStartTime,
          s.durationMinutes,
          s.daysOfWeek.map((d) => DAY_NAMES[d]).join('|'),
          s.startsOn,
          s.status,
        ]),
      );
    }
  }
  return {
    venues: `${venueLines.join('\r\n')}\r\n`,
    sessions: `${sessionLines.join('\r\n')}\r\n`,
    counts: { venues: venueLines.length - 1, sessions },
  };
}
