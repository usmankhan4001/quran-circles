import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, Text, spacing } from '@qc/ui';

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  title: { flex: 1 },
  inner: { gap: spacing.md },
});

/** A titled block of a screen. With `card` the content sits in a raised card (D11). */
export function Section({
  title,
  action,
  card,
  children,
  testID,
}: {
  title: string;
  action?: ReactNode;
  card?: boolean;
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
      {card ? (
        <Card>
          <View style={styles.inner}>{children}</View>
        </Card>
      ) : (
        children
      )}
    </View>
  );
}
