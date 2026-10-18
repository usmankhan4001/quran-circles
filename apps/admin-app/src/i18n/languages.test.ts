import { describe, expect, it } from 'vitest';
import { parts } from '@qc/i18n';
import * as client from '@qc/i18n/client';
import type { Locale } from '@qc/contracts';
import { bundledLanguages, createLanguageLoader, prefetchLanguage } from './languageLoader';
import { languages as phoneLanguages } from './languages';
import { languages as webLanguages } from './languages.web';
import { hasMessage } from './translate';

describe('the languages', () => {
  it('are all in the bundle on a phone', async () => {
    expect(phoneLanguages).toBe(bundledLanguages);
    expect(phoneLanguages.isLoaded('ur')).toBe(true);
    await expect(phoneLanguages.load('ur')).resolves.toBeUndefined();
  });

  it("download one at a time on the web, with this app's words only", async () => {
    const ur = client.messages.ur as Record<string, string>;
    const en = client.messages.en as Record<string, string>;
    expect(webLanguages.isLoaded('ur')).toBe(false);

    await webLanguages.load('ur');
    expect(webLanguages.isLoaded('ur')).toBe(true);
    expect(webLanguages.isLoaded('en')).toBe(false);
    expect(ur['admin.schedule.title']).toBe(parts['admin-app'].ur['admin.schedule.title']);
    expect(ur['errors.forbidden']).toBe(parts.shared.ur['errors.forbidden']);
    expect(ur['time.period.night']).toBe(parts.shared.ur['time.period.night']);
    expect(Object.keys(ur).some((k) => k.startsWith('home.') || k.startsWith('console.'))).toBe(
      false,
    );
    expect(en['admin.schedule.title']).toBeUndefined();

    await webLanguages.load('en');
    expect(en['admin.schedule.title']).toBe(parts['admin-app'].en['admin.schedule.title']);
  });
});

describe('the language loader', () => {
  it('treats a loader that throws before it starts as a failed download, then tries again', async () => {
    const installed = new Set<Locale>(['en']);
    let attempts = 0;
    const loader = createLanguageLoader({
      tables: {
        en: () => Promise.resolve({ default: {} }),
        ur: () => {
          attempts += 1;
          if (attempts === 1) throw new Error('Requiring unknown module');
          return Promise.resolve({ default: { 'ui.close': 'ur' } });
        },
      },
      install: (locale) => installed.add(locale),
      has: (locale) => installed.has(locale),
    });
    expect(() => prefetchLanguage(loader, 'ur')).not.toThrow();
    await expect(loader.load('ur')).rejects.toThrow('Requiring unknown module');
    expect(loader.isLoaded('ur')).toBe(false);
    await expect(loader.load('ur')).resolves.toBeUndefined();
    expect(attempts).toBe(2);
    expect(loader.isLoaded('ur')).toBe(true);
  });
});

describe('hasMessage', () => {
  it('knows the keys of this app and no others', () => {
    expect(hasMessage('admin.schedule.title')).toBe(true);
    expect(hasMessage('admin.no.such.key')).toBe(false);
  });
});
