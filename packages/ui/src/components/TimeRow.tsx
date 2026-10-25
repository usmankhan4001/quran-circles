import { StyleSheet, View, type GestureResponderEvent } from 'react-native';
import { useTheme } from '../theme';
import { spacing } from '../tokens';
import { Icon } from './Icon';
import { Text } from './Text';
import { Touchable } from './Touchable';

export interface TimeRowProps {
  title: string;
  /** Muted line: day, who it is for, distance. */
  subtitle?: string;
  /** The start time, in Western digits and always left to right. */
  time: string;
  onPress?: (event: GestureResponderEvent) => void;
  divider?: boolean;
  accessibilityLabel?: string;
  testID?: string;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 64,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  text: { flex: 1, gap: 2 },
  time: { marginHorizontal: spacing.md },
});

/** A list row for a circle: name, a muted line, the start time and a chevron. Used on Nearby and Home. */
export function TimeRow({
  title,
  subtitle,
  time,
  onPress,
  divider = true,
  accessibilityLabel,
  testID,
}: TimeRowProps) {
  const theme = useTheme();
  const c = theme.colors;
  return (
    <Touchable
      testID={testID}
      role="button"
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      style={[styles.row, { borderBottomColor: divider ? c.hairline : 'transparent' }]}
    >
      <View style={styles.text}>
        <Text variant="title3">{title}</Text>
        {subtitle ? (
          <Text variant="caption" color="textMuted">
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={styles.time}>
        <Text variant="title2" direction="ltr" lang="en" strong>
          {time}
        </Text>
      </View>
      <Icon name="chevron-forward" size={20} color={c.textMuted} />
    </Touchable>
  );
}
