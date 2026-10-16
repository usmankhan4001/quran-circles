import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../theme';
import { elevation, radii, spacing } from '../tokens';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';
import { IconButton } from './IconButton';
import { Text, type TextColor } from './Text';

export type ToastKind = 'info' | 'success' | 'warning' | 'danger';

export interface ToastProps {
  message: string;
  kind?: ToastKind;
  /** An optional action, for example "Undo". A toast with an action does not time out. */
  actionLabel?: string;
  onAction?: () => void;
  /** Called when the person dismisses the toast or it times out. */
  onDismiss?: () => void;
  /** Time before it dismisses itself. Default 6000. 0 keeps it until dismissed. */
  durationMs?: number;
  dismissLabel?: string;
  testID?: string;
}

const icons: Record<ToastKind, IconName> = {
  info: 'info',
  success: 'success',
  warning: 'warning',
  danger: 'error',
};

const textColors: Record<ToastKind, TextColor> = {
  info: 'textOnAccentSubtle',
  success: 'textOnSuccessSubtle',
  warning: 'textOnWarningSubtle',
  danger: 'textOnDangerSubtle',
};

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.lg,
    borderWidth: 2,
    paddingStart: spacing.lg,
    paddingEnd: spacing.xs,
    paddingVertical: spacing.xs,
    minHeight: 56,
  },
  icon: { marginEnd: spacing.md },
  text: { flex: 1, paddingVertical: spacing.sm },
});

export function Toast({
  message,
  kind = 'info',
  actionLabel,
  onAction,
  onDismiss,
  durationMs = 6000,
  dismissLabel,
  testID,
}: ToastProps) {
  const theme = useTheme();
  const c = theme.colors;
  const hasAction = Boolean(actionLabel && onAction);
  useEffect(() => {
    if (!onDismiss || hasAction || durationMs <= 0) return undefined;
    const timer = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(timer);
  }, [onDismiss, hasAction, durationMs, message]);
  const palette = {
    info: { bg: c.accentSubtle, fg: c.textOnAccentSubtle, border: c.accent },
    success: { bg: c.successSubtle, fg: c.textOnSuccessSubtle, border: c.success },
    warning: { bg: c.warningSubtle, fg: c.textOnWarningSubtle, border: c.warning },
    danger: { bg: c.dangerSubtle, fg: c.textOnDangerSubtle, border: c.danger },
  }[kind];
  const textColor = textColors[kind];
  return (
    <View
      testID={testID}
      role={kind === 'danger' ? 'alert' : 'status'}
      aria-live={kind === 'danger' ? 'assertive' : 'polite'}
      style={[
        styles.box,
        { backgroundColor: palette.bg, borderColor: palette.border, boxShadow: elevation.medium },
      ]}
    >
      <View style={styles.icon}>
        <Icon name={icons[kind]} size={24} color={palette.fg} />
      </View>
      <View style={styles.text}>
        <Text variant="body" color={textColor}>
          {message}
        </Text>
      </View>
      {hasAction ? (
        <Button label={actionLabel as string} onPress={onAction} variant="tertiary" />
      ) : null}
      {onDismiss ? (
        <IconButton
          icon="close"
          accessibilityLabel={dismissLabel ?? theme.t('ui.dismiss')}
          onPress={onDismiss}
        />
      ) : null}
    </View>
  );
}
