import { describe, expect, it } from 'vitest';
import { builtInAyahFor, type DailyAyahEntry, type Principal } from '@qc/contracts';
import { circles, dailyAyahs, venues } from '@qc/contracts/fixtures';
import { cityCoordinator, nationalAdmin, venueA, venueB, venueCoordinator } from '../test/people';
import {
  ayahCount,
  buildPut,
  canManagePick,
  canSetNational,
  circlesFor,
  draftFromEntry,
  existingPickFor,
  fallbackDays,
  pickResource,
  scopesFor,
  sortPicks,
  venuesFor,
  type PickDraft,
} from './daily-ayahs';

const draft = (patch: Partial<PickDraft> = {}): PickDraft => ({
  date: '2027-02-20',
  scopeType: 'national',
  venueId: '',
  circleId: '',
  surah: '2',
  ayah: '255',
  ...patch,
});

const [nationalPick, , venuePick, circlePick, lahorePick] = dailyAyahs as [
  DailyAyahEntry,
  DailyAyahEntry,
  DailyAyahEntry,
  DailyAyahEntry,
  DailyAyahEntry,
];
const nobody: Principal = { userId: 'u', assignments: [] };

describe('ayahCount', () => {
  it('gives the number of ayat in a surah', () => {
    expect(ayahCount(1)).toBe(7);
    expect(ayahCount(2)).toBe(286);
    expect(ayahCount(114)).toBe(6);
  });

  it('knows no surah outside 1 to 114', () => {
    expect(ayahCount(0)).toBeUndefined();
    expect(ayahCount(115)).toBeUndefined();
    expect(ayahCount(Number.NaN)).toBeUndefined();
    expect(ayahCount(2.5)).toBeUndefined();
  });
});

describe('buildPut (the shared DailyAyahPut schema)', () => {
  it('builds a national pick', () => {
    expect(buildPut(draft())).toEqual({
      ok: true,
      body: { date: '2027-02-20', scope: { type: 'national' }, surah: 2, ayah: 255 },
    });
  });

  it('builds a venue pick and a circle pick', () => {
    expect(buildPut(draft({ scopeType: 'venue', venueId: venueA!.id }))).toMatchObject({
      ok: true,
      body: { scope: { type: 'venue', venueId: venueA!.id } },
    });
    expect(buildPut(draft({ scopeType: 'circle', circleId: circles[0]!.id }))).toMatchObject({
      ok: true,
      body: { scope: { type: 'circle', circleId: circles[0]!.id } },
    });
  });

  it('asks for every empty field', () => {
    const result = buildPut({
      date: '',
      scopeType: '',
      venueId: '',
      circleId: '',
      surah: '',
      ayah: ' ',
    });
    expect(result).toEqual({
      ok: false,
      problems: {
        date: { code: 'required' },
        scopeType: { code: 'required' },
        surah: { code: 'required' },
        ayah: { code: 'required' },
      },
    });
  });

  it('asks for the venue or circle of a place pick', () => {
    expect(buildPut(draft({ scopeType: 'venue' }))).toEqual({
      ok: false,
      problems: { venueId: { code: 'required' } },
    });
    expect(buildPut(draft({ scopeType: 'circle' }))).toEqual({
      ok: false,
      problems: { circleId: { code: 'required' } },
    });
  });

  it('refuses an ayah that does not exist in the surah', () => {
    expect(buildPut(draft({ surah: '1', ayah: '8' }))).toEqual({
      ok: false,
      problems: { ayah: { code: 'ayah_not_in_surah', surah: 1, count: 7 } },
    });
    expect(buildPut(draft({ surah: '114', ayah: '0' }))).toEqual({
      ok: false,
      problems: { ayah: { code: 'ayah_not_in_surah', surah: 114, count: 6 } },
    });
    expect(buildPut(draft({ surah: '2', ayah: '2.5' }))).toMatchObject({
      ok: false,
      problems: { ayah: { code: 'ayah_not_in_surah', count: 286 } },
    });
    // 286 is fine for the longest surah only.
    expect(buildPut(draft({ surah: '2', ayah: '286' })).ok).toBe(true);
    expect(buildPut(draft({ surah: '3', ayah: '286' })).ok).toBe(false);
  });

  it('reports a surah out of range once, not the ayah as well', () => {
    expect(buildPut(draft({ surah: '115', ayah: '1' }))).toEqual({
      ok: false,
      problems: { surah: { code: 'surah_range' } },
    });
  });

  it('refuses a date that does not exist', () => {
    expect(buildPut(draft({ date: '2027-02-30' }))).toEqual({
      ok: false,
      problems: { date: { code: 'invalid_date' } },
    });
  });

  it('turns a stored pick back into a draft that replaces it', () => {
    const back = buildPut(draftFromEntry(venuePick));
    expect(back).toEqual({
      ok: true,
      body: {
        date: venuePick.date,
        scope: { type: 'venue', venueId: venuePick.venueId },
        surah: 13,
        ayah: 28,
      },
    });
    if (back.ok) expect(existingPickFor(back.body, dailyAyahs)?.id).toBe(venuePick.id);
    const circle = buildPut(draftFromEntry(circlePick));
    if (circle.ok) expect(existingPickFor(circle.body, dailyAyahs)?.id).toBe(circlePick.id);
  });

  it('finds no pick to replace on another date or place', () => {
    const body = { date: '2027-03-01', scope: { type: 'national' as const }, surah: 1, ayah: 1 };
    expect(existingPickFor(body, dailyAyahs)).toBeUndefined();
    const other = {
      date: venuePick.date,
      scope: { type: 'venue' as const, venueId: venueB!.id },
      surah: 1,
      ayah: 1,
    };
    expect(existingPickFor(other, dailyAyahs)).toBeUndefined();
  });
});

describe('who may change a pick (daily_ayah.manage)', () => {
  it('national picks: national admins only', () => {
    expect(pickResource(nationalPick)).toEqual({});
    expect(canManagePick(nationalAdmin, nationalPick)).toBe(true);
    expect(canManagePick(cityCoordinator, nationalPick)).toBe(false);
    expect(canManagePick(venueCoordinator, nationalPick)).toBe(false);
    expect(canManagePick(nobody, nationalPick)).toBe(false);
    expect(canManagePick(null, nationalPick)).toBe(false);
  });

  it('a venue pick: national admin, the city coordinator and that venue coordinator', () => {
    expect(canManagePick(nationalAdmin, venuePick)).toBe(true);
    expect(canManagePick(cityCoordinator, venuePick)).toBe(true);
    expect(canManagePick(venueCoordinator, venuePick)).toBe(true);
    expect(canManagePick(nobody, venuePick)).toBe(false);
  });

  it('a pick in another city is out of a coordinator scope', () => {
    expect(canManagePick(nationalAdmin, lahorePick)).toBe(true);
    expect(canManagePick(cityCoordinator, lahorePick)).toBe(false);
    expect(canManagePick(venueCoordinator, lahorePick)).toBe(false);
  });

  it('a circle pick is checked at its venue', () => {
    expect(canManagePick(cityCoordinator, circlePick)).toBe(true);
    expect(canManagePick(venueCoordinator, circlePick)).toBe(true);
    const elsewhere = { ...circlePick, venueId: venueB!.id };
    expect(canManagePick(venueCoordinator, elsewhere)).toBe(false);
    expect(canManagePick(cityCoordinator, elsewhere)).toBe(true);
  });

  it('a place pick with no place is treated as national', () => {
    const broken = { ...venuePick, cityId: null, venueId: null };
    expect(pickResource(broken)).toEqual({});
    expect(canManagePick(cityCoordinator, broken)).toBe(false);
    expect(canManagePick(nationalAdmin, broken)).toBe(true);
  });

  it('offers each role only the scopes and places it may set', () => {
    expect(canSetNational(nationalAdmin)).toBe(true);
    expect(canSetNational(cityCoordinator)).toBe(false);
    expect(canSetNational(venueCoordinator)).toBe(false);

    expect(scopesFor(nationalAdmin, venues, circles)).toEqual(['national', 'venue', 'circle']);
    expect(scopesFor(cityCoordinator, venues, circles)).toEqual(['venue', 'circle']);
    expect(scopesFor(venueCoordinator, venues, circles)).toEqual(['venue', 'circle']);
    expect(scopesFor(nobody, venues, circles)).toEqual([]);
    // No circles loaded: no circle scope.
    expect(scopesFor(venueCoordinator, venues, [])).toEqual(['venue']);

    expect(venuesFor(nationalAdmin, venues)).toHaveLength(venues.length);
    expect(venuesFor(cityCoordinator, venues).map((v) => v.id)).toEqual(
      venues.filter((v) => v.cityId === venueA!.cityId).map((v) => v.id),
    );
    expect(venuesFor(venueCoordinator, venues).map((v) => v.id)).toEqual([venueA!.id]);
    expect(circlesFor(venueCoordinator, circles).every((c) => c.venueId === venueA!.id)).toBe(true);
    expect(circlesFor(cityCoordinator, circles).every((c) => c.cityId === venueA!.cityId)).toBe(
      true,
    );
  });
});

describe('the fallback for days without a pick (resolveDailyAyah)', () => {
  it('shows the national pick, then the built-in list', () => {
    const days = fallbackDays('2027-02-15', '2027-03-15', dailyAyahs, 4);
    expect(days.map((d) => [d.date, d.source, d.surah, d.ayah])).toEqual([
      ['2027-02-15', 'national', 2, 255],
      ['2027-02-16', 'national', 94, 5],
      [
        '2027-02-17',
        'built_in',
        builtInAyahFor('2027-02-17').surah,
        builtInAyahFor('2027-02-17').ayah,
      ],
      [
        '2027-02-18',
        'built_in',
        builtInAyahFor('2027-02-18').surah,
        builtInAyahFor('2027-02-18').ayah,
      ],
    ]);
  });

  it('never lets a venue or circle pick stand in for everyone', () => {
    const placeOnly = dailyAyahs.filter((p) => p.scopeType !== 'national');
    expect(fallbackDays('2027-02-15', '2027-02-16', placeOnly).map((d) => d.source)).toEqual([
      'built_in',
      'built_in',
    ]);
  });

  it('stops at the end of the loaded range', () => {
    expect(fallbackDays('2027-02-15', '2027-02-16', dailyAyahs)).toHaveLength(2);
    expect(fallbackDays('2027-02-15', '2027-02-14', dailyAyahs)).toHaveLength(0);
  });

  it('sorts picks by date, national first', () => {
    expect(sortPicks(dailyAyahs).map((p) => [p.date, p.scopeType])).toEqual([
      ['2027-02-15', 'national'],
      ['2027-02-15', 'venue'],
      ['2027-02-15', 'venue'],
      ['2027-02-16', 'national'],
      ['2027-02-16', 'circle'],
    ]);
  });
});
