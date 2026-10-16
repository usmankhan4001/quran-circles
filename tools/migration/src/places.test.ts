import { cities as fixtureCities, provinces as fixtureProvinces } from '@qc/contracts/fixtures';
import { describe, expect, it } from 'vitest';
import { formatCsv, parseCsvObjects } from './csv';
import {
  CITY_HINTS,
  MAPPING_COLUMNS,
  coordinateProblem,
  distanceKm,
  proposeCity,
  proposeMapping,
  readMapping,
  slugify,
} from './places';
import type { V1Venue } from './v1';

describe('CITY_HINTS stays in step with the contract fixtures', () => {
  it('has the same cities, names and provinces', () => {
    const provinceCode = new Map(fixtureProvinces.map((p) => [p.id, p.code]));
    const fromContract = fixtureCities
      .map((c) => ({
        slug: c.slug,
        nameEn: c.name.en,
        provinceCode: provinceCode.get(c.provinceId),
      }))
      .sort((a, b) => a.slug.localeCompare(b.slug));
    const ours = CITY_HINTS.map((h) => ({
      slug: h.slug,
      nameEn: h.nameEn,
      provinceCode: h.provinceCode,
    })).sort((a, b) => a.slug.localeCompare(b.slug));
    expect(ours).toEqual(fromContract);
  });
  it('has nine cities with valid centres', () => {
    expect(CITY_HINTS).toHaveLength(9);
    for (const h of CITY_HINTS) expect(coordinateProblem(h.lat, h.lng)).toBeNull();
  });
});

describe('slugify', () => {
  it.each([
    ['Sample Masjid Al-Noor', 'sample-masjid-al-noor'],
    ['  F-7 Markaz  ', 'f-7-markaz'],
    ['Caf\u00e9 & Hall', 'cafe-and-hall'],
    ['!!!', ''],
    ['مسجد نور', ''],
    ['Block C / Johar Town', 'block-c-johar-town'],
  ])('%j -> %j', (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });
  it('caps the length at a word boundary', () => {
    const slug = slugify('a '.repeat(80) + 'end');
    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug.endsWith('-')).toBe(false);
  });
});

describe('coordinateProblem', () => {
  it.each([
    [null, 73, 'missing'],
    [33, null, 'missing'],
    [0, 0, 'missing'],
    [91, 73, 'out_of_range'],
    [33, 181, 'out_of_range'],
    [73.0, 33.6, 'swapped'],
    [51.5, -0.12, 'outside_pakistan'],
    [33.6, 73.0, null],
    [24.86, 67.0, null],
  ] as const)('(%s, %s) -> %s', (lat, lng, expected) => {
    expect(coordinateProblem(lat, lng)).toBe(expected);
  });
});

describe('proposeCity', () => {
  const venue = (over: Partial<Parameters<typeof proposeCity>[0]>) => ({
    address: null,
    venue: null,
    name: null,
    lat: null,
    lng: null,
    ...over,
  });

  it.each(CITY_HINTS.map((h) => [h.slug, h] as const))(
    'finds %s from its name and its centre',
    (slug, h) => {
      const byText = proposeCity(venue({ address: `Main Road, ${h.nameEn}` }));
      expect(byText).toMatchObject({ citySlug: slug, confidence: 'medium' });
      const byBoth = proposeCity(
        venue({ address: `Main Road, ${h.nameEn}`, lat: h.lat, lng: h.lng }),
      );
      expect(byBoth).toMatchObject({ citySlug: slug, confidence: 'high' });
    },
  );

  it('prefers the city named last: Murree Road is in Rawalpindi', () => {
    expect(proposeCity(venue({ address: 'Murree Road, Rawalpindi' })).citySlug).toBe('rawalpindi');
    expect(proposeCity(venue({ address: 'Islamabad Highway, Lahore' })).citySlug).toBe('lahore');
  });

  it('recognises an Islamabad sector when no city is named', () => {
    const result = proposeCity(venue({ address: 'Markaz, G-9' }));
    expect(result).toMatchObject({ citySlug: 'islamabad', confidence: 'medium' });
    expect(result.reasons).toContain('sector_pattern');
    expect(proposeCity(venue({ address: 'Street 9, Block I-8/2' })).citySlug).toBe('islamabad');
  });

  it('reads Urdu city names', () => {
    expect(proposeCity(venue({ address: 'گلی 4، صدر، راولپنڈی' })).citySlug).toBe('rawalpindi');
    expect(proposeCity(venue({ address: 'ماڈل ٹاؤن، لاہور' })).citySlug).toBe('lahore');
  });

  it('falls back to the venue name when the address names no city', () => {
    expect(
      proposeCity(venue({ address: 'Street 1', venue: 'Lahore Central Mosque' })).citySlug,
    ).toBe('lahore');
  });

  it('uses coordinates alone at medium confidence, low where cities overlap', () => {
    expect(proposeCity(venue({ address: 'Street 1', lat: 31.5, lng: 74.35 }))).toMatchObject({
      citySlug: 'lahore',
      confidence: 'medium',
    });
    // Between Rawalpindi and Islamabad both radii cover the point.
    const between = proposeCity(venue({ address: 'Street 1', lat: 33.63, lng: 73.04 }));
    expect(between.confidence).toBe('low');
    expect(between.reasons).toContain('coordinates_overlap');
  });

  it('marks disagreement low and proposes the address text', () => {
    const result = proposeCity(venue({ address: 'Main Road, Lahore', lat: 33.5651, lng: 73.0169 }));
    expect(result).toMatchObject({ citySlug: 'lahore', confidence: 'low' });
    expect(result.reasons).toContain('text_and_coordinates_disagree');
  });

  it('proposes nothing rather than guess', () => {
    expect(proposeCity(venue({ address: 'Somewhere', lat: 25.0, lng: 62.0 }))).toEqual({
      citySlug: null,
      confidence: 'none',
      reasons: ['no_city_found'],
    });
  });

  it('does not match a city name inside a longer word', () => {
    expect(proposeCity(venue({ address: 'Multanabad Road' })).citySlug).toBeNull();
  });

  it('measures distance in kilometres', () => {
    expect(distanceKm(31.5204, 74.3587, 31.5204, 74.3587)).toBe(0);
    const lahoreToIslamabad = distanceKm(31.5204, 74.3587, 33.6844, 73.0479);
    expect(lahoreToIslamabad).toBeGreaterThan(260);
    expect(lahoreToIslamabad).toBeLessThan(280);
  });
});

const v1 = (over: Partial<V1Venue> = {}): V1Venue => ({
  id: '00000000-0000-4000-8000-000000000001',
  created_at: null,
  name: 'Sample Saddar',
  venue: 'Sample Masjid',
  address: 'Street 4, Saddar, Rawalpindi',
  lat: 33.5961,
  lng: 73.0483,
  contact: null,
  ...over,
});

describe('proposeMapping', () => {
  it('writes the agreed header and proposes but never approves', () => {
    const rows = proposeMapping([v1(), v1({ id: 'x2', address: 'Nowhere', lat: null, lng: null })]);
    expect(rows[0]).toEqual([...MAPPING_COLUMNS]);
    const col = (name: string) => rows[0]!.indexOf(name);
    expect(rows[1]![col('city_slug')]).toBe('rawalpindi');
    expect(rows[1]![col('province_code')]).toBe('PB');
    expect(rows[1]![col('area_slug')]).toBe('sample-saddar');
    expect(rows[1]![col('confidence')]).toBe('high');
    expect(rows[2]![col('city_slug')]).toBe('');
    expect(rows[2]![col('confidence')]).toBe('none');
    expect(rows.slice(1).every((r) => r[col('approved')] === '')).toBe(true);
  });

  it('guards spreadsheet formulas that an anonymous V1 visitor could have typed', () => {
    const rows = proposeMapping([
      v1({ venue: '=HYPERLINK("http://x.test","click")', address: '@evil', name: '-1+1' }),
    ]);
    const col = (name: string) => rows[0]!.indexOf(name);
    expect(rows[1]![col('venue_name')]!.startsWith("'=")).toBe(true);
    expect(rows[1]![col('address')]!.startsWith("'@")).toBe(true);
    expect(rows[1]![col('v1_area_label')]!.startsWith("'-")).toBe(true);
  });
});

describe('readMapping', () => {
  const csv = (rows: string[]) => parseCsvObjects([MAPPING_COLUMNS.join(','), ...rows].join('\n'));
  // v1_id,venue_name,address,v1_area_label,lat,lng,province_code,city_slug,area_slug,area_name_en,area_name_ur,confidence,reason,approved
  const line = (
    id: string,
    city: string,
    area: string,
    approved: string,
    extra = ['', '', '', ''],
  ) =>
    `${id},n,a,l,${extra[0]},${extra[1]},${extra[2]},${city},${area},${extra[3]},,high,,${approved}`;

  it.each(['yes', 'YES', 'Y', 'true', '1', ' approved '])('accepts %j as approval', (word) => {
    const { rows } = readMapping(csv([line('a', 'lahore', 'johar-town', word)]));
    expect(rows.get('a')?.approved).toBe(true);
  });
  it.each(['', 'no', 'maybe', 'pending', '0'])('does not accept %j', (word) => {
    const { rows } = readMapping(csv([line('a', 'lahore', 'johar-town', word)]));
    expect(rows.get('a')?.approved).toBe(false);
  });
  it('reads overrides and trims', () => {
    const { rows } = readMapping(
      csv([line(' a ', 'lahore', 'johar-town', 'yes', ['31.47', '74.27', 'pb', 'Johar Town'])]),
    );
    expect(rows.get('a')).toMatchObject({
      provinceCode: 'PB',
      lat: 31.47,
      lng: 74.27,
      areaNameEn: 'Johar Town',
      citySlug: 'lahore',
    });
  });
  it('treats a bad slug as not approved and counts it', () => {
    const parsed = readMapping(csv([line('a', 'La Hore!', 'johar-town', 'yes')]));
    expect(parsed.rows.get('a')).toMatchObject({ approved: false, citySlug: null });
    expect(parsed.invalidRows).toBe(1);
  });
  it('counts a missing id and a repeated id, keeping the first', () => {
    const parsed = readMapping(
      csv([
        line('', 'lahore', 'x', 'yes'),
        line('a', 'lahore', 'x', 'yes'),
        line('a', 'multan', 'y', 'yes'),
      ]),
    );
    expect(parsed.invalidRows).toBe(1);
    expect(parsed.duplicateIds).toBe(1);
    expect(parsed.rows.get('a')?.citySlug).toBe('lahore');
  });
  it('a proposal written by this tool reads back with the same ids', () => {
    const proposed = proposeMapping([v1()]);
    const { rows } = readMapping(parseCsvObjects(formatCsv(proposed)));
    expect(rows.get(v1().id)).toMatchObject({ citySlug: 'rawalpindi', approved: false });
  });
});
