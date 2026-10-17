import { Pressable } from 'react-native';
import { minTouchTarget, radii, useTheme } from '@qc/ui';
import { Glyph, type GlyphName } from './glyphs';

export interface RoundButtonProps {
  glyph: GlyphName;
  /** Required: an icon alone has no name. Use the person's name here, never a number. */
  accessibilityLabel: string;
  onPress: () => void;
  testID?: string;
}

/**
 * A round tinted button with a drawn icon, for call and message on a person's row.
 * TODO(kit): replace with @qc/ui IconButton once it takes the kit's phone and chat icons.
 */
export function RoundButton({ glyph, accessibilityLabel, onPress, testID }: RoundButtonProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      role="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => ({
        width: minTouchTarget,
        height: minTouchTarget,
        borderRadius: radii.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? colors.accent : colors.accentSubtle,
      })}
    >
      {({ pressed }) => (
        <Glyph name={glyph} color={pressed ? colors.textOnAccent : colors.accent} size={22} />
      )}
    </Pressable>
  );
}
