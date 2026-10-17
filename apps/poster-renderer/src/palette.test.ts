import { describe, expect, it } from 'vitest';
import { ACCENTS, contrastRatio } from './palette';
import { TEMPLATES } from './templates';

describe('contrastRatio', () => {
  it('matches the WCAG formula', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#226836', '#226836')).toBeCloseTo(1, 5);
    expect(() => contrastRatio('green', '#ffffff')).toThrow(RangeError);
  });
});

describe('every template with every approved accent', () => {
  for (const template of Object.values(TEMPLATES)) {
    for (const accent of ACCENTS) {
      it(`${template.id} / ${accent}: text meets 4.5:1, small text 7:1`, () => {
        for (const pair of template.textPairs(accent)) {
          const ratio = contrastRatio(pair.fg, pair.bg);
          expect(ratio, `${pair.name} ${pair.fg} on ${pair.bg}`).toBeGreaterThanOrEqual(
            pair.small ? 7 : 4.5,
          );
        }
      });
    }
  }
});
