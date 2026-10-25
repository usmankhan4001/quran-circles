/**
 * The console shares design tokens with the apps but not components (docs/product/experience.md).
 * `@qc/ui` has one entry point that also exports React Native components, which the web console
 * must not bundle. These re-exports read only the pure token modules by relative path. A change
 * request asks the ui lane for a tokens-only entry point (`@qc/ui/tokens`); when it lands, this
 * file is the only place to update.
 */
export {
  colors,
  elevation,
  fonts,
  fontFallbacks,
  radii,
  spacing,
  textScale,
  minTouchTarget,
  typeRoles,
  lineHeightRatio,
  scriptSizeFactor,
  type TextSizeStep,
} from '../../../../packages/ui/src/tokens';
export {
  semanticColors,
  type ColorMode,
  type SemanticColors,
} from '../../../../packages/ui/src/semantic-colors';
export { contrastRatio } from '../../../../packages/ui/src/contrast';
export {
  directionForLocale,
  isolate,
  ltrRun,
  type Direction,
} from '../../../../packages/ui/src/direction';
export {
  creditGroups,
  type CreditEntry,
  type CreditGroup,
} from '../../../../packages/ui/src/credits';

/**
 * Tag colours the console artboard draws that the kit has no token for yet (owner override of
 * D17): sky for the circles card and city coordinators, rose for the sisters' section, cobalt for
 * families. Each pair is text on its tint and keeps 4.5:1. The ui lane is asked to move these into
 * the kit; until then this file is the one place they are written.
 */
export const consoleTagColors = {
  light: {
    sky: '#0284c7',
    skySubtle: '#e0f2fe',
    rose: '#9d174d',
    roseSubtle: '#fdf2f8',
    cobalt: '#1e40af',
    cobaltSubtle: '#eff6ff',
    mint: '#059669',
    mintSubtle: '#d1fae5',
    slate: '#334155',
    slateSubtle: '#f1f5f9',
  },
  dark: {
    sky: '#7dd3fc',
    skySubtle: '#0c2b3d',
    rose: '#f9a8d4',
    roseSubtle: '#3b1426',
    cobalt: '#bfdbfe',
    cobaltSubtle: '#172554',
    mint: '#6ee7b7',
    mintSubtle: '#0f3022',
    slate: '#cbd5e1',
    slateSubtle: '#1e293b',
  },
} as const;

/**
 * The console redesign palette (design system "Quran Circles", tokens v2): a white page, one grey
 * fill for the sidebar and tracks, one green, hairlines instead of shadows. Each entry overrides
 * the kit's semantic colour of the same meaning, so every existing rule recolours at once. The
 * member-app thread owns the shared copy of these values; when it lands in `@qc/ui`, read them
 * from there and delete this block.
 */
export const consoleRedesign = {
  light: {
    background: '#FFFFFF',
    surface: '#FFFFFF',
    surfaceRaised: '#FFFFFF',
    surfaceMuted: '#F4F6F5',
    text: '#0E1512',
    textSecondary: '#5E6963',
    textMuted: '#5E6963',
    textAccent: '#0A6938',
    accent: '#0A6938',
    accentPressed: '#08532C',
    textOnAccent: '#FFFFFF',
    accentSubtle: '#EDF5F0',
    textOnAccentSubtle: '#08532C',
    success: '#0A6938',
    successSubtle: '#EDF5F0',
    textSuccess: '#0A6938',
    textOnSuccessSubtle: '#08532C',
    danger: '#B3261E',
    dangerPressed: '#8F1D17',
    dangerSubtle: '#FDEEED',
    textDanger: '#B3261E',
    textOnDangerSubtle: '#B3261E',
    warning: '#6B4E00',
    warningSubtle: '#FFF6E0',
    textWarning: '#6B4E00',
    textOnWarningSubtle: '#6B4E00',
    cta: '#0A6938',
    ctaPressed: '#08532C',
    textOnCta: '#FFFFFF',
    border: '#E8ECEA',
    hairline: '#E8ECEA',
    borderStrong: '#858F8A',
    focus: '#0A6938',
    decoration: '#B8862B',
  },
  dark: {
    background: '#0B0D0C',
    surface: '#121514',
    surfaceRaised: '#191D1B',
    surfaceMuted: '#1A1F1C',
    text: '#EEF1EF',
    textSecondary: '#A2ACA7',
    textMuted: '#A2ACA7',
    textAccent: '#4FC386',
    accent: '#4FC386',
    accentPressed: '#6FD39C',
    textOnAccent: '#04210F',
    accentSubtle: '#142A1E',
    textOnAccentSubtle: '#8EDDB2',
    success: '#4FC386',
    successSubtle: '#142A1E',
    textSuccess: '#4FC386',
    textOnSuccessSubtle: '#8EDDB2',
    danger: '#FF9A8F',
    dangerPressed: '#FFB4AB',
    dangerSubtle: '#331815',
    textDanger: '#FF9A8F',
    textOnDangerSubtle: '#FF9A8F',
    warning: '#F2CF73',
    warningSubtle: '#2B2412',
    textWarning: '#F2CF73',
    textOnWarningSubtle: '#F2CF73',
    cta: '#4FC386',
    ctaPressed: '#6FD39C',
    textOnCta: '#04210F',
    border: '#242A27',
    hairline: '#242A27',
    borderStrong: '#6F7A75',
    focus: '#4FC386',
    decoration: '#E3B85C',
  },
} as const;

/** The one shadow of the redesign: what floats above the page (dialogs and menus). */
export const consoleFloatShadow = {
  light: '0 -12px 40px rgba(14, 21, 18, 0.10)',
  dark: '0 -12px 40px rgba(0, 0, 0, 0.6)',
} as const;
