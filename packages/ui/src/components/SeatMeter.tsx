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
  top: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  track: {
    height: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    overflow: 'hidden',
    marginTop: spacing.xs + spacing.xxs,
  },
  fill: { height: '100%', borderRadius: radii.pill },
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
  const tone = left === 0 ? c.danger : ratio >= 0.8 ? c.progressWarn : c.progress;
  // D17: the places left in green (amber when nearly full) on the start side, taken / capacity
  // on the end side.
  const labelColor = !hasLimit
    ? 'textSecondary'
    : left === 0
      ? 'textDanger'
      : ratio >= 0.8
        ? 'textWarning'
        : 'textSuccess';
  return (
    <View testID={testID}>
      <View style={styles.top}>
        <Text variant="caption" color={labelColor} strong={hasLimit}>
          {label}
        </Text>
        {hasLimit ? (
          <Text variant="caption" color="textMuted" lang="en" direction="ltr" decorative>
            {`${formatNumber(Math.min(taken, capacity), theme.locale)} / ${formatNumber(capacity, theme.locale)}`}
          </Text>
        ) : null}
      </View>
      {hasLimit ? (
        <View
          role="progressbar"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={capacity}
          aria-valuenow={Math.min(taken, capacity)}
          style={[styles.track, { backgroundColor: c.border, borderColor: c.border }]}
        >
          <View style={[styles.fill, { width: `${ratio * 100}%`, backgroundColor: tone }]} />
        </View>
      ) : null}
    </View>
  );
}
