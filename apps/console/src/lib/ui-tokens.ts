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

/** The one shadow of the redesign: what floats above the page (dialogs and menus). */
export const consoleFloatShadow = {
  light: '0 -12px 40px rgba(14, 21, 18, 0.10)',
  dark: '0 -12px 40px rgba(0, 0, 0, 0.6)',
} as const;
