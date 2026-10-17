import { VenueCreate, can, type Area, type City, type Venue } from '@qc/contracts';
import type { CsvTable } from '../lib/csv';
import { normalizePhone } from '../lib/phone';
import {
  columnForPath,
  normalizeName,
  parseBoolean,
  parseNumber,
  readTable,
  type ColumnSpec,
  type ReadRow,
} from './table';
import {
  buildReport,
  issue,
  type DryRunReport,
  type DryRunRow,
  type ImportActor,
  type ImportIssue,
} from './types';

export type VenueBody = VenueCreate;

export const VENUE_COLUMNS: readonly ColumnSpec[] = [
  { name: 'city', aliases: ['city_slug', 'city_name'], required: true },
  { name: 'area', aliases: ['area_slug', 'area_name'], required: true },
  { name: 'name_en', aliases: ['name'], required: true },
  { name: 'name_ur' },
  { name: 'address_en', aliases: ['address'], required: true },
  { name: 'address_ur' },
  { name: 'lat', aliases: ['latitude'], required: true },
  { name: 'lng', aliases: ['lon', 'long', 'longitude'], required: true },
  { name: 'contact_phone', aliases: ['phone', 'contact'] },
  { name: 'women_section' },
  { name: 'parking' },
  { name: 'wudu_area' },
  { name: 'wheelchair_access' },
  { name: 'child_friendly' },
  { name: 'entrance_notes_en' },
  { name: 'entrance_notes_ur' },
];

export const VENUE_PATH_COLUMNS: Readonly<Record<string, string>> = {
  cityId: 'city',
  areaId: 'area',
  'name.en': 'name_en',
  'name.ur': 'name_ur',
  'address.en': 'address_en',
  'address.ur': 'address_ur',
  lat: 'lat',
  lng: 'lng',
  contactPhone: 'contact_phone',
  'facilities.womenSection': 'women_section',
  'facilities.parking': 'parking',
  'facilities.wuduArea': 'wudu_area',
  'facilities.elderWheelchairAccess': 'wheelchair_access',
  'facilities.childFriendly': 'child_friendly',
  'facilities.entranceNotes': 'entrance_notes_en',
};

export interface VenueContext extends ImportActor {
  cities: readonly City[];
  /** Areas of every city the file mentions, keyed by city id. */
  areasByCity: Readonly<Record<string, readonly Area[]>>;
  /** Venues already in the cities the file mentions, archived ones included. */
  venues: readonly Venue[];
}

const matchesName = (
  item: { slug?: string; name: { en: string; ur: string | null } },
  wanted: string,
): boolean => {
  const w = normalizeName(wanted);
  return (
    (item.slug !== undefined && normalizeName(item.slug) === w) ||
    normalizeName(item.name.en) === w ||
    (item.name.ur !== null && normalizeName(item.name.ur) === w)
  );
};

/** The cities a venue file mentions, so the caller can load only their areas and venues. */
export function citiesMentioned(table: CsvTable, cities: readonly City[]): City[] {
  const { rows } = readTable(table, VENUE_COLUMNS);
  const found = new Map<string, City>();
  for (const row of rows) {
    const text = row.get('city');
    const match = cities.find((c) => matchesName(c, text));
    if (text && match) found.set(match.id, match);
  }
  return [...found.values()];
}

export function validateVenues(table: CsvTable, ctx: VenueContext): DryRunReport<VenueBody> {
  const read = readTable(table, VENUE_COLUMNS);
  const rows: DryRunRow<VenueBody>[] = [];
  const firstSeen = new Map<string, number>();

  for (const row of read.rows) {
    const issues: ImportIssue[] = [];
    const bad = read.malformed.get(row.line);
    if (bad) issues.push(bad);
    const label = row.get('name_en') || `#${row.line}`;
    const body = bad ? null : buildVenue(row, ctx, issues);

    let status: DryRunRow<VenueBody>['status'] = issues.some((i) => i.severity === 'error')
      ? 'invalid'
      : 'valid';
    if (status === 'valid' && body) {
      const key = `${body.cityId}|${normalizeName(body.name.en)}`;
      const earlier = firstSeen.get(key);
      if (earlier !== undefined) {
        issues.push(issue(row.line, 'name_en', 'duplicate_in_file', { firstLine: earlier }));
        status = 'invalid';
      } else {
        firstSeen.set(key, row.line);
        if (
          ctx.venues.some(
            (v) =>
              v.cityId === body.cityId && normalizeName(v.name.en) === normalizeName(body.name.en),
          )
        ) {
          issues.push(issue(row.line, 'name_en', 'already_exists', undefined, 'warning'));
          status = 'duplicate';
        }
      }
    }
    rows.push({
      line: row.line,
      status,
      issues,
      label,
      ...(status !== 'invalid' && body ? { body } : {}),
    });
  }
  return buildReport('venues', read.fileIssues, rows);
}

function buildVenue(row: ReadRow, ctx: VenueContext, issues: ImportIssue[]): VenueBody | null {
  const line = row.line;
  const need = (column: string): string => {
    const v = row.get(column);
    if (!v) issues.push(issue(line, column, 'required', { column }));
    return v;
  };

  const cityText = need('city');
  const areaText = need('area');
  need('name_en');
  need('address_en');

  const city = cityText ? ctx.cities.find((c) => matchesName(c, cityText)) : undefined;
  if (cityText && !city) issues.push(issue(line, 'city', 'unknown_city', { column: 'city' }));
  let area: Area | undefined;
  if (city && areaText) {
    area = (ctx.areasByCity[city.id] ?? []).find((a) => matchesName(a, areaText));
    if (!area) issues.push(issue(line, 'area', 'unknown_area', { column: 'area' }));
  }
  if (city && !can(ctx.principal, 'venue.create', { cityId: city.id }))
    issues.push(issue(line, 'city', 'out_of_scope', { column: 'city' }));

  const lat = parseNumber(row.get('lat'));
  const lng = parseNumber(row.get('lng'));
  if (lat === null) issues.push(issue(line, 'lat', 'required', { column: 'lat' }));
  else if (lat === 'invalid') issues.push(issue(line, 'lat', 'invalid_number', { column: 'lat' }));
  if (lng === null) issues.push(issue(line, 'lng', 'required', { column: 'lng' }));
  else if (lng === 'invalid') issues.push(issue(line, 'lng', 'invalid_number', { column: 'lng' }));

  let contactPhone: string | null = null;
  const phoneText = row.get('contact_phone');
  if (phoneText) {
    const phone = normalizePhone(phoneText);
    if (phone.ok) contactPhone = phone.e164;
    else issues.push(issue(line, 'contact_phone', 'invalid_phone', { column: 'contact_phone' }));
  }

  const facilities: Record<string, unknown> = {};
  const flags: [string, string][] = [
    ['women_section', 'womenSection'],
    ['parking', 'parking'],
    ['wudu_area', 'wuduArea'],
    ['wheelchair_access', 'elderWheelchairAccess'],
    ['child_friendly', 'childFriendly'],
  ];
  for (const [column, key] of flags) {
    const value = parseBoolean(row.get(column));
    if (value === 'invalid') issues.push(issue(line, column, 'invalid_boolean', { column }));
    else if (value !== null) facilities[key] = value;
  }
  const notesEn = row.get('entrance_notes_en');
  if (notesEn) facilities.entranceNotes = { en: notesEn, ur: row.get('entrance_notes_ur') || null };

  if (
    issues.some((i) => i.severity === 'error') ||
    !city ||
    !area ||
    typeof lat !== 'number' ||
    typeof lng !== 'number'
  )
    return null;

  const parsed = VenueCreate.safeParse({
    cityId: city.id,
    areaId: area.id,
    name: { en: row.get('name_en'), ur: row.get('name_ur') || null },
    address: { en: row.get('address_en'), ur: row.get('address_ur') || null },
    lat,
    lng,
    contactPhone,
    facilities,
  });
  if (!parsed.success) {
    for (const zodIssue of parsed.error.issues) {
      const column = columnForPath(VENUE_PATH_COLUMNS, zodIssue.path);
      issues.push(issue(line, column, 'invalid_value', { column: column ?? 'row' }));
    }
    return null;
  }
  return parsed.data;
}
