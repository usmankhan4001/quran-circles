import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  colors as palette,
  consoleTagColors,
  consoleFloatShadow,
  fontFallbacks,
  lineHeightRatio,
  minTouchTarget,
  radii,
  scriptSizeFactor,
  semanticColors,
  spacing,
  textScale,
  typeRoles,
  type ColorMode,
  type SemanticColors,
  type TextSizeStep,
} from '../lib/ui-tokens';
import { webStore, type KeyValueStore } from '../lib/storage';

export type ThemeChoice = 'system' | 'light' | 'dark';
export type ResolvedTheme = Extract<ColorMode, 'light' | 'dark'>;

const THEME_KEY = 'qc.console.theme';
const SIZE_KEY = 'qc.console.textSize';

/** `surfaceMuted` becomes `--c-surface-muted`. */
const kebab = (name: string) => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

const GENERIC_FAMILIES = new Set(['system-ui', 'sans-serif', 'serif', 'monospace']);
const fontStack = (names: readonly string[]) =>
  names.map((n) => (GENERIC_FAMILIES.has(n) ? n : `'${n}'`)).join(', ');

const rem = (px: number) => `${px / 16}rem`;

/**
 * Every value the stylesheet uses, as CSS custom properties generated from the shared tokens.
 * The stylesheet and the components hold no raw colours: they read these names only.
 * The sidebar follows D17 (docs/design/redesign-decisions.md): a white rail whose brand block on
 * top is the deep emerald fading to the emerald by day, and the two darkest greens at night.
 */
export function themeVariables(mode: ResolvedTheme): Record<string, string> {
  const vars: Record<string, string> = {};
  const colors: SemanticColors = semanticColors[mode];
  for (const [name, value] of Object.entries(colors)) vars[`--c-${kebab(name)}`] = value;
  // D17: the sidebar is white with a deep emerald brand block on top; these name that block.
  vars['--c-sidebar-from'] = colors.accentPressed;
  vars['--c-sidebar-to'] = colors.accent;
  vars['--c-sidebar-text'] = colors.textOnAccent;
  vars['--c-sidebar-soft'] = palette.green[200];
  vars['--c-on-sidebar-logo'] = colors.accentPressed;
  // The work area: slate cloud by day so white cards stand off it, the night page after Isha.
  vars['--c-page'] = colors.background;
  // The quiet grey fill: the sidebar, table heads, tracks and chips at rest.
  vars['--c-fill'] = colors.surfaceMuted;
  for (const [name, value] of Object.entries(consoleTagColors[mode]))
    vars[`--c-tag-${kebab(name)}`] = value;
  for (const [name, value] of Object.entries(spacing)) vars[`--space-${name}`] = rem(value);
  for (const [name, value] of Object.entries(radii)) vars[`--radius-${name}`] = `${value}px`;
  // The redesign rounds controls to 12, cards to 16 and sheets and dialogs to 20; only chips,
  // tags and counters stay pills.
  Object.assign(vars, {
    '--radius-field': '12px',
    '--radius-md': '12px',
    '--radius-lg': '16px',
    '--radius-section': '16px',
    '--radius-card': '16px',
    '--radius-xl': '16px',
    '--radius-dialog': '20px',
    '--radius-sheet': '20px',
  });
  vars['--touch-min'] = rem(minTouchTarget);
  // Plus Jakarta Sans leads Latin text, as on the showcase (owner override of D17); Urdu keeps
  // the kit's Mehr Nastaliq.
  vars['--font-sans'] = fontStack(
    fontFallbacks.sans[0] === 'Plus Jakarta Sans'
      ? fontFallbacks.sans
      : ['Plus Jakarta Sans', ...fontFallbacks.sans],
  );
  vars['--font-urdu'] = fontStack(fontFallbacks.urdu);
  vars['--font-mono'] = 'ui-monospace, SFMono-Regular, Menlo, monospace';
  for (const [role, spec] of Object.entries(typeRoles)) {
    const name = kebab(role);
    vars[`--type-${name}-size`] = rem(spec.size);
    vars[`--type-${name}-weight`] = spec.weight;
    vars[`--type-${name}-tracking`] = rem(spec.letterSpacing);
  }
  vars['--line-latin'] = String(lineHeightRatio.latin);
  vars['--line-urdu'] = String(lineHeightRatio.urdu);
  vars['--scale-urdu'] = String(scriptSizeFactor.urdu);
  // Flat: cards and buttons use a hairline, not a shadow. Only what floats (dialogs, menus) has one.
  vars['--shadow-low'] = 'none';
  vars['--shadow-button'] = 'none';
  vars['--shadow-high'] = consoleFloatShadow[mode];
  vars['--card-edge'] = colors.border;
  vars['--c-card-outline'] = colors.border;
  return vars;
}

export function resolveTheme(choice: ThemeChoice, systemDark: boolean): ResolvedTheme {
  return choice === 'system' ? (systemDark ? 'dark' : 'light') : choice;
}

export interface Theme {
  choice: ThemeChoice;
  resolved: ResolvedTheme;
  setChoice(choice: ThemeChoice): void;
  textStep: TextSizeStep;
  setTextStep(step: TextSizeStep): void;
}

const ThemeContext = createContext<Theme | null>(null);

const prefersDark = (): boolean => {
  try {
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  } catch {
    return false;
  }
};

const isChoice = (v: string | null): v is ThemeChoice =>
  v === 'system' || v === 'light' || v === 'dark';

export interface ThemeProviderProps {
  children: ReactNode;
  store?: KeyValueStore;
  initialChoice?: ThemeChoice;
  initialTextStep?: TextSizeStep;
}

export function ThemeProvider({
  children,
  store,
  initialChoice,
  initialTextStep,
}: ThemeProviderProps) {
  const kv = useMemo(() => store ?? webStore('local'), [store]);
  const [choice, setChoiceState] = useState<ThemeChoice>(() => {
    if (initialChoice) return initialChoice;
    const saved = kv.get(THEME_KEY);
    return isChoice(saved) ? saved : 'system';
  });
  const [textStep, setTextStepState] = useState<TextSizeStep>(() => {
    if (initialTextStep !== undefined) return initialTextStep;
    const n = Number(kv.get(SIZE_KEY));
    return n === 1 || n === 2 || n === 3 ? n : 0;
  });
  const [systemDark, setSystemDark] = useState(prefersDark);

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const onChange = () => setSystemDark(mq.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  const resolved = resolveTheme(choice, systemDark);

  useEffect(() => {
    const root = document.documentElement;
    for (const [name, value] of Object.entries(themeVariables(resolved)))
      root.style.setProperty(name, value);
    root.dataset.theme = resolved;
    root.style.colorScheme = resolved;
  }, [resolved]);

  // Everything is sized in rem, so the root size is the one text size control.
  useEffect(() => {
    document.documentElement.style.fontSize = `${100 * (textScale[textStep] ?? 1)}%`;
    document.documentElement.dataset.textStep = String(textStep);
  }, [textStep]);

  const setChoice = useCallback(
    (next: ThemeChoice) => {
      setChoiceState(next);
      kv.set(THEME_KEY, next);
    },
    [kv],
  );
  const setTextStep = useCallback(
    (next: TextSizeStep) => {
      setTextStepState(next);
      kv.set(SIZE_KEY, String(next));
    },
    [kv],
  );

  const value = useMemo(
    () => ({ choice, resolved, setChoice, textStep, setTextStep }),
    [choice, resolved, setChoice, textStep, setTextStep],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
