import { StyleSheet, View } from 'react-native';
import { useTheme } from '../theme';

export interface StarMarkProps {
  /** Size in dp before the text size is applied. Default 16. */
  size?: number;
  testID?: string;
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center' },
  square: { position: 'absolute' },
});

/**
 * The small solid eight-point star in gilt. It marks Quran content (the portion line, empty
 * states) and nothing else: never a pattern, never a background, never on a button. It is two
 * squares, one turned 45 degrees, so it needs no image file.
 */
export function StarMark({ size = 16, testID }: StarMarkProps) {
  const theme = useTheme();
  const px = Math.round(size * theme.scale);
  const inner = Math.round(px * 0.72);
  const fill = { backgroundColor: theme.colors.decoration, width: inner, height: inner };
  return (
    <View aria-hidden testID={testID} style={[styles.box, { width: px, height: px }]}>
      <View style={[styles.square, fill]} />
      <View style={[styles.square, fill, { transform: [{ rotate: '45deg' }] }]} />
    </View>
  );
}
