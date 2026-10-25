import { colors } from './tokens';
import { contrastRatio } from './contrast';

export type ColorMode = 'light' | 'dark' | 'highContrast';
export const colorModes: readonly ColorMode[] = ['light', 'dark', 'highContrast'];

/**
 * Meaning-based colours. Components use these, never raw palette values.
 * `light` is the day look (D17), `dark` is the night green after Isha, and `highContrast` is a
 * light theme with black text, white surfaces and strong borders.
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

  /** The main call to action (charcoal pill, D17): one per screen. */
  cta: string;
  ctaPressed: string;
  textOnCta: string;

  /** Hairlines and dividers. Decorative: never the only cue that something is a control. */
  border: string;
  /** The faintest hairline, around white cards. Decorative. */
  hairline: string;
  /** Outlines of inputs, switches and chips. At least 3:1 against the surface. */
  borderStrong: string;
  focus: string;

  skeleton: string;
  disabledBackground: string;
  disabledText: string;

  /** The green header that tops main screens and sheets (D12, D13). */
  hero: string;
  textOnHero: string;
  /** Where the header's gradient lightens before it fades into the page. Behind cards only, never text. */
  heroEnd: string;
  /** Light glass on the green header: icon buttons and the sheet handle. Decoration. */
  heroGlass: string;
  heroGlassPressed: string;

  /** Bars that show how full or how far along something is. The words beside them carry the meaning. */
  progress: string;
  progressWarn: string;

  /** Mushaf gilt. Decoration and Quran moments only (rules, ornaments, progress). Never used for text. */
  decoration: string;
}

const light: SemanticColors = {
  background: colors.day.page,
  surface: colors.white,
  surfaceRaised: colors.white,
  surfaceMuted: colors.day.fill,
  scrim: 'rgba(14, 21, 18, 0.45)',

  text: colors.day.ink,
  textSecondary: colors.day.inkSoft,
  textMuted: colors.day.inkMuted,
  textAccent: colors.day.green,
  textDanger: colors.day.careful,
  textSuccess: colors.day.green,
  textWarning: colors.day.noticeInk,

  accent: colors.day.green,
  accentPressed: colors.day.greenPress,
  textOnAccent: colors.white,
  accentSubtle: colors.day.greenTint,
  textOnAccentSubtle: colors.day.onGreenTint,

  success: colors.day.green,
  textOnSuccess: colors.white,
  successSubtle: colors.day.greenTint,
  textOnSuccessSubtle: colors.day.onGreenTint,

  danger: colors.day.careful,
  dangerPressed: colors.day.carefulPress,
  textOnDanger: colors.white,
  dangerSubtle: colors.day.carefulTint,
  textOnDangerSubtle: colors.day.careful,

  warning: colors.day.noticeInk,
  textOnWarning: colors.white,
  warningSubtle: colors.day.noticeTint,
  textOnWarningSubtle: colors.day.noticeInk,

  // Green is the only action colour: there is no charcoal or black button.
  cta: colors.day.green,
  ctaPressed: colors.day.greenPress,
  textOnCta: colors.white,

  border: colors.day.line,
  hairline: colors.day.line,
  borderStrong: colors.day.lineStrong,
  focus: colors.day.green,

  skeleton: colors.day.line,
  disabledBackground: colors.day.fill,
  disabledText: colors.day.inkMuted,

  // The green band is kept for the admin app and console; the member app has no coloured header.
  hero: colors.day.green,
  textOnHero: colors.white,
  heroEnd: colors.day.green,
  heroGlass: 'rgba(255, 255, 255, 0.16)',
  heroGlassPressed: 'rgba(255, 255, 255, 0.32)',

  progress: colors.day.green,
  progressWarn: colors.day.gilt,

  decoration: colors.day.gilt,
};

/** Night: near-black, not green-black. Only used when the person picks it in Settings. */
const dark: SemanticColors = {
  background: colors.night.page,
  surface: colors.night.surface,
  surfaceRaised: colors.night.raised,
  surfaceMuted: colors.night.fill,
  scrim: 'rgba(0, 0, 0, 0.7)',

  text: colors.night.ink,
  textSecondary: colors.night.inkSoft,
  textMuted: colors.night.inkMuted,
  textAccent: colors.night.green,
  textDanger: colors.night.careful,
  textSuccess: colors.night.green,
  textWarning: colors.night.noticeInk,

  accent: colors.night.green,
  accentPressed: colors.night.greenPress,
  textOnAccent: colors.night.onGreen,
  accentSubtle: colors.night.greenTint,
  textOnAccentSubtle: colors.night.onGreenTint,

  success: colors.night.green,
  textOnSuccess: colors.night.onGreen,
  successSubtle: colors.night.greenTint,
  textOnSuccessSubtle: colors.night.onGreenTint,

  danger: colors.night.careful,
  dangerPressed: colors.red[100],
  textOnDanger: colors.red[950],
  dangerSubtle: colors.night.carefulTint,
  textOnDangerSubtle: colors.night.careful,

  warning: colors.night.noticeInk,
  textOnWarning: colors.gold[950],
  warningSubtle: colors.night.noticeTint,
  textOnWarningSubtle: colors.night.noticeInk,

  cta: colors.night.green,
  ctaPressed: colors.night.greenPress,
  textOnCta: colors.night.onGreen,

  border: colors.night.line,
  hairline: colors.night.line,
  borderStrong: colors.night.lineStrong,
  focus: colors.night.green,

  skeleton: colors.night.line,
  disabledBackground: colors.night.fill,
  disabledText: colors.night.inkMuted,

  hero: colors.green[900],
  textOnHero: colors.white,
  heroEnd: colors.green[800],
  heroGlass: 'rgba(255, 255, 255, 0.16)',
  heroGlassPressed: 'rgba(255, 255, 255, 0.32)',

  progress: colors.night.green,
  progressWarn: colors.night.gilt,

  decoration: colors.night.gilt,
};

const highContrast: SemanticColors = {
  background: colors.white,
  surface: colors.white,
  surfaceRaised: colors.white,
  surfaceMuted: colors.grey[100],
  scrim: 'rgba(0, 0, 0, 0.75)',

  text: colors.black,
  textSecondary: colors.grey[900],
  textMuted: colors.grey[800],
  textAccent: colors.green[950],
  textDanger: colors.red[900],
  textSuccess: colors.green[950],
  textWarning: colors.gold[900],

  accent: colors.green[950],
  accentPressed: colors.green[975],
  textOnAccent: colors.white,
  accentSubtle: colors.brand.leaf,
  textOnAccentSubtle: colors.green[975],

  success: colors.green[950],
  textOnSuccess: colors.white,
  successSubtle: colors.brand.leaf,
  textOnSuccessSubtle: colors.green[975],

  danger: colors.red[900],
  dangerPressed: colors.red[950],
  textOnDanger: colors.white,
  dangerSubtle: colors.red[100],
  textOnDangerSubtle: colors.red[950],

  warning: colors.gold[900],
  textOnWarning: colors.white,
  warningSubtle: colors.gold[100],
  textOnWarningSubtle: colors.gold[950],

  cta: colors.black,
  ctaPressed: colors.grey[800],
  textOnCta: colors.white,

  border: colors.black,
  hairline: colors.black,
  borderStrong: colors.black,
  focus: colors.green[975],

  skeleton: colors.grey[300],
  disabledBackground: colors.grey[200],
  disabledText: colors.grey[700],

  hero: colors.green[975],
  textOnHero: colors.white,
  heroEnd: colors.green[975],
  heroGlass: 'rgba(255, 255, 255, 0.16)',
  heroGlassPressed: 'rgba(255, 255, 255, 0.32)',

  progress: colors.green[950],
  progressWarn: colors.gold[900],

  decoration: colors.brand.gilt,
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
    ['textOnHero', 'hero'],
    ['textOnCta', 'cta'],
    ['textOnCta', 'ctaPressed'],
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
