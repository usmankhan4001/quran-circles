import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Text, spacing, useTheme } from '@qc/ui';
import { formatClockTime } from '../core/format';
import { useTodayPortions } from '../features/readAlong/hooks';
import { describePortion } from '../features/session/portion';
import { useI18n } from '../i18n/I18nProvider';
import { useNav } from '../nav/NavProvider';
import { useServices } from '../providers/services';

const styles = StyleSheet.create({
  stack: { gap: spacing.sm },
  rule: { height: 3, width: spacing.xxl, borderRadius: 2 },
});

/**
 * "Read tonight's portion" (feature 4): on the day of a session the person registered for or
 * follows, the portion the coordinator set, opening the reader at its first ayah. Reading any
 * ayah of it counts as a day read (`useReadingDaySync`). No notification is added.
 */
function ReadAlongCardContent() {
  const { t, l, locale } = useI18n();
  const nav = useNav();
  const c = useTheme().colors;
  const { now } = useServices();
  const { enabled, portions } = useTodayPortions();
  const first = portions[0];
  if (!enabled || !first) return null;
  const { occurrence, session, start } = first;
  const portion = describePortion(occurrence, t, locale);
  const when = formatClockTime(occurrence.startsAt, session.timezone, locale);
  return (
    <Card variant="raised" testID="home-read-along">
      <View style={styles.stack}>
        <View style={[styles.rule, { backgroundColor: c.decoration }]} aria-hidden />
        <Text variant="eyebrow" color="textSecondary">
          {t('readAlong.eyebrow')}
        </Text>
        <Text variant="title3" heading={2}>
          {t('readAlong.title')}
        </Text>
        {portion ? (
          <Text variant="bodyLarge" testID="read-along-portion">
            {portion}
          </Text>
        ) : null}
        <Text variant="caption" color="textSecondary" testID="read-along-session">
          {t('readAlong.session', { session: l(session.title).text, time: when })}
        </Text>
        <Button
          label={t('readAlong.open')}
          icon="book"
          onPress={() => nav.tab({ name: 'quran', reader: { ...start, at: now().getTime() } })}
          testID="read-along-open"
        />
      </View>
    </Card>
  );
}

/** It takes no props, so it draws again when its own data changes, not each time Home does. */
export const ReadAlongCard = memo(ReadAlongCardContent);
