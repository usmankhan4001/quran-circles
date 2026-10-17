import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  colors as palette,
  elevation,
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
 * The sidebar is the C2 green (docs/design/redesign-decisions.md, D15): the deep green fading to
 * the night green by day, and the two darkest greens at night.
 */
export function themeVariables(mode: ResolvedTheme): Record<string, string> {
  const vars: Record<string, string> = {};
  const colors: SemanticColors = semanticColors[mode];
  for (const [name, value] of Object.entries(colors)) vars[`--c-${kebab(name)}`] = value;
  const night = mode === 'dark';
  vars['--c-sidebar-from'] = night ? palette.green[900] : palette.brand.deep;
  vars['--c-sidebar-to'] = night ? palette.green[975] : palette.brand.night;
  vars['--c-sidebar-text'] = palette.white;
  vars['--c-on-sidebar-logo'] = palette.brand.deep;
  for (const [name, value] of Object.entries(spacing)) vars[`--space-${name}`] = rem(value);
  for (const [name, value] of Object.entries(radii)) vars[`--radius-${name}`] = `${value}px`;
  vars['--touch-min'] = rem(minTouchTarget);
  vars['--font-sans'] = fontStack(fontFallbacks.sans);
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
  // Resting depth is a soft shadow by day. At night depth comes from lighter surfaces, so cards
  // get a light hairline instead (D11).
  vars['--shadow-low'] = night ? 'none' : (elevation.low ?? 'none');
  vars['--shadow-button'] = night ? 'none' : (elevation.medium ?? 'none');
  vars['--shadow-high'] = night ? 'none' : (elevation.high ?? 'none');
  vars['--card-edge'] = night ? colors.border : 'transparent';
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
