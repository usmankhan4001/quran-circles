/**
 * Design tokens for Quran Circles. The ui lane owns this file (docs/agents/briefs/ui.md).
 *
 * Raw values live here. Components never use raw colours: they read the semantic colours for
 * the current mode from `semantic-colors.ts` through `useTheme()`.
 *
 * Starting values come from the V1 app (tailwind.config.js, index.css). A human reviews this
 * file as part of the design review (docs/design/principles.md).
 */
export const colors = {
  brand: {
    emerald: '#064e3b',
    /** Decoration only. Never use gold for text: it fails contrast on parchment. */
    gold: '#d4af37',
    parchment: '#fdfcf6',
    slate: '#0f172a',
  },
  emerald: {
    50: '#ecfdf5',
    100: '#d1fae5',
    200: '#a7f3d0',
    300: '#6ee7b7',
    400: '#34d399',
    800: '#065f46',
    900: '#064e3b',
    950: '#022c22',
  },
  slate: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
  },
  red: {
    100: '#fee2e2',
    200: '#fecaca',
    300: '#fca5a5',
    400: '#f87171',
    700: '#b91c1c',
    800: '#991b1b',
    900: '#7f1d1d',
    950: '#450a0a',
  },
  green: {
    100: '#dcfce7',
    200: '#bbf7d0',
    400: '#4ade80',
    800: '#166534',
    900: '#14532d',
    950: '#052e16',
  },
  amber: {
    100: '#fef3c7',
    200: '#fde68a',
    400: '#fbbf24',
    800: '#92400e',
    900: '#78350f',
    950: '#451a03',
  },
  blue: {
    300: '#93c5fd',
    700: '#1d4ed8',
    900: '#1e3a8a',
  },
  white: '#ffffff',
  black: '#000000',
} as const;

export const fonts = {
  sans: 'DM Sans',
  urdu: 'Gulzar',
  quran: 'AlMushaf',
} as const;

/** App-wide text size steps the person can choose in Profile. 1 is the default. */
export const textScale = [1, 1.15, 1.3, 1.5] as const;

/** The four text size steps by index. Step 0 is the default. */
export type TextSizeStep = 0 | 1 | 2 | 3;
export const textSizeSteps: readonly TextSizeStep[] = [0, 1, 2, 3];

/** Minimum touch target in dp (Android guidance; iOS minimum is 44pt). */
export const minTouchTarget = 48;

/** Spacing scale in dp, on a 4 dp grid. Use the names, not raw numbers. */
export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
  huge: 64,
} as const;
export type SpacingToken = keyof typeof spacing;

/** Horizontal gutter of a screen. */
export const screenGutter = spacing.lg;

export const radii = {
  none: 0,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;
export type RadiusToken = keyof typeof radii;

/**
 * Elevation as `boxShadow` strings, which React Native 0.76+ and React Native Web both support.
 * In dark mode depth is shown with lighter surfaces; the shadow is kept subtle.
 */
export const elevation = {
  none: undefined,
  low: '0px 1px 3px rgba(15, 23, 42, 0.12)',
  medium: '0px 4px 12px rgba(15, 23, 42, 0.16)',
  high: '0px 12px 32px rgba(15, 23, 42, 0.24)',
} as const;
export type ElevationToken = keyof typeof elevation;

/** Motion. When the person asks for reduced motion every duration becomes 0. */
export const motion = {
  duration: { instant: 0, fast: 120, base: 200, slow: 320 },
  easing: {
    standard: [0.2, 0, 0, 1],
    enter: [0, 0, 0, 1],
    exit: [0.4, 0, 1, 1],
  },
} as const;

export type TypeRole =
  'display' | 'title1' | 'title2' | 'title3' | 'bodyLarge' | 'body' | 'label' | 'caption' | 'quran';

/** The script a piece of text is set in. It decides the font and the line height. */
export type Script = 'latin' | 'urdu' | 'quran';

interface TypeRoleSpec {
  /** Size in dp at text size step 0, for Latin text. */
  size: number;
  weight: '400' | '500' | '700';
  letterSpacing: number;
}

export const typeRoles: Record<TypeRole, TypeRoleSpec> = {
  display: { size: 34, weight: '700', letterSpacing: -0.4 },
  title1: { size: 28, weight: '700', letterSpacing: -0.2 },
  title2: { size: 24, weight: '700', letterSpacing: 0 },
  title3: { size: 20, weight: '500', letterSpacing: 0 },
  bodyLarge: { size: 18, weight: '400', letterSpacing: 0 },
  body: { size: 16, weight: '400', letterSpacing: 0 },
  label: { size: 16, weight: '500', letterSpacing: 0 },
  caption: { size: 14, weight: '400', letterSpacing: 0.1 },
  quran: { size: 28, weight: '400', letterSpacing: 0 },
};

/**
 * Line height as a multiple of the font size. Gulzar (Nastaliq) has tall ascenders and deep
 * descenders, so it needs far more room than Latin text. AlMushaf needs the most, because of
 * stacked diacritics.
 */
export const lineHeightRatio: Record<Script, number> = {
  latin: 1.4,
  urdu: 1.95,
  quran: 2.2,
};

/** Gulzar looks smaller than DM Sans at the same size, so Urdu text is set a little larger. */
export const scriptSizeFactor: Record<Script, number> = {
  latin: 1,
  urdu: 1.1,
  quran: 1,
};

export interface TypeStyle {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  fontWeight: '400' | '500' | '700';
  letterSpacing: number;
}

/** Resolves a type role for a script at a text size step into concrete React Native text style. */
export function typeStyle(role: TypeRole, script: Script, step: TextSizeStep = 0): TypeStyle {
  const spec = typeRoles[role];
  const scale = textScale[step];
  const fontSize = Math.round(spec.size * scriptSizeFactor[script] * scale);
  return {
    fontFamily: fonts[script === 'latin' ? 'sans' : script],
    fontSize,
    lineHeight: Math.round(fontSize * lineHeightRatio[script]),
    // Nastaliq and Quran fonts have one weight. A synthesised bold looks broken, so emphasise
    // Urdu with size and colour instead.
    fontWeight: script === 'latin' ? spec.weight : '400',
    letterSpacing: script === 'latin' ? spec.letterSpacing : 0,
  };
}
