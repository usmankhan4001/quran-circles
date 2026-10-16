import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useColorScheme } from 'react-native';
import type { Locale } from '@qc/contracts';
import { formatNumber, ThemeProvider, type ColorMode, type TextSizeStep } from '@qc/ui';
import { createTranslator, type Translator } from '../i18n/translate';
import type { KeyValueStore } from '../storage/storage';

export type ColorChoice = 'system' | ColorMode;
export const colorChoices: readonly ColorChoice[] = ['system', 'light', 'dark', 'highContrast'];

export interface Appearance {
  locale: Locale;
  textSize: TextSizeStep;
  colorChoice: ColorChoice;
}

export const APPEARANCE_KEY = 'qc.admin.appearance';

interface AppearanceContextValue extends Appearance {
  setLocale: (locale: Locale) => void;
  setTextSize: (size: TextSizeStep) => void;
  setColorChoice: (choice: ColorChoice) => void;
  /** True once saved choices have been read, so the first paint does not flash the defaults. */
  ready: boolean;
}

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

export interface AppearanceProviderProps {
  store: KeyValueStore;
  initial?: Partial<Appearance>;
  /** Skips animations. Tests set it: jsdom never finishes a CSS animation. */
  reduceMotion?: boolean;
  children: ReactNode;
}

function parseSaved(raw: string | null): Partial<Appearance> {
  if (!raw) return {};
  try {
    const data = JSON.parse(raw) as Partial<Appearance>;
    const out: Partial<Appearance> = {};
    if (data.locale === 'en' || data.locale === 'ur') out.locale = data.locale;
    if (data.textSize === 0 || data.textSize === 1 || data.textSize === 2 || data.textSize === 3) {
      out.textSize = data.textSize;
    }
    if (data.colorChoice && (colorChoices as readonly string[]).includes(data.colorChoice)) {
      out.colorChoice = data.colorChoice;
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * Language, text size and colour mode, saved on the device, wrapped around the kit's
 * ThemeProvider (which also sets the layout direction from the language).
 */
export function AppearanceProvider({
  store,
  initial,
  reduceMotion,
  children,
}: AppearanceProviderProps) {
  const [state, setState] = useState<Appearance>({
    locale: initial?.locale ?? 'en',
    textSize: initial?.textSize ?? 0,
    colorChoice: initial?.colorChoice ?? 'system',
  });
  const [ready, setReady] = useState(Boolean(initial));
  const scheme = useColorScheme();

  useEffect(() => {
    if (initial) return;
    let cancelled = false;
    void store.get(APPEARANCE_KEY).then((raw) => {
      if (cancelled) return;
      setState((prev) => ({ ...prev, ...parseSaved(raw) }));
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [store, initial]);

  const update = useCallback(
    (patch: Partial<Appearance>) => {
      setState((prev) => {
        const next = { ...prev, ...patch };
        void store.set(APPEARANCE_KEY, JSON.stringify(next));
        return next;
      });
    },
    [store],
  );

  const value = useMemo<AppearanceContextValue>(
    () => ({
      ...state,
      ready,
      setLocale: (locale) => update({ locale }),
      setTextSize: (textSize) => update({ textSize }),
      setColorChoice: (colorChoice) => update({ colorChoice }),
    }),
    [state, ready, update],
  );

  const mode: ColorMode =
    state.colorChoice === 'system' ? (scheme === 'dark' ? 'dark' : 'light') : state.colorChoice;

  return (
    <AppearanceContext.Provider value={value}>
      <ThemeProvider
        mode={mode}
        locale={state.locale}
        textSize={state.textSize}
        reduceMotion={reduceMotion}
        style={{ flex: 1 }}
      >
        {children}
      </ThemeProvider>
    </AppearanceContext.Provider>
  );
}

export function useAppearance(): AppearanceContextValue {
  const value = useContext(AppearanceContext);
  if (!value) throw new Error('useAppearance must be used inside AppearanceProvider');
  return value;
}

export interface TranslationApi {
  t: Translator;
  locale: Locale;
  /** A number in the language's numerals. */
  n: (value: number | string) => string;
}

/** Strings and numbers in the person's language. Every visible string comes through `t`. */
export function useT(): TranslationApi {
  const { locale } = useAppearance();
  return useMemo(
    () => ({ t: createTranslator(locale), locale, n: (v) => formatNumber(v, locale) }),
    [locale],
  );
}
