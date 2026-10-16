import { describe, expect, it } from 'vitest';
import { colors, contrastRatio, minTouchTarget, textScale } from './index';

describe('contrast helper', () => {
  it('gives 21 for black on white', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
  });
});

describe('brand tokens meet WCAG AA for body text', () => {
  const AA = 4.5;

  it('slate text on parchment', () => {
    expect(contrastRatio(colors.brand.slate, colors.brand.parchment)).toBeGreaterThanOrEqual(AA);
  });

  it('white text on emerald', () => {
    expect(contrastRatio(colors.white, colors.brand.emerald)).toBeGreaterThanOrEqual(AA);
  });

  it('emerald text on parchment', () => {
    expect(contrastRatio(colors.brand.emerald, colors.brand.parchment)).toBeGreaterThanOrEqual(AA);
  });
});

describe('accessibility constants', () => {
  it('offers four text sizes starting at the default', () => {
    expect(textScale).toHaveLength(4);
    expect(textScale[0]).toBe(1);
  });

  it('keeps touch targets at 48 dp or more', () => {
    expect(minTouchTarget).toBeGreaterThanOrEqual(48);
  });
});
