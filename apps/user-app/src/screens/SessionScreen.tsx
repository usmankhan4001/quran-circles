import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  Banner,
  Button,
  Card,
  Icon,
  SeatMeter,
  Tag,
  Text,
  initialsOf,
  minTouchTarget,
  radii,
  spacing,
  useTheme,
} from '@qc/ui';
import type { Registration, Session, Occurrence } from '@qc/contracts';
import { distanceParts, haversineMetres } from '../core/distance';
import { IconTile } from '../components/IconTile';
import { useOrigin } from '../features/nearby/useOrigin';
import { useAreas } from '../features/places/usePlaces';
import { registerState } from '../features/session/registerState';
import { FacilityChips } from '../components/FacilitiesChecklist';
import { QueryBoundary } from '../components/QueryBoundary';
import { ScreenFrame } from '../components/ScreenFrame';
import { useRequireAuth } from '../features/auth/useRequireAuth';
import { toInstant } from '../features/home/useHome';
import { useMyRegistrations } from '../features/journey/hooks';
import { describeOccurrence, describeSchedule } from '../features/nearby/schedule';
import { useSession, useSessionOccurrences, useVenue } from '../features/nearby/useSessions';
import { safeWebUrl, venueMapUrl, venuePhoneUrl } from '../features/session/links';
import { describePortion } from '../features/session/portion';
import { useI18n } from '../i18n/I18nProvider';
import { useNav } from '../nav/NavProvider';
import { useServices } from '../providers/services';
import { shareText } from '../platform/share';
import { useToast } from '../providers/Toasts';

const styles = StyleSheet.create({
  stack: { gap: spacing.md + spacing.xxs },
  overline: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  glass: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xxs,
    borderRadius: radii.pill,
  },
  when: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  seat: { gap: spacing.sm },
  occurrence: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: minTouchTarget,
    paddingVertical: spacing.sm,
  },
  occurrenceWhen: { flex: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  block: { gap: spacing.sm },
  listPad: { paddingHorizontal: spacing.md + spacing.xxs, paddingVertical: spacing.xs },
  rule: { height: 1, marginVertical: spacing.sm },
  grow: { flex: 1 },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: minTouchTarget,
  },
  initials: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  online: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs },
});

/** Who the session is for and when, in a glass pill and a line over the picture (D17). */
function SessionOverline({ session }: { session: Session }) {
  const { t, locale } = useI18n();
  const c = useTheme().colors;
  const dot = (
    <Text variant="caption" color="textOnHero" strong decorative>
      {' · '}
    </Text>
  );
  return (
    <View style={styles.overline}>
      <View style={[styles.glass, { backgroundColor: c.heroGlass }]}>
        <Text variant="caption" color="textOnHero" strong>
          {t(`sections.${session.section}`)}
        </Text>
        {dot}
        <Text variant="caption" color="textOnHero" strong>
          {t(`profile.language.${session.language}`)}
        </Text>
        {dot}
        <Text variant="caption" color="textOnHero" strong>
          {t(`programs.${session.program}`)}
        </Text>
      </View>
      <View style={styles.when}>
        <Text variant="caption" color="textOnHero">
          {describeSchedule(session, t, locale)}
        </Text>
        <Text variant="caption" color="textOnHero" decorative>
          ·
        </Text>
        <Text variant="caption" color="textOnHero">
          {t('session.duration', { count: session.durationMinutes })}
        </Text>
      </View>
    </View>
  );
}

export function SessionScreen({ sessionId }: { sessionId: string }) {
  const { t, l, locale } = useI18n();
  const nav = useNav();
  const { openUrl, now } = useServices();
  const requireAuth = useRequireAuth();
  const session = useSession(sessionId);
  const venue = useVenue(session.data?.venueId ?? null);
  const areas = useAreas(session.data?.venue.cityId ?? null);
  const origin = useOrigin();
  const occurrences = useSessionOccurrences(sessionId, toInstant(now()));
  const mine = useMyRegistrations();
  const toast = useToast();
  const c = useTheme().colors;
  const share = async (s: Session) => {
    const message = t('session.share.message', {
      title: l(s.title).text,
      venue: l(s.venue.name).text,
      when: s.nextOccurrence
        ? describeOccurrence(s.nextOccurrence, s.timezone, locale)
        : describeSchedule(s, t, locale),
    });
    const shared = await shareText(`${message} ${venueMapUrl(s.venue)}`);
    if (!shared) toast.show(t('session.share.unavailable'), 'info');
  };

  /** "Area · 0.8 km" under the venue name, from what we know; the old hint when we know nothing. */
  const venueLine = (s: Session) => {
    const area = areas.data?.find((a) => a.id === s.venue.areaId);
    const parts: string[] = [];
    if (area) parts.push(l(area.name).text);
    if (origin) {
      const d = distanceParts(haversineMetres(origin, s.venue), locale);
      parts.push(
        d.unit === 'km'
          ? t('home.distance.km', { distance: d.value })
          : t('home.distance.metres', { distance: d.value }),
      );
    }
    return parts.length > 0 ? parts.join(' · ') : t('session.openVenue');
  };

  return (
    <ScreenFrame
      title={session.data ? l(session.data.title).text : t('session.title')}
      onBack={() => nav.back()}
      photo={{
        seed: session.data?.venueId ?? sessionId,
        testID: 'session-photo',
        fade: 'dark',
        ...(session.data
          ? {
              onShare: () => void share(session.data!),
              overline: <SessionOverline session={session.data} />,
            }
          : {}),
      }}
      testID="session-screen"
      floatingFooter
      footer={
        session.data ? (
          <RegisterFooter
            session={session.data}
            mine={mine.data}
            onRegister={() => {
              const target = { name: 'register', sessionId } as const;
              if (requireAuth(target)) nav.go(target);
            }}
            onJourney={() => nav.tab({ name: 'journey' })}
          />
        ) : undefined
      }
    >
      <QueryBoundary query={session}>
        {(s) => {
          const venueName = l(s.venue.name);
          const description = s.description ? l(s.description) : null;
          const circle = s.circle;
          const onlineUrl = circle?.onlineLink ? safeWebUrl(circle.onlineLink) : null;
          const limited =
            s.registration.enabled &&
            s.registration.capacity !== null &&
            s.registration.seatsTaken !== null;
          return (
            <View style={styles.stack}>
              {s.status === 'cancelled' ? (
                <Banner kind="error" title={t('session.cancelled')} testID="session-cancelled" />
              ) : null}

              <Card padding="md">
                <InfoRow
                  leading={<IconTile icon="masjid" />}
                  title={venueName.text}
                  titleLang={venueName.lang}
                  subtitle={venueLine(s)}
                  onPress={() => nav.go({ name: 'venue', venueId: s.venueId })}
                  testID="session-venue"
                />
                {circle ? (
                  <>
                    <View style={[styles.rule, { backgroundColor: c.hairline }]} />
                    <InfoRow
                      leading={
                        <Initials text={initialsOf(circle.teacherName ?? l(circle.name).text)} />
                      }
                      title={circle.teacherName ?? l(circle.name).text}
                      {...(circle.teacherName
                        ? { subtitle: l(circle.name).text, subtitleLang: l(circle.name).lang }
                        : {})}
                      trailing={
                        onlineUrl ? (
                          <Pressable
                            role="link"
                            onPress={() => void openUrl(onlineUrl)}
                            hitSlop={spacing.sm}
                            style={styles.online}
                            testID="session-online"
                          >
                            <Text variant="caption" color="textAccent" strong>
                              {t('session.online')}
                            </Text>
                            <Icon name="arrow-forward" size={14} color={c.textAccent} />
                          </Pressable>
                        ) : undefined
                      }
                      testID="session-circle"
                    />
                  </>
                ) : null}
              </Card>

              <Card padding="md">
                <View style={styles.seat}>
                  {limited ? (
                    <SeatMeter
                      taken={s.registration.seatsTaken!}
                      capacity={s.registration.capacity!}
                    />
                  ) : null}
                  {!limited || s.registration.full ? (
                    <Text
                      variant="caption"
                      color="textSecondary"
                      testID="session-registration-info"
                    >
                      {!s.registration.enabled
                        ? t('session.registration.notNeeded')
                        : s.registration.full
                          ? t('session.registration.fullWaitlist')
                          : t('session.registration.open')}
                    </Text>
                  ) : null}
                </View>
              </Card>

              <View style={styles.block}>
                <Text variant="label" heading={2}>
                  {t('session.upcomingPortions')}
                </Text>
                <Card padding="none">
                  <View style={styles.listPad}>
                    <QueryBoundary query={occurrences}>
                      {(items) =>
                        items.length === 0 ? (
                          <View style={styles.occurrence}>
                            <Text variant="caption" color="textSecondary">
                              {t('session.noUpcoming')}
                            </Text>
                          </View>
                        ) : (
                          <OccurrenceRows session={s} items={items} />
                        )
                      }
                    </QueryBoundary>
                  </View>
                </Card>
              </View>

              {venue.data ? <FacilityChips facilities={venue.data.facilities} /> : null}

              {description ? (
                <Text variant="caption" color="textSecondary" lang={description.lang}>
                  {description.text}
                </Text>
              ) : null}

              {venue.data ? (
                <View style={styles.actions}>
                  <View>
                    <Button
                      variant="outline"
                      icon="route"
                      label={t('venue.directions')}
                      onPress={() => void openUrl(venueMapUrl(venue.data!))}
                      testID="session-location"
                    />
                  </View>
                  {venue.data.contactPhone ? (
                    <View>
                      <Button
                        variant="outline"
                        icon="phone"
                        label={t('venue.call')}
                        onPress={() => void openUrl(venuePhoneUrl(venue.data!.contactPhone!))}
                        testID="session-contact"
                      />
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
          );
        }}
      </QueryBoundary>
    </ScreenFrame>
  );
}

/** Two letters of a name in an amber circle, for the host row (D17). */
function Initials({ text }: { text: string }) {
  const c = useTheme().colors;
  return (
    <View aria-hidden style={[styles.initials, { backgroundColor: c.warningSubtle }]}>
      <Text variant="caption" color="textOnWarningSubtle" strong>
        {text}
      </Text>
    </View>
  );
}

/** A row of the venue card: a tile, a name and a line under it, and a chevron or an action. */
function InfoRow({
  leading,
  title,
  titleLang,
  subtitle,
  subtitleLang,
  trailing,
  onPress,
  testID,
}: {
  leading: ReactNode;
  title: string;
  titleLang?: 'en' | 'ur';
  subtitle?: string;
  subtitleLang?: 'en' | 'ur';
  trailing?: ReactNode;
  onPress?: () => void;
  testID?: string;
}) {
  const c = useTheme().colors;
  const body = (
    <>
      {leading}
      <View style={styles.grow}>
        <Text variant="label" lang={titleLang}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" color="textSecondary" lang={subtitleLang}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {onPress ? <Icon name="chevron-forward" size={16} color={c.textMuted} /> : trailing}
    </>
  );
  return onPress ? (
    <Pressable
      role="button"
      aria-label={subtitle ? `${title}, ${subtitle}` : title}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [styles.infoRow, pressed ? { opacity: 0.7 } : null]}
    >
      {body}
    </Pressable>
  ) : (
    <View style={styles.infoRow} testID={testID}>
      {body}
    </View>
  );
}

/** The dates coming up, each with its portion as an amber pill at the end (D17). */
function OccurrenceRows({ session, items }: { session: Session; items: readonly Occurrence[] }) {
  const { t, locale } = useI18n();
  const c = useTheme().colors;
  return (
    <View>
      {items.map((occurrence, i) => {
        const portion = describePortion(occurrence, t, locale);
        const cancelled = occurrence.status === 'cancelled';
        return (
          <View
            key={occurrence.id}
            accessible
            testID={`occurrence-${occurrence.id}`}
            style={[
              styles.occurrence,
              i < items.length - 1 ? { borderBottomWidth: 1, borderBottomColor: c.hairline } : null,
            ]}
          >
            <View style={styles.occurrenceWhen}>
              <Text variant="label" color="textSecondary">
                {describeOccurrence(occurrence, session.timezone, locale)}
              </Text>
            </View>
            {cancelled ? (
              <Tag kind="alert" label={t('session.cancelled')} />
            ) : portion ? (
              <Tag kind="gilt" label={portion} />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

function RegisterFooter({
  session,
  mine,
  onRegister,
  onJourney,
}: {
  session: Session;
  mine: readonly Registration[] | undefined;
  onRegister: () => void;
  onJourney: () => void;
}) {
  const { t } = useI18n();
  const state = registerState(session, mine);
  switch (state.kind) {
    case 'cancelled':
      return (
        <Button
          label={t('session.cancelled')}
          size="large"
          fullWidth
          disabled
          testID="register-button"
        />
      );
    case 'notNeeded':
      return (
        <Text variant="body" color="textSecondary" align="center" testID="register-not-needed">
          {t('session.registration.notNeeded')}
        </Text>
      );
    case 'registered':
      return (
        <Button
          variant="secondary"
          size="large"
          fullWidth
          label={
            state.registration.status === 'waitlisted'
              ? t('session.onWaitlist')
              : t('session.alreadyRegistered')
          }
          onPress={onJourney}
          testID="register-button"
        />
      );
    case 'waitlist':
      return (
        <Button
          label={t('session.waitlist')}
          size="large"
          fullWidth
          onPress={onRegister}
          testID="register-button"
        />
      );
    case 'open':
      return (
        <Button
          label={t('session.reserve')}
          icon="ticket"
          size="large"
          fullWidth
          onPress={onRegister}
          testID="register-button"
        />
      );
  }
}
