import { View } from 'react-native';
import { radii, useTheme } from '@qc/ui';

/**
 * A thin bar showing how full a session is. Decoration only: the numbers are written beside it.
 * TODO(kit): replace with @qc/ui SeatMeter.
 */
export function SeatMeter({ taken, capacity }: { taken: number; capacity: number }) {
  const { colors } = useTheme();
  const ratio = capacity > 0 ? Math.min(1, Math.max(0, taken / capacity)) : 0;
  return (
    <View
      aria-hidden
      testID="seat-meter"
      style={{
        height: 8,
        borderRadius: radii.pill,
        backgroundColor: colors.surfaceMuted,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          width: `${Math.round(ratio * 100)}%`,
          height: 8,
          borderRadius: radii.pill,
          backgroundColor: ratio >= 1 ? colors.warning : colors.accent,
        }}
      />
    </View>
  );
}
