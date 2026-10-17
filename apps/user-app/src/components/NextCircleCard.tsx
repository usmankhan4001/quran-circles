import { Pressable, StyleSheet, View } from 'react-native';
import { Icon, Text, radii, spacing, useTheme } from '@qc/ui';
import type { Session } from '@qc/contracts';
import { useI18n } from '../i18n/I18nProvider';
import { describeOccurrence, describeSchedule } from '../features/nearby/schedule';
import { Glyph } from '../ui/Glyph';

export interface NextCircleCardProps {
  session: Session;
  /** The small line above the title: "Your next session". */
  eyebrow: string;
  onPress: () => void;
  testID?: string;
}

const styles = StyleSheet.create({
  card: { borderRadius: radii.card, padding: spacing.lg, gap: spacing.xs },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  grow: { flex: 1, gap: spacing.xs },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});

/**
 * "Your next circle" inside the green header of Home (D14): the session, its venue and when it
 * starts, on light glass. The whole card opens the session.
 */
export function NextCircleCard({ session, eyebrow, onPress, testID }: NextCircleCardProps) {
  const { t, l, locale } = useI18n();
  const c = useTheme().colors;
  const title = l(session.title);
  const venue = l(session.venue.name);
  const when = session.nextOccurrence
    ? describeOccurrence(session.nextOccurrence, session.timezone, locale)
    : describeSchedule(session, t, locale);
  return (
    <Pressable
      role="button"
      aria-label={`${eyebrow}: ${title.text}, ${venue.text}, ${when}`}
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: pressed ? c.heroGlassPressed : c.heroGlass },
      ]}
    >
      <Text variant="eyebrow" color="textOnHero">
        {eyebrow}
      </Text>
      <View style={styles.top}>
        <View style={styles.grow}>
          <Text variant="title2" color="textOnHero" lang={title.lang}>
            {title.text}
          </Text>
          <View style={styles.line}>
            <Glyph name="pin" size={18} color={c.textOnHero} />
            <View style={styles.grow}>
              <Text variant="body" color="textOnHero" lang={venue.lang}>
                {venue.text}
              </Text>
            </View>
          </View>
          <View style={styles.line}>
            <Glyph name="clock" size={18} color={c.textOnHero} />
            <View style={styles.grow}>
              <Text variant="bodyLarge" color="textOnHero" strong>
                {when}
              </Text>
            </View>
          </View>
        </View>
        <Icon name="chevron-forward" size={24} color={c.textOnHero} />
      </View>
    </Pressable>
  );
}
