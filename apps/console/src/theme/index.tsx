import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  fonts,
  minTouchTarget,
  radii,
  semanticColors,
  spacing,
  textScale,
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

export function themeVariables(mode: ResolvedTheme): Record<string, string> {
  const vars: Record<string, string> = {};
  const colors: SemanticColors = semanticColors[mode];
  for (const [name, value] of Object.entries(colors)) vars[`--c-${kebab(name)}`] = value;
  for (const [name, value] of Object.entries(spacing)) vars[`--space-${name}`] = `${value / 16}rem`;
  for (const [name, value] of Object.entries(radii)) vars[`--radius-${name}`] = `${value}px`;
  vars['--touch-min'] = `${minTouchTarget / 16}rem`;
  vars['--font-sans'] = `'${fonts.sans}', system-ui, -apple-system, 'Segoe UI', sans-serif`;
  vars['--font-urdu'] = `'${fonts.urdu}', 'Noto Nastaliq Urdu', 'Noto Naskh Arabic', serif`;
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
