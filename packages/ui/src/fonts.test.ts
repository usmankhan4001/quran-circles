import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  bundledFonts,
  fontLoadTimeoutMs,
  loadFontsWithFallback,
  type BundledFontFamily,
} from './font-sources';
import {
  fontFallbacks,
  fontStack,
  fontTokenFor,
  fonts,
  sansWeights,
  typeRoles,
  urduFallbackFont,
} from './index';

const fontsDir = resolve(import.meta.dirname, '../assets/fonts');
const inFonts = (file: string) => resolve(fontsDir, file);
const sha256 = (file: string) =>
  createHash('sha256')
    .update(readFileSync(inFonts(file)))
    .digest('hex');

/** Recorded in assets/fonts/LICENSES.md when the files were copied from their npm tarballs. */
const recorded = {
  kfgqpc: {
    file: 'KFGQPCUthmanicScriptHAFS-Regular.otf',
    bytes: 246428,
    sha256: '59e20b2403687a67854fd199861abed3528068c035d2689898465d5faf39bb31',
  },
  jameel: {
    file: 'JameelNooriNastaleeq-Regular.ttf',
    bytes: 13857080,
    sha256: '30caf30da47c3132af67caa823df8aa446dd4c0195e74cbc1be4ae9c493f52b0',
  },
  mehr: {
    file: 'MehrNastaliqWeb-Regular.ttf',
    bytes: 132816,
    sha256: '1339f7fbf3531908048a0b2965d3c79deb7d41a98614c77ac1d2f691cd6aa373',
  },
};

describe('font tokens (D4)', () => {
  it('names the bundled families', () => {
    expect(fonts).toEqual({
      sans: 'Plus Jakarta Sans',
      urdu: 'Jameel Noori Nastaleeq',
      quran: 'KFGQPC Uthmanic Script HAFS',
    });
  });

  it('sets Urdu in Jameel Noori Nastaleeq, with Mehr Nastaliq Web showing while it downloads', () => {
    expect(fontFallbacks.urdu.slice(0, 2)).toEqual([fonts.urdu, urduFallbackFont]);
    expect(urduFallbackFont).toBe('Mehr Nastaliq Web');
  });

  it('starts each fallback chain with the bundled family and ends with a generic family', () => {
    for (const token of ['sans', 'urdu', 'quran'] as const) {
      const chain = fontFallbacks[token];
      expect(chain[0]).toBe(fonts[token]);
      expect(['serif', 'sans-serif']).toContain(chain[chain.length - 1]);
    }
    expect(fontFallbacks.urdu).toContain('Noto Nastaliq Urdu');
  });

  it('writes a CSS stack with family names quoted and generic names bare', () => {
    expect(fontStack('sans')).toBe('"Plus Jakarta Sans", system-ui, sans-serif');
    expect(fontStack('urdu')).toBe(
      '"Jameel Noori Nastaleeq", "Mehr Nastaliq Web", "Noto Nastaliq Urdu", serif',
    );
    expect(fontStack('quran')).toBe('"KFGQPC Uthmanic Script HAFS", serif');
  });

  it('maps each script to its token', () => {
    expect(fontTokenFor('latin')).toBe('sans');
    expect(fontTokenFor('urdu')).toBe('urdu');
    expect(fontTokenFor('quran')).toBe('quran');
  });

  it('ships every Plus Jakarta Sans weight the type roles use, and no others', () => {
    const used = new Set<string>(Object.values(typeRoles).map((r) => r.weight));
    used.add('700'); // Text strong
    expect([...used].sort()).toEqual([...sansWeights].sort());
  });
});

describe('bundled font map', () => {
  const family = (name: string): BundledFontFamily => {
    const found = bundledFonts.find((f) => f.fontFamily === name);
    if (!found) throw new Error(`missing ${name}`);
    return found;
  };

  it('includes the families under the token names, and Mehr as the Urdu fallback', () => {
    expect(bundledFonts.map((f) => f.fontFamily).sort()).toEqual(
      [fonts.sans, fonts.urdu, urduFallbackFont, fonts.quran].sort(),
    );
  });

  it('loads each Plus Jakarta Sans weight once, from its own file', () => {
    const sans = family(fonts.sans);
    expect(sans.fontDefinitions.map((d) => String(d.weight))).toEqual([...sansWeights]);
    expect(new Set(sans.fontDefinitions.map((d) => d.path)).size).toBe(sansWeights.length);
    for (const face of sans.fontDefinitions)
      expect(String(face.path)).toMatch(/PlusJakartaSans_\d+\w+\.ttf/);
  });

  it('loads the Urdu and Quran families from the files in assets/fonts', () => {
    const urdu = family(fonts.urdu).fontDefinitions;
    const quran = family(fonts.quran).fontDefinitions;
    expect(urdu).toHaveLength(1);
    expect(quran).toHaveLength(1);
    expect(String(urdu[0]?.path)).toContain(recorded.jameel.file);
    expect(String(family(urduFallbackFont).fontDefinitions[0]?.path)).toContain(recorded.mehr.file);
    expect(String(quran[0]?.path)).toContain(recorded.kfgqpc.file);
  });
});

describe('bundled font files', () => {
  it('keeps the KFGQPC Quran font byte-for-byte unmodified (its licence forbids changes)', () => {
    expect(statSync(inFonts(recorded.kfgqpc.file)).size).toBe(recorded.kfgqpc.bytes);
    expect(sha256(recorded.kfgqpc.file)).toBe(recorded.kfgqpc.sha256);
  });

  it('keeps the full Jameel Noori Nastaleeq TTF as supplied', () => {
    expect(statSync(inFonts(recorded.jameel.file)).size).toBe(recorded.jameel.bytes);
    expect(sha256(recorded.jameel.file)).toBe(recorded.jameel.sha256);
  });

  it('keeps Mehr Nastaliq Web unmodified', () => {
    expect(statSync(inFonts(recorded.mehr.file)).size).toBe(recorded.mehr.bytes);
    expect(sha256(recorded.mehr.file)).toBe(recorded.mehr.sha256);
  });

  it('records the checksums and the right licences next to the files', () => {
    const notes = readFileSync(inFonts('LICENSES.md'), 'utf8');
    expect(notes).toContain(recorded.kfgqpc.sha256);
    expect(notes).toContain(recorded.mehr.sha256);
    expect(notes).toContain(recorded.jameel.sha256);
    expect(notes).toContain('SIL Open Font License');
    expect(notes).toContain('https://creativecommons.org/licenses/by-sa/4.0/');
    expect(notes).toMatch(/Not ISC/);
    const eula = readFileSync(inFonts('KFGQPC-EULA.txt'), 'utf8');
    expect(eula).toContain('the rights to Use, Copy, Distribute');
    expect(eula).toContain('cannot be Sold, Modified, Altered');
    const ofl = readFileSync(inFonts('PlusJakartaSans-OFL.txt'), 'utf8');
    expect(ofl).toContain('Copyright 2020 The Plus Jakarta Sans Project Authors');
  });
});

describe('loadFontsWithFallback', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reports loaded when the loader resolves', async () => {
    await expect(loadFontsWithFallback(() => Promise.resolve())).resolves.toBe('loaded');
  });

  it('reports failed, without rejecting, when the loader rejects', async () => {
    await expect(loadFontsWithFallback(() => Promise.reject(new Error('no font')))).resolves.toBe(
      'failed',
    );
  });

  it('reports failed when the loader throws synchronously', async () => {
    await expect(
      loadFontsWithFallback(() => {
        throw new Error('broken');
      }),
    ).resolves.toBe('failed');
  });

  it('stops waiting after the timeout so the app never blocks forever', async () => {
    vi.useFakeTimers();
    const pending = loadFontsWithFallback(() => new Promise(() => undefined));
    vi.advanceTimersByTime(fontLoadTimeoutMs);
    await expect(pending).resolves.toBe('timedOut');
  });
});
