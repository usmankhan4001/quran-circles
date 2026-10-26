import { afterEach, describe, expect, it, vi } from 'vitest';
import { fonts, sansWeights, urduFallbackFont } from '@qc/ui';
import { appFontFamilies, loadAppFonts } from './appFonts';

describe('app fonts', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('loads all three families under the token names', () => {
    expect(appFontFamilies.map((f) => f.fontFamily)).toEqual([
      fonts.sans,
      fonts.urdu,
      urduFallbackFont,
      fonts.quran,
    ]);
  });

  it('loads Figtree in every weight the type roles use, each face with swap on the web', () => {
    const sans = appFontFamilies.find((f) => f.fontFamily === fonts.sans);
    expect(sans?.fontDefinitions.map((d) => String(d.weight))).toEqual([...sansWeights]);
    for (const family of appFontFamilies) {
      for (const face of family.fontDefinitions) {
        expect(face.display).toBe('swap');
        expect(face.path).toBeTruthy();
      }
    }
  });

  it('loads the Jameel, Mehr and KFGQPC files from the kit', () => {
    const path = (name: string) =>
      String(appFontFamilies.find((f) => f.fontFamily === name)?.fontDefinitions[0]?.path);
    expect(path(fonts.urdu)).toContain('JameelNooriNastaleeq-Regular.ttf');
    expect(path(urduFallbackFont)).toContain('MehrNastaliqWeb-Regular.ttf');
    expect(path(fonts.quran)).toContain('KFGQPCUthmanicScriptHAFS-Regular.otf');
  });

  it('hands the whole map to the loader in one call', async () => {
    const load = vi.fn(() => Promise.resolve());
    await expect(loadAppFonts(load)).resolves.toBe('loaded');
    expect(load).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledWith(appFontFamilies);
  });

  it('carries on with fallback fonts when loading fails', async () => {
    await expect(loadAppFonts(() => Promise.reject(new Error('missing')))).resolves.toBe('failed');
  });

  it('stops waiting for a font that never arrives', async () => {
    vi.useFakeTimers();
    const pending = loadAppFonts(() => new Promise(() => undefined), 1000);
    vi.advanceTimersByTime(1000);
    await expect(pending).resolves.toBe('timedOut');
  });
});
