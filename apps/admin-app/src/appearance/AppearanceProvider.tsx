import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Platform, useColorScheme } from 'react-native';
import type { Locale } from '@qc/contracts';
import { formatNumber, ThemeProvider, type ColorMode, type TextSizeStep } from '@qc/ui';
import type { LanguageLoader } from '../i18n/languageLoader';
import { languages as appLanguages } from '../i18n/languages';
import { createTranslator, type Translator } from '../i18n/translate';
import { usePrefetchOtherLanguage, useShownLocale } from '../i18n/useLanguage';
import type { KeyValueStore } from '../storage/storage';

export type ColorChoice = 'system' | ColorMode;
export const colorChoices: readonly ColorChoice[] = ['system', 'light', 'dark', 'highContrast'];

export interface Appearance {
  locale: Locale;
  textSize: TextSizeStep;
  colorChoice: ColorChoice;
}

export const APPEARANCE_KEY = 'qc.admin.appearance';

/** The language `public/boot.js` put on the page (web), else English. */
function pageLocale(): Locale {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return 'en';
  return document.documentElement.lang === 'ur' ? 'ur' : 'en';
}

interface AppearanceContextValue extends Appearance {
  /**
   * Switches once the language's words are in (the web downloads one language at a time).
   * Rejects, changing nothing, when they cannot be had.
   */
  setLocale: (locale: Locale) => Promise<void>;
  setTextSize: (size: TextSizeStep) => void;
  setColorChoice: (choice: ColorChoice) => void;
  /**
   * True once saved choices have been read and the saved language's words are in, so the first
   * paint does not flash the defaults.
   */
  ready: boolean;
}

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

export interface AppearanceProviderProps {
  store: KeyValueStore;
  initial?: Partial<Appearance>;
  /** Skips animations. Tests set it: jsdom never finishes a CSS animation. */
  reduceMotion?: boolean;
  /** Where the languages' words come from. Tests pass one they control. */
  languages?: LanguageLoader;
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
  languages = appLanguages,
  children,
}: AppearanceProviderProps) {
  const [state, setState] = useState<Appearance>({
    // Until the saved choice is read, the page's language: `public/boot.js` set it from the same
    // saved choice and its words are already downloading, so the other language is not fetched
    // for nothing (a phone, and tests, start in English as before).
    locale: initial?.locale ?? pageLocale(),
    textSize: initial?.textSize ?? 0,
    // Light is the default for everyone; the phone's dark setting only when picked.
    colorChoice: initial?.colorChoice ?? 'light',
  });
  const [ready, setReady] = useState(Boolean(initial));
  const scheme = useColorScheme();

  useEffect(() => {
    if (initial) return;
    let cancelled = false;
    void store.get(APPEARANCE_KEY).then(async (raw) => {
      const saved = parseSaved(raw);
      // `public/boot.js` started the saved language's download before the scripts. Without it
      // (offline) the screens fall back to the other language or the keys, rather than never
      // starting.
      await languages.load(saved.locale ?? 'en').catch(() => undefined);
      if (cancelled) return;
      // Nothing saved means English, whatever the page said before the read.
      setState((prev) => ({ ...prev, ...saved, locale: saved.locale ?? 'en' }));
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [store, initial, languages]);

  // The saved language once its words are in.
  const locale = useShownLocale(state.locale, languages);
  usePrefetchOtherLanguage(locale, { loader: languages });

  // The page's language and direction, for screen readers and the browser (A-01). Only once the
  // saved choice is read: until then the page keeps what public/boot.js set from it.
  useEffect(() => {
    if (!ready || Platform.OS !== 'web' || typeof document === 'undefined') return;
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === 'ur' ? 'rtl' : 'ltr';
  }, [ready, locale]);

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
      locale,
      ready,
      setLocale: (next) => languages.load(next).then(() => update({ locale: next })),
      setTextSize: (textSize) => update({ textSize }),
      setColorChoice: (colorChoice) => update({ colorChoice }),
    }),
    [state, locale, ready, update, languages],
  );

  const mode: ColorMode =
    state.colorChoice === 'system' ? (scheme === 'dark' ? 'dark' : 'light') : state.colorChoice;

  return (
    <AppearanceContext.Provider value={value}>
      <ThemeProvider
        mode={mode}
        locale={locale}
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
