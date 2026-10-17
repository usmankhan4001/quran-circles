import type { ReactNode } from 'react';
import { Text as RNText, type StyleProp, type TextStyle } from 'react-native';
import { directionForLocale, textAlignStart, type Direction } from '../direction';
import type { SemanticColors } from '../semantic-colors';
import { useTheme } from '../theme';
import type { TypeRole } from '../tokens';

export type TextColor = Extract<keyof SemanticColors, `text${string}` | 'disabledText'>;
export type TextLang = 'en' | 'ur' | 'ar';

export interface TextProps {
  children: ReactNode;
  /** The type role. `quran` is for Quran text only and uses the Quran font (KFGQPC). */
  variant?: TypeRole;
  color?: TextColor;
  /**
   * The language of this text when it differs from the screen, for example an English venue
   * name inside an Urdu screen. It picks the font and the reading direction.
   */
  lang?: TextLang;
  /** Reading direction override. `auto` lets the first strong character decide. */
  direction?: Direction | 'auto';
  /** Alignment relative to the text's own direction. Default `start`. */
  align?: 'start' | 'center' | 'end';
  /** Bold. Applies to Latin text only: Urdu and Quran fonts have one weight, so it is ignored. */
  strong?: boolean;
  /** Marks this text as a heading for screen readers. */
  heading?: 1 | 2 | 3;
  numberOfLines?: number;
  selectable?: boolean;
  /** Hides the text from screen readers when something else already announces it. */
  decorative?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<TextStyle>;
  testID?: string;
}

function dirOf(lang: TextLang | undefined, fallback: Direction): Direction {
  if (!lang) return fallback;
  return directionForLocale(lang);
}

/**
 * The only way to show text. It applies the type role, the right font for the script, the
 * line height that script needs, the chosen text size, the colour and the reading direction.
 */
export function Text({
  children,
  variant = 'body',
  color = 'text',
  lang,
  direction,
  align = 'start',
  heading,
  strong,
  numberOfLines,
  selectable,
  decorative,
  accessibilityLabel,
  style,
  testID,
}: TextProps) {
  const theme = useTheme();
  const isQuran = variant === 'quran' || lang === 'ar';
  const script = isQuran
    ? 'quran'
    : lang === 'ur'
      ? 'urdu'
      : lang === 'en'
        ? 'latin'
        : theme.script;
  const role: TypeRole = variant === 'quran' && lang !== 'ar' ? 'quran' : variant;
  const resolvedDir: Direction | 'auto' =
    direction ?? (isQuran ? 'rtl' : dirOf(lang, theme.direction));
  const type = theme.type(role, script);
  const alignStart: TextStyle['textAlign'] =
    resolvedDir === 'auto' ? undefined : textAlignStart(resolvedDir);
  let textAlign: TextStyle['textAlign'];
  if (align === 'center') textAlign = 'center';
  else if (resolvedDir === 'auto') textAlign = 'auto';
  else if (align === 'start') textAlign = alignStart;
  else textAlign = textAlignStart(resolvedDir === 'rtl' ? 'ltr' : 'rtl');
  const web = {
    dir: resolvedDir,
    ...(heading ? { 'aria-level': heading } : {}),
    ...(lang ? { lang } : {}),
  };
  return (
    <RNText
      testID={testID}
      {...web}
      role={heading ? 'heading' : undefined}
      aria-label={accessibilityLabel}
      aria-hidden={decorative ? true : undefined}
      numberOfLines={numberOfLines}
      selectable={selectable}
      style={[
        type,
        strong && script === 'latin' ? { fontWeight: '700' } : undefined,
        {
          color: theme.colors[color],
          textAlign,
          writingDirection: resolvedDir === 'auto' ? 'auto' : resolvedDir,
        },
        style,
      ]}
    >
      {children}
    </RNText>
  );
}
