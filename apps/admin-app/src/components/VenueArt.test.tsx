import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ThemeProvider, colorModes, semanticColors, type ColorMode } from '@qc/ui';
import { VenueArt, variantOf } from './VenueArt';

const SEEDS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

/** The browser's own spelling of a colour, so hex tokens and drawn rgb values compare. */
function normal(color: string): string {
  const probe = document.createElement('i');
  probe.style.color = color;
  return probe.style.color;
}

/** Every colour painted inside the art: fills and outlines. */
function paintedColors(root: HTMLElement): Set<string> {
  const found = new Set<string>();
  for (const el of [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))]) {
    for (const value of [
      el.style.backgroundColor,
      el.style.borderTopColor,
      el.style.borderBottomColor,
      el.style.borderLeftColor,
      el.style.borderRightColor,
    ]) {
      if (value && value !== 'transparent') found.add(normal(value));
    }
  }
  return found;
}

interface Drawn {
  art: HTMLElement;
  mushaf: HTMLElement;
}

/** Draws the art, hands it to `read`, then takes it off the screen again. */
function drawn<T>(
  read: (d: Drawn) => T,
  {
    seed = 'venue-1',
    mode = 'light' as ColorMode,
    locale = 'en' as 'en' | 'ur',
    height = undefined as number | undefined,
  } = {},
): T {
  const view = render(
    <ThemeProvider mode={mode} locale={locale}>
      <VenueArt seed={seed} height={height} testID="art" />
    </ThemeProvider>,
  );
  try {
    return read({
      art: view.getByTestId('art'),
      mushaf: view.getByTestId('art-mushaf'),
    });
  } finally {
    view.unmount();
  }
}

describe('VenueArt (drawn mushaf on a rehal)', () => {
  it.each(
    colorModes.flatMap((mode) => (['en', 'ur'] as const).map((locale) => ({ mode, locale }))),
  )('draws in $mode / $locale as decoration hidden from screen readers', ({ mode, locale }) => {
    drawn(
      ({ art }) => {
        expect(art.getAttribute('aria-hidden')).toBe('true');
        expect(art.style.height).toBe('104px');
      },
      { mode, locale },
    );
  });

  it.each(colorModes)('paints only with %s theme colours', (mode) => {
    const tokens = new Set(Object.values(semanticColors[mode]).map(normal));
    for (const seed of SEEDS) {
      const painted = drawn(({ art }) => paintedColors(art), { seed, mode });
      expect(painted.size).toBeGreaterThan(3);
      for (const color of painted) expect(tokens).toContain(color);
    }
  });

  it('turns to night with the app: the sky changes with the colour mode', () => {
    // The admin sky is the green header colour of each mode.
    const day = drawn(({ art }) => art.style.backgroundColor, { mode: 'light' });
    const night = drawn(({ art }) => art.style.backgroundColor, { mode: 'dark' });
    expect(day).not.toBe(night);
  });

  it('has no letters or words in the drawing (no stand-in Quran text)', () => {
    expect(drawn(({ art }) => art.textContent, { locale: 'ur', height: 208 })).toBe('');
  });

  it.each(['en', 'ur'] as const)(
    'lays the book out left to right in %s, so each page keeps its lean',
    (locale) => {
      drawn(
        ({ mushaf }) => {
          expect(mushaf.getAttribute('dir')).toBe('ltr');
          expect(mushaf.style.direction).toBe('ltr');
          const parts = Array.from(mushaf.children) as HTMLElement[];
          expect(parts.length).toBeGreaterThan(4);
          for (const part of parts) {
            expect(part.style.left).not.toBe('');
            expect(part.style.right).toBe('');
          }
        },
        { locale },
      );
    },
  );

  it('looks the same every time for one place, and differs between places', () => {
    const first = drawn(({ art }) => art.outerHTML);
    expect(drawn(({ art }) => art.outerHTML)).toBe(first);
    const looks = new Set(SEEDS.map((seed) => drawn(({ art }) => art.outerHTML, { seed })));
    expect(looks.size).toBeGreaterThan(1);
    expect(variantOf('venue-1', 3)).toBe(variantOf('venue-1', 3));
    for (const seed of SEEDS) expect(variantOf(seed, 3)).toBeLessThan(3);
  });

  it('scales with its height', () => {
    const small = drawn(({ mushaf }) => Number.parseFloat(mushaf.style.width));
    const big = drawn(({ mushaf }) => Number.parseFloat(mushaf.style.width), { height: 208 });
    expect(big).toBeCloseTo(small * 2, 1);
  });
});
