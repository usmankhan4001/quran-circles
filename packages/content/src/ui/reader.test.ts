import { describe, expect, it } from 'vitest';
import { fakeVerse, FAKE_OPENING } from '../test/fakes';
import { buildRows, resolveJump, rowIndexFor, targetForBookmark } from './reader';
import type { QuranPassage } from '../quran/types';

const passage = (
  kind: 'surah' | 'juz',
  id: number,
  verses: ReturnType<typeof fakeVerse>[],
): QuranPassage => ({
  kind,
  id,
  verses,
  fromCache: false,
  stale: false,
  fetchedAt: '2026-10-16T12:00:00.000Z',
});

describe('buildRows', () => {
  it('turns the opening formula of a surah into its own row', () => {
    const rows = buildRows(passage('surah', 112, [fakeVerse(112, 1), fakeVerse(112, 2)]));
    expect(rows.map((r) => r.type)).toEqual(['heading', 'verse', 'verse']);
    expect(rows[0]).toMatchObject({ bismillah: FAKE_OPENING, surah: null });
    expect(rows[1]).toMatchObject({ type: 'verse', text: 'FAKE-AR 112:1' });
  });

  it('adds no row for Al-Fatihah or At-Tawbah', () => {
    expect(buildRows(passage('surah', 1, [fakeVerse(1, 1)])).map((r) => r.type)).toEqual(['verse']);
    expect(buildRows(passage('surah', 9, [fakeVerse(9, 1)])).map((r) => r.type)).toEqual(['verse']);
  });

  it('heads every surah in a juz, even when the juz starts in the middle of one', () => {
    const rows = buildRows(
      passage('juz', 30, [fakeVerse(2, 142), fakeVerse(2, 143), fakeVerse(3, 1), fakeVerse(3, 2)]),
    );
    expect(rows.map((r) => (r.type === 'heading' ? `h${r.surah}` : r.key))).toEqual([
      'h2',
      '2:142',
      '2:143',
      'h3',
      '3:1',
      '3:2',
    ]);
    expect(rows[0]).toMatchObject({ bismillah: null });
    expect(rows[3]).toMatchObject({ bismillah: FAKE_OPENING });
  });
});

describe('rowIndexFor', () => {
  const rows = buildRows(
    passage(
      'surah',
      112,
      [1, 2, 3, 4].map((a) => fakeVerse(112, a)),
    ),
  );
  it('finds the row of an ayah', () => {
    expect(rowIndexFor(rows, { kind: 'surah', id: 112, ayah: 3 })).toBe(3);
  });
  it('lands on the formula above ayah 1, so it is not hidden', () => {
    expect(rowIndexFor(rows, { kind: 'surah', id: 112, ayah: 1 })).toBe(0);
  });
  it('starts at the top with no ayah, and when the ayah is not there', () => {
    expect(rowIndexFor(rows, { kind: 'surah', id: 112 })).toBe(0);
    expect(rowIndexFor(rows, { kind: 'surah', id: 112, ayah: 99 })).toBe(0);
  });
  it('uses the surah to find an ayah in a juz', () => {
    const juz = buildRows(
      passage('juz', 1, [fakeVerse(1, 1), fakeVerse(1, 2), fakeVerse(2, 1), fakeVerse(2, 2)]),
    );
    expect(rowIndexFor(juz, { kind: 'juz', id: 1, surah: 2, ayah: 2 })).toBe(
      juz.findIndex((r) => r.key === '2:2'),
    );
  });
});

describe('resolveJump', () => {
  const surah = passage('surah', 18, []);
  it('accepts an ayah that exists in the surah', () => {
    expect(resolveJump(' 100 ', surah)).toEqual({ ok: true, surah: 18, ayah: 100 });
    expect(resolveJump('110', surah)).toEqual({ ok: true, surah: 18, ayah: 110 });
  });
  it.each(['0', '111', '-3', 'abc', '', '1.5', '18:3'])('rejects %j in a surah', (text) => {
    expect(resolveJump(text, surah)).toEqual({ ok: false, reason: 'invalid' });
  });

  const juz = passage('juz', 30, [fakeVerse(78, 1), fakeVerse(78, 2), fakeVerse(79, 1)]);
  it('accepts a bare number or surah:ayah inside a juz', () => {
    expect(resolveJump('2', juz)).toEqual({ ok: true, surah: 78, ayah: 2 });
    expect(resolveJump('79:1', juz)).toEqual({ ok: true, surah: 79, ayah: 1 });
  });
  it('rejects an ayah outside the juz', () => {
    expect(resolveJump('2:255', juz)).toEqual({ ok: false, reason: 'invalid' });
    expect(resolveJump('50', juz)).toEqual({ ok: false, reason: 'invalid' });
  });
});

describe('targetForBookmark', () => {
  it('maps each bookmark kind to a place in the reader', () => {
    expect(targetForBookmark({ kind: 'ayah', surah: 2, ayah: 255, para: null })).toEqual({
      kind: 'surah',
      id: 2,
      ayah: 255,
    });
    expect(targetForBookmark({ kind: 'surah', surah: 18, ayah: null, para: null })).toEqual({
      kind: 'surah',
      id: 18,
    });
    expect(targetForBookmark({ kind: 'para', surah: null, ayah: null, para: 30 })).toEqual({
      kind: 'juz',
      id: 30,
    });
  });
  it('gives nothing for a bookmark with missing fields', () => {
    expect(targetForBookmark({ kind: 'ayah', surah: 2, ayah: null, para: null })).toBeNull();
  });
});
