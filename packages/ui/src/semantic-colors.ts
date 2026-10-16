import { colors } from './tokens';
import { contrastRatio } from './contrast';

export type ColorMode = 'light' | 'dark' | 'highContrast';
export const colorModes: readonly ColorMode[] = ['light', 'dark', 'highContrast'];

/**
 * Meaning-based colours. Components use these, never raw palette values.
 * `highContrast` is a light theme with black text, white surfaces and strong borders.
 */
export interface SemanticColors {
  background: string;
  surface: string;
  surfaceRaised: string;
  surfaceMuted: string;
  /** Dim layer behind sheets. Decoration, not text. */
  scrim: string;

  text: string;
  textSecondary: string;
  textMuted: string;
  /** Links and accent-coloured text. */
  textAccent: string;
  textDanger: string;
  textSuccess: string;
  textWarning: string;

  accent: string;
  accentPressed: string;
  textOnAccent: string;
  accentSubtle: string;
  textOnAccentSubtle: string;

  success: string;
  textOnSuccess: string;
  successSubtle: string;
  textOnSuccessSubtle: string;

  danger: string;
  dangerPressed: string;
  textOnDanger: string;
  dangerSubtle: string;
  textOnDangerSubtle: string;

  warning: string;
  textOnWarning: string;
  warningSubtle: string;
  textOnWarningSubtle: string;

  /** Hairlines and dividers. Decorative: never the only cue that something is a control. */
  border: string;
  /** Outlines of inputs, switches and chips. At least 3:1 against the surface. */
  borderStrong: string;
  focus: string;

  skeleton: string;
  disabledBackground: string;
  disabledText: string;

  /** Gold. Decoration only (rules, ornaments, illustrations). Never used for text. */
  decoration: string;
}

const light: SemanticColors = {
  background: colors.brand.parchment,
  surface: colors.white,
  surfaceRaised: colors.white,
  surfaceMuted: colors.slate[100],
  scrim: 'rgba(15, 23, 42, 0.5)',

  text: colors.brand.slate,
  textSecondary: colors.slate[600],
  textMuted: '#566274',
  textAccent: colors.emerald[900],
  textDanger: colors.red[700],
  textSuccess: colors.green[800],
  textWarning: colors.amber[800],

  accent: colors.emerald[900],
  accentPressed: colors.emerald[950],
  textOnAccent: colors.white,
  accentSubtle: colors.emerald[100],
  textOnAccentSubtle: colors.emerald[900],

  success: colors.green[800],
  textOnSuccess: colors.white,
  successSubtle: colors.green[100],
  textOnSuccessSubtle: colors.green[900],

  danger: colors.red[700],
  dangerPressed: colors.red[800],
  textOnDanger: colors.white,
  dangerSubtle: colors.red[100],
  textOnDangerSubtle: colors.red[900],

  warning: colors.amber[800],
  textOnWarning: colors.white,
  warningSubtle: colors.amber[100],
  textOnWarningSubtle: colors.amber[900],

  border: colors.slate[200],
  borderStrong: colors.slate[500],
  focus: colors.blue[700],

  skeleton: colors.slate[200],
  disabledBackground: colors.slate[200],
  disabledText: colors.slate[600],

  decoration: colors.brand.gold,
};

const dark: SemanticColors = {
  background: colors.brand.slate,
  surface: colors.slate[800],
  surfaceRaised: '#273548',
  surfaceMuted: '#1a2538',
  scrim: 'rgba(2, 6, 23, 0.7)',

  text: colors.slate[50],
  textSecondary: colors.slate[300],
  textMuted: '#a3b1c6',
  textAccent: colors.emerald[300],
  textDanger: colors.red[300],
  textSuccess: colors.green[400],
  textWarning: colors.amber[400],

  accent: colors.emerald[400],
  accentPressed: colors.emerald[300],
  textOnAccent: colors.emerald[950],
  accentSubtle: colors.emerald[900],
  textOnAccentSubtle: colors.emerald[200],

  success: colors.green[400],
  textOnSuccess: colors.green[950],
  successSubtle: colors.green[900],
  textOnSuccessSubtle: colors.green[200],

  danger: colors.red[400],
  dangerPressed: colors.red[300],
  textOnDanger: colors.red[950],
  dangerSubtle: colors.red[900],
  textOnDangerSubtle: colors.red[200],

  warning: colors.amber[400],
  textOnWarning: colors.amber[950],
  warningSubtle: colors.amber[900],
  textOnWarningSubtle: colors.amber[200],

  border: colors.slate[700],
  borderStrong: colors.slate[400],
  focus: colors.blue[300],

  skeleton: colors.slate[700],
  disabledBackground: colors.slate[700],
  disabledText: colors.slate[300],

  decoration: colors.brand.gold,
};

const highContrast: SemanticColors = {
  background: colors.white,
  surface: colors.white,
  surfaceRaised: colors.white,
  surfaceMuted: colors.slate[100],
  scrim: 'rgba(0, 0, 0, 0.75)',

  text: colors.black,
  textSecondary: '#1f2937',
  textMuted: '#2f3b4c',
  textAccent: colors.emerald[950],
  textDanger: colors.red[900],
  textSuccess: colors.green[900],
  textWarning: colors.amber[900],

  accent: colors.emerald[950],
  accentPressed: colors.black,
  textOnAccent: colors.white,
  accentSubtle: colors.emerald[100],
  textOnAccentSubtle: colors.emerald[950],

  success: colors.green[900],
  textOnSuccess: colors.white,
  successSubtle: colors.green[100],
  textOnSuccessSubtle: colors.green[950],

  danger: colors.red[900],
  dangerPressed: colors.red[950],
  textOnDanger: colors.white,
  dangerSubtle: colors.red[100],
  textOnDangerSubtle: colors.red[950],

  warning: colors.amber[900],
  textOnWarning: colors.white,
  warningSubtle: colors.amber[100],
  textOnWarningSubtle: colors.amber[950],

  border: colors.black,
  borderStrong: colors.black,
  focus: colors.blue[900],

  skeleton: colors.slate[300],
  disabledBackground: colors.slate[200],
  disabledText: colors.slate[600],

  decoration: colors.brand.gold,
};

export const semanticColors: Record<ColorMode, SemanticColors> = { light, dark, highContrast };

export interface ContrastPair {
  name: string;
  foreground: string;
  background: string;
  /** Minimum ratio: 4.5 for text (7 in high contrast), 3 for outlines and large UI shapes. */
  min: number;
}

/** Minimum contrast for body text in the given mode. High contrast aims for WCAG AAA. */
export function textContrastMin(mode: ColorMode): number {
  return mode === 'highContrast' ? 7 : 4.5;
}

/** Every text and background pair the kit uses, with the ratio it must reach. */
export function contrastPairs(mode: ColorMode): ContrastPair[] {
  const c = semanticColors[mode];
  const textMin = textContrastMin(mode);
  const pairs: ContrastPair[] = [];
  const grounds = ['background', 'surface', 'surfaceRaised', 'surfaceMuted'] as const;
  const texts = [
    'text',
    'textSecondary',
    'textMuted',
    'textAccent',
    'textDanger',
    'textSuccess',
    'textWarning',
  ] as const;
  for (const t of texts) {
    for (const g of grounds) {
      pairs.push({
        name: `${t} on ${g}`,
        foreground: c[t],
        background: c[g],
        min: textMin,
      });
    }
  }
  const filled: [keyof SemanticColors, keyof SemanticColors][] = [
    ['textOnAccent', 'accent'],
    ['textOnAccent', 'accentPressed'],
    ['textOnAccentSubtle', 'accentSubtle'],
    ['textOnSuccess', 'success'],
    ['textOnSuccessSubtle', 'successSubtle'],
    ['textOnDanger', 'danger'],
    ['textOnDanger', 'dangerPressed'],
    ['textOnDangerSubtle', 'dangerSubtle'],
    ['textOnWarning', 'warning'],
    ['textOnWarningSubtle', 'warningSubtle'],
  ];
  for (const [fg, bg] of filled) {
    pairs.push({ name: `${fg} on ${bg}`, foreground: c[fg], background: c[bg], min: textMin });
  }
  // Disabled text is exempt from WCAG, but we still hold it to 3:1 so it stays readable.
  pairs.push({
    name: 'disabledText on disabledBackground',
    foreground: c.disabledText,
    background: c.disabledBackground,
    min: 3,
  });
  // Non-text contrast (WCAG 1.4.11): outlines, focus ring and the filled accent shape.
  for (const g of ['background', 'surface'] as const) {
    pairs.push({
      name: `borderStrong on ${g}`,
      foreground: c.borderStrong,
      background: c[g],
      min: 3,
    });
    pairs.push({ name: `focus on ${g}`, foreground: c.focus, background: c[g], min: 3 });
    pairs.push({ name: `accent on ${g}`, foreground: c.accent, background: c[g], min: 3 });
  }
  return pairs;
}

/** Returns the pairs that fail their minimum. Empty means the mode passes. */
export function failingPairs(mode: ColorMode): (ContrastPair & { ratio: number })[] {
  return contrastPairs(mode)
    .map((p) => ({ ...p, ratio: contrastRatio(p.foreground, p.background) }))
    .filter((p) => p.ratio < p.min);
}
