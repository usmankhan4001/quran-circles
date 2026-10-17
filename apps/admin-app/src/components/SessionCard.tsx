import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Card, Icon, Text, spacing, useTheme } from '@qc/ui';

export interface SessionCardProps {
  title: string;
  /** Venue and time, already in the reader's language. */
  detail: string;
  tag?: ReactNode;
  onPress: () => void;
  testID?: string;
}

/**
 * A tappable session in a list: the title, where and when, a tag, and an arrow that points the
 * right way in both directions.
 * TODO(kit): replace with @qc/ui SessionCard.
 */
export function SessionCard({ title, detail, tag, onPress, testID }: SessionCardProps) {
  const { colors } = useTheme();
  return (
    <Card testID={testID} onPress={onPress} accessibilityLabel={`${title}, ${detail}`}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Text variant="label">{title}</Text>
          <Text variant="caption" color="textSecondary">
            {detail}
          </Text>
          {tag}
        </View>
        <Icon name="chevron-forward" size={20} color={colors.textSecondary} />
      </View>
    </Card>
  );
}
