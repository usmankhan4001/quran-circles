import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fonts, typeRoles } from './lib/ui-tokens';

const here = import.meta.dirname;
const read = (file: string) => readFileSync(resolve(here, file), 'utf8');

interface FontFace {
  family: string;
  url: string;
  format: string;
}

function fontFaces(css: string): FontFace[] {
  return [...css.matchAll(/@font-face\s*{([^}]*)}/g)].map(([, body = '']) => ({
    family: /font-family:\s*'([^']+)'/.exec(body)?.[1] ?? '',
    url: /url\('([^']+)'\)/.exec(body)?.[1] ?? '',
    format: /format\('([^']+)'\)/.exec(body)?.[1] ?? '',
  }));
}

describe('console fonts', () => {
  const main = read('main.tsx');
  const faces = fontFaces(read('fonts.css'));

  it('loads Plus Jakarta Sans from Fontsource in every weight the type roles use', () => {
    const weights = new Set<string>(Object.values(typeRoles).map((r) => r.weight));
    weights.add('700'); // bold text
    for (const weight of weights)
      expect(main).toContain(`import '@fontsource/plus-jakarta-sans/${weight}.css';`);
    expect(main).toMatch(/import '\.\/fonts\.css';\s*import '\.\/styles\.css';/);
  });

  it('declares the bundled Urdu and Quran fonts under the token names', () => {
    expect(faces.map((f) => f.family)).toEqual([fonts.urdu, fonts.quran]);
  });

  it('serves the kit files themselves, which exist on disk', () => {
    for (const face of faces) {
      expect(face.url).toMatch(/^\.\.\/\.\.\/\.\.\/packages\/ui\/assets\/fonts\//);
      expect(existsSync(resolve(here, face.url)), face.url).toBe(true);
    }
  });

  it('serves the KFGQPC Quran font as the original OTF, never converted', () => {
    const quran = faces.find((f) => f.family === fonts.quran);
    expect(quran?.url).toMatch(/KFGQPCUthmanicScriptHAFS-Regular\.otf$/);
    expect(quran?.format).toBe('opentype');
    expect(read('fonts.css')).not.toMatch(/KFGQPC[^']*\.woff2?/);
  });
});
