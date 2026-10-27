import { describe, expect, it } from 'vitest';
import { forQuranFont } from './quranFontMarks';

describe('forQuranFont', () => {
  it('shows the silent alef sign as the small zero the font draws', () => {
    expect(forQuranFont('ٱتَّبِعُوا۟')).toBe('ٱتَّبِعُوا۠');
  });

  it('drops the small low meem and the empty-centre stops, which the font draws as a dot', () => {
    expect(forQuranFont('حَرَجٌۭ')).toBe('حَرَجٌ');
    expect(forQuranFont('a۪b۫c')).toBe('abc');
  });

  it('leaves letters, vowels and other signs alone', () => {
    const text = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ ۖ ۚ ۢ';
    expect(forQuranFont(text)).toBe(text);
  });
});
