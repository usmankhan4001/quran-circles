import { describe, expect, it } from 'vitest';
import { DAILY_AYAHS, ayahOfTheDay } from './ayah';

describe('ayahOfTheDay', () => {
  it('shows the same place all day and the next place the next day', () => {
    const morning = ayahOfTheDay(new Date('2027-02-15T01:00:00Z'));
    const night = ayahOfTheDay(new Date('2027-02-15T23:30:00Z'));
    const tomorrow = ayahOfTheDay(new Date('2027-02-16T01:00:00Z'));
    expect(night).toEqual(morning);
    expect(tomorrow).not.toEqual(morning);
  });

  it('cycles through the list and never leaves it', () => {
    const start = Date.parse('2027-01-01T00:00:00Z');
    const seen = new Set<string>();
    for (let day = 0; day < DAILY_AYAHS.length * 2; day += 1) {
      const place = ayahOfTheDay(new Date(start + day * 86_400_000));
      expect(DAILY_AYAHS).toContainEqual(place);
      seen.add(`${place.surah}:${place.ayah}`);
    }
    expect(seen.size).toBe(DAILY_AYAHS.length);
  });

  it('only lists real places: surah 1 to 114 and ayah 1 or more', () => {
    for (const place of DAILY_AYAHS) {
      expect(place.surah).toBeGreaterThanOrEqual(1);
      expect(place.surah).toBeLessThanOrEqual(114);
      expect(place.ayah).toBeGreaterThanOrEqual(1);
    }
  });
});
