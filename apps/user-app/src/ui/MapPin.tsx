import { StyleSheet, View } from 'react-native';
import { Text, elevation, formatNumber, useTheme } from '@qc/ui';

export interface MapPinProps {
  /** How many circles are at this place. One shows a plain dot. */
  count?: number;
  /** The chosen pin is drawn larger, with a gold ring. */
  selected?: boolean;
  size?: number;
  testID?: string;
}

const s = StyleSheet.create({
  wrap: { alignItems: 'center' },
  head: { alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute' },
});

/**
 * A green map pin (N2, H4): a round head with a point, and the number of circles at the place
 * when there are more than one. Decoration: the place's name and count are written next to it.
 * TODO(kit): replace with the @qc/ui map pin when the ui lane builds it.
 */
export function MapPin({ count = 1, selected = false, size = 32, testID }: MapPinProps) {
  const theme = useTheme();
  const c = theme.colors;
  const head = selected ? size * 1.2 : size;
  const point = head * 0.32;
  return (
    <View aria-hidden testID={testID} style={s.wrap}>
      <View
        style={[
          s.head,
          {
            width: head,
            height: head,
            borderRadius: head,
            backgroundColor: c.hero,
            borderWidth: selected ? 3 : 2,
            borderColor: selected ? c.decoration : c.textOnHero,
            boxShadow: theme.mode === 'light' ? elevation.medium : undefined,
          },
        ]}
      >
        {count > 1 ? (
          <Text variant="caption" color="textOnHero" strong decorative>
            {formatNumber(count, theme.locale)}
          </Text>
        ) : (
          <View
            style={{
              width: head * 0.3,
              height: head * 0.3,
              borderRadius: head,
              backgroundColor: c.textOnHero,
            }}
          />
        )}
      </View>
      <View
        style={{
          width: 0,
          height: 0,
          marginTop: -2,
          borderLeftWidth: point / 2,
          borderRightWidth: point / 2,
          borderTopWidth: point,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderTopColor: c.hero,
        }}
      />
    </View>
  );
}
