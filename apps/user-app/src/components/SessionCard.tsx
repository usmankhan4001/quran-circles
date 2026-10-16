import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, Text, spacing } from '@qc/ui';
import type { Session } from '@qc/contracts';
import { useI18n } from '../i18n/I18nProvider';
import { describeOccurrence, describeSchedule } from '../features/nearby/schedule';

export interface SessionCardProps {
  session: Session;
  onPress?: () => void;
  /** Extra content under the facts: a status, a button. */
  footer?: ReactNode;
  /** Shows the next dated occurrence instead of the repeating schedule. */
  emphasis?: 'schedule' | 'next';
  testID?: string;
}

const styles = StyleSheet.create({ stack: { gap: spacing.xs } });

/** A session as a card: title, venue, when, and who it is for. Used on Nearby, Home and My Journey. */
export function SessionCard({ session, onPress, footer, emphasis = 'schedule', testID }: SessionCardProps) {
  const { t, l, locale } = useI18n();
  const title = l(session.title);
  const venue = l(session.venue.name);
  const when =
    emphasis === 'next' && session.nextOccurrence
      ? describeOccurrence(session.nextOccurrence, session.timezone, locale)
      : describeSchedule(session, t, locale);
  const registration = session.registration;
  const facts = [t(`sections.${session.section}`), t(`languages.${session.language}`)].join(
    t('schedule.separator'),
  );
  return (
    <Card
      testID={testID ?? `session-card-${session.id}`}
      onPress={onPress}
      accessibilityLabel={`${title.text}, ${venue.text}, ${when}`}
    >
      <View style={styles.stack}>
        <Text variant="title3" lang={title.lang}>
          {title.text}
        </Text>
        <Text variant="body" color="textSecondary" lang={venue.lang}>
          {venue.text}
        </Text>
        <Text variant="body">{when}</Text>
        <Text variant="caption" color="textSecondary">
          {facts}
        </Text>
        {registration.enabled && registration.full ? (
          <Text variant="caption" color="textWarning" strong>
            {t('session.full')}
          </Text>
        ) : null}
        {session.status === 'cancelled' ? (
          <Text variant="caption" color="textDanger" strong>
            {t('session.cancelled')}
          </Text>
        ) : null}
        {footer}
      </View>
    </Card>
  );
}
