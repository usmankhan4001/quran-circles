import { StyleSheet, View } from 'react-native';
import { useTheme } from '../theme';
import { spacing } from '../tokens';
import { StarMark } from './StarMark';
import { Text } from './Text';

export interface QuranPortionProps {
  /** For example "Para 12 · Surah Hud". Surah names in words, never "Surah 11, ayah 6". */
  label: string;
  testID?: string;
}

const styles = StyleSheet.create({
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  gap: { marginEnd: 10 },
  text: { flex: 1 },
});

/** One quiet line between hairlines that names the Quran portion, marked by the gilt star. */
export function QuranPortion({ label, testID }: QuranPortionProps) {
  const theme = useTheme();
  return (
    <View testID={testID} style={[styles.line, { borderColor: theme.colors.hairline }]}>
      <View style={styles.gap}>
        <StarMark />
      </View>
      <View style={styles.text}>
        <Text variant="label">{label}</Text>
      </View>
    </View>
  );
}
