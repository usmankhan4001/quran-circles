import { describe, expect, it } from 'vitest';
import { cleanRows, parsePhone, parseTime, parseWeeks, type RawRow } from './clean';
import { decodeFull, plusCodeToPoint, recoverShort } from './pluscode';
import { parseCoords } from './coords';

const row = (over: Partial<RawRow>): RawRow => ({
  id: '1',
  city: 'Testville',
  address: 'House 1, Test Street',
  day: 'Friday',
  time: 'After Isha',
  weeks: 'Every Week',
  contact: '03001234567',
  map_link: '',
  map_note: '',
  ...over,
});

describe('parseTime', () => {
  it('reads clock forms', () => {
    expect(parseTime('07:30-AM').time).toEqual({ kind: 'clock', start: '07:30', end: null });
    expect(parseTime('02:30-PM').time).toMatchObject({ start: '14:30' });
    expect(parseTime('02.30-PM').time).toMatchObject({ start: '14:30' });
    expect(parseTime('9:30 am').time).toMatchObject({ start: '09:30' });
    expect(parseTime('12:00 pm').time).toMatchObject({ start: '12:00' });
    expect(parseTime('Morning 10:15am').time).toMatchObject({ start: '10:15' });
  });
  it('reads an evening time with no am or pm', () => {
    expect(parseTime('Evening 6:15')).toEqual({
      time: { kind: 'clock', start: '18:15', end: null },
      flags: [],
    });
  });
  it('reads a range as start and end', () => {
    expect(parseTime('09:45 PM to 10:45 PM').time).toEqual({
      kind: 'clock',
      start: '21:45',
      end: '22:45',
    });
  });
  it('reads prayer-relative starts, with their spellings', () => {
    for (const [text, prayer] of [
      ['After Maghrib', 'maghrib'],
      ['After Magrib', 'maghrib'],
      ['Aftar Asar', 'asr'],
      ['After Fajar', 'fajr'],
      ['Namaz Isha', 'isha'],
      ['Namaz Zuhar', 'zuhr'],
    ] as const)
      expect(parseTime(text).time).toEqual({ kind: 'prayer', prayer, explicit: null });
  });
  it('keeps an explicit time given beside a prayer', () => {
    expect(parseTime('After Zohar (12:45)').time).toEqual({
      kind: 'prayer',
      prayer: 'zuhr',
      explicit: '12:45',
    });
  });
  it('flags midnight written as a morning time, and a bare clock', () => {
    expect(parseTime('Morning 12:00am').flags).toContain('suspect_time');
    expect(parseTime('3:30').flags).toContain('ambiguous_time');
  });
  it('refuses text it cannot read', () => {
    expect(parseTime('whenever').flags).toContain('unreadable_time');
    expect(parseTime('').time).toBeNull();
  });
});

describe('parseWeeks and parsePhone', () => {
  it('reads week patterns', () => {
    expect(parseWeeks('Every Week')).toBe('every');
    expect(parseWeeks('Every 1st & 3rd Week of Month')).toEqual([1, 3]);
    expect(parseWeeks('Every 1st Week of the Month')).toEqual([1]);
    expect(parseWeeks('sometimes')).toBeNull();
  });
  it('normalises Pakistani mobile formats and refuses short numbers', () => {
    expect(parsePhone('0300-1234567')).toBe('+923001234567');
    expect(parsePhone('+92 300 1234567')).toBe('+923001234567');
    expect(parsePhone('0300123456')).toBeNull();
  });
});

describe('cleanRows', () => {
  it('imports a plain row', () => {
    const [r] = cleanRows([row({})]);
    expect(r).toMatchObject({ status: 'import', day: 5, phone: '+923001234567', flags: [] });
  });
  it('skips an exact repeat and keeps the first', () => {
    const rows = cleanRows([
      row({ id: '71' }),
      row({ id: '73', map_link: 'https://maps.app.goo.gl/x' }),
    ]);
    expect(rows.map((r) => r.status)).toEqual(['import', 'skip']);
    expect(rows[1]!.flags).toContain('duplicate_of:71');
  });
  it('holds both rows when two times differ by a minute (probable typo)', () => {
    const rows = cleanRows([
      row({ id: '185', time: 'Evening 6:15' }),
      row({ id: '186', time: 'Evening 6:16' }),
    ]);
    expect(rows.map((r) => r.status)).toEqual(['hold', 'hold']);
    expect(rows[0]!.flags).toContain('near_duplicate_time');
  });
  it('holds a one-minute difference at one venue even on different days', () => {
    const rows = cleanRows([
      row({ id: '185', day: 'Tuesday', time: 'Evening 6:15' }),
      row({ id: '186', day: 'Wednesday', time: 'Evening 6:16' }),
    ]);
    expect(rows.map((r) => r.status)).toEqual(['hold', 'hold']);
  });
  it('lets one venue meet at the same time on two days', () => {
    const rows = cleanRows([
      row({ id: '1', day: 'Tuesday', time: 'Evening 6:15' }),
      row({ id: '2', day: 'Wednesday', time: 'Evening 6:15' }),
    ]);
    expect(rows.map((r) => r.status)).toEqual(['import', 'import']);
  });
  it('holds an address that names another city of the file', () => {
    const rows = cleanRows([
      row({ id: '1', city: 'Sargodha', address: 'Street 2, Sargodha' }),
      row({ id: '59', city: 'Sargodha', address: 'Block 5, Karachi' }),
      row({ id: '2', city: 'Karachi', address: 'Street 9, Karachi' }),
    ]);
    expect(rows.map((r) => r.status)).toEqual(['import', 'hold', 'import']);
    expect(rows[1]!.flags).toContain('address_names_other_city');
  });
  it('drops a bad phone but still imports the row, and holds a suspect time', () => {
    const [a, b] = cleanRows([
      row({ id: '1', contact: '0300123456' }),
      row({ id: '2', address: 'Other Street', time: 'Morning 12:00am' }),
    ]);
    expect(a).toMatchObject({ status: 'import', phone: null });
    expect(a!.flags).toContain('phone_invalid');
    expect(b!.status).toBe('hold');
  });
  it('holds a row with an unreadable day', () => {
    expect(cleanRows([row({ day: 'Someday' })])[0]!.status).toBe('hold');
  });
});

describe('plus codes and the sll parameter', () => {
  it('decodes a full code to its cell centre', () => {
    // The specification's own example, 8FVC9G8F+6X, is in Zurich.
    const q = decodeFull('8FVC9G8F+6X')!;
    expect(q.lat).toBeCloseTo(47.365562, 4);
    expect(q.lng).toBeCloseTo(8.524937, 4);
    expect(decodeFull('not+code')).toBeNull();
  });
  it('recovers a short code near a reference point', () => {
    const ref = { lat: 47.4, lng: 8.5 };
    const got = recoverShort('9G8F+6X', ref)!;
    expect(got.lat).toBeCloseTo(47.365562, 4);
    expect(got.lng).toBeCloseTo(8.524937, 4);
    expect(plusCodeToPoint('near 9G8F+6X gate', null)).toBeNull();
    expect(plusCodeToPoint('near 9G8F+6X gate', ref)!.lat).toBeCloseTo(47.365562, 4);
    expect(plusCodeToPoint('8FVC9G8F+6X', null)!.lng).toBeCloseTo(8.524937, 4);
  });
  it('reads sll= like the other coordinate parameters', () => {
    expect(parseCoords('https://maps.google.com/?sll=31.5204,74.3587&z=17')).toEqual({
      lat: 31.5204,
      lng: 74.3587,
    });
  });
});
