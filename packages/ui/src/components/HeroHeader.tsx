import type { ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useForcedColors } from '../forcedColors';
import { useTheme } from '../theme';
import { radii, spacing } from '../tokens';
import { Icon } from './Icon';
import { IconButton } from './IconButton';
import { Text } from './Text';

export interface HeroHeaderProps {
  /** The screen title. Leave it out when the content (a next-circle card) carries the heading. */
  title?: string;
  /** A short line above the title, such as the area and the Hijri date. */
  eyebrow?: string;
  subtitle?: string;
  onBack?: () => void;
  backLabel?: string;
  /** `IconButton`s with `variant="onHero"`, at the end of the top row. */
  actions?: ReactNode;
  /** At the start of the top row, such as the area picker (D17). */
  leading?: ReactNode;
  /** Content inside the green, under the title: a next-circle card, a switch, a search field. */
  children?: ReactNode;
  /**
   * `fade` (the default, as drawn): the green lightens and fades into the page under the content,
   * so a white card can sit half on it. `rounded`: a solid green block with rounded lower corners,
   * for sheets and short headers.
   */
  shape?: 'fade' | 'rounded';
  /** The faint eight-point pattern behind the title. Off by default since D17. */
  pattern?: boolean;
  testID?: string;
}

const PATTERN_COLS = 9;
const PATTERN_ROWS = 4;
const TILE = 40;

const styles = StyleSheet.create({
  hero: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 48 },
  grow: { flex: 1 },
  titles: { marginTop: spacing.sm, gap: spacing.xxs },
  body: { marginTop: spacing.lg },
  pattern: {
    position: 'absolute',
    top: 0,
    start: 0,
    end: 0,
    height: TILE * PATTERN_ROWS,
    flexDirection: 'row',
    flexWrap: 'wrap',
    overflow: 'hidden',
    opacity: 0.35,
  },
  tile: { width: TILE, height: TILE, alignItems: 'center', justifyContent: 'center' },
});

/** The motif from the drawings: two squares turned to make an eight-point star, tiled. */
function Pattern({ color }: { color: string }) {
  return (
    <View aria-hidden pointerEvents="none" style={styles.pattern} testID="hero-pattern">
      {Array.from({ length: PATTERN_COLS * PATTERN_ROWS }, (_, i) => (
        <View key={i} style={[styles.tile, { opacity: 1 - Math.floor(i / PATTERN_COLS) * 0.25 }]}>
          <Icon name="star" size={18} color={color} />
        </View>
      ))}
    </View>
  );
}

/**
 * The green header that tops the main screens (D12, D14). It holds the title and, under it,
 * whatever the screen leads with. Text on it uses `textOnHero`.
 */
export function HeroHeader({
  title,
  eyebrow,
  subtitle,
  onBack,
  backLabel,
  actions,
  leading,
  children,
  shape = 'fade',
  pattern = false,
  testID,
}: HeroHeaderProps) {
  const theme = useTheme();
  const forced = useForcedColors();
  const c = theme.colors;
  const hasTop = Boolean(onBack || actions || leading);
  // The fade needs a CSS gradient, so it is drawn on the web; native keeps the solid green with
  // rounded corners until the kit gains a gradient view. High contrast keeps solid colours.
  const fade = shape === 'fade' && Platform.OS === 'web' && theme.mode !== 'highContrast';
  const look = fade
    ? {
        backgroundColor: c.hero,
        // D17: deep emerald, through the mid green and a pale green, into the page.
        backgroundImage: `linear-gradient(180deg, ${c.hero} 0%, ${c.heroEnd} 48%, color-mix(in srgb, ${c.heroEnd} 60%, ${c.background}) 78%, ${c.background} 100%)`,
        paddingBottom: spacing.xxl,
      }
    : {
        backgroundColor: c.hero,
        borderBottomStartRadius: radii.sheet,
        borderBottomEndRadius: radii.sheet,
      };
  return (
    <View testID={testID} style={[styles.hero, look]}>
      {/* Decoration only: left out in high contrast and in forced colours, where it would be
          drawn as a grid of solid shapes (A-07). */}
      {pattern && theme.mode !== 'highContrast' && !forced ? <Pattern color={c.heroGlass} /> : null}
      {hasTop ? (
        <View style={styles.row}>
          {onBack ? (
            <IconButton
              icon="chevron-back"
              variant="onHero"
              accessibilityLabel={backLabel ?? theme.t('ui.back')}
              onPress={onBack}
            />
          ) : null}
          {leading}
          <View style={styles.grow} />
          {actions}
        </View>
      ) : null}
      {eyebrow || title || subtitle ? (
        <View style={styles.titles}>
          {eyebrow ? (
            <Text variant="caption" color="textOnHero">
              {eyebrow}
            </Text>
          ) : null}
          {title ? (
            <Text variant="title1" color="textOnHero" heading={1}>
              {title}
            </Text>
          ) : null}
          {subtitle ? (
            <Text variant="body" color="textOnHero">
              {subtitle}
            </Text>
          ) : null}
        </View>
      ) : null}
      {children ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}
