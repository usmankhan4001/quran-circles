import { describe, expect, it, vi } from 'vitest';
import { WEB_FONT_STYLE_ID } from '@qc/ui/web-fonts';
import { appFontFamilies } from './appFonts';
import { firstScreenWeights, loadFonts, pageLocale, startFonts } from './loadFonts.web';

function page(lang: string, load?: (font: string) => Promise<unknown[]>): Document {
  const doc = document.implementation.createHTMLDocument('fonts');
  doc.documentElement.lang = lang;
  if (load) Object.defineProperty(doc, 'fonts', { value: { load }, configurable: true });
  return doc;
}

const preloads = (doc: Document) =>
  [...doc.querySelectorAll('link[rel="preload"][as="font"]')].map((l) => l.getAttribute('href'));

describe('admin web fonts', () => {
  it('reads the language boot.js put on the page, English otherwise', () => {
    expect(pageLocale(page('ur'))).toBe('ur');
    expect(pageLocale(page('en'))).toBe('en');
    expect(pageLocale(page(''))).toBe('en');
  });

  it.each(['en', 'ur'] as const)('starts the first screen weights for %s, once', (locale) => {
    const doc = page(locale);
    startFonts(doc);
    startFonts(doc);
    expect(doc.querySelectorAll(`#${WEB_FONT_STYLE_ID}`)).toHaveLength(1);
    const links = preloads(doc);
    expect(links).toHaveLength(firstScreenWeights[locale].length);
    firstScreenWeights[locale].forEach((weight, i) =>
      expect(links[i]).toMatch(new RegExp(`Figtree-${weight}\\b`)),
    );
  });

  it('waits for the face of the page language only, not every bundled file', async () => {
    const load = vi.fn(() => Promise.resolve([{}]));
    await loadFonts(appFontFamilies, page('en', load));
    await loadFonts(appFontFamilies, page('ur', load));
    expect(load.mock.calls).toEqual([['400 1em "Figtree"'], ['400 1em "Mehr Nastaliq Web"']]);
  });

  it('reports a face that fails, so FontGate draws with the fallback font', async () => {
    await expect(
      loadFonts(
        appFontFamilies,
        page('en', () => Promise.reject(new Error('404'))),
      ),
    ).rejects.toThrow();
  });
});
