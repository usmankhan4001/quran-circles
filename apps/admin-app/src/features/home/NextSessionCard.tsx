import { Pressable, View } from 'react-native';
import type { Session } from '@qc/contracts';
import { Card, Icon, Tag, Text, radii, spacing, useTheme } from '@qc/ui';
import { useAppearance, useT } from '../../appearance/AppearanceProvider';
import { ActionTile } from '../../components/ActionTile';
import { PillButton } from '../../components/PillButton';
import { pickLocalized } from '../../lib/localized';
import { formatInstantDate, formatInstantTime, formatLocalTime, isToday } from '../../lib/time';
import { useNavigation } from '../../navigation/NavigationContext';
import { routes } from '../../navigation/routes';
import { sessionAbilities } from '../../scope/principal';
import { useWorkingScope } from '../../scope/WorkingScopeProvider';
import { posterAbilities } from '../posters/posters';

export interface NextSessionCardProps {
  session: Session;
  now: Date;
}

/**
 * D17: tonight's session as a white card sitting half on the green header. A green status line
 * and the portion in amber, the title, the time and place, a row with how many are coming and the
 * seats, then "Log attendance" (charcoal) and "Registrants" (outline). Each action shows only when
 * the person's role allows it on this session; the server still decides.
 */
export function NextSessionCard({ session: s, now }: NextSessionCardProps) {
  const { t, locale, n } = useT();
  const { colors } = useTheme();
  const nav = useNavigation();
  const { principal, active } = useWorkingScope();
  const can = sessionAbilities(principal, s);
  // The scope pill already names the masjid of a venue coordinator.
  const showPlace = active?.role !== 'venue_coordinator';
  const next = s.nextOccurrence;
  const today = next ? isToday(next.startsAt, now) : false;
  const time = next
    ? formatInstantTime(next.startsAt, locale)
    : formatLocalTime(s.localStartTime, locale);
  const day = next && !today ? formatInstantDate(next.startsAt, locale) : null;
  const status = today ? t('admin.home.todaySection') : t('admin.home.nextSection');
  const title = pickLocalized(s.title, locale);
  const place = pickLocalized(s.venue.name, locale);
  const teacher = s.circle?.teacherName ?? null;
  const coming = s.registration.seatsTaken;
  const capacity = s.registration.capacity;

  return (
    <Card testID="today-next" padding="md">
      <View style={{ gap: spacing.md }}>
        <Pressable
          testID={`session-${s.id}`}
          role="button"
          accessibilityLabel={[status, title, place, day, time].filter(Boolean).join(', ')}
          onPress={() => nav.push(routes.session(s.id))}
          style={{ gap: spacing.xs }}
        >
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: spacing.sm,
            }}
          >
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexShrink: 1 }}
            >
              <Icon name="check-circle" weight="fill" size={14} color={colors.textSuccess} />
              <Text variant="caption" color="textSuccess" strong>
                {status}
              </Text>
              <Text variant="caption" color="textSuccess" decorative>
                ·
              </Text>
              <Text variant="caption" color="textSuccess" strong numberOfLines={1}>
                {t(`admin.home.section.${s.section}`)}
              </Text>
            </View>
            <View style={{ flexShrink: 1 }}>
              {next?.portionLabel ? (
                <Tag testID="today-next-portion" label={next.portionLabel} kind="gilt" />
              ) : (
                <Tag label={t('admin.home.portionNotSet')} kind="gilt" />
              )}
            </View>
          </View>
          <Text variant="title3">{title}</Text>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              columnGap: spacing.xs,
            }}
          >
            <Icon name="clock" size={13} color={colors.textSecondary} />
            {day ? (
              <Text variant="caption" color="textSecondary">
                {`${day} ·`}
              </Text>
            ) : null}
            <Text testID="today-next-time" variant="caption" color="textSecondary" lang="en">
              {time}
            </Text>
            {teacher || showPlace ? (
              <Text variant="caption" color="textSecondary">
                {`· ${teacher ?? place}`}
              </Text>
            ) : null}
          </View>
          {s.status === 'draft' ? (
            <View style={{ marginTop: spacing.xxs }}>
              <Tag label={t('admin.home.draft')} kind="neutral" />
            </View>
          ) : null}
        </Pressable>

        {/* Always drawn, as in the artboard; a value the server does not give is left out. */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: spacing.sm,
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.md,
            borderRadius: radii.md,
            borderWidth: 1,
            borderColor: colors.hairline,
            backgroundColor: colors.surfaceMuted,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            <Icon name="users-three" weight="duotone" size={15} color={colors.textAccent} />
            {coming !== null ? (
              <Text
                testID="today-next-coming"
                variant="caption"
                color="textAccent"
                strong
                lang="en"
              >
                {n(coming)}
              </Text>
            ) : null}
            <Text variant="caption" color="textAccent" strong>
              {coming !== null ? t('admin.home.coming') : t('admin.home.registrants')}
            </Text>
          </View>
          <Text variant="caption" color="textSecondary">
            {capacity !== null
              ? t('admin.home.capacity', { count: n(capacity) })
              : t('admin.home.noLimit')}
          </Text>
        </View>

        {(can.markAttendance && next) || can.seeRegistrants ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {can.markAttendance && next ? (
              <View style={{ flexGrow: 1.15, flexBasis: 120 }}>
                <PillButton
                  testID="today-action-attendance"
                  icon="clipboard-text"
                  iconWeight="fill"
                  label={t('admin.home.logAttendance')}
                  tone="charcoal"
                  onPress={() => nav.push(routes.attendance(s.id, next.id))}
                />
              </View>
            ) : null}
            {can.seeRegistrants ? (
              <View style={{ flexGrow: 1, flexBasis: 110 }}>
                <PillButton
                  testID="today-action-registrants"
                  icon="users-three"
                  label={
                    coming !== null
                      ? t('admin.home.registrantsCount', { count: n(coming) })
                      : t('admin.home.registrants')
                  }
                  onPress={() =>
                    nav.push(routes.registrants(s.id, today && next ? next.id : undefined))
                  }
                />
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </Card>
  );
}

/**
 * D17: the quick actions for the next session, as two-by-two tiles under its card. Every line
 * under a label says something true now (the portion, the weekly time); none is a made-up count.
 */
export function QuickActions({ session: s }: { session: Session }) {
  const { t, locale } = useT();
  const { textSize } = useAppearance();
  const nav = useNavigation();
  const { principal } = useWorkingScope();
  const can = sessionAbilities(principal, s);
  const posters = posterAbilities(principal, s);
  const next = s.nextOccurrence;
  const wide = textSize >= 2;
  const tiles = [
    can.markAttendance && next ? (
      <ActionTile
        key="attendance"
        testID="today-tile-attendance"
        icon="clipboard-text"
        label={t('admin.home.attendance')}
        sub={`${formatInstantDate(next.startsAt, locale)} · ${formatInstantTime(next.startsAt, locale)}`}
        wide={wide}
        onPress={() => nav.push(routes.attendance(s.id, next.id))}
      />
    ) : null,
    can.editOccurrence && next ? (
      <ActionTile
        key="portion"
        testID="today-action-portion"
        icon="book-open-text"
        label={t('admin.home.setPortion')}
        sub={next.portionLabel ?? t('admin.home.portionNotSet')}
        wide={wide}
        onPress={() => nav.push(routes.occurrence(s.id, next.id))}
      />
    ) : null,
    can.postUpdate ? (
      <ActionTile
        key="post"
        testID="today-action-post"
        icon="megaphone"
        label={t('admin.home.postShort')}
        sub={t('admin.home.postSub')}
        wide={wide}
        onPress={() => nav.push(routes.postUpdate(s.id))}
      />
    ) : null,
    posters.read ? (
      <ActionTile
        key="posters"
        testID="today-action-posters"
        icon="qr-code"
        label={t('admin.home.qrPoster')}
        sub={t('admin.home.postersSub')}
        wide={wide}
        onPress={() => nav.push(routes.posters(s.id))}
      />
    ) : null,
  ].filter(Boolean);
  if (tiles.length === 0) return null;
  return (
    <View style={{ gap: spacing.md }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: spacing.sm,
        }}
      >
        <Text variant="body" strong heading={2}>
          {t('admin.home.quickActions')}
        </Text>
        <Text variant="caption" color="textSecondary">
          {t('admin.home.tools')}
        </Text>
      </View>
      <View
        testID="today-actions"
        role="group"
        aria-label={t('admin.home.quickActions')}
        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}
      >
        {tiles}
      </View>
    </View>
  );
}
