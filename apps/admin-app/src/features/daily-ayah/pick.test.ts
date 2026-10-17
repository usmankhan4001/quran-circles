import { describe, expect, it } from 'vitest';
import { builtInAyahFor, type DailyAyahEntry, type Principal } from '@qc/contracts';
import * as fx from '@qc/contracts/fixtures';
import { FIXTURE_NOW, ids, meFor } from '../../test/backend';
import { principalOf } from '../../scope/principal';
import {
  PICK_DAYS,
  ayahCountOf,
  ayahFormOf,
  canPickFor,
  datesIn,
  fallbackOn,
  pickOn,
  pickWindow,
  placeQuery,
  targetOf,
  typedSurah,
  validatePick,
  type AyahPlace,
} from './pick';

const name = { en: 'Sample place', ur: null };
const venue = (venueId: string, cityId: string): AyahPlace => ({
  type: 'venue',
  venueId,
  cityId,
  name,
});
const circleOf = (index: number): AyahPlace => {
  const c = fx.circles[index]!;
  return { type: 'circle', circleId: c.id, venueId: c.venueId, cityId: c.cityId, name };
};

const alNoor = venue(ids.venueAlNoor, ids.cityRawalpindi);
const iqra = venue(fx.venues[1]!.id, fx.venues[1]!.cityId);
const lahore = venue(ids.venueLahore, ids.cityLahore);
/** The Tuesday Tajweed Circle, at Al-Noor. */
const alNoorCircle = circleOf(0);
/** A circle at the Lahore venue. */
const lahoreCircle = circleOf(1);

const who: Record<string, Principal> = {
  venue: principalOf(meFor('venue')),
  city: principalOf(meFor('city')),
  admin: principalOf(meFor('admin')),
  multi: principalOf(meFor('multi')),
  attendee: principalOf({ ...meFor('venue'), roles: [] }),
};

describe('canPickFor, per role', () => {
  const matrix: [string, AyahPlace, Record<keyof typeof who, boolean>][] = [
    ['Al-Noor', alNoor, { venue: true, city: true, admin: true, multi: true, attendee: false }],
    [
      "Al-Noor's circle",
      alNoorCircle,
      { venue: true, city: true, admin: true, multi: true, attendee: false },
    ],
    [
      'Markaz Iqra (same city, other venue)',
      iqra,
      { venue: false, city: true, admin: true, multi: false, attendee: false },
    ],
    [
      'the Lahore venue',
      lahore,
      { venue: false, city: false, admin: true, multi: true, attendee: false },
    ],
    [
      'a Lahore circle',
      lahoreCircle,
      { venue: false, city: false, admin: true, multi: true, attendee: false },
    ],
  ];
  for (const [label, place, expected] of matrix) {
    for (const role of Object.keys(who) as (keyof typeof who)[]) {
      it(`${role} ${expected[role] ? 'may' : 'may not'} pick for ${label}`, () => {
        expect(canPickFor(who[role]!, place)).toBe(expected[role]);
      });
    }
  }
});

describe('targets and queries', () => {
  it('sends a venue or a circle target, never national', () => {
    expect(targetOf(alNoor)).toEqual({ type: 'venue', venueId: ids.venueAlNoor });
    expect(targetOf(alNoorCircle)).toEqual({ type: 'circle', circleId: fx.circles[0]!.id });
  });

  it("lists only the place's own picks (a venue filter alone would match its circles too)", () => {
    expect(placeQuery(alNoor)).toEqual({ scopeType: 'venue', venueId: ids.venueAlNoor });
    expect(placeQuery(alNoorCircle)).toEqual({
      scopeType: 'circle',
      circleId: fx.circles[0]!.id,
    });
  });
});

describe('the days offered', () => {
  it('starts today in Pakistan and runs for PICK_DAYS days', () => {
    const range = pickWindow(FIXTURE_NOW);
    expect(range).toEqual({ from: '2027-02-15', to: '2027-03-16' });
    const days = datesIn(range);
    expect(days).toHaveLength(PICK_DAYS);
    expect(days[0]).toBe('2027-02-15');
    expect(days.at(-1)).toBe('2027-03-16');
  });

  it('uses the Pakistan date just after midnight there, not the UTC date', () => {
    expect(pickWindow(new Date('2027-02-15T19:30:00Z')).from).toBe('2027-02-16');
  });
});

const entry = (over: Partial<DailyAyahEntry>): DailyAyahEntry => ({
  id: '00000000-0000-4000-8000-0f0000000999',
  date: '2027-02-15',
  scopeType: 'venue',
  cityId: ids.cityRawalpindi,
  venueId: ids.venueAlNoor,
  circleId: null,
  surah: 13,
  ayah: 28,
  updatedAt: '2027-02-12T04:00:00Z',
  ...over,
});

describe('pickOn', () => {
  it("finds the venue's own pick and not a circle pick at the same venue", () => {
    const circlePick = entry({ scopeType: 'circle', circleId: fx.circles[0]!.id, surah: 73 });
    expect(pickOn('2027-02-15', [circlePick], alNoor)).toBeUndefined();
    expect(pickOn('2027-02-15', [circlePick, entry({})], alNoor)?.surah).toBe(13);
    expect(pickOn('2027-02-15', [circlePick], alNoorCircle)?.surah).toBe(73);
  });

  it('ignores other dates and other venues', () => {
    expect(pickOn('2027-02-16', [entry({})], alNoor)).toBeUndefined();
    expect(pickOn('2027-02-15', [entry({})], iqra)).toBeUndefined();
  });
});

describe('fallbackOn: what followers see without a pick', () => {
  it('is the national pick when there is one', () => {
    expect(fallbackOn('2027-02-15', fx.dailyAyahs)).toMatchObject({
      source: 'national',
      surah: 2,
      ayah: 255,
    });
  });

  it('is the built-in ayah when there is no national pick', () => {
    const f = fallbackOn('2027-02-17', fx.dailyAyahs);
    expect(f.source).toBe('built_in');
    expect({ surah: f.surah, ayah: f.ayah }).toEqual(builtInAyahFor('2027-02-17'));
  });

  it('never counts a venue or circle pick as the fallback', () => {
    const onlyPlaces = fx.dailyAyahs.filter((p) => p.scopeType !== 'national');
    expect(fallbackOn('2027-02-15', onlyPlaces).source).toBe('built_in');
  });
});

describe('ayahCountOf and typedSurah', () => {
  it('knows the ayat in a surah', () => {
    expect(ayahCountOf(1)).toBe(7);
    expect(ayahCountOf(2)).toBe(286);
    expect(ayahCountOf(114)).toBe(6);
  });

  it('has no count for a surah that does not exist', () => {
    expect(ayahCountOf(0)).toBeNull();
    expect(ayahCountOf(115)).toBeNull();
    expect(ayahCountOf(1.5)).toBeNull();
  });

  it('reads the typed surah only when it is a real one', () => {
    expect(typedSurah({ surah: ' 36 ', ayah: '' })).toBe(36);
    expect(typedSurah({ surah: '115', ayah: '' })).toBeNull();
    expect(typedSurah({ surah: 'yasin', ayah: '' })).toBeNull();
  });
});

describe('validatePick, with the contract schema', () => {
  it('builds the request for a venue', () => {
    expect(validatePick({ surah: '1', ayah: '5' }, '2027-02-17', alNoor, undefined)).toEqual({
      errors: {},
      body: {
        date: '2027-02-17',
        scope: { type: 'venue', venueId: ids.venueAlNoor },
        surah: 1,
        ayah: 5,
      },
    });
  });

  it('builds the request for a circle', () => {
    expect(
      validatePick({ surah: '2', ayah: '286' }, '2027-02-16', alNoorCircle, undefined).body?.scope,
    ).toEqual({ type: 'circle', circleId: fx.circles[0]!.id });
  });

  it.each([
    ['', '1'],
    ['0', '1'],
    ['115', '1'],
    ['abc', '1'],
    ['2.5', '1'],
  ])('refuses the surah %j', (surah, ayah) => {
    const res = validatePick({ surah, ayah }, '2027-02-17', alNoor, undefined);
    expect(res.errors.surah).toBe(true);
    expect(res.body).toBeUndefined();
  });

  it.each([
    ['1', '8'],
    ['1', '0'],
    ['1', ''],
    ['114', '7'],
    ['2', '287'],
    ['2', '2:255'],
  ])('refuses surah %s ayah %j, which does not exist', (surah, ayah) => {
    const res = validatePick({ surah, ayah }, '2027-02-17', alNoor, undefined);
    expect(res.errors).toEqual({ ayah: true });
    expect(res.body).toBeUndefined();
  });

  it('accepts the last ayah of a surah', () => {
    const res = validatePick({ surah: '114', ayah: '6' }, '2027-02-17', alNoor, undefined);
    expect(res.errors).toEqual({});
    expect(res.body).toMatchObject({ surah: 114, ayah: 6 });
  });

  it('says so when the ayah is already the pick, and sends nothing', () => {
    const res = validatePick({ surah: '13', ayah: '28' }, '2027-02-15', alNoor, entry({}));
    expect(res).toEqual({ errors: { same: true } });
  });

  it('replaces a pick with another ayah', () => {
    const res = validatePick({ surah: '13', ayah: '29' }, '2027-02-15', alNoor, entry({}));
    expect(res.body).toMatchObject({ surah: 13, ayah: 29 });
  });

  it('reports a bad date as a general error, not as the person’s input', () => {
    const res = validatePick({ surah: '1', ayah: '1' }, '15/02/2027', alNoor, undefined);
    expect(res.errors).toEqual({ invalid: true });
  });

  it('fills the form from a pick, or leaves it empty', () => {
    expect(ayahFormOf(entry({}))).toEqual({ surah: '13', ayah: '28' });
    expect(ayahFormOf(undefined)).toEqual({ surah: '', ayah: '' });
  });
});
