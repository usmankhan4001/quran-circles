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
    emerald: '#0a6938',
    deep: '#08532c',
    /** The page colour after Isha. */
    night: '#0b1f16',
    /** Emerald tint: chosen pills, tonal buttons, section tags. */
    leaf: '#edf5f0',
    /** Soft surfaces: muted cards, tracks, the search pill. */
    cloud: '#f4f6f5',
    mist: '#e8ecea',
    /** Charcoal: the main call to action on every screen (pill buttons). */
    charcoal: '#111827',
    /** Portion amber. Quran portions, Ramadan and decoration; never body text on white. */
    gilt: '#f59e0b',
    /** Red for unread counts and errors. White text needs the deeper `red[700]`. */
    alert: '#ef4444',
    ink: '#0e1512',
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
  /** The earlier green-black night surfaces. Still used by the admin app and console. */
  nightGreen: {
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
  /**
   * The Quran Circles design system (design system artifact, 25 Oct 2026): mostly white, black-green
   * text, one green accent. `day` is the default look; `night` is only used when the person picks it.
   */
  day: {
    page: '#ffffff',
    fill: '#f4f6f5',
    line: '#e8ecea',
    lineStrong: '#858f8a',
    ink: '#0e1512',
    inkSoft: '#3f4a45',
    inkMuted: '#5e6963',
    green: '#0a6938',
    greenPress: '#08532c',
    greenTint: '#edf5f0',
    onGreenTint: '#08532c',
    gilt: '#b8862b',
    giltInk: '#8a6214',
    giltTint: '#fbf3e2',
    noticeTint: '#fff6e0',
    noticeInk: '#6b4e00',
    careful: '#b3261e',
    carefulPress: '#8f1e18',
    carefulTint: '#fdeeed',
  },
  night: {
    page: '#0b0d0c',
    surface: '#121514',
    raised: '#191d1b',
    fill: '#1a1f1c',
    line: '#242a27',
    lineStrong: '#6f7a75',
    ink: '#eef1ef',
    inkSoft: '#c4ccc8',
    inkMuted: '#a2aca7',
    green: '#4fc386',
    greenPress: '#6fd39c',
    onGreen: '#04210f',
    greenTint: '#142a1e',
    onGreenTint: '#8eddb2',
    gilt: '#e3b85c',
    noticeTint: '#2b2412',
    noticeInk: '#f2cf73',
    careful: '#ff9a8f',
    carefulTint: '#331815',
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
 * Corners (design system): controls (buttons, fields, banners, the segmented control) 12; cards 16;
 * sheets and dialogs 20; chips, tags and counters are pills.
 */
export const radii = {
  none: 0,
  sm: 8,
  md: 12,
  control: 12,
  field: 12,
  lg: 16,
  section: 16,
  card: 16,
  xl: 20,
  dialog: 20,
  sheet: 20,
  pill: 999,
} as const;
export type RadiusToken = keyof typeof radii;

/**
 * Elevation as `boxShadow` strings. The design is flat: cards use a hairline, not a shadow. The
 * bottom sheet is the one thing that floats (`high`). `low` and `medium` stay as names so older
 * screens compile; they draw nothing.
 */
export const elevation = {
  none: undefined,
  low: undefined,
  medium: undefined,
  /** Bottom sheets only. */
  high: '0px -12px 40px rgba(14, 21, 18, 0.10)',
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
  /** Size in dp at step 0 for Urdu, where the design sets it by hand. Default: `size` times `scriptSizeFactor.urdu`. */
  urdu?: number;
  weight: '400' | '500' | '600' | '700' | '800';
  letterSpacing: number;
}

/**
 * Type scale (design system tokens, 25 Oct 2026). English is Plus Jakarta Sans: big, tight titles
 * and calm 400 to 600 elsewhere. The Urdu sizes are the design's `ur-*` styles: body 20, label 19,
 * caption 17, card title 24, title 30.
 */
export const typeRoles: Record<TypeRole, TypeRoleSpec> = {
  countdown: { size: 42, weight: '800', letterSpacing: -0.8 },
  time: { size: 30, weight: '600', letterSpacing: -0.6 },
  display: { size: 28, urdu: 30, weight: '700', letterSpacing: -0.56 },
  title1: { size: 22, urdu: 27, weight: '700', letterSpacing: -0.2 },
  title2: { size: 20, urdu: 26, weight: '700', letterSpacing: 0 },
  title3: { size: 17, urdu: 24, weight: '600', letterSpacing: 0 },
  bodyLarge: { size: 17, urdu: 21, weight: '400', letterSpacing: 0 },
  body: { size: 16, urdu: 20, weight: '400', letterSpacing: 0 },
  label: { size: 15, urdu: 19, weight: '600', letterSpacing: 0 },
  caption: { size: 13, urdu: 17, weight: '500', letterSpacing: 0 },
  eyebrow: { size: 13, urdu: 16, weight: '500', letterSpacing: 0 },
  quran: { size: 30, weight: '400', letterSpacing: 0 },
};

/**
 * Line height as a multiple of the font size. Nastaliq has tall ascenders and deep descenders,
 * so it needs far more room than Latin text (D5: 2.0 to 2.2). Quran text needs the most,
 * because of stacked diacritics.
 */
export const lineHeightRatio: Record<Script, number> = {
  latin: 1.4,
  urdu: 2,
  quran: 2.1,
};

/** Nastaliq looks smaller than the Latin face at the same size, so Urdu text is set larger (D5; 1.1 became 1.25 on 25 Oct 2026 because the Nastaliq read too small on a phone). */
export const scriptSizeFactor: Record<Script, number> = {
  latin: 1,
  urdu: 1.25,
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
  const base =
    script === 'urdu' && spec.urdu !== undefined ? spec.urdu : spec.size * scriptSizeFactor[script];
  const fontSize = Math.round(base * scale * 2) / 2;
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
