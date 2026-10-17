import { describe, expect, it } from 'vitest';
import type { MemorisationEntry } from '@qc/contracts';
import {
  SURAH_NUMBERS,
  countByStatus,
  removeEntry,
  reviseThisWeek,
  surahNames,
  upsertEntry,
} from './logic';

const NOW = new Date('2027-02-15T08:00:00Z');
const entry = (
  surah: number,
  status: MemorisationEntry['status'],
  lastRevisedAt: string | null,
): MemorisationEntry => ({ surah, status, lastRevisedAt, updatedAt: '2027-01-01T00:00:00Z' });

describe('reviseThisWeek', () => {
  it('lists memorised surahs not revised within the setting, longest since revised first', () => {
    const items = [
      entry(1, 'memorised', '2027-02-10T16:00:00Z'), // 5 days: not yet
      entry(112, 'memorised', '2027-01-02T16:00:00Z'),
      entry(113, 'memorised', '2027-01-20T16:00:00Z'),
      entry(114, 'memorised', null), // never revised: first
      entry(67, 'revising', '2026-12-01T00:00:00Z'), // not memorised: never listed
      entry(36, 'learning', null),
    ];
    expect(reviseThisWeek(items, NOW).map((e) => e.surah)).toEqual([114, 112, 113]);
  });

  it("follows the person's own setting", () => {
    const items = [entry(1, 'memorised', '2027-02-10T16:00:00Z')];
    expect(reviseThisWeek(items, NOW, 7)).toHaveLength(0);
    expect(reviseThisWeek(items, NOW, 3)).toHaveLength(1);
  });

  it('is empty when nothing is memorised', () => {
    expect(reviseThisWeek([], NOW)).toEqual([]);
  });
});

describe('the list', () => {
  it('counts each mark', () => {
    expect(
      countByStatus([
        entry(1, 'memorised', null),
        entry(2, 'memorised', null),
        entry(3, 'learning', null),
      ]),
    ).toEqual({ learning: 1, memorised: 2, revising: 0 });
  });

  it('puts a marked surah in surah order and replaces an older mark', () => {
    const items = upsertEntry(
      [entry(1, 'memorised', null), entry(67, 'learning', null)],
      entry(36, 'learning', null),
    );
    expect(items.map((e) => e.surah)).toEqual([1, 36, 67]);
    expect(
      upsertEntry(items, entry(67, 'memorised', null)).find((e) => e.surah === 67)?.status,
    ).toBe('memorised');
  });

  it('clears a mark', () => {
    expect(removeEntry([entry(1, 'memorised', null)], 1)).toEqual([]);
    expect(removeEntry([entry(1, 'memorised', null)], 2)).toHaveLength(1);
  });

  it('names every surah from the content list', () => {
    expect(SURAH_NUMBERS).toHaveLength(114);
    expect(surahNames(1).simple).toBe('Al-Fatihah');
    expect(surahNames(1).arabic).toBeTruthy();
    expect(surahNames(999).simple).toBe('999');
  });
});
