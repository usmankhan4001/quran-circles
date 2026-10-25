import { StyleSheet, View } from 'react-native';
import { useTheme } from '../theme';
import { radii } from '../tokens';
import { Text } from './Text';

export interface MapPinProps {
  /** The start time shown on the pin, for example "9:30". Never a coordinate. */
  time: string;
  selected?: boolean;
  /** The circle is already running: a small dot before the time. */
  now?: boolean;
  testID?: string;
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  label: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginEnd: 6 },
  tail: { height: 10 },
});

/** A pin on the Nearby map: a white time label with a thin edge; the chosen one fills green and grows. */
export function MapPin({ time, selected, now, testID }: MapPinProps) {
  const theme = useTheme();
  const c = theme.colors;
  return (
    <View testID={testID} style={styles.wrap}>
      <View
        style={[
          styles.label,
          {
            backgroundColor: selected ? c.accent : c.surface,
            borderColor: selected ? c.accent : c.borderStrong,
            paddingHorizontal: selected ? 12 : 10,
            paddingVertical: selected ? 9 : 7,
          },
        ]}
      >
        {now ? <View aria-hidden style={[styles.dot, { backgroundColor: c.danger }]} /> : null}
        <Text
          variant={selected ? 'label' : 'caption'}
          color={selected ? 'textOnAccent' : 'text'}
          direction="ltr"
          lang="en"
          strong
        >
          {time}
        </Text>
      </View>
      <View
        aria-hidden
        style={[
          styles.tail,
          { width: selected ? 2 : 1, backgroundColor: selected ? c.accent : c.borderStrong },
        ]}
      />
    </View>
  );
}
