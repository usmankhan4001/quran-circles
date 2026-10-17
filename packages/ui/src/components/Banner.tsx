import { StyleSheet, View } from 'react-native';
import { useTheme } from '../theme';
import { spacing } from '../tokens';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';
import { Text, type TextColor } from './Text';

/** D13: grey when offline, gold for a time change, terracotta for an error. */
export type BannerKind = 'offline' | 'change' | 'error';

export interface BannerProps {
  kind: BannerKind;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  testID?: string;
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    minHeight: 48,
  },
  icon: { marginEnd: spacing.md },
  text: { flex: 1 },
});

/** An edge-to-edge message at the top of a screen. Errors are announced at once. */
export function Banner({ kind, title, message, actionLabel, onAction, testID }: BannerProps) {
  const theme = useTheme();
  const c = theme.colors;
  const look: Record<BannerKind, { bg: string; fg: TextColor; icon: IconName }> = {
    offline: { bg: c.surfaceMuted, fg: 'textSecondary', icon: 'info' },
    change: { bg: c.warningSubtle, fg: 'textOnWarningSubtle', icon: 'warning' },
    error: { bg: c.dangerSubtle, fg: 'textOnDangerSubtle', icon: 'error' },
  };
  const l = look[kind];
  return (
    <View
      testID={testID}
      role={kind === 'error' ? 'alert' : 'status'}
      aria-live={kind === 'error' ? 'assertive' : 'polite'}
      style={[styles.bar, { backgroundColor: l.bg }]}
    >
      <View style={styles.icon}>
        <Icon name={l.icon} size={20} color={c[l.fg]} />
      </View>
      <View style={styles.text}>
        <Text variant="label" color={l.fg}>
          {title}
        </Text>
        {message ? (
          <Text variant="caption" color={l.fg}>
            {message}
          </Text>
        ) : null}
      </View>
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} variant="tertiary" />
      ) : null}
    </View>
  );
}
