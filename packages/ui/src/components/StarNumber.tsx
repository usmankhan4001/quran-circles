import { StyleSheet, View } from 'react-native';
import { formatNumber } from '../numerals';
import { useTheme } from '../theme';
import { Text } from './Text';

export interface StarNumberProps {
  /** The surah, para or ayah number. */
  value: number;
  /** The words a screen reader says, such as "Surah 18". Leave out when the row already says it. */
  accessibilityLabel?: string;
  testID?: string;
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center' },
  square: { position: 'absolute', borderWidth: 1.5 },
  disc: { position: 'absolute' },
});

/**
 * A number inside the eight-point star of the drawings (two squares, one turned): surah and
 * para lists, and the end of an ayah. It grows with the text size so three digits always fit.
 */
export function StarNumber({ value, accessibilityLabel, testID }: StarNumberProps) {
  const theme = useTheme();
  const c = theme.colors;
  const size = Math.round(40 * theme.scale);
  const side = Math.round(size * 0.66);
  const innerDisc = Math.round(size * 0.56);
  const square = [
    styles.square,
    {
      width: side,
      height: side,
      borderColor: c.textAccent,
      backgroundColor: c.accentSubtle,
      borderRadius: 3,
    },
  ];
  return (
    <View
      testID={testID}
      role={accessibilityLabel ? 'img' : undefined}
      aria-label={accessibilityLabel}
      style={[styles.box, { width: size, height: size }]}
    >
      <View aria-hidden style={square} />
      <View aria-hidden style={[square, { transform: [{ rotate: '45deg' }] }]} />
      <View
        aria-hidden
        style={[
          styles.disc,
          {
            width: innerDisc,
            height: innerDisc,
            borderRadius: innerDisc / 2,
            backgroundColor: c.accentSubtle,
            borderWidth: theme.mode === 'highContrast' ? 0 : 1,
            borderColor: c.decoration,
          },
        ]}
      />
      <Text
        variant="eyebrow"
        color="textAccent"
        lang="en"
        direction="ltr"
        strong
        align="center"
        decorative={Boolean(accessibilityLabel)}
      >
        {formatNumber(value, theme.locale)}
      </Text>
    </View>
  );
}
