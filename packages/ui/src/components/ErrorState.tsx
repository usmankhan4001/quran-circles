import { StyleSheet, View } from 'react-native';
import { useTheme } from '../theme';
import { spacing } from '../tokens';
import { Button } from './Button';
import { Icon } from './Icon';
import { Text } from './Text';

export interface ErrorStateProps {
  /** `offline` is for a missing connection; it uses calmer wording and the same retry. */
  kind?: 'generic' | 'offline';
  title?: string;
  description?: string;
  onRetry?: () => void;
  /** Shows the retry button as busy while the retry runs. */
  retrying?: boolean;
  retryLabel?: string;
  testID?: string;
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', paddingHorizontal: spacing.xl, paddingVertical: spacing.xxl },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  gap: { marginTop: spacing.sm },
  action: { marginTop: spacing.xl },
});

/**
 * Shown when something failed to load. It never blames the person, says what happened in plain
 * words and offers a retry. Announced to screen readers as an alert.
 */
export function ErrorState({ kind = 'generic', title, description, onRetry, retrying, retryLabel, testID }: ErrorStateProps) {
  const theme = useTheme();
  const c = theme.colors;
  const offline = kind === 'offline';
  return (
    <View testID={testID} role="alert" aria-live="assertive" style={styles.box}>
      <View style={[styles.iconWrap, { backgroundColor: offline ? c.warningSubtle : c.dangerSubtle }]}>
        <Icon
          name={offline ? 'warning' : 'error'}
          size={32}
          color={offline ? c.textOnWarningSubtle : c.textOnDangerSubtle}
        />
      </View>
      <Text variant="title3" heading={2} align="center">
        {title ?? theme.t(offline ? 'ui.offlineTitle' : 'ui.errorTitle')}
      </Text>
      <View style={styles.gap}>
        <Text variant="body" color="textSecondary" align="center">
          {description ?? theme.t(offline ? 'ui.offlineBody' : 'ui.errorBody')}
        </Text>
      </View>
      {onRetry ? (
        <View style={styles.action}>
          <Button label={retryLabel ?? theme.t('ui.retry')} onPress={onRetry} loading={retrying} />
        </View>
      ) : null}
    </View>
  );
}
