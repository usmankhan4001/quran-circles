import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fonts, sansWeights } from './index';
import {
  WEB_FONT_STYLE_ID,
  firstPaintFace,
  fontFaceCss,
  installWebFonts,
  waitForWebFont,
  warmWebFonts,
  webFacesOf,
  webFontFaces,
} from './web-fonts';

const webDir = resolve(import.meta.dirname, '../assets/fonts/web');
const sha256 = (file: string) =>
  createHash('sha256')
    .update(readFileSync(resolve(webDir, file)))
    .digest('hex');

/** Written by scripts/web-fonts.py and recorded in assets/fonts/LICENSES.md. */
const recorded: Record<string, string> = {
  'PlusJakartaSans-400.woff2': '2840bc540a9d19fd03d707003c00922d4f25fd7cd733e59ed66983c38c40ebb6',
  'PlusJakartaSans-500.woff2': '32137504084aeb3f2824d152d5d13d452725af51928c02c2ef9897f309d6d2d0',
  'PlusJakartaSans-600.woff2': '1f5332f0cfb1eb025feca2d03e0d61fc31f6dc4fddbd5025a9cb0e5312d0af6d',
  'PlusJakartaSans-700.woff2': '44c2af85d93393c5a2d20f653ca503dfcf770b874901506ec91fdd9895b7f39d',
  'PlusJakartaSans-800.woff2': 'e518a764e20deb7a27a086413fbea6f7c121197cf3e55d88560ca8165376fb6b',
  'MehrNastaliqWeb-Regular.woff2':
    '94bc07b5c7408accf76def79d6d4736bbd4b8d0c5034c6239e25c8b7f15aef62',
};

function fakeDocument(load?: (font: string) => Promise<unknown[]>): Document {
  const doc = document.implementation.createHTMLDocument('fonts');
  if (load) Object.defineProperty(doc, 'fonts', { value: { load }, configurable: true });
  return doc;
}

describe('web font faces', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('declares every Plus Jakarta Sans weight the type roles use, Mehr and KFGQPC, under the token names', () => {
    const sans = webFontFaces.filter((f) => f.family === fonts.sans);
    expect(sans.map((f) => String(f.weight))).toEqual([...sansWeights]);
    expect(webFontFaces.filter((f) => f.family === fonts.urdu)).toHaveLength(1);
    expect(webFontFaces.filter((f) => f.family === fonts.quran)).toHaveLength(1);
  });

  it('serves Plus Jakarta Sans and Mehr as WOFF2 and the KFGQPC font as its original OTF', () => {
    for (const f of webFontFaces) {
      if (f.family === fonts.quran) {
        expect(f.format).toBe('opentype');
        expect(f.src).toContain('KFGQPCUthmanicScriptHAFS-Regular.otf');
      } else {
        expect(f.format).toBe('woff2');
        expect(f.src).toMatch(/\/web\/[\w-]+\.woff2/);
      }
    }
  });

  it('never ships a converted copy of the KFGQPC font', () => {
    expect(readdirSync(webDir).filter((name) => /kfgqpc|uthman|hafs/i.test(name))).toEqual([]);
  });

  it('keeps the WOFF2 files as recorded', () => {
    expect(readdirSync(webDir).sort()).toEqual(Object.keys(recorded).sort());
    for (const [file, hash] of Object.entries(recorded)) expect(sha256(file)).toBe(hash);
    const notes = readFileSync(resolve(webDir, '../LICENSES.md'), 'utf8');
    for (const hash of Object.values(recorded)) expect(notes).toContain(hash);
  });

  it('holds the first frame for the face of the language only', () => {
    expect(firstPaintFace('en')).toMatchObject({ family: fonts.sans, weight: 400 });
    expect(firstPaintFace('ur')).toMatchObject({ family: fonts.urdu, weight: 400 });
  });

  it('writes one swap rule per face, with the family quoted', () => {
    const css = fontFaceCss();
    expect(css.match(/@font-face/g)).toHaveLength(webFontFaces.length);
    expect(css.match(/font-display:swap/g)).toHaveLength(webFontFaces.length);
    expect(css).toContain('font-family:"Mehr Nastaliq Web"');
    expect(css).toContain('format("opentype")');
    expect(fontFaceCss([{ family: 'A"B', weight: 400, src: 'x', format: 'woff2' }])).toContain(
      'font-family:"A\\"B"',
    );
  });

  it('declares the faces on the page once', () => {
    const doc = fakeDocument();
    installWebFonts(doc);
    installWebFonts(doc);
    const styles = doc.head.querySelectorAll(`style#${WEB_FONT_STYLE_ID}`);
    expect(styles).toHaveLength(1);
    expect(styles[0]?.textContent).toBe(fontFaceCss());
  });

  it('waits for the one face through the page font set', async () => {
    const load = vi.fn(() => Promise.resolve([{}]));
    await expect(waitForWebFont(fakeDocument(load), firstPaintFace('ur'))).resolves.toBe('loaded');
    expect(load).toHaveBeenCalledWith('400 1em "Mehr Nastaliq Web"');
  });

  it('carries on when the face fails, is missing or never arrives', async () => {
    await expect(
      waitForWebFont(
        fakeDocument(() => Promise.reject(new Error('404'))),
        firstPaintFace('en'),
      ),
    ).resolves.toBe('failed');
    await expect(
      waitForWebFont(
        fakeDocument(() => Promise.resolve([])),
        firstPaintFace('en'),
      ),
    ).resolves.toBe('failed');
    vi.useFakeTimers();
    const pending = waitForWebFont(
      fakeDocument(() => new Promise(() => undefined)),
      firstPaintFace('en'),
      500,
    );
    vi.advanceTimersByTime(500);
    await expect(pending).resolves.toBe('timedOut');
  });

  it('picks faces of a family by weight, skipping weights it does not have', () => {
    expect(webFacesOf(fonts.sans, [700, 500, 300]).map((f) => f.weight)).toEqual([700, 500]);
    expect(webFacesOf('Nope', [400])).toEqual([]);
  });

  it('starts faces downloading at once with one preload link each, never twice', () => {
    const doc = fakeDocument();
    const faces = webFacesOf(fonts.sans, [500, 700]);
    warmWebFonts(doc, faces);
    warmWebFonts(doc, faces);
    const links = [...doc.head.querySelectorAll<HTMLLinkElement>('link[rel="preload"]')];
    expect(links.map((l) => l.getAttribute('href'))).toEqual(faces.map((f) => f.src));
    for (const link of links) {
      expect(link.getAttribute('as')).toBe('font');
      expect(link.getAttribute('type')).toBe('font/woff2');
      expect(link.getAttribute('crossorigin')).toBe('anonymous');
    }
    warmWebFonts(doc, webFacesOf(fonts.quran, [400]));
    expect(doc.head.querySelectorAll('link[rel="preload"]')).toHaveLength(3);
    expect(doc.head.querySelector('link[type="font/otf"]')).not.toBeNull();
  });

  it('does not wait where the page has no font set', async () => {
    await expect(waitForWebFont(fakeDocument(), firstPaintFace('en'))).resolves.toBe('loaded');
  });
});
