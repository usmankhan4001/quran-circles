import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, spacing } from '@qc/ui';

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  title: { flex: 1 },
});

/** A titled block of a screen. */
export function Section({
  title,
  action,
  children,
  testID,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  testID?: string;
}) {
  return (
    <View style={styles.section} testID={testID}>
      <View style={styles.head}>
        <View style={styles.title}>
          <Text variant="title3" heading={2}>
            {title}
          </Text>
        </View>
        {action}
      </View>
      {children}
    </View>
  );
}
