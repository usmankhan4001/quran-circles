import { guardCell, unguardCell } from './csv';
import { toNumber, toText, normaliseForMatch } from './v1';
import type { V1Venue } from './v1';

/** Lower-case ASCII slug. Empty when the text has no Latin letters or digits (for example Urdu only). */
export function slugify(input: string): string {
  const ascii = input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (ascii.length <= 60) return ascii;
  const cut = ascii.slice(0, 60);
  const lastHyphen = cut.lastIndexOf('-');
  return (lastHyphen > 20 ? cut.slice(0, lastHyphen) : cut).replace(/-+$/g, '');
}

export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// ---------------------------------------------------------------------------------------------
// Where V1's venues are. These hints only PROPOSE a city; a person approves every mapping.
// ---------------------------------------------------------------------------------------------

export interface CityHint {
  slug: string;
  nameEn: string;
  provinceCode: string;
  /** Terms searched for in address text, already in `normaliseForMatch` form. */
  terms: string[];
  lat: number;
  lng: number;
  radiusKm: number;
}

/** The nine cities V1 served. Slugs match the seeded V2 cities (`@qc/contracts/fixtures`). */
export const CITY_HINTS: readonly CityHint[] = [
  {
    slug: 'rawalpindi',
    nameEn: 'Rawalpindi',
    provinceCode: 'PB',
    terms: ['rawalpindi', 'pindi', 'rwp', 'راولپنڈی'],
    lat: 33.5651,
    lng: 73.0169,
    radiusKm: 14,
  },
  {
    slug: 'islamabad',
    nameEn: 'Islamabad',
    provinceCode: 'ICT',
    terms: ['islamabad', 'isb', 'اسلام آباد'],
    lat: 33.6844,
    lng: 73.0479,
    radiusKm: 16,
  },
  {
    slug: 'multan',
    nameEn: 'Multan',
    provinceCode: 'PB',
    terms: ['multan', 'ملتان'],
    lat: 30.1575,
    lng: 71.5249,
    radiusKm: 16,
  },
  {
    slug: 'faisalabad',
    nameEn: 'Faisalabad',
    provinceCode: 'PB',
    terms: ['faisalabad', 'lyallpur', 'فیصل آباد'],
    lat: 31.4504,
    lng: 73.135,
    radiusKm: 16,
  },
  {
    slug: 'wah-cantt',
    nameEn: 'Wah Cantt',
    provinceCode: 'PB',
    terms: ['wah cantt', 'wah cant', 'wah cantonment', 'واہ کینٹ'],
    lat: 33.7715,
    lng: 72.7511,
    radiusKm: 8,
  },
  {
    slug: 'murree',
    nameEn: 'Murree',
    provinceCode: 'PB',
    terms: ['murree', 'مری'],
    lat: 33.9062,
    lng: 73.3903,
    radiusKm: 10,
  },
  {
    slug: 'kot-addu',
    nameEn: 'Kot Addu',
    provinceCode: 'PB',
    terms: ['kot addu', 'kotaddu', 'کوٹ ادو'],
    lat: 30.4697,
    lng: 70.9631,
    radiusKm: 10,
  },
  {
    slug: 'abbottabad',
    nameEn: 'Abbottabad',
    provinceCode: 'KP',
    terms: ['abbottabad', 'abbotabad', 'ایبٹ آباد'],
    lat: 34.1688,
    lng: 73.2215,
    radiusKm: 12,
  },
  {
    slug: 'lahore',
    nameEn: 'Lahore',
    provinceCode: 'PB',
    terms: ['lahore', 'لاہور'],
    lat: 31.5204,
    lng: 74.3587,
    radiusKm: 25,
  },
];

/** Rough bounding box of Pakistan. A venue outside it has bad coordinates (often lat/lng swapped). */
export const PAKISTAN_BOX = { latMin: 23.5, latMax: 37.2, lngMin: 60.8, lngMax: 77.9 } as const;

export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(bLat - aLat);
  const dLng = rad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export type CoordinateProblem = 'missing' | 'out_of_range' | 'swapped' | 'outside_pakistan';

/** Validates a coordinate pair. Returns the problem, or null when usable. */
export function coordinateProblem(lat: number | null, lng: number | null): CoordinateProblem | null {
  if (lat === null || lng === null) return 'missing';
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return 'out_of_range';
  if (lat === 0 && lng === 0) return 'missing';
  const inside = (la: number, lo: number) =>
    la >= PAKISTAN_BOX.latMin &&
    la <= PAKISTAN_BOX.latMax &&
    lo >= PAKISTAN_BOX.lngMin &&
    lo <= PAKISTAN_BOX.lngMax;
  if (inside(lat, lng)) return null;
  if (inside(lng, lat)) return 'swapped';
  return 'outside_pakistan';
}

const padded = (normalised: string) => ` ${normalised} `;

function lastTermPosition(haystack: string, term: string): number {
  return padded(haystack).lastIndexOf(padded(term));
}

export type Confidence = 'high' | 'medium' | 'low' | 'none';

export interface CityProposal {
  citySlug: string | null;
  confidence: Confidence;
  reasons: string[];
}

/**
 * Proposes a city for a V1 venue from its address text and its coordinates.
 *
 * Text: the city named LAST in the address wins ("Murree Road, Rawalpindi" is Rawalpindi). An
 * Islamabad sector like F-7 counts as Islamabad when no city is named.
 * Coordinates: the nearest city centre within its radius. Rawalpindi and Islamabad overlap, so
 * coordinates alone are only medium confidence.
 * Agreement of both is high; disagreement is low and the text answer is proposed.
 */
export function proposeCity(venue: {
  address: string | null;
  venue: string | null;
  name: string | null;
  lat: number | null;
  lng: number | null;
}): CityProposal {
  const reasons: string[] = [];

  const searchIn = [venue.address, venue.venue, venue.name]
    .filter((v): v is string => v !== null)
    .map(normaliseForMatch);
  let textSlug: string | null = null;
  for (const haystack of searchIn) {
    let bestPos = -1;
    for (const hint of CITY_HINTS) {
      for (const term of hint.terms) {
        const pos = lastTermPosition(haystack, term);
        if (pos > bestPos) {
          bestPos = pos;
          textSlug = hint.slug;
        }
      }
    }
    if (textSlug !== null) break;
  }
  if (textSlug === null) {
    const sector = searchIn.some((h) => / [efghi] \d{1,2} /.test(padded(h)));
    if (sector) {
      textSlug = 'islamabad';
      reasons.push('sector_pattern');
    }
  } else {
    reasons.push('address_text');
  }

  let coordSlug: string | null = null;
  let coordAmbiguous = false;
  if (coordinateProblem(venue.lat, venue.lng) === null) {
    const candidates = CITY_HINTS.map((h) => ({
      h,
      d: distanceKm(venue.lat!, venue.lng!, h.lat, h.lng),
    }))
      .filter((c) => c.d <= c.h.radiusKm)
      .sort((a, b) => a.d - b.d);
    if (candidates[0]) {
      coordSlug = candidates[0].h.slug;
      coordAmbiguous = candidates.length > 1;
      reasons.push(coordAmbiguous ? 'coordinates_overlap' : 'coordinates');
    }
  }

  if (textSlug && coordSlug) {
    if (textSlug === coordSlug) return { citySlug: textSlug, confidence: 'high', reasons };
    return {
      citySlug: textSlug,
      confidence: 'low',
      reasons: [...reasons, 'text_and_coordinates_disagree'],
    };
  }
  if (textSlug) return { citySlug: textSlug, confidence: 'medium', reasons };
  if (coordSlug) {
    return { citySlug: coordSlug, confidence: coordAmbiguous ? 'low' : 'medium', reasons };
  }
  return { citySlug: null, confidence: 'none', reasons: ['no_city_found'] };
}

// ---------------------------------------------------------------------------------------------
// The reviewed mapping CSV
// ---------------------------------------------------------------------------------------------

export interface MappingRow {
  v1Id: string;
  provinceCode: string | null;
  citySlug: string | null;
  areaSlug: string | null;
  areaNameEn: string | null;
  areaNameUr: string | null;
  lat: number | null;
  lng: number | null;
  approved: boolean;
}

export const MAPPING_COLUMNS = [
  'v1_id',
  'venue_name',
  'address',
  'v1_area_label',
  'lat',
  'lng',
  'province_code',
  'city_slug',
  'area_slug',
  'area_name_en',
  'area_name_ur',
  'confidence',
  'reason',
  'approved',
] as const;

const PROVINCE_BY_CITY = new Map(CITY_HINTS.map((h) => [h.slug, h.provinceCode]));

/** Builds the proposed mapping rows for review. Nothing is approved: a person sets `approved`. */
export function proposeMapping(venues: readonly V1Venue[]): string[][] {
  const rows: string[][] = [MAPPING_COLUMNS.slice() as string[]];
  for (const v of venues) {
    const proposal = proposeCity(v);
    const label = v.name ?? '';
    const areaSlug = slugify(label);
    rows.push([
      v.id,
      guardCell(v.venue ?? v.name ?? ''),
      guardCell(v.address ?? ''),
      guardCell(label),
      v.lat === null ? '' : String(v.lat),
      v.lng === null ? '' : String(v.lng),
      proposal.citySlug ? (PROVINCE_BY_CITY.get(proposal.citySlug) ?? '') : '',
      proposal.citySlug ?? '',
      proposal.citySlug ? areaSlug : '',
      proposal.citySlug ? guardCell(label) : '',
      '',
      proposal.confidence,
      proposal.reasons.join(' '),
      '',
    ]);
  }
  return rows;
}

const TRUTHY = new Set(['yes', 'y', 'true', '1', 'approved']);

export interface ParsedMapping {
  rows: Map<string, MappingRow>;
  /** Rows that could not be read (bad slug, missing id). They count as not approved. */
  invalidRows: number;
  duplicateIds: number;
}

/** Reads the reviewed mapping CSV (already split into objects by `parseCsvObjects`). */
export function readMapping(records: readonly Record<string, string>[]): ParsedMapping {
  const rows = new Map<string, MappingRow>();
  let invalidRows = 0;
  let duplicateIds = 0;
  for (const rec of records) {
    const v1Id = toText(rec.v1_id);
    if (v1Id === null) {
      invalidRows++;
      continue;
    }
    if (rows.has(v1Id)) {
      duplicateIds++;
      continue;
    }
    const citySlug = toText(rec.city_slug);
    const areaSlug = toText(rec.area_slug);
    const slugsOk =
      (citySlug === null || SLUG_PATTERN.test(citySlug)) &&
      (areaSlug === null || SLUG_PATTERN.test(areaSlug));
    if (!slugsOk) invalidRows++;
    const approvedText = toText(rec.approved)?.toLowerCase() ?? '';
    const latText = toText(rec.lat);
    const lngText = toText(rec.lng);
    const nameEn = toText(rec.area_name_en);
    const nameUr = toText(rec.area_name_ur);
    rows.set(v1Id, {
      v1Id,
      provinceCode: toText(rec.province_code)?.toUpperCase() ?? null,
      citySlug: slugsOk ? citySlug : null,
      areaSlug: slugsOk ? areaSlug : null,
      areaNameEn: nameEn === null ? null : unguardCell(nameEn),
      areaNameUr: nameUr === null ? null : unguardCell(nameUr),
      lat: latText === null ? null : toNumber(latText),
      lng: lngText === null ? null : toNumber(lngText),
      approved: slugsOk && TRUTHY.has(approvedText),
    });
  }
  return { rows, invalidRows, duplicateIds };
}
