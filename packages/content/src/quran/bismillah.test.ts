import { describe, expect, it } from 'vitest';
import { FAKE_OPENING, fakeArabic, fakeVerse } from '../test/fakes';
import { passageBismillah, splitBismillah } from './bismillah';

describe('splitBismillah', () => {
  it('cuts the first four words off ayah 1 of an ordinary surah', () => {
    const split = splitBismillah({ surah: 2, ayah: 1, arabic: fakeArabic(2, 1) });
    expect(split.bismillah).toBe(FAKE_OPENING);
    expect(split.text).toBe('FAKE-AR 2:1');
  });

  it('leaves Al-Fatihah alone, where the formula is ayah 1 itself', () => {
    const split = splitBismillah({ surah: 1, ayah: 1, arabic: fakeArabic(1, 1) });
    expect(split).toEqual({ text: 'FAKE-AR 1:1', bismillah: null });
  });

  it('leaves At-Tawbah alone, which has no formula', () => {
    expect(splitBismillah({ surah: 9, ayah: 1, arabic: fakeArabic(9, 1) }).bismillah).toBeNull();
  });

  it('leaves later ayahs alone', () => {
    expect(
      splitBismillah({ surah: 2, ayah: 2, arabic: 'one two three four five six' }).bismillah,
    ).toBeNull();
  });

  it('does not strip an ayah that is only four words or fewer', () => {
    const split = splitBismillah({ surah: 112, ayah: 1, arabic: 'a b c d' });
    expect(split).toEqual({ text: 'a b c d', bismillah: null });
  });

  it('finds the formula of a passage from its first surah that has one', () => {
    expect(passageBismillah([fakeVerse(9, 1), fakeVerse(10, 1)])).toBe(FAKE_OPENING);
    expect(passageBismillah([fakeVerse(1, 1), fakeVerse(1, 2)])).toBeNull();
  });
});
