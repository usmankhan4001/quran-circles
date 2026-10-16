import { render, type RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';
import { directionForLocale, locales, type Direction, type Locale } from '../direction';
import { colorModes, type ColorMode } from '../semantic-colors';
import { ThemeProvider } from '../theme';
import { textSizeSteps, type TextSizeStep } from '../tokens';

export interface Combo {
  name: string;
  mode: ColorMode;
  locale: Locale;
  direction: Direction;
  textSize: TextSizeStep;
}

/** Every colour mode x language (and so direction) x text size: 3 x 2 x 4 = 24 combinations. */
export const matrix: Combo[] = colorModes.flatMap((mode) =>
  locales.flatMap((locale) =>
    textSizeSteps.map((textSize) => ({
      name: `${mode} / ${locale} (${directionForLocale(locale)}) / size ${textSize}`,
      mode,
      locale,
      direction: directionForLocale(locale),
      textSize,
    })),
  ),
);

export type ThemedOptions = Partial<Omit<Combo, 'name'>> & { reduceMotion?: boolean };

/**
 * Renders inside a ThemeProvider. Motion is reduced by default: jsdom never fires CSS
 * animation events, so an animated Modal would never finish closing.
 */
export function renderThemed(ui: ReactElement, options: ThemedOptions = {}): RenderResult {
  return render(<ThemeProvider reduceMotion {...options}>{ui}</ThemeProvider>);
}

/** Converts #rrggbb to the `rgb(r, g, b)` string the DOM reports. */
export function rgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

export function px(value: string): number {
  return parseFloat(value) || 0;
}

/** Walks up from an element to the closest ancestor (or itself) that has the attribute. */
export function closestWith(el: Element, attr: string): Element | null {
  return el.closest(`[${attr}]`);
}
