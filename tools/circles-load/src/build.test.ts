import { describe, expect, it } from 'vitest';
import { APPROXIMATE_NOTE_EN, DEFAULTS, sessionRow, venueRow, type LoadDefaults } from './build';
import { cleanRows, type RawRow } from './clean';
import { buildPlan } from './plan';
import type { Resolution } from './resolve';

const ID = '00000000-0000-4000-8000-000000000001';
const defaults: LoadDefaults = { ...DEFAULTS, startsOn: '2026-11-01' };

const raw = (over: Partial<RawRow>): RawRow => ({
  id: '1',
  city: 'Testville',
  halqa_code: 'T-1',
  halqa_name: 'حلقہ ٹیسٹ',
  address: 'House 1, Test Street, Testville',
  day: 'Friday',
  time: 'After Maghrib',
  weeks: 'Every Week',
  contact: '03001234567',
  map_link: 'https://maps.app.goo.gl/a',
  map_note: '',
  ...over,
});
const pinned = new Map<string, Resolution>([
  ['https://maps.app.goo.gl/a', { ok: true, point: { lat: 31.5, lng: 74.3 }, via: 'link' }],
]);

const plan = (rows: RawRow[], approx = new Map()) => {
  const clean = cleanRows(rows);
  return { clean, plan: buildPlan(clean, pinned, new Map(), approx) };
};

describe('venueRow', () => {
  it('builds a valid venue row with no phone unless asked', () => {
    const { plan: p } = plan([raw({})]);
    const out = venueRow(p.venues[0]!, { cityId: ID, areaId: ID })!;
    expect(out.body).toMatchObject({
      lat: 31.5,
      lng: 74.3,
      contactPhone: null,
      name: { en: 'House 1, Testville' },
    });
    expect(out.body.facilities).toEqual({});
  });
  it('carries a phone only when it is passed in', () => {
    const { plan: p } = plan([raw({})]);
    expect(
      venueRow(p.venues[0]!, { cityId: ID, areaId: ID }, '+923001234567')!.body.contactPhone,
    ).toBe('+923001234567');
  });
  it('flags an approximate pin in the entrance notes', () => {
    const rows = [raw({ map_link: '' })];
    const clean = cleanRows(rows);
    const p = buildPlan(
      clean,
      new Map(),
      new Map(),
      new Map([[clean[0]!.venueKey, { lat: 31.5, lng: 74.3 }]]),
    );
    const out = venueRow(p.venues[0]!, { cityId: ID, areaId: ID })!;
    expect(out.body.facilities.entranceNotes).toEqual({ en: APPROXIMATE_NOTE_EN, ur: null });
  });
  it('returns null for a venue with no trusted pin', () => {
    const clean = cleanRows([raw({ map_link: '' })]);
    const p = buildPlan(clean, new Map());
    expect(venueRow(p.venues[0]!, { cityId: ID, areaId: ID })).toBeNull();
  });
});

describe('sessionRow', () => {
  it('uses a placeholder for a prayer-relative start and says so', () => {
    const { clean } = plan([raw({})]);
    const s = sessionRow(clean[0]!, ID, defaults)!;
    expect(s).toMatchObject({
      kind: 'recurring',
      localStartTime: '18:45',
      daysOfWeek: [5],
      status: 'published',
      durationMinutes: 60,
      program: 'circles',
    });
    expect(s.description?.en).toContain('placeholder');
  });
  it('keeps an explicit time and a range as given', () => {
    const { clean } = plan([
      raw({ id: '1', time: '09:45 PM to 10:45 PM' }),
      raw({ id: '2', address: 'Other', time: 'After Zohar (12:45)' }),
    ]);
    expect(sessionRow(clean[0]!, ID, defaults)).toMatchObject({
      localStartTime: '21:45',
      durationMinutes: 60,
    });
    expect(sessionRow(clean[1]!, ID, defaults)).toMatchObject({ localStartTime: '12:45' });
  });
  it('loads a monthly pattern as a draft with the pattern in the description', () => {
    const { clean } = plan([raw({ weeks: 'Every 1st & 3rd Week of Month' })]);
    const s = sessionRow(clean[0]!, ID, defaults)!;
    expect(s.status).toBe('draft');
    expect(s.description?.en).toContain('1st and 3rd week');
  });
  it('takes the Urdu title from the halqa name and the code into the English one', () => {
    const { clean } = plan([raw({})]);
    const s = sessionRow(clean[0]!, ID, defaults)!;
    expect(s.title).toEqual({ en: 'Quran circle T-1 (Testville)', ur: 'حلقہ ٹیسٹ' });
  });
});
