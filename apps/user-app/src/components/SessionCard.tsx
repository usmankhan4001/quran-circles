import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, SessionCard as KitSessionCard, spacing } from '@qc/ui';
import type { Session } from '@qc/contracts';
import { useI18n } from '../i18n/I18nProvider';
import { describeWhenParts } from '../features/nearby/schedule';

export interface SessionCardProps {
  session: Session;
  onPress?: () => void;
  /** Extra content under the card: a status, a switch, a button. It sits in its own card. */
  footer?: ReactNode;
  /** Shows the next dated occurrence instead of the repeating schedule. */
  emphasis?: 'schedule' | 'next';
  testID?: string;
}

const styles = StyleSheet.create({ stack: { gap: spacing.sm }, footer: { gap: spacing.sm } });

/**
 * A session as a card: it fills the kit's `SessionCard` from a session of the API. The kit card
 * has no slot for extra controls, so a footer goes in a card of its own right under it.
 */
export function SessionCard({
  session,
  onPress,
  footer,
  emphasis = 'schedule',
  testID,
}: SessionCardProps) {
  const { t, l, locale } = useI18n();
  const title = l(session.title);
  const venue = l(session.venue.name);
  const { time, day } = describeWhenParts(session, t, locale, emphasis === 'next');
  const registration = session.registration;
  const tag =
    session.status === 'cancelled'
      ? { label: t('session.cancelled'), kind: 'alert' as const }
      : registration.enabled && registration.full
        ? { label: t('session.full'), kind: 'gilt' as const }
        : undefined;
  const card = (
    <KitSessionCard
      title={title.text}
      place={venue.text}
      time={time}
      day={day}
      eyebrow={t(`programs.${session.program}`)}
      details={[t(`sections.${session.section}`), t(`profile.language.${session.language}`)].join(
        t('schedule.separator'),
      )}
      {...(tag ? { tag } : {})}
      {...(registration.enabled && !registration.full && registration.capacity !== null
        ? { seats: { taken: registration.seatsTaken ?? 0, capacity: registration.capacity } }
        : {})}
      onPress={onPress}
      accessibilityLabel={`${title.text}, ${venue.text}, ${day} ${time}`}
      testID={testID ?? `session-card-${session.id}`}
    />
  );
  if (!footer) return card;
  return (
    <View style={styles.stack}>
      {card}
      <Card>
        <View style={styles.footer}>{footer}</View>
      </Card>
    </View>
  );
}
