import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { spacing } from '../tokens';
import { Text } from './Text';

export interface ScreenHeaderProps {
  title: string;
  /** Muted line above the title: the area, the Hijri date. Western digits. */
  meta?: string;
  /** Small trailing control, such as a profile button. */
  trailing?: ReactNode;
  testID?: string;
}

const styles = StyleSheet.create({
  wrap: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  text: { flex: 1, gap: spacing.xs },
});

/**
 * The top of Home, Nearby and My Journey: a large title on the white page with a muted line above
 * it. There is no coloured band and no decoration.
 */
export function ScreenHeader({ title, meta, trailing, testID }: ScreenHeaderProps) {
  return (
    <View testID={testID} style={styles.wrap}>
      <View style={styles.text}>
        {meta ? (
          <Text variant="caption" color="textMuted">
            {meta}
          </Text>
        ) : null}
        <Text variant="display" heading={1}>
          {title}
        </Text>
      </View>
      {trailing}
    </View>
  );
}
