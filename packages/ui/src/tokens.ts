/**
 * Starting design tokens, taken from the V1 app (tailwind.config.js, index.css).
 * The UI lane owns this file from Wave 2 and extends it with dark mode, high contrast,
 * spacing, radii and elevation. See docs/agents/briefs/ui.md.
 */
export const colors = {
  brand: {
    emerald: '#064e3b',
    gold: '#d4af37',
    parchment: '#fdfcf6',
    slate: '#0f172a',
  },
  emerald: {
    50: '#ecfdf5',
    100: '#d1fae5',
    200: '#a7f3d0',
    800: '#065f46',
    900: '#064e3b',
  },
  slate: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    800: '#1e293b',
    900: '#0f172a',
  },
  white: '#ffffff',
} as const;

export const fonts = {
  sans: 'DM Sans',
  urdu: 'Gulzar',
  quran: 'AlMushaf',
} as const;

/** App-wide text size steps the person can choose in Profile. 1 is the default. */
export const textScale = [1, 1.15, 1.3, 1.5] as const;

/** Minimum touch target in dp (Android guidance; iOS minimum is 44pt). */
export const minTouchTarget = 48;
