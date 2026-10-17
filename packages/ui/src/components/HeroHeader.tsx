import type { ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
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
  /** Content inside the green, under the title: a next-circle card, a switch, a search field. */
  children?: ReactNode;
  /**
   * `fade` (the default, as drawn): the green lightens and fades into the page under the content,
   * so a white card can sit half on it. `rounded`: a solid green block with rounded lower corners,
   * for sheets and short headers.
   */
  shape?: 'fade' | 'rounded';
  /** The faint eight-point pattern behind the title. On by default. */
  pattern?: boolean;
  testID?: string;
}

const PATTERN_COLS = 9;
const PATTERN_ROWS = 4;
const TILE = 40;

const styles = StyleSheet.create({
  hero: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 48 },
  grow: { flex: 1 },
  titles: { marginTop: spacing.sm },
  body: { marginTop: spacing.md },
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
  children,
  shape = 'fade',
  pattern = true,
  testID,
}: HeroHeaderProps) {
  const theme = useTheme();
  const c = theme.colors;
  const hasTop = Boolean(onBack || actions);
  // The fade needs a CSS gradient, so it is drawn on the web; native keeps the solid green with
  // rounded corners until the kit gains a gradient view. High contrast keeps solid colours.
  const fade = shape === 'fade' && Platform.OS === 'web' && theme.mode !== 'highContrast';
  const look = fade
    ? {
        backgroundColor: c.hero,
        backgroundImage: `linear-gradient(180deg, ${c.hero} 0%, ${c.hero} 40%, ${c.heroEnd} 72%, ${c.background} 100%)`,
        paddingBottom: spacing.xxl,
      }
    : {
        backgroundColor: c.hero,
        borderBottomStartRadius: radii.sheet,
        borderBottomEndRadius: radii.sheet,
      };
  return (
    <View testID={testID} style={[styles.hero, look]}>
      {pattern && theme.mode !== 'highContrast' ? <Pattern color={c.heroGlass} /> : null}
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
