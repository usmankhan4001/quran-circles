/**
 * Design tokens for Quran Circles. The ui lane owns this file (docs/agents/briefs/ui.md).
 *
 * Raw values live here. Components never use raw colours: they read the semantic colours for
 * the current mode from `semantic-colors.ts` through `useTheme()`.
 *
 * Values follow the redesign agreed with the owner (docs/design/redesign-decisions.md, D3 to D13).
 */
export const colors = {
  brand: {
    /** Tanzeem-e-Islami green: every main action, selected states, the brand (D3). */
    tanzeem: '#226836',
    deep: '#154a27',
    /** The page colour after Isha. */
    night: '#0c2a17',
    leaf: '#e5f0e8',
    cloud: '#f7fbf9',
    mist: '#dbe7e6',
    /** Mushaf gilt. Quran moments and decoration only; never body text. */
    gilt: '#b8913a',
    /** Terracotta for unread counts and errors. White text needs the deeper `red[700]`. */
    alert: '#c4563f',
    ink: '#16201a',
  },
  green: {
    50: '#f2f8f4',
    100: '#e5f0e8',
    200: '#c6dfcd',
    300: '#8fd3a5',
    400: '#5fb87d',
    500: '#3d9e5c',
    600: '#2d8048',
    700: '#226836',
    800: '#154a27',
    900: '#0f3a20',
    950: '#0c2a17',
    975: '#06160c',
  },
  /** Green-tinted greys, so neutrals sit with the brand green. */
  grey: {
    50: '#f7fbf9',
    100: '#eef4f1',
    200: '#dfe8e3',
    300: '#c5d2ca',
    400: '#9fb3a6',
    500: '#6f7f75',
    600: '#56635b',
    700: '#4a5a50',
    800: '#2c3a31',
    900: '#16201a',
  },
  /** Night surfaces, lighter as they rise. */
  night: {
    surface: '#123520',
    raised: '#184228',
    muted: '#0f301c',
    border: '#24543a',
    text: '#eaf3ed',
    textSecondary: '#c4d6ca',
    textMuted: '#a6bdae',
  },
  red: {
    100: '#fbe7e2',
    300: '#f0a38f',
    600: '#c4563f',
    700: '#b4472f',
    800: '#963a26',
    900: '#6e2a1b',
    950: '#3a150d',
  },
  gold: {
    100: '#fbf1d6',
    300: '#e4c46d',
    500: '#b8913a',
    700: '#7a5a10',
    800: '#6b4e0e',
    900: '#4a3608',
    950: '#2a1f05',
  },
  white: '#ffffff',
  black: '#000000',
} as const;

/**
 * Font families (D4). Figtree for Latin text and for every number, a true Nastaliq for Urdu,
 * and a Quranic face for Quran text only. The values are the family names the apps register
 * the bundled files under (`@qc/ui/font-sources`), so they match the fonts' own names.
 *
 * Urdu is Mehr Nastaliq Web (CC BY-SA 4.0). Jameel Noori Nastaleeq is not bundled: it has no
 * redistribution licence. Licences and checksums: `assets/fonts/LICENSES.md`.
 */
export const fonts = {
  sans: 'Figtree',
  urdu: 'Mehr Nastaliq Web',
  quran: 'KFGQPC Uthmanic Script HAFS',
} as const;
export type FontToken = keyof typeof fonts;

/**
 * Fallbacks in order, used where a font stack is possible (the web, the console, the catalog).
 * On iOS and Android a family that has not loaded falls back to the system font by itself.
 */
export const fontFallbacks = {
  sans: ['Figtree', 'system-ui', 'sans-serif'],
  urdu: ['Mehr Nastaliq Web', 'Noto Nastaliq Urdu', 'serif'],
  quran: ['KFGQPC Uthmanic Script HAFS', 'serif'],
} as const satisfies Record<FontToken, readonly string[]>;

/** The font token for a script. */
export function fontTokenFor(script: Script): FontToken {
  return script === 'latin' ? 'sans' : script;
}

/** A CSS `font-family` value for a font token: each family name quoted, generic names bare. */
export function fontStack(token: FontToken): string {
  const generic = new Set(['serif', 'sans-serif', 'system-ui', 'monospace']);
  return fontFallbacks[token].map((name) => (generic.has(name) ? name : `"${name}"`)).join(', ');
}

/** Figtree weights the type roles use (and `Text strong`, 700). Only these files ship. */
export const sansWeights = ['400', '500', '600', '700', '800'] as const;
export type SansWeight = (typeof sansWeights)[number];

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

/** Corners (D6, D8 to D13): tags 8, chips and small buttons 12, fields 14, buttons 16, section cards 18, cards 22, dialogs 26, sheets 28. */
export const radii = {
  none: 0,
  sm: 8,
  md: 12,
  field: 14,
  lg: 16,
  section: 18,
  card: 22,
  xl: 24,
  dialog: 26,
  sheet: 28,
  pill: 999,
} as const;
export type RadiusToken = keyof typeof radii;

/**
 * Elevation as `boxShadow` strings, which React Native 0.76+ and React Native Web both support.
 * In dark mode depth is shown with lighter surfaces; the shadow is kept subtle.
 */
export const elevation = {
  none: undefined,
  /** Resting cards (D11): two soft layers in green-black. */
  low: '0px 1px 2px rgba(10, 30, 18, 0.06), 0px 8px 22px rgba(10, 30, 18, 0.07)',
  /** The main button's soft green shadow (D8). */
  medium: '0px 6px 16px rgba(34, 104, 54, 0.22)',
  /** Floating: sheets, the tab bar and map cards. */
  high: '0px 14px 34px rgba(10, 30, 18, 0.18)',
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
  | 'countdown'
  | 'time'
  | 'display'
  | 'title1'
  | 'title2'
  | 'title3'
  | 'bodyLarge'
  | 'body'
  | 'label'
  | 'caption'
  | 'eyebrow'
  | 'quran';

/** The script a piece of text is set in. It decides the font and the line height. */
export type Script = 'latin' | 'urdu' | 'quran';

interface TypeRoleSpec {
  /** Size in dp at text size step 0, for Latin text. */
  size: number;
  weight: '400' | '500' | '600' | '700' | '800';
  letterSpacing: number;
}

/** Type scale (D5). Big times and countdowns are Figtree figures in both languages. */
export const typeRoles: Record<TypeRole, TypeRoleSpec> = {
  countdown: { size: 56, weight: '600', letterSpacing: -1 },
  time: { size: 40, weight: '600', letterSpacing: -0.5 },
  display: { size: 32, weight: '800', letterSpacing: -0.4 },
  title1: { size: 26, weight: '700', letterSpacing: -0.2 },
  title2: { size: 22, weight: '700', letterSpacing: 0 },
  title3: { size: 18, weight: '700', letterSpacing: 0 },
  bodyLarge: { size: 17, weight: '400', letterSpacing: 0 },
  body: { size: 16, weight: '400', letterSpacing: 0 },
  label: { size: 15, weight: '600', letterSpacing: 0 },
  /** 14, not D5's 13: captions stay at the accessibility floor (docs/design/accessibility.md). */
  caption: { size: 14, weight: '500', letterSpacing: 0.1 },
  eyebrow: { size: 12, weight: '700', letterSpacing: 0.8 },
  quran: { size: 28, weight: '400', letterSpacing: 0 },
};

/**
 * Line height as a multiple of the font size. Nastaliq has tall ascenders and deep descenders,
 * so it needs far more room than Latin text (D5: 2.0 to 2.2). Quran text needs the most,
 * because of stacked diacritics.
 */
export const lineHeightRatio: Record<Script, number> = {
  latin: 1.4,
  urdu: 2.1,
  quran: 2.2,
};

/** Nastaliq looks smaller than Figtree at the same size, so Urdu text is set a little larger (D5). */
export const scriptSizeFactor: Record<Script, number> = {
  latin: 1,
  urdu: 1.1,
  quran: 1,
};

export interface TypeStyle {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  fontWeight: '400' | '500' | '600' | '700' | '800';
  letterSpacing: number;
}

/** Resolves a type role for a script at a text size step into concrete React Native text style. */
export function typeStyle(role: TypeRole, script: Script, step: TextSizeStep = 0): TypeStyle {
  const spec = typeRoles[role];
  const scale = textScale[step];
  const fontSize = Math.round(spec.size * scriptSizeFactor[script] * scale);
  return {
    fontFamily: fonts[fontTokenFor(script)],
    fontSize,
    lineHeight: Math.round(fontSize * lineHeightRatio[script]),
    // Nastaliq and Quran fonts have one weight. A synthesised bold looks broken, so emphasise
    // Urdu with size and colour instead.
    fontWeight: script === 'latin' ? spec.weight : '400',
    letterSpacing: script === 'latin' ? spec.letterSpacing : 0,
  };
}
