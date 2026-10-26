import { SessionCreate, VenueCreate } from '@qc/contracts';
import { PLACEHOLDER_TIMES, type CleanRow } from './clean';
import type { PlannedVenue } from './plan';

/**
 * Defaults the load applies where the source has nothing. They are choices made for the test load,
 * not source data, and are listed in the report and in the README.
 */
export interface LoadDefaults {
  /** First date a recurring session runs from, `YYYY-MM-DD`. */
  startsOn: string;
  section: 'women' | 'men' | 'family';
  language: 'en' | 'ur';
  durationMinutes: number;
  program: 'circles' | 'dora';
}

export const DEFAULTS = {
  section: 'family',
  language: 'ur',
  durationMinutes: 60,
  program: 'circles',
} as const satisfies Omit<LoadDefaults, 'startsOn'>;

export const APPROXIMATE_NOTE_EN =
  'Approximate location: found from the address, may be off by a few kilometres. A coordinator should correct the pin.';

const WEEK_WORDS = ['', '1st', '2nd', '3rd', '4th', '5th'];

const clip = (text: string, max: number): string =>
  text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;

const firstSegment = (address: string): string =>
  address
    .split(/[,\n]/)
    .map((p) => p.trim())
    .find(Boolean) ?? '';

export interface VenueImportRow {
  /** Matches a venue to its sessions. Not part of the API row. */
  venueKey: string;
  body: ReturnType<typeof VenueCreate.parse>;
}

/** One API venue row for a planned venue, or null when it has no trusted pin. */
export function venueRow(
  venue: PlannedVenue,
  ids: { cityId: string; areaId: string },
  contactPhone: string | null = null,
): VenueImportRow | null {
  const point = venue.location.point;
  if (!venue.importable || !point) return null;
  const name = clip(
    [firstSegment(venue.address), venue.city].filter(Boolean).join(', ') || venue.city,
    200,
  );
  const body = VenueCreate.parse({
    cityId: ids.cityId,
    areaId: ids.areaId,
    name: { en: name },
    address: { en: clip(venue.address, 500) },
    lat: point.lat,
    lng: point.lng,
    contactPhone,
    facilities: venue.approximate ? { entranceNotes: { en: APPROXIMATE_NOTE_EN, ur: null } } : {},
  });
  return { venueKey: venue.venueKey, body };
}

/** Describes the timing the source gave and what the load did with it. */
export function timingNote(row: CleanRow): string {
  const parts: string[] = [];
  if (row.time?.kind === 'prayer') {
    const placeholder = PLACEHOLDER_TIMES[row.time.prayer];
    parts.push(
      row.time.explicit
        ? `Starts after ${row.time.prayer} (source gave ${row.time.explicit}).`
        : `Starts after ${row.time.prayer}. The time shown (${placeholder}) is a placeholder: the app has no prayer-based start yet.`,
    );
  }
  if (row.weeks && row.weeks !== 'every')
    parts.push(
      `Meets in the ${row.weeks.map((w) => WEEK_WORDS[w]).join(' and ')} week of the month only. Loaded as a draft because the app cannot yet express this pattern.`,
    );
  return parts.join(' ');
}

/** The session row for one clean row, or null when the row has no day or time. */
export function sessionRow(
  row: CleanRow,
  venueId: string,
  defaults: LoadDefaults,
): ReturnType<typeof SessionCreate.parse> | null {
  if (row.day === null || row.time === null) return null;
  const time = row.time;
  const start =
    time.kind === 'clock' ? time.start : (time.explicit ?? PLACEHOLDER_TIMES[time.prayer]);
  let duration = defaults.durationMinutes;
  if (time.kind === 'clock' && time.end) {
    const diff = minutesOf(time.end) - minutesOf(time.start);
    if (diff >= 5 && diff <= 600) duration = diff;
  }
  const monthly = row.weeks !== 'every';
  const note = timingNote(row);
  return SessionCreate.parse({
    kind: 'recurring',
    venueId,
    program: defaults.program,
    title: {
      en: clip(`Quran circle${row.code ? ` ${row.code}` : ''} (${row.city})`, 200),
      ur: row.nameUr ? clip(row.nameUr, 200) : null,
    },
    description: note ? { en: note } : null,
    section: defaults.section,
    language: defaults.language,
    localStartTime: start,
    durationMinutes: duration,
    daysOfWeek: [row.day],
    startsOn: defaults.startsOn,
    status: monthly ? 'draft' : 'published',
  });
}

const minutesOf = (hhmm: string): number => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));
