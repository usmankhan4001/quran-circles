/**
 * The console shares design tokens with the apps but not components (docs/product/experience.md).
 * `@qc/ui` has one entry point that also exports React Native components, which the web console
 * must not bundle. These re-exports read only the pure token modules by relative path. A change
 * request asks the ui lane for a tokens-only entry point (`@qc/ui/tokens`); when it lands, this
 * file is the only place to update.
 */
export {
  colors,
  fonts,
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
export {
  directionForLocale,
  isolate,
  ltrRun,
  type Direction,
} from '../../../../packages/ui/src/direction';
