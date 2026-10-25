import type { CleanRow } from './clean';
import { median, parseBarePair, parseCoords, type LatLng } from './coords';
import {
  countLocations,
  locateVenues,
  type LocationCounts,
  type VenueInput,
  type VenueLocation,
} from './locate';
import { plusCodeToPoint } from './pluscode';
import type { Resolution } from './resolve';

export interface PlannedVenue {
  venueKey: string;
  city: string;
  address: string;
  location: VenueLocation;
  /** Rows at this venue that are clean enough to import. */
  sessionRows: string[];
  /** Rows at this venue held back or skipped, with their flag codes. */
  otherRows: { id: string; status: 'hold' | 'skip'; flags: string[] }[];
  /** True when the venue has a trusted pin and at least one importable row. */
  importable: boolean;
}

export interface Plan {
  venues: PlannedVenue[];
  counts: {
    rows: number;
    rowsImport: number;
    rowsHold: number;
    rowsSkip: number;
    flags: Record<string, number>;
    locations: LocationCounts;
    venuesImportable: number;
    sessionsImportable: number;
    /** Rows whose venue has no trusted pin yet. */
    sessionsWaitingForLocation: number;
    pinsFromNotes: { coordinates: number; plusCodes: number };
  };
}

/** Every distinct map link the file mentions, for the resolver. Rows that are skipped are left out. */
export const linksOf = (rows: readonly CleanRow[]): string[] => [
  ...new Set(rows.filter((r) => r.status !== 'skip' && r.link).map((r) => r.link)),
];

/**
 * Groups clean rows into venues, finds each venue's pin (map links first, then coordinates or a
 * plus code written in the row's note), checks it against the city, and counts what can be
 * imported. A venue that is not pinned, or whose pin looks wrong, is reported and not imported.
 */
export function buildPlan(
  rows: readonly CleanRow[],
  resolutions: ReadonlyMap<string, Resolution>,
): Plan {
  const groups = new Map<string, CleanRow[]>();
  for (const r of rows) groups.set(r.venueKey, [...(groups.get(r.venueKey) ?? []), r]);

  // A venue sits in the city of its first row; its links and notes come from all its live rows.
  const inputs: VenueInput[] = [];
  const noteCodes = new Map<string, string>();
  let fromCoords = 0;
  for (const [key, group] of groups) {
    const live = group.filter((r) => r.status !== 'skip');
    let given: LatLng | null = null;
    for (const r of live) {
      const p = r.note ? (parseCoords(r.note) ?? parseBarePair(r.note)) : null;
      if (p) {
        given ??= p;
        fromCoords++;
      }
      if (r.note && !p) noteCodes.set(key, r.note);
    }
    inputs.push({
      venueKey: key,
      city: group[0]!.city,
      given,
      links: [...new Set(live.map((r) => r.link).filter(Boolean))],
    });
  }

  let locations = locateVenues(inputs, resolutions);

  // A short plus code needs a reference: the median of the city's other trusted pins.
  let fromPlus = 0;
  for (const input of inputs) {
    const text = noteCodes.get(input.venueKey);
    const loc = locations.find((l) => l.venueKey === input.venueKey);
    if (!text || !loc || loc.status === 'resolved' || input.given) continue;
    const peers = locations.filter(
      (l) => l.city === input.city && l.status === 'resolved' && l.point,
    );
    const ref = peers.length > 0 ? median(peers.map((p) => p.point!)) : null;
    const point = plusCodeToPoint(text, ref);
    if (point) {
      input.given = point;
      fromPlus++;
    }
  }
  if (fromPlus > 0) locations = locateVenues(inputs, resolutions);

  const venues = [...groups.entries()].map(([key, group]): PlannedVenue => {
    const location = locations.find((l) => l.venueKey === key)!;
    const sessionRows = group.filter((r) => r.status === 'import').map((r) => r.id);
    return {
      venueKey: key,
      city: group[0]!.city,
      address: group[0]!.address,
      location,
      sessionRows,
      otherRows: group
        .filter((r) => r.status !== 'import')
        .map((r) => ({ id: r.id, status: r.status as 'hold' | 'skip', flags: r.flags })),
      importable: location.status === 'resolved' && sessionRows.length > 0,
    };
  });

  const flags: Record<string, number> = {};
  for (const r of rows)
    for (const f of r.flags) {
      const code = f.split(':')[0]!;
      flags[code] = (flags[code] ?? 0) + 1;
    }

  const importable = venues.filter((v) => v.importable);
  return {
    venues,
    counts: {
      rows: rows.length,
      rowsImport: rows.filter((r) => r.status === 'import').length,
      rowsHold: rows.filter((r) => r.status === 'hold').length,
      rowsSkip: rows.filter((r) => r.status === 'skip').length,
      flags,
      locations: countLocations(locations),
      venuesImportable: importable.length,
      sessionsImportable: importable.reduce((n, v) => n + v.sessionRows.length, 0),
      sessionsWaitingForLocation: venues
        .filter((v) => !v.importable && v.location.status !== 'resolved')
        .reduce((n, v) => n + v.sessionRows.length, 0),
      pinsFromNotes: { coordinates: fromCoords, plusCodes: fromPlus },
    },
  };
}
