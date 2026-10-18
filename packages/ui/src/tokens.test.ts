import { describe, expect, it } from 'vitest';
import {
  colorModes,
  colors,
  contrastPairs,
  contrastRatio,
  elevation,
  failingPairs,
  fonts,
  lineHeightRatio,
  minTouchTarget,
  motion,
  radii,
  semanticColors,
  spacing,
  textContrastMin,
  textScale,
  textSizeSteps,
  typeRoles,
  typeStyle,
  type SemanticColors,
  type TypeRole,
} from './index';

describe('contrast helper', () => {
  it('gives 21 for black on white', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
  });

  it('gives 1 for the same colour', () => {
    expect(contrastRatio('#064e3b', '#064e3b')).toBeCloseTo(1, 5);
  });

  it('is symmetric', () => {
    expect(contrastRatio('#064e3b', '#fdfcf6')).toBeCloseTo(
      contrastRatio('#fdfcf6', '#064e3b'),
      10,
    );
  });

  it('rejects colours that are not #rrggbb', () => {
    expect(() => contrastRatio('red', '#ffffff')).toThrow(/#rrggbb/);
    expect(() => contrastRatio('#fff', '#ffffff')).toThrow(/#rrggbb/);
  });
});

describe('brand tokens meet WCAG AA for body text', () => {
  const AA = 4.5;

  it('ink text on cloud', () => {
    expect(contrastRatio(colors.brand.ink, colors.brand.cloud)).toBeGreaterThanOrEqual(AA);
  });

  it('white text on deep emerald', () => {
    expect(contrastRatio(colors.white, colors.brand.emerald)).toBeGreaterThanOrEqual(AA);
  });

  it('deep emerald text on cloud', () => {
    expect(contrastRatio(colors.brand.emerald, colors.brand.cloud)).toBeGreaterThanOrEqual(AA);
  });

  it('gilt on cloud fails body text contrast, which is why gilt is decoration only', () => {
    expect(contrastRatio(colors.brand.gilt, colors.brand.cloud)).toBeLessThan(AA);
  });

  it('white on the raw alert red fails, which is why danger fills use the deeper red', () => {
    expect(contrastRatio(colors.white, colors.brand.alert)).toBeLessThan(AA);
    expect(contrastRatio(colors.white, colors.red[700])).toBeGreaterThanOrEqual(AA);
  });
});

describe.each(colorModes)('semantic colours in %s mode', (mode) => {
  const set = semanticColors[mode];

  it('has a value for every colour', () => {
    for (const [name, value] of Object.entries(set)) {
      expect(value, name).toMatch(/^(#[0-9a-f]{6}|rgba\(.+\))$/i);
    }
  });

  it('meets the minimum contrast for every text and background pair', () => {
    expect(failingPairs(mode)).toEqual([]);
  });

  it('checks a meaningful number of pairs', () => {
    expect(contrastPairs(mode).length).toBeGreaterThan(40);
  });

  it(`uses ${textContrastMin(mode)}:1 as the text minimum`, () => {
    const textPairs = contrastPairs(mode).filter((p) => p.min >= 4.5);
    expect(textPairs.length).toBeGreaterThan(30);
    for (const p of textPairs) expect(p.min).toBe(textContrastMin(mode));
  });

  it('never uses gilt for text or fills', () => {
    const gold = colors.brand.gilt.toLowerCase();
    for (const [name, value] of Object.entries(set)) {
      // The amber bar beside "filling fast" is a decoration too: the words carry the meaning.
      if (name === 'decoration' || name === 'progressWarn') continue;
      expect(String(value).toLowerCase(), name).not.toBe(gold);
    }
    for (const p of contrastPairs(mode)) {
      expect(p.foreground.toLowerCase(), p.name).not.toBe(gold);
    }
  });
});

describe('semantic colours across modes', () => {
  it('has the same set of names in every mode', () => {
    const names = (c: SemanticColors) => Object.keys(c).sort();
    expect(names(semanticColors.dark)).toEqual(names(semanticColors.light));
    expect(names(semanticColors.highContrast)).toEqual(names(semanticColors.light));
  });

  it('keeps the brand colours in light mode', () => {
    expect(semanticColors.light.background).toBe(colors.white);
    expect(semanticColors.light.surfaceMuted).toBe(colors.brand.cloud);
    expect(semanticColors.light.cta).toBe(colors.brand.charcoal);
    expect(semanticColors.light.accent).toBe(colors.brand.emerald);
    expect(semanticColors.light.text).toBe(colors.brand.ink);
  });

  it('puts the dark background on the night green', () => {
    expect(semanticColors.dark.background).toBe(colors.brand.night);
  });

  it('makes high contrast stronger than light for primary text', () => {
    const light = contrastRatio(semanticColors.light.text, semanticColors.light.background);
    const hc = contrastRatio(
      semanticColors.highContrast.text,
      semanticColors.highContrast.background,
    );
    expect(hc).toBeGreaterThan(light);
    expect(hc).toBeGreaterThanOrEqual(7);
  });

  it('reports a failing pair when one is made worse (the check can fail)', () => {
    const original = semanticColors.light.textMuted;
    try {
      (semanticColors.light as { textMuted: string }).textMuted = '#cccccc';
      expect(failingPairs('light').some((p) => p.name.startsWith('textMuted'))).toBe(true);
    } finally {
      (semanticColors.light as { textMuted: string }).textMuted = original;
    }
    expect(failingPairs('light')).toEqual([]);
  });
});

describe('accessibility constants', () => {
  it('offers four text sizes starting at the default', () => {
    expect(textScale).toHaveLength(4);
    expect(textScale[0]).toBe(1);
    expect(textSizeSteps).toEqual([0, 1, 2, 3]);
  });

  it('grows the text sizes in order', () => {
    for (let i = 1; i < textScale.length; i++) {
      expect(textScale[i] as number).toBeGreaterThan(textScale[i - 1] as number);
    }
  });

  it('keeps touch targets at 48 dp or more', () => {
    expect(minTouchTarget).toBeGreaterThanOrEqual(48);
  });
});

describe('type scale', () => {
  const roles = Object.keys(typeRoles) as TypeRole[];

  it('uses the named fonts for each script', () => {
    expect(typeStyle('body', 'latin').fontFamily).toBe(fonts.sans);
    expect(typeStyle('body', 'urdu').fontFamily).toBe(fonts.urdu);
    expect(typeStyle('quran', 'quran').fontFamily).toBe(fonts.quran);
  });

  it('gives Nastaliq more line height than Latin, and the Quran font the most', () => {
    expect(lineHeightRatio.urdu).toBeGreaterThan(lineHeightRatio.latin);
    expect(lineHeightRatio.quran).toBeGreaterThan(lineHeightRatio.urdu);
  });

  it.each(roles)(
    '%s: line height always clears the font size, for every script and size',
    (role) => {
      for (const script of ['latin', 'urdu', 'quran'] as const) {
        for (const step of textSizeSteps) {
          const t = typeStyle(role, script, step);
          expect(t.lineHeight, `${role} ${script} ${step}`).toBeGreaterThan(t.fontSize * 1.3);
        }
      }
    },
  );

  it.each(roles)('%s: grows with each text size step', (role) => {
    const sizes = textSizeSteps.map((s) => typeStyle(role, 'latin', s).fontSize);
    for (let i = 1; i < sizes.length; i++)
      expect(sizes[i] as number).toBeGreaterThan(sizes[i - 1] as number);
  });

  it('copies the artboard sizes at the default step (D17)', () => {
    expect(typeStyle('body', 'latin', 0).fontSize).toBe(13);
    expect(typeStyle('caption', 'latin', 0).fontSize).toBe(11.5);
    expect(typeStyle('title3', 'latin', 0).fontSize).toBe(16);
  });

  it('reaches 19 dp body and 17 dp captions at the largest step', () => {
    expect(typeStyle('body', 'latin', 3).fontSize).toBeGreaterThanOrEqual(19);
    expect(typeStyle('caption', 'latin', 3).fontSize).toBeGreaterThanOrEqual(17);
  });

  it('sets Urdu a little larger than Latin at the same role', () => {
    expect(typeStyle('body', 'urdu', 0).fontSize).toBeGreaterThan(
      typeStyle('body', 'latin', 0).fontSize,
    );
  });

  it('never synthesises bold for Urdu or Quran text', () => {
    expect(typeStyle('title1', 'urdu', 0).fontWeight).toBe('400');
    expect(typeStyle('title1', 'quran', 0).fontWeight).toBe('400');
    expect(typeStyle('title1', 'latin', 0).fontWeight).toBe('800');
  });
});

describe('spacing, radii, elevation and motion', () => {
  it('keeps spacing on a 2 dp grid and increasing', () => {
    const values = Object.values(spacing);
    for (const v of values) expect(v % 2).toBe(0);
    for (let i = 1; i < values.length; i++)
      expect(values[i] as number).toBeGreaterThan(values[i - 1] as number);
  });

  it('has increasing radii ending in a pill, with fields drawn as pills (D17)', () => {
    const values = Object.values(radii);
    for (let i = 1; i < values.length; i++)
      expect(values[i] as number).toBeGreaterThanOrEqual(values[i - 1] as number);
    expect(radii.pill).toBeGreaterThanOrEqual(999);
    expect(radii.field).toBe(radii.pill);
  });

  it('has no shadow at level none and a shadow string above it', () => {
    expect(elevation.none).toBeUndefined();
    for (const level of ['low', 'medium', 'high'] as const)
      expect(elevation[level]).toMatch(/^0px \d+px \d+px (-?\d+px )?rgba\(/);
  });

  it('has motion durations that grow, starting at zero', () => {
    const { instant, fast, base, slow } = motion.duration;
    expect([instant, fast, base, slow]).toEqual([0, 120, 200, 320]);
  });
});
