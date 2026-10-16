import { StyleSheet, View } from 'react-native';
import { useTheme } from '../theme';
import { spacing } from '../tokens';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export interface EmptyStateAction {
  label: string;
  onPress: () => void;
}

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: IconName;
  action?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
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
  actions: { marginTop: spacing.xl, alignSelf: 'stretch', alignItems: 'center' },
  actionGap: { marginTop: spacing.sm },
});

/** Shown when a list or screen has nothing in it yet. It says what is missing and what to do. */
export function EmptyState({
  title,
  description,
  icon = 'info',
  action,
  secondaryAction,
  testID,
}: EmptyStateProps) {
  const theme = useTheme();
  return (
    <View testID={testID} style={styles.box}>
      <View style={[styles.iconWrap, { backgroundColor: theme.colors.accentSubtle }]}>
        <Icon name={icon} size={32} color={theme.colors.textOnAccentSubtle} />
      </View>
      <Text variant="title3" heading={2} align="center">
        {title}
      </Text>
      {description ? (
        <View style={styles.gap}>
          <Text variant="body" color="textSecondary" align="center">
            {description}
          </Text>
        </View>
      ) : null}
      {action || secondaryAction ? (
        <View style={styles.actions}>
          {action ? <Button label={action.label} onPress={action.onPress} /> : null}
          {secondaryAction ? (
            <View style={styles.actionGap}>
              <Button
                label={secondaryAction.label}
                onPress={secondaryAction.onPress}
                variant="tertiary"
              />
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
