import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { directionForLocale, type Direction, type Locale } from './direction';
import { t as translate, type UiMessageKey } from './i18n';
import { semanticColors, type ColorMode, type SemanticColors } from './semantic-colors';
import {
  textScale,
  typeStyle,
  type Script,
  type TextSizeStep,
  type TypeRole,
  type TypeStyle,
} from './tokens';

export interface Theme {
  mode: ColorMode;
  locale: Locale;
  direction: Direction;
  textSize: TextSizeStep;
  /** The multiplier for the chosen text size step. */
  scale: number;
  colors: SemanticColors;
  reduceMotion: boolean;
  /** The script text is set in by default: Urdu in Urdu mode, Latin otherwise. */
  script: Script;
  /** Resolves a type role into a text style for the theme, or for a given script. */
  type: (role: TypeRole, script?: Script) => TypeStyle;
  /** Built-in strings of the kit, in the theme's locale. */
  t: (key: UiMessageKey, params?: Record<string, string | number>) => string;
}

export interface ThemeOptions {
  mode?: ColorMode;
  locale?: Locale;
  /** Defaults to the locale's direction. Pass it to test a mismatch. */
  direction?: Direction;
  textSize?: TextSizeStep;
  reduceMotion?: boolean;
}

export function createTheme(options: ThemeOptions = {}): Theme {
  const mode = options.mode ?? 'light';
  const locale = options.locale ?? 'en';
  const direction = options.direction ?? directionForLocale(locale);
  const textSize = options.textSize ?? 0;
  const script: Script = locale === 'ur' ? 'urdu' : 'latin';
  return {
    mode,
    locale,
    direction,
    textSize,
    scale: textScale[textSize],
    colors: semanticColors[mode],
    reduceMotion: options.reduceMotion ?? false,
    script,
    type: (role, s) => typeStyle(role, s ?? script, textSize),
    t: (key, params) => translate(locale, key, params),
  };
}

const ThemeContext = createContext<Theme>(createTheme());

export interface ThemeProviderProps extends ThemeOptions {
  children: ReactNode;
  /** Style for the wrapping view. The default fills nothing: pass `{ flex: 1 }` at the app root. */
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Carries colour mode, language, direction and text size. Put it once at the root of an app.
 * It also sets the layout direction of everything below it, so `flexDirection: 'row'` and the
 * logical `*Start` and `*End` styles mirror.
 */
export function ThemeProvider({
  children,
  style,
  testID,
  mode,
  locale,
  direction,
  textSize,
  reduceMotion,
}: ThemeProviderProps) {
  const theme = useMemo(
    () => createTheme({ mode, locale, direction, textSize, reduceMotion }),
    [mode, locale, direction, textSize, reduceMotion],
  );
  // `dir` is read by the web target and ignored on native, where `direction` in the style is used.
  const webDir = { dir: theme.direction };
  return (
    <ThemeContext.Provider value={theme}>
      <View
        testID={testID}
        {...webDir}
        style={[{ direction: theme.direction, backgroundColor: theme.colors.background }, style]}
      >
        {children}
      </View>
    </ThemeContext.Provider>
  );
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
