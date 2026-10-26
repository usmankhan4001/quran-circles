import { describe, expect, it } from 'vitest';
import { cleanRows, type RawRow } from './clean';
import { buildPlan } from './plan';
import type { Resolution } from './resolve';

const row = (over: Partial<RawRow>): RawRow => ({
  id: '1',
  city: 'Testville',
  address: 'House 1, Test Street',
  day: 'Friday',
  time: 'After Isha',
  weeks: 'Every Week',
  contact: '',
  map_link: '',
  map_note: '',
  ...over,
});

const at = (lat: number, lng: number): Resolution => ({
  ok: true,
  point: { lat, lng },
  via: 'link',
});

describe('buildPlan', () => {
  it('imports a pinned venue and counts its sessions', () => {
    const rows = cleanRows([
      row({ id: '1', map_link: 'https://maps.app.goo.gl/a' }),
      row({ id: '2', day: 'Sunday', map_link: 'https://maps.app.goo.gl/a' }),
    ]);
    const plan = buildPlan(rows, new Map([['https://maps.app.goo.gl/a', at(31.5, 74.3)]]));
    expect(plan.counts).toMatchObject({
      venuesImportable: 1,
      sessionsImportable: 2,
      rowsImport: 2,
    });
  });
  it('does not import a venue with no pin, and says how many sessions wait', () => {
    const plan = buildPlan(cleanRows([row({})]), new Map());
    expect(plan.counts).toMatchObject({
      venuesImportable: 0,
      sessionsImportable: 0,
      sessionsWaitingForLocation: 1,
    });
    expect(plan.counts.locations.needsGeocoding).toBe(1);
  });
  it('reads coordinates written in a note', () => {
    const plan = buildPlan(cleanRows([row({ map_note: '31.5204, 74.3587' })]), new Map());
    expect(plan.counts.venuesImportable).toBe(1);
    expect(plan.counts.pinsFromNotes.coordinates).toBe(1);
  });
  it('recovers a short plus code from the pins of the same city', () => {
    // 8FVC9G8F+6X is a Zurich code; the reference city's other venue is nearby.
    const rows = cleanRows([
      row({ id: '1', address: 'A', map_link: 'https://maps.app.goo.gl/a' }),
      row({ id: '2', address: 'B', map_note: 'at 9G8F+6X' }),
    ]);
    const plan = buildPlan(rows, new Map([['https://maps.app.goo.gl/a', at(47.4, 8.5)]]));
    expect(plan.counts.pinsFromNotes.plusCodes).toBe(1);
  });
  it('uses a geocoded pin for a venue with no link, and counts it', () => {
    const rows = cleanRows([row({ id: '1' })]);
    const key = rows[0]!.venueKey;
    const plan = buildPlan(rows, new Map(), new Map([[key, { lat: 31.5, lng: 74.3 }]]));
    expect(plan.counts).toMatchObject({ venuesImportable: 1, pinsFromGeocoding: 1 });
  });
  it('imports an approximate geocoder pin only when nothing better exists, and flags it', () => {
    const rows = cleanRows([
      row({ id: '1', address: 'A', map_link: 'https://maps.app.goo.gl/a' }),
      row({ id: '2', address: 'B' }),
    ]);
    const [a, b] = rows.map((r) => r.venueKey);
    const approx = new Map([
      [a!, { lat: 1, lng: 1 }],
      [b!, { lat: 31.51, lng: 74.31 }],
    ]);
    const plan = buildPlan(
      rows,
      new Map([['https://maps.app.goo.gl/a', at(31.5, 74.3)]]),
      new Map(),
      approx,
    );
    expect(plan.venues.map((v) => [v.importable, v.approximate])).toEqual([
      [true, false],
      [true, true],
    ]);
    expect(plan.venues[0]!.location.point).toEqual({ lat: 31.5, lng: 74.3 });
    expect(plan.counts.pinsApproximate).toBe(1);
  });
  it('does not import a held row or a row skipped as a duplicate', () => {
    const rows = cleanRows([
      row({ id: '71', map_link: 'https://maps.app.goo.gl/a' }),
      row({ id: '73', map_link: 'https://maps.app.goo.gl/a' }),
      row({
        id: '9',
        day: 'Monday',
        time: 'Morning 12:00am',
        map_link: 'https://maps.app.goo.gl/a',
      }),
    ]);
    const plan = buildPlan(rows, new Map([['https://maps.app.goo.gl/a', at(31.5, 74.3)]]));
    expect(plan.counts).toMatchObject({
      rowsImport: 1,
      rowsSkip: 1,
      rowsHold: 1,
      sessionsImportable: 1,
    });
    expect(plan.counts.flags).toMatchObject({ duplicate_of: 1, suspect_time: 1 });
  });
  it('does not import venues that share one link across different addresses', () => {
    const rows = cleanRows([
      row({ id: '1', city: 'Arifwala', address: 'A', map_link: 'https://maps.app.goo.gl/s' }),
      row({ id: '2', city: 'Sahiwal', address: 'B', map_link: 'https://maps.app.goo.gl/s' }),
    ]);
    const plan = buildPlan(rows, new Map([['https://maps.app.goo.gl/s', at(30.3, 73.1)]]));
    expect(plan.counts.venuesImportable).toBe(0);
    expect(plan.venues.every((v) => v.location.reason === 'shared_pin')).toBe(true);
  });
});
