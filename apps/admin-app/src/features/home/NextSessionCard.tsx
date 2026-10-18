import { Pressable, View } from 'react-native';
import type { Session } from '@qc/contracts';
import { Card, Icon, Tag, Text, radii, spacing, useTheme } from '@qc/ui';
import { useAppearance, useT } from '../../appearance/AppearanceProvider';
import { ActionTile } from '../../components/ActionTile';
import { pickLocalized } from '../../lib/localized';
import { formatInstantDate, formatInstantTime, formatLocalTime, isToday } from '../../lib/time';
import { useNavigation } from '../../navigation/NavigationContext';
import { routes } from '../../navigation/routes';
import { sessionAbilities } from '../../scope/principal';
import { useWorkingScope } from '../../scope/WorkingScopeProvider';

export interface NextSessionCardProps {
  session: Session;
  now: Date;
}

/**
 * The big card at the top of Today (layout A): the next session's start time in a tinted block,
 * what and where, the portion being read and how many are coming, and four quick actions
 * (registrants, attendance, post an update, change the time). Each action shows only when the
 * person's role allows it on this session; the server still decides.
 */
export function NextSessionCard({ session: s, now }: NextSessionCardProps) {
  const { t, locale, n } = useT();
  const { textSize } = useAppearance();
  const { colors } = useTheme();
  const nav = useNavigation();
  const { principal } = useWorkingScope();
  const can = sessionAbilities(principal, s);
  const next = s.nextOccurrence;
  const today = next ? isToday(next.startsAt, now) : false;
  const time = next
    ? formatInstantTime(next.startsAt, locale)
    : formatLocalTime(s.localStartTime, locale);
  const day = !next
    ? null
    : today
      ? t('admin.home.todaySection')
      : formatInstantDate(next.startsAt, locale);
  const title = pickLocalized(s.title, locale);
  const place = pickLocalized(s.venue.name, locale);
  const coming = s.registration.seatsTaken;
  const half = textSize >= 2;

  return (
    <Card testID="today-next">
      <View style={{ gap: spacing.md }}>
        <Pressable
          testID={`session-${s.id}`}
          role="button"
          accessibilityLabel={[title, place, day, time].filter(Boolean).join(', ')}
          onPress={() => nav.push(routes.session(s.id))}
          style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}
        >
          <View
            style={{
              minWidth: 68,
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.sm,
              borderRadius: radii.lg,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.accentSubtle,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              testID="today-next-time"
              variant="title2"
              lang="en"
              color="textOnAccentSubtle"
              align="center"
            >
              {time}
            </Text>
            {day ? (
              <Text variant="caption" color="textOnAccentSubtle" align="center">
                {day}
              </Text>
            ) : null}
          </View>
          <View style={{ flex: 1, gap: spacing.xxs }}>
            <Text variant="title3">{title}</Text>
            <Text variant="caption" color="textSecondary">
              {place} · {t(`admin.home.section.${s.section}`)}
            </Text>
            {next?.portionLabel ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.xs,
                  paddingVertical: spacing.xxs,
                  paddingHorizontal: spacing.xs,
                  backgroundColor: colors.accentSubtle,
                  borderRadius: radii.sm,
                  alignSelf: 'flex-start',
                  marginTop: spacing.xxs,
                }}
              >
                <Icon name="book" size={16} color={colors.textAccent} />
                <Text testID="today-next-portion" variant="caption" color="textAccent">
                  {next.portionLabel}
                </Text>
              </View>
            ) : null}
            {s.status === 'draft' ? (
              <View style={{ marginTop: spacing.xxs, alignSelf: 'flex-start' }}>
                <Tag label={t('admin.home.draft')} kind="gilt" />
              </View>
            ) : null}
          </View>
          {coming !== null ? (
            <View style={{ alignItems: 'flex-end', paddingStart: spacing.xs }}>
              <Text testID="today-next-coming" variant="title2" color="textAccent" lang="en">
                {n(coming)}
              </Text>
              <Text variant="caption" color="textSecondary">
                {t('admin.home.coming')}
              </Text>
            </View>
          ) : null}
        </Pressable>

        <View
          testID="today-actions"
          role="group"
          aria-label={t('admin.home.quickActions')}
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: spacing.sm,
            paddingTop: spacing.md,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          {can.seeRegistrants ? (
            <ActionTile
              testID="today-action-registrants"
              icon="people"
              label={t('admin.home.registrants')}
              half={half}
              onPress={() =>
                nav.push(routes.registrants(s.id, today && next ? next.id : undefined))
              }
            />
          ) : null}
          {can.markAttendance && next ? (
            <ActionTile
              testID="today-action-attendance"
              icon="check"
              label={t('admin.home.attendance')}
              half={half}
              onPress={() => nav.push(routes.attendance(s.id, next.id))}
            />
          ) : null}
          {can.postUpdate ? (
            <ActionTile
              testID="today-action-post"
              icon="bell"
              label={t('admin.home.postShort')}
              half={half}
              onPress={() => nav.push(routes.postUpdate(s.id))}
            />
          ) : null}
          {can.changeSchedule ? (
            <ActionTile
              testID="today-action-time"
              icon="clock"
              label={t('admin.home.changeTimeShort')}
              half={half}
              onPress={() => nav.push(routes.schedule(s.id))}
            />
          ) : null}
        </View>
      </View>
    </Card>
  );
}
