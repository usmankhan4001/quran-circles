import { StyleSheet, View } from 'react-native';
import { useTheme } from '../theme';
import { radii, spacing } from '../tokens';
import { Text } from './Text';
import { Touchable } from './Touchable';

export interface SwitchProps {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  testID?: string;
}

const TRACK_W = 56;
const TRACK_H = 32;
const THUMB = 24;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 64,
    paddingVertical: spacing.sm,
  },
  text: { flex: 1, marginEnd: spacing.lg },
  stateColumn: { alignItems: 'center' },
  track: {
    width: TRACK_W,
    height: TRACK_H,
    borderRadius: radii.pill,
    borderWidth: 2,
    padding: 2,
    flexDirection: 'row',
  },
  thumb: { width: THUMB - 4, height: THUMB - 4, borderRadius: radii.pill, marginTop: 1 },
  state: { marginTop: 2 },
});

/**
 * A labelled on/off switch. The whole row is the touch target. The state is also written as
 * "On" or "Off" so it never depends on colour alone. The thumb sits at the start when off and
 * at the end when on, in either direction, because the track is a row.
 */
export function Switch({ label, description, value, onValueChange, disabled, testID }: SwitchProps) {
  const theme = useTheme();
  const c = theme.colors;
  const trackBg = disabled ? c.disabledBackground : value ? c.accent : c.surfaceMuted;
  const trackBorder = disabled ? c.disabledText : value ? c.accent : c.borderStrong;
  const thumb = disabled ? c.disabledText : value ? c.textOnAccent : c.borderStrong;
  return (
    <Touchable
      testID={testID}
      role="switch"
      checked={value}
      disabled={disabled}
      accessibilityLabel={description ? `${label}. ${description}` : label}
      onPress={() => onValueChange(!value)}
      style={styles.row}
    >
      <View style={styles.text}>
        <Text variant="body" color={disabled ? 'disabledText' : 'text'}>
          {label}
        </Text>
        {description ? (
          <Text variant="caption" color={disabled ? 'disabledText' : 'textSecondary'}>
            {description}
          </Text>
        ) : null}
      </View>
      <View style={styles.stateColumn} aria-hidden>
        <View
          testID={testID ? `${testID}-track` : undefined}
          style={[
            styles.track,
            { backgroundColor: trackBg, borderColor: trackBorder, justifyContent: value ? 'flex-end' : 'flex-start' },
          ]}
        >
          <View style={[styles.thumb, { backgroundColor: thumb }]} />
        </View>
        <Text variant="caption" color={disabled ? 'disabledText' : 'textSecondary'} style={styles.state}>
          {value ? theme.t('ui.on') : theme.t('ui.off')}
        </Text>
      </View>
    </Touchable>
  );
}
