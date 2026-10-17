import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../theme';
import { radii, spacing } from '../tokens';
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
  testID?: string;
}

const styles = StyleSheet.create({
  hero: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    borderBottomStartRadius: radii.sheet,
    borderBottomEndRadius: radii.sheet,
  },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 48 },
  grow: { flex: 1 },
  titles: { marginTop: spacing.sm },
  body: { marginTop: spacing.md },
});

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
  testID,
}: HeroHeaderProps) {
  const theme = useTheme();
  const c = theme.colors;
  const hasTop = Boolean(onBack || actions);
  return (
    <View testID={testID} style={[styles.hero, { backgroundColor: c.hero }]}>
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
