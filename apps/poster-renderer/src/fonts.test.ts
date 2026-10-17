import { createHash } from 'node:crypto';
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { FONT_DIR, FONT_FILES, fontFaceCss, FontIntegrityError } from './fonts';

const scratch = mkdtempSync(join(tmpdir(), 'qc-fonts-'));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

describe('bundled fonts', () => {
  it('are the unmodified files, with the checksums recorded in LICENSES.md', () => {
    const licences = readFileSync(join(FONT_DIR, 'LICENSES.md'), 'utf8');
    for (const font of FONT_FILES) {
      const digest = createHash('sha256')
        .update(readFileSync(join(FONT_DIR, font.file)))
        .digest('hex');
      expect(digest, font.file).toBe(font.sha256);
      expect(licences).toContain(font.sha256);
      expect(licences).toContain(font.file);
    }
  });

  it('keep their licence texts beside them', () => {
    expect(readFileSync(join(FONT_DIR, 'Figtree-OFL.txt'), 'utf8')).toContain(
      'SIL OPEN FONT LICENSE',
    );
    const licences = readFileSync(join(FONT_DIR, 'LICENSES.md'), 'utf8');
    expect(licences).toContain('CC BY-SA 4.0');
    expect(licences).toContain('Mehr Type');
  });

  it('are the same Mehr Nastaliq file as the shared kit', () => {
    const kit = readFileSync(
      new URL('../../../packages/ui/assets/fonts/MehrNastaliqWeb-Regular.ttf', import.meta.url),
    );
    expect(Buffer.compare(kit, readFileSync(join(FONT_DIR, 'MehrNastaliqWeb-Regular.ttf')))).toBe(
      0,
    );
  });

  it('are embedded as data URLs only, never as files or remote URLs', () => {
    const css = fontFaceCss();
    const urls = [...css.matchAll(/url\(([^)]*)\)/g)].map((m) => m[1] ?? '');
    expect(urls).toHaveLength(FONT_FILES.length);
    for (const url of urls) expect(url.startsWith('data:font/ttf;base64,')).toBe(true);
  });

  it('refuses a changed font file', () => {
    const dir = `${scratch}/`;
    for (const font of FONT_FILES) copyFileSync(join(FONT_DIR, font.file), join(dir, font.file));
    expect(fontFaceCss(dir)).toContain('Mehr Nastaliq Web');
    const target = join(dir, 'MehrNastaliqWeb-Regular.ttf');
    const bytes = readFileSync(target);
    bytes[100] = (bytes[100] ?? 0) ^ 0xff;
    writeFileSync(target, bytes);
    expect(() => fontFaceCss(dir)).toThrow(FontIntegrityError);
  });
});
