import { describe, expect, it } from 'vitest';
import { MemoryStore } from './storage';
import {
  PREFERENCES_KEY,
  PreferencesStore,
  defaultPreferences,
  detectLocale,
  sanitizePreferences,
} from './preferences';

describe('detectLocale', () => {
  it('picks Urdu when the phone’s first language is Urdu, English otherwise', () => {
    expect(detectLocale(['ur-PK', 'en-US'])).toBe('ur');
    expect(detectLocale(['ur'])).toBe('ur');
    expect(detectLocale(['en-GB', 'ur'])).toBe('en');
    expect(detectLocale(['pa-PK'])).toBe('en');
    expect(detectLocale([])).toBe('en');
  });
});

describe('sanitizePreferences', () => {
  const fallback = defaultPreferences();

  it('keeps valid choices', () => {
    const next = sanitizePreferences(
      { locale: 'ur', textSize: 2, color: 'dark', cityId: 'c1', areaId: null },
      fallback,
    );
    expect(next).toEqual({
      locale: 'ur',
      textSize: 2,
      color: 'dark',
      cityId: 'c1',
      areaId: null,
      section: null,
      welcomed: false,
    });
  });

  it('replaces anything invalid with the fallback', () => {
    const next = sanitizePreferences(
      { locale: 'fr', textSize: 9, color: 'purple', cityId: 42, areaId: 'x'.repeat(200) } as never,
      fallback,
    );
    expect(next).toEqual(fallback);
  });
});

describe('PreferencesStore', () => {
  it('starts from the phone’s language', () => {
    const store = new PreferencesStore(new MemoryStore(), defaultPreferences(['ur-PK']));
    expect(store.get().locale).toBe('ur');
  });

  it('saves a change and loads it again after a restart', async () => {
    const storage = new MemoryStore();
    const first = new PreferencesStore(storage);
    await first.update({ locale: 'ur', textSize: 3 });
    const second = new PreferencesStore(storage);
    expect((await second.load()).locale).toBe('ur');
    expect(second.get().textSize).toBe(3);
  });

  it('tells listeners when something changes', async () => {
    const store = new PreferencesStore(new MemoryStore());
    let calls = 0;
    store.subscribe(() => (calls += 1));
    await store.update({ color: 'dark' });
    expect(calls).toBeGreaterThan(0);
  });

  it('starts with the defaults when the saved file is damaged', async () => {
    const storage = new MemoryStore();
    await storage.set(PREFERENCES_KEY, '{nope');
    const store = new PreferencesStore(storage);
    expect((await store.load()).locale).toBe('en');
  });

  it('refuses an invalid change instead of saving it', async () => {
    const store = new PreferencesStore(new MemoryStore());
    await store.update({ textSize: 7 as never });
    expect(store.get().textSize).toBe(0);
  });
});
