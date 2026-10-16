import { describe, expect, it } from 'vitest';
import { messages } from './index';

const keys = (o: Record<string, string>) => Object.keys(o).filter((k) => !k.startsWith('_'));

describe('translations', () => {
  it('has the same keys in English and Urdu', () => {
    expect(keys(messages.ur).sort()).toEqual(keys(messages.en).sort());
  });

  it('has no empty values', () => {
    for (const locale of ['en', 'ur'] as const) {
      for (const k of keys(messages[locale])) {
        expect((messages[locale] as Record<string, string>)[k]?.trim()).toBeTruthy();
      }
    }
  });
});
