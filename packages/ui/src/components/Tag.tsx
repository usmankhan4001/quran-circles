import { StyleSheet, View } from 'react-native';
import type { SemanticColors } from '../semantic-colors';
import { useTheme } from '../theme';
import { radii, spacing } from '../tokens';
import { Text, type TextColor } from './Text';

/**
 * D7, D11: `ok` leaf for good news, `gilt` for Quran and time changes, `alert` for problems,
 * `neutral` for drafts and quiet facts, `strong` solid green.
 */
export type TagKind = 'ok' | 'gilt' | 'alert' | 'neutral' | 'strong';

export interface TagProps {
  label: string;
  kind?: TagKind;
  testID?: string;
}

const styles = StyleSheet.create({
  tag: {
    alignSelf: 'flex-start',
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
});

const look: Record<TagKind, { bg: keyof SemanticColors; fg: TextColor }> = {
  ok: { bg: 'accentSubtle', fg: 'textOnAccentSubtle' },
  gilt: { bg: 'warningSubtle', fg: 'textOnWarningSubtle' },
  alert: { bg: 'dangerSubtle', fg: 'textOnDangerSubtle' },
  neutral: { bg: 'surfaceMuted', fg: 'textSecondary' },
  strong: { bg: 'accent', fg: 'textOnAccent' },
};

/** A short status label, such as "Full", "Time changed" or "Draft". Not a button. */
export function Tag({ label, kind = 'ok', testID }: TagProps) {
  const theme = useTheme();
  const l = look[kind];
  return (
    <View testID={testID} style={[styles.tag, { backgroundColor: theme.colors[l.bg] }]}>
      <Text variant="caption" color={l.fg} strong>
        {label}
      </Text>
    </View>
  );
}
