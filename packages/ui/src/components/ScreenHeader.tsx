import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '../theme';
import { spacing } from '../tokens';
import { Icon } from './Icon';
import { Text } from './Text';

export interface ScreenHeaderProps {
  title: string;
  /** Muted line above the title: the area, the Hijri date. Western digits. */
  meta?: string;
  /** Makes the meta line a button (the area, which opens the area picker). */
  metaAction?: { label: string; onPress: () => void; testID?: string };
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
  metaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 32,
    alignSelf: 'flex-start',
  },
});

/**
 * The top of Home, Nearby and My Journey: a large title on the white page with a muted line above
 * it. There is no coloured band and no decoration.
 */
export function ScreenHeader({ title, meta, metaAction, trailing, testID }: ScreenHeaderProps) {
  const c = useTheme().colors;
  return (
    <View testID={testID} style={styles.wrap}>
      <View style={styles.text}>
        {meta && metaAction ? (
          <Pressable
            role="button"
            aria-label={metaAction.label}
            onPress={metaAction.onPress}
            style={styles.metaButton}
            testID={metaAction.testID}
          >
            <Icon name="pin" size={14} color={c.textMuted} />
            <Text variant="caption" color="textMuted" decorative>
              {meta}
            </Text>
            <Icon name="chevron-down" size={12} color={c.textMuted} />
          </Pressable>
        ) : meta ? (
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
