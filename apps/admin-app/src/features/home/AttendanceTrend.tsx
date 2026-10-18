import { View } from 'react-native';
import type { AdminOccurrence, Session } from '@qc/contracts';
import { Card, Text, radii, spacing, useTheme } from '@qc/ui';
import { useQuery } from '../../api/query';
import { useT } from '../../appearance/AppearanceProvider';
import { useApi } from '../../auth/AuthProvider';
import { dayParts, pkDateOf } from '../../lib/time';

const DAY_MS = 24 * 60 * 60 * 1000;
const BARS = 7;
const BAR_MAX = 48;

/** The last dates that have already started, oldest first, at most seven. */
export function recentDates(items: readonly AdminOccurrence[], now: Date): AdminOccurrence[] {
  return items
    .filter((o) => Date.parse(o.startsAt) <= now.getTime() && o.status !== 'cancelled')
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .slice(-BARS);
}

/**
 * D17 "7-day attendance": the headcount of the session's last seven dates as bars, the latest in
 * emerald. Only counts the coordinator saved are drawn; a date with no count has an empty bar and
 * no number. Hidden when the session has no past dates.
 */
export function AttendanceTrend({ session, now }: { session: Session; now: Date }) {
  const { t, locale, n } = useT();
  const { colors } = useTheme();
  const api = useApi();
  const query = useQuery(async () => {
    const res = await api.adminSessions.occurrences({
      params: { sessionId: session.id },
      query: { from: new Date(now.getTime() - 30 * DAY_MS).toISOString(), limit: 60 },
    });
    return recentDates(res.items, now);
  }, [session.id]);
  // As drawn, the card is always there. Before any date has passed, the last seven days are
  // shown as empty bars with no numbers.
  const found = query.data ?? [];
  const dates: Pick<AdminOccurrence, 'id' | 'startsAt' | 'headcount'>[] =
    found.length > 0
      ? found
      : Array.from({ length: BARS }, (_, i) => ({
          id: `empty-${i}`,
          startsAt: new Date(now.getTime() - (BARS - 1 - i) * DAY_MS).toISOString(),
          headcount: null,
        }));
  const counts = dates.map((o) => o.headcount);
  const known = counts.filter((c): c is number => c !== null);
  const total = known.reduce((a, b) => a + b, 0);
  const top = Math.max(session.registration.capacity ?? 0, ...known, 1);

  return (
    <View testID="today-trend" style={{ gap: spacing.md }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: spacing.sm,
        }}
      >
        <Text variant="body" strong heading={2}>
          {t('admin.home.trendTitle')}
        </Text>
        {known.length > 0 ? (
          <Text testID="today-trend-total" variant="caption" color="textAccent" strong>
            {t('admin.home.trendTotal', { count: n(total) })}
          </Text>
        ) : (
          <Text variant="caption" color="textSecondary">
            {t('admin.home.trendNone')}
          </Text>
        )}
      </View>
      <Card padding="md">
        <View
          role="list"
          style={{
            flexDirection: 'row',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: spacing.sm,
          }}
        >
          {dates.map((o, i) => {
            const last = i === dates.length - 1 && found.length > 0;
            const parts = dayParts(pkDateOf(o.startsAt), locale);
            const value = o.headcount;
            const height = value === null ? 20 : Math.max(20, Math.round((value / top) * BAR_MAX));
            return (
              <View
                key={o.id}
                role="listitem"
                aria-label={
                  value === null
                    ? `${parts.full}: ${t('admin.home.trendNoCount')}`
                    : `${parts.full}: ${t('admin.home.headcount', { count: n(value) })}`
                }
                style={{ flex: 1, alignItems: 'center', gap: spacing.xxs }}
              >
                <Text variant="caption" color={last ? 'textAccent' : 'textMuted'} strong decorative>
                  {value === null ? ' ' : n(value)}
                </Text>
                <View
                  style={{
                    width: '100%',
                    maxWidth: 24,
                    height,
                    borderRadius: radii.sm - 2,
                    backgroundColor: last ? colors.accent : colors.accentSubtle,
                  }}
                />
                <Text
                  variant="caption"
                  color={last ? 'text' : 'textSecondary'}
                  strong={last}
                  decorative
                >
                  {parts.weekday}
                </Text>
              </View>
            );
          })}
        </View>
      </Card>
    </View>
  );
}
