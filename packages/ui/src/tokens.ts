/**
 * Design tokens for Quran Circles. The ui lane owns this file (docs/agents/briefs/ui.md).
 *
 * Raw values live here. Components never use raw colours: they read the semantic colours for
 * the current mode from `semantic-colors.ts` through `useTheme()`.
 *
 * Values follow the Iqraa redesign the owner pushed on 2026-10-18 (docs/design/redesign-decisions.md,
 * D17), which replaces the D3 colours and the D8 to D13 shapes.
 */
export const colors = {
  brand: {
    /** Deep emerald: the green header, chosen states, links and the brand (Iqraa redesign). */
    emerald: '#1e563b',
    deep: '#163f2c',
    /** The page colour after Isha. */
    night: '#0b1f16',
    /** Emerald tint: chosen pills, tonal buttons, section tags. */
    leaf: '#e8f5ee',
    /** Soft surfaces: muted cards, tracks, the search pill. */
    cloud: '#f8fafc',
    mist: '#e2e8f0',
    /** Charcoal: the main call to action on every screen (pill buttons). */
    charcoal: '#111827',
    /** Portion amber. Quran portions, Ramadan and decoration; never body text on white. */
    gilt: '#f59e0b',
    /** Red for unread counts and errors. White text needs the deeper `red[700]`. */
    alert: '#ef4444',
    ink: '#111827',
  },
  /** Emerald ramp (style guide: Emerald 50 to 900). */
  green: {
    50: '#f3faf6',
    100: '#e8f5ee',
    200: '#a7f3d0',
    300: '#6ee7b7',
    400: '#34d399',
    500: '#10b981',
    600: '#3b8861',
    700: '#327a56',
    800: '#1e563b',
    900: '#163f2c',
    950: '#0f3022',
    975: '#071a12',
  },
  /** Slate greys, as in the style guide. */
  grey: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    450: '#7d8aa0',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#111827',
  },
  /** Night surfaces, lighter as they rise. */
  night: {
    surface: '#11291e',
    raised: '#163426',
    muted: '#0e241a',
    border: '#24473a',
    text: '#ecf5f0',
    textSecondary: '#c6d8ce',
    textMuted: '#a7bfb2',
  },
  red: {
    50: '#fef2f2',
    100: '#fee2e2',
    300: '#fca5a5',
    600: '#dc2626',
    700: '#b91c1c',
    800: '#991b1b',
    900: '#7f1d1d',
    950: '#450a0a',
  },
  /** Portion amber (style guide: Amber 50 to 700). */
  gold: {
    50: '#fffbeb',
    100: '#fef3c7',
    300: '#fcd34d',
    500: '#f59e0b',
    700: '#b45309',
    800: '#92400e',
    900: '#78350f',
    950: '#451a03',
  },
  white: '#ffffff',
  black: '#000000',
} as const;

/**
 * Font families (D4; Latin changed by D17). Plus Jakarta Sans (SIL OFL 1.1, the Iqraa showcase's
 * Latin face) for Latin text and for every number, a true Nastaliq for Urdu,
 * and a Quranic face for Quran text only. The values are the family names the apps register
 * the bundled files under (`@qc/ui/font-sources`), so they match the fonts' own names.
 *
 * Urdu is Mehr Nastaliq Web (CC BY-SA 4.0). Jameel Noori Nastaleeq is not bundled: it has no
 * redistribution licence. Licences and checksums: `assets/fonts/LICENSES.md`.
 */
export const fonts = {
  sans: 'Plus Jakarta Sans',
  urdu: 'Mehr Nastaliq Web',
  quran: 'KFGQPC Uthmanic Script HAFS',
} as const;
export type FontToken = keyof typeof fonts;

/**
 * Fallbacks in order, used where a font stack is possible (the web, the console, the catalog).
 * On iOS and Android a family that has not loaded falls back to the system font by itself.
 */
export const fontFallbacks = {
  sans: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
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

/** Plus Jakarta Sans weights the type roles use (and `Text strong`, 700). Only these files ship. */
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

/**
 * Corners (D17): tags, chips, buttons and fields are pills; thumbnails 8 and 12; tiles 16;
 * small cards 18; cards 20; dialogs 26; sheets 28.
 */
export const radii = {
  none: 0,
  sm: 8,
  md: 12,
  lg: 16,
  section: 18,
  card: 20,
  xl: 24,
  dialog: 26,
  sheet: 28,
  field: 999,
  pill: 999,
} as const;
export type RadiusToken = keyof typeof radii;

/**
 * Elevation as `boxShadow` strings, which React Native 0.76+ and React Native Web both support.
 * In dark mode depth is shown with lighter surfaces; the shadow is kept subtle.
 */
export const elevation = {
  none: undefined,
  /** Resting cards (D17): a whisper of charcoal under a hairline border. */
  low: '0px 6px 24px -4px rgba(17, 24, 39, 0.06), 0px 1px 2px rgba(17, 24, 39, 0.03)',
  /** Picture cards and the main pill button. */
  medium: '0px 8px 20px -4px rgba(17, 24, 39, 0.14)',
  /** Floating: sheets, the tab dock and map cards. */
  high: '0px 10px 30px rgba(17, 24, 39, 0.12), 0px 1px 3px rgba(17, 24, 39, 0.05)',
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

/** Type scale (D5). Big times and countdowns are Plus Jakarta Sans figures in both languages. */
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

/** Nastaliq looks smaller than the Latin face at the same size, so Urdu text is set a little larger (D5). */
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
