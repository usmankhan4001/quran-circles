import { StyleSheet, View } from 'react-native';
import { formatNumber } from '../numerals';
import { useTheme } from '../theme';
import { radii, spacing } from '../tokens';
import { Text } from './Text';

export interface SeatMeterProps {
  /** Places already taken. */
  taken: number;
  /** Total places. Leave it out for a session with no limit. */
  capacity?: number | null;
  testID?: string;
}

const styles = StyleSheet.create({
  track: { height: 6, borderRadius: radii.pill, overflow: 'hidden', marginTop: spacing.xs },
  fill: { height: 6, borderRadius: radii.pill },
});

/** How full a session is (D2): a thin bar and the places left. Gold when nearly full. */
export function SeatMeter({ taken, capacity, testID }: SeatMeterProps) {
  const theme = useTheme();
  const c = theme.colors;
  const hasLimit = typeof capacity === 'number' && capacity > 0;
  const left = hasLimit ? Math.max(0, capacity - taken) : 0;
  const ratio = hasLimit ? Math.min(1, taken / capacity) : 0;
  const label = !hasLimit
    ? theme.t('ui.seatsNoLimit')
    : left === 0
      ? theme.t('ui.seatsFull')
      : left === 1
        ? theme.t('ui.seatsLeftOne')
        : theme.t('ui.seatsLeft', { count: formatNumber(left, theme.locale) });
  const tone = left === 0 ? c.danger : ratio >= 0.8 ? c.warning : c.accent;
  return (
    <View testID={testID}>
      <Text
        variant="caption"
        color={!hasLimit ? 'textSecondary' : left === 0 ? 'textDanger' : 'textSecondary'}
      >
        {label}
      </Text>
      {hasLimit ? (
        <View
          role="progressbar"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={capacity}
          aria-valuenow={Math.min(taken, capacity)}
          style={[styles.track, { backgroundColor: c.surfaceMuted }]}
        >
          <View style={[styles.fill, { width: `${ratio * 100}%`, backgroundColor: tone }]} />
        </View>
      ) : null}
    </View>
  );
}
