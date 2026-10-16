import { describe, expect, it } from 'vitest';
import { LIMITS } from './constants';
import type { MappingRow, ParsedMapping } from './places';
import { buildPlan, type PlanInput } from './plan';
import { offlineTarget } from './target';
import { fakeNational, phoneForms } from './synthetic';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const venue = (n: number, over: Record<string, unknown> = {}) => ({
  id: id(n),
  created_at: `2026-02-${String(n).padStart(2, '0')}T10:00:00Z`,
  name: `Sample Area ${n}`,
  venue: `Sample Masjid ${n}`,
  address: `Street ${n}, Lahore`,
  lat: 31.5 + n / 1000,
  lng: 74.3,
  contact: null,
  ...over,
});

const mapRow = (n: number, over: Partial<MappingRow> = {}): MappingRow => ({
  v1Id: id(n),
  provinceCode: null,
  citySlug: 'lahore',
  areaSlug: `area-${n}`,
  areaNameEn: `Area ${n}`,
  areaNameUr: null,
  lat: null,
  lng: null,
  approved: true,
  ...over,
});

const mapping = (...rows: MappingRow[]): ParsedMapping => ({
  rows: new Map(rows.map((r) => [r.v1Id, r])),
  invalidRows: 0,
  duplicateIds: 0,
});

const plan = (input: Partial<PlanInput>) =>
  buildPlan({
    venues: null,
    registrations: null,
    subscribers: null,
    mapping: null,
    target: offlineTarget(),
    createAreas: true,
    ...input,
  });

describe('venue deduplication', () => {
  const approved = (...ns: number[]) => mapping(...ns.map((n) => mapRow(n)));

  it('keeps the earliest copy of the same name and address', () => {
    const rows = [
      venue(1),
      venue(2, { name: 'Sample Area 1', venue: 'Sample Masjid 1', address: 'Street 1, Lahore' }),
    ];
    const p = plan({ venues: rows, mapping: approved(1, 2) });
    expect(p.counts.totals.venues).toMatchObject({ read: 2, toInsert: 1, duplicate: 1 });
    expect(p.venues).toHaveLength(1);
    expect(p.flagged).toEqual([
      { dataset: 'venues', row: 2, sourceId: id(2), reason: 'duplicate' },
    ]);
  });

  it('is not fooled by case, punctuation or spacing', () => {
    const rows = [
      venue(1),
      venue(2, { venue: '  SAMPLE   masjid-1 ', address: 'street 1 , LAHORE.' }),
    ];
    expect(plan({ venues: rows, mapping: approved(1, 2) }).counts.totals.venues.duplicate).toBe(1);
  });

  it('treats the same name within 100 metres as the same place even if the address differs', () => {
    const rows = [
      venue(1),
      venue(2, {
        venue: 'Sample Masjid 1',
        address: 'Another way of writing it',
        lat: 31.5015,
        lng: 74.3,
      }),
    ];
    expect(plan({ venues: rows, mapping: approved(1, 2) }).counts.totals.venues.duplicate).toBe(1);
  });

  it('keeps two venues with the same name in different places', () => {
    const rows = [
      venue(1),
      venue(2, { venue: 'Sample Masjid 1', address: 'Elsewhere in Lahore', lat: 31.6, lng: 74.4 }),
    ];
    const p = plan({ venues: rows, mapping: approved(1, 2) });
    expect(p.counts.totals.venues).toMatchObject({ duplicate: 0, toInsert: 2 });
    expect(new Set(p.venues.map((v) => v.slug)).size).toBe(2);
  });

  it('keeps different names at the same coordinates', () => {
    const rows = [venue(1), venue(2, { lat: venue(1).lat, lng: venue(1).lng })];
    expect(plan({ venues: rows, mapping: approved(1, 2) }).counts.totals.venues.duplicate).toBe(0);
  });

  it('picks the same survivor whatever order the rows arrive in', () => {
    const a = venue(1);
    const b = venue(2, { venue: a.venue, address: a.address });
    const forward = plan({ venues: [a, b], mapping: approved(1, 2) });
    const backward = plan({ venues: [b, a], mapping: approved(1, 2) });
    expect(forward.venues.map((v) => v.slug)).toEqual(backward.venues.map((v) => v.slug));
    expect(forward.flagged.map((f) => f.sourceId)).toEqual(backward.flagged.map((f) => f.sourceId));
    expect(forward.flagged[0]?.sourceId).toBe(id(2)); // the later created copy goes
  });

  it('counts a duplicate in the city of the venue it duplicates', () => {
    const a = venue(1);
    const p = plan({
      venues: [a, venue(2, { venue: a.venue, address: a.address })],
      mapping: approved(1, 2),
    });
    expect(p.counts.cities.lahore?.venues).toMatchObject({ read: 2, duplicate: 1, toInsert: 1 });
  });

  it('repeats of the same V1 id are duplicates', () => {
    const p = plan({ venues: [venue(1), venue(1)], mapping: approved(1) });
    expect(p.counts.totals.venues).toMatchObject({ duplicate: 1, toInsert: 1 });
  });
});

describe('venue coordinates', () => {
  const run = (over: Record<string, unknown>, m: Partial<MappingRow> = {}) =>
    plan({ venues: [venue(1, over)], mapping: mapping(mapRow(1, m)) });

  it.each([
    ['missing', { lat: null, lng: null }, 'missing'],
    ['text', { lat: 'north', lng: 'east' }, 'missing'],
    ['zero zero', { lat: 0, lng: 0 }, 'missing'],
    ['out of range', { lat: 120, lng: 74 }, 'out_of_range'],
    ['swapped', { lat: 74.3, lng: 31.5 }, 'swapped'],
    ['abroad', { lat: 51.5, lng: -0.1 }, 'outside_pakistan'],
  ])('%s is held back with the reason', (_label, over, detail) => {
    const p = run(over);
    expect(p.counts.totals.venues).toMatchObject({ invalidCoordinates: 1, toInsert: 0 });
    expect(p.flagged[0]).toMatchObject({ reason: 'invalidCoordinates', detail });
  });

  it('numbers typed as text are read', () => {
    expect(run({ lat: '31.5', lng: ' 74.3 ' }).counts.totals.venues.toInsert).toBe(1);
  });

  it('a person can correct the coordinates in the reviewed mapping', () => {
    const p = run({ lat: 74.3, lng: 31.5 }, { lat: 31.5, lng: 74.3 });
    expect(p.counts.totals.venues.toInsert).toBe(1);
    expect(p.venues[0]).toMatchObject({ lat: 31.5, lng: 74.3 });
  });
});

describe('venue fields', () => {
  const approved = mapping(mapRow(1));
  it('uses the venue name, falling back to the area label', () => {
    expect(plan({ venues: [venue(1)], mapping: approved }).venues[0]?.nameEn).toBe(
      'Sample Masjid 1',
    );
    expect(plan({ venues: [venue(1, { venue: null })], mapping: approved }).venues[0]?.nameEn).toBe(
      'Sample Area 1',
    );
  });
  it('rejects a venue with no name or no address', () => {
    expect(
      plan({ venues: [venue(1, { venue: null, name: null })], mapping: approved }).counts.totals
        .venues.invalidRow,
    ).toBe(1);
    expect(
      plan({ venues: [venue(1, { address: '   ' })], mapping: approved }).counts.totals.venues
        .invalidRow,
    ).toBe(1);
  });
  it('rejects over-long values instead of trimming them', () => {
    const long = 'x'.repeat(LIMITS.shortText + 1);
    expect(
      plan({ venues: [venue(1, { venue: long })], mapping: approved }).counts.totals.venues
        .invalidRow,
    ).toBe(1);
    expect(
      plan({ venues: [venue(1, { address: 'y'.repeat(LIMITS.address + 1) })], mapping: approved })
        .counts.totals.venues.invalidRow,
    ).toBe(1);
  });
  it('rejects rows that are not objects or have no id', () => {
    const p = plan({
      venues: ['text', null, 7, [], { name: 'no id', address: 'a' }],
      mapping: approved,
    });
    expect(p.counts.totals.venues).toMatchObject({ read: 5, invalidRow: 5 });
  });
  it('strips control characters and collapses whitespace', () => {
    const p = plan({
      venues: [venue(1, { venue: 'Sample\u0000\u0007  Masjid\t\n1' })],
      mapping: approved,
    });
    expect(p.venues[0]?.nameEn).toBe('Sample Masjid 1');
  });
  it('normalises the contact number, allowing landlines, or drops a bad one', () => {
    const good = plan({ venues: [venue(1, { contact: '042-35123456' })], mapping: approved });
    expect(good.venues[0]?.contactPhone).toBe('+924235123456');
    const bad = plan({ venues: [venue(1, { contact: '12' })], mapping: approved });
    expect(bad.venues[0]?.contactPhone).toBeNull();
    expect(bad.counts.totals.venues.contactPhoneInvalid).toBe(1);
  });
  it('never uses Urdu it does not have: the English text fills the Urdu columns and is counted', () => {
    const p = plan({ venues: [venue(1)], mapping: approved });
    expect(p.venues[0]).toMatchObject({ nameUr: 'Sample Masjid 1', addressUr: 'Street 1, Lahore' });
    expect(p.counts.totals.venues.needsUrduText).toBe(1);
  });
  it('gives an area the name from the reviewed mapping, Urdu defaulting to English', () => {
    const p = plan({ venues: [venue(1)], mapping: mapping(mapRow(1, { areaNameUr: 'علاقہ' })) });
    expect(p.areas).toEqual([
      { citySlug: 'lahore', slug: 'area-1', nameEn: 'Area 1', nameUr: 'علاقہ' },
    ]);
  });
  it('creates each area once even when several venues share it', () => {
    const p = plan({
      venues: [venue(1), venue(2)],
      mapping: mapping(mapRow(1, { areaSlug: 'shared' }), mapRow(2, { areaSlug: 'shared' })),
    });
    expect(p.areas).toHaveLength(1);
    expect(p.counts.areas.toCreate).toBe(1);
  });
});

describe('venue slugs', () => {
  it('are stable whether or not the other venue is approved yet', () => {
    const a = venue(1, { venue: 'Same Name' });
    const b = venue(2, {
      venue: 'Same Name',
      address: 'Other street, Lahore',
      lat: 31.7,
      lng: 74.5,
    });
    const both = plan({ venues: [a, b], mapping: mapping(mapRow(1), mapRow(2)) });
    const onlyA = plan({ venues: [a, b], mapping: mapping(mapRow(1)) });
    expect(onlyA.venues[0]?.slug).toBe(both.venues[0]?.slug);
  });
  it('fall back to a short id when even the area label matches', () => {
    const a = venue(1, { venue: 'Same Name', name: 'Same Label' });
    const b = venue(2, {
      venue: 'Same Name',
      name: 'Same Label',
      address: 'Other',
      lat: 31.7,
      lng: 74.5,
    });
    const slugs = plan({ venues: [a, b], mapping: mapping(mapRow(1), mapRow(2)) }).venues.map(
      (v) => v.slug,
    );
    expect(new Set(slugs).size).toBe(2);
    expect(slugs.every((s) => /^same-name-same-label-/.test(s))).toBe(true);
  });
  it('use a placeholder when the name has no Latin letters', () => {
    const p = plan({ venues: [venue(1, { venue: 'مسجد نور' })], mapping: mapping(mapRow(1)) });
    expect(p.venues[0]?.slug).toBe('venue');
  });
});

describe('registrations', () => {
  const reg = (n: number, over: Record<string, unknown> = {}) => ({
    id: n,
    timestamp: `2026-02-${String(10 + (n % 15)).padStart(2, '0')}T12:00:00Z`,
    location: 'Sample Masjid 1',
    name: `Test Person ${n}`,
    mobile: phoneForms(n).v1Digits,
    ...over,
  });
  const base = { venues: [venue(1), venue(2)], mapping: mapping(mapRow(1), mapRow(2)) };

  it('treats every way of typing one number as one person at one venue', () => {
    const forms = Object.values(phoneForms(9));
    const rows = forms.map((mobile, i) => reg(100 + i, { mobile }));
    const p = plan({ ...base, registrations: rows });
    expect(p.counts.totals.registrations).toMatchObject({
      read: forms.length,
      toInsert: 1,
      duplicate: forms.length - 1,
    });
  });

  it('keeps the earliest of a repeated registration, whatever the row order', () => {
    const early = reg(1, { timestamp: '2026-02-01T00:00:00Z', mobile: phoneForms(5).v1Digits });
    const late = reg(2, { timestamp: '2026-02-20T00:00:00Z', mobile: phoneForms(5).national });
    for (const rows of [
      [early, late],
      [late, early],
    ]) {
      const p = plan({ ...base, registrations: rows });
      expect(p.registrations.map((r) => r.sourceId)).toEqual(['1']);
    }
  });

  it('keeps the same person at two different venues', () => {
    const rows = [reg(1), reg(2, { location: 'Sample Masjid 2' })];
    expect(plan({ ...base, registrations: rows }).counts.totals.registrations.toInsert).toBe(2);
  });

  it('matches the venue name loosely and reads the venue from either spelling', () => {
    const p = plan({ ...base, registrations: [reg(1, { location: '  sample MASJID-1 ' })] });
    expect(p.registrations[0]).toMatchObject({
      citySlug: 'lahore',
      cityName: 'Lahore',
      venueName: 'sample MASJID-1',
    });
  });

  it('stores the E.164 number, the V1 id as text, and the original answers under raw', () => {
    const p = plan({
      ...base,
      registrations: [
        reg(7, { age: '30s', profession: 'Sample job', area: null, extra: 'ignored' }),
      ],
    });
    expect(p.registrations[0]).toMatchObject({
      sourceId: '7',
      phone: `+92${fakeNational(7)}`,
      raw: { source: 'v1-registeration', v1: { age: '30s', profession: 'Sample job' } },
    });
    expect(JSON.stringify(p.registrations[0]?.raw)).not.toContain('extra');
    // The name and number are columns already; they are not repeated inside raw.
    expect(JSON.stringify(p.registrations[0]?.raw)).not.toContain('Test Person');
    expect(JSON.stringify(p.registrations[0]?.raw)).not.toContain(fakeNational(7));
  });

  it('records the time in UTC, and a missing time as null', () => {
    const p = plan({
      ...base,
      registrations: [
        reg(1, { timestamp: '2026-02-20T19:00:00+05:00' }),
        reg(2, { timestamp: null }),
      ],
    });
    expect(p.registrations.map((r) => r.registeredAt)).toEqual(['2026-02-20T14:00:00.000Z', null]);
  });

  it('never invents a time from a vague string', () => {
    const p = plan({
      ...base,
      registrations: [reg(1, { timestamp: '15' }), reg(2, { timestamp: 'tomorrow' })],
    });
    expect(p.registrations.map((r) => r.registeredAt)).toEqual([null, null]);
    expect(p.counts.totals.registrations.unparseableTimestamp).toBe(2);
  });

  it('rejects rows without a name or number, and numbers that are not numbers', () => {
    const p = plan({
      ...base,
      registrations: [
        reg(1, { name: null }),
        reg(2, { mobile: null }),
        reg(3, { mobile: 'abc' }),
        'junk',
      ],
    });
    expect(p.counts.totals.registrations).toMatchObject({
      read: 4,
      invalidRow: 3,
      invalidPhone: 1,
      toInsert: 0,
    });
  });

  it('holds back registrations whose venue is not placed', () => {
    const p = plan({
      venues: [venue(1), venue(2)],
      mapping: mapping(mapRow(1), mapRow(2, { approved: false })),
      registrations: [
        reg(1),
        reg(2, { location: 'Sample Masjid 2' }),
        reg(3, { location: 'Unknown Hall' }),
        reg(4, { location: null }),
      ],
    });
    expect(p.counts.totals.registrations).toMatchObject({ toInsert: 1, unmappedVenue: 3 });
  });

  it('holds back a venue name that belongs to two cities', () => {
    const p = plan({
      venues: [
        venue(1, { venue: 'Twin' }),
        venue(2, { venue: 'Twin', address: 'Somewhere in Multan', lat: 30.2, lng: 71.5 }),
      ],
      mapping: mapping(mapRow(1), mapRow(2, { citySlug: 'multan' })),
      registrations: [reg(1, { location: 'Twin' })],
    });
    expect(p.counts.totals.registrations.ambiguousVenue).toBe(1);
  });

  it('accepts one name shared by two venues in the same city', () => {
    const p = plan({
      venues: [
        venue(1, { venue: 'Twin' }),
        venue(2, { venue: 'Twin', address: 'Elsewhere in Lahore', lat: 31.7, lng: 74.5 }),
      ],
      mapping: mapping(mapRow(1), mapRow(2)),
      registrations: [reg(1, { location: 'Twin' })],
    });
    expect(p.counts.totals.registrations.toInsert).toBe(1);
  });

  it('an unplaceable registration is still counted once, never lost', () => {
    const p = plan({ registrations: [reg(1)] }); // no venues provided
    expect(p.counts.totals.registrations).toMatchObject({ read: 1, unmappedVenue: 1 });
  });

  it('skips already-present source ids', () => {
    const target = offlineTarget();
    target.registrationSourceIds.add('1');
    const p = plan({
      ...base,
      target,
      registrations: [reg(1), reg(2, { mobile: phoneForms(2).national })],
    });
    expect(p.counts.totals.registrations).toMatchObject({ alreadyPresent: 1, toInsert: 1 });
  });

  it('counts overseas numbers typed with a plus', () => {
    const p = plan({ ...base, registrations: [reg(1, { mobile: '+971500000115' })] });
    expect(p.counts.totals.registrations).toMatchObject({ toInsert: 1, nonPakistanNumber: 1 });
    expect(p.registrations[0]?.phone).toBe('+971500000115');
  });

  it('flagged rows list ids and reasons, never names or numbers', () => {
    const p = plan({ ...base, registrations: [reg(1, { mobile: 'abc' }), reg(2, { name: null })] });
    expect(p.flagged).toEqual([
      { dataset: 'registrations', row: 1, sourceId: '1', reason: 'invalidPhone' },
      { dataset: 'registrations', row: 2, sourceId: '2', reason: 'invalidRow' },
    ]);
  });
});

describe('subscribers', () => {
  const sub = (n: number, over: Record<string, unknown> = {}) => ({
    phone: phoneForms(n).v1Digits,
    venue: 'Sample Masjid 1',
    name: 'Sample Area 1',
    ...over,
  });
  const base = { venues: [venue(1)], mapping: mapping(mapRow(1)) };

  it('deduplicates by normalised number, keeping the first', () => {
    const p = plan({
      ...base,
      subscribers: [
        sub(1),
        sub(1, { phone: phoneForms(1).national }),
        sub(1, { phone: `+92 ${fakeNational(1)}` }),
        sub(2),
      ],
    });
    expect(p.counts.totals.subscribers).toMatchObject({ read: 4, toInsert: 2, duplicate: 2 });
    expect(p.subscribers.map((s) => s.phone)).toEqual([
      `+92${fakeNational(1)}`,
      `+92${fakeNational(2)}`,
    ]);
  });

  it('rejects numbers that are not numbers and rows without one', () => {
    const p = plan({ ...base, subscribers: [sub(1, { phone: 'x' }), sub(2, { phone: null }), 5] });
    expect(p.counts.totals.subscribers).toMatchObject({
      invalidPhone: 1,
      invalidRow: 2,
      toInsert: 0,
    });
  });

  it('keeps a subscriber whose venue is unknown, but says so', () => {
    const p = plan({ ...base, subscribers: [sub(1, { venue: 'Unknown Hall' })] });
    expect(p.counts.totals.subscribers).toMatchObject({ toInsert: 1, venueUnmapped: 1 });
    expect(p.counts.cities.unassigned?.subscribers.toInsert).toBe(1);
  });

  it('works with no venues dataset at all', () => {
    const p = plan({ subscribers: [sub(1), sub(2)] });
    expect(p.counts.totals.subscribers).toMatchObject({ toInsert: 2, venueUnmapped: 2 });
  });

  it('skips numbers already present', () => {
    const target = offlineTarget();
    target.subscriberPhones.add(`+92${fakeNational(1)}`);
    const p = plan({ ...base, target, subscribers: [sub(1), sub(2)] });
    expect(p.counts.totals.subscribers).toMatchObject({ alreadyPresent: 1, toInsert: 1 });
  });

  it('flagged subscribers carry no id, because V1 has none', () => {
    const p = plan({ ...base, subscribers: [sub(1, { phone: 'x' })] });
    expect(p.flagged).toEqual([
      { dataset: 'subscribers', row: 1, sourceId: null, reason: 'invalidPhone' },
    ]);
  });
});

describe('datasets are optional', () => {
  it('does nothing and reports nothing for a dataset that was not provided', () => {
    const p = plan({ subscribers: [] });
    expect(p.counts.provided).toEqual({ venues: false, registrations: false, subscribers: true });
    expect(p.counts.totals.venues.read).toBe(0);
    expect(p.venues).toEqual([]);
  });
});
