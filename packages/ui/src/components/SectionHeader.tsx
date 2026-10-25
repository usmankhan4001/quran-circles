import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { spacing } from '../tokens';
import { Text } from './Text';

export interface SectionHeaderProps {
  title: string;
  /** A control at the far end, such as a "See all" icon button. */
  trailing?: ReactNode;
  testID?: string;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  title: { flex: 1, paddingEnd: spacing.sm },
});

/** The small heading of a section. The space above it comes from the screen's layout. */
export function SectionHeader({ title, trailing, testID }: SectionHeaderProps) {
  return (
    <View testID={testID} style={styles.row}>
      <View style={styles.title}>
        <Text variant="title3" heading={2}>
          {title}
        </Text>
      </View>
      {trailing}
    </View>
  );
}
