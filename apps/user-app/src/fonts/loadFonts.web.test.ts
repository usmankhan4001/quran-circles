import { describe, expect, it, vi } from 'vitest';
import { WEB_FONT_STYLE_ID } from '@qc/ui/web-fonts';
import { firstScreenWeights, loadFirstFonts, startFonts } from './loadFonts.web';

function pageWithFonts(load: (font: string) => Promise<unknown[]>): Document {
  const doc = document.implementation.createHTMLDocument('fonts');
  Object.defineProperty(doc, 'fonts', { value: { load }, configurable: true });
  return doc;
}

describe('web fonts at start-up', () => {
  it.each(['en', 'ur'] as const)(
    'declares the faces once and starts the first screen weights in %s, once each',
    (locale) => {
      const doc = pageWithFonts(() => Promise.resolve([{}]));
      startFonts(locale, doc);
      startFonts(locale, doc);
      expect(doc.querySelectorAll(`#${WEB_FONT_STYLE_ID}`)).toHaveLength(1);
      const preloads = [...doc.querySelectorAll('link[rel="preload"][as="font"]')].map(
        (l) => l.getAttribute('href') ?? '',
      );
      expect(preloads).toHaveLength(firstScreenWeights[locale].length);
      firstScreenWeights[locale].forEach((weight, i) =>
        expect(preloads[i]).toMatch(new RegExp(`Figtree-${weight}\\b`)),
      );
    },
  );

  it('waits for Figtree 400 in English and Mehr in Urdu', async () => {
    const load = vi.fn(() => Promise.resolve([{}]));
    await expect(loadFirstFonts('en', pageWithFonts(load))).resolves.toBe('loaded');
    await expect(loadFirstFonts('ur', pageWithFonts(load))).resolves.toBe('loaded');
    expect(load.mock.calls).toEqual([['400 1em "Figtree"'], ['400 1em "Mehr Nastaliq Web"']]);
  });

  it('carries on with the fallback font when the face fails or is slow', async () => {
    const failing = pageWithFonts(() => Promise.reject(new Error('offline')));
    expect(() => startFonts('en', failing)).not.toThrow();
    await expect(loadFirstFonts('en', failing)).resolves.toBe('failed');
    vi.useFakeTimers();
    try {
      const slow = loadFirstFonts(
        'ur',
        pageWithFonts(() => new Promise(() => undefined)),
        200,
      );
      vi.advanceTimersByTime(200);
      await expect(slow).resolves.toBe('timedOut');
    } finally {
      vi.useRealTimers();
    }
  });
});
