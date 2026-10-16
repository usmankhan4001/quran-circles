import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../theme';
import { minTouchTarget, spacing } from '../tokens';
import { IconButton } from './IconButton';
import { Text } from './Text';

export interface HeaderProps {
  title: string;
  subtitle?: string;
  /** Shows a back button. It points the right way in both directions. */
  onBack?: () => void;
  backLabel?: string;
  /** Buttons at the end of the bar, usually `IconButton`s. */
  actions?: ReactNode;
  /** `large` sets the title bigger on its own line, for the top of a tab. */
  variant?: 'regular' | 'large';
  testID?: string;
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: minTouchTarget + spacing.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
  },
  spacer: { width: spacing.md },
  titles: { flex: 1, paddingHorizontal: spacing.md },
  actions: { flexDirection: 'row', alignItems: 'center' },
});

export function Header({ title, subtitle, onBack, backLabel, actions, variant = 'regular', testID }: HeaderProps) {
  const theme = useTheme();
  const c = theme.colors;
  return (
    <View
      testID={testID}
      role="banner"
      style={[styles.bar, { backgroundColor: c.surface, borderBottomColor: c.border }]}
    >
      {onBack ? (
        <IconButton icon="chevron-back" accessibilityLabel={backLabel ?? theme.t('ui.back')} onPress={onBack} />
      ) : (
        <View style={styles.spacer} />
      )}
      <View style={styles.titles}>
        <Text variant={variant === 'large' ? 'title1' : 'title3'} heading={1} numberOfLines={variant === 'large' ? 2 : 1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" color="textSecondary" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {actions ? <View style={styles.actions}>{actions}</View> : null}
    </View>
  );
}
