import { StyleSheet, View } from 'react-native';
import { Button, Card, Text, creditGroups, spacing, type CreditEntry } from '@qc/ui';
import { ScreenFrame } from '../components/ScreenFrame';
import { Section } from '../components/Section';
import { useI18n } from '../i18n/I18nProvider';
import { useNav } from '../nav/NavProvider';
import { useServices } from '../providers/services';

const styles = StyleSheet.create({
  stack: { gap: spacing.xl },
  entries: { gap: spacing.md },
  entry: { gap: spacing.xs, alignItems: 'stretch' },
  link: { alignSelf: 'flex-start' },
});

function Credit({ entry }: { entry: CreditEntry }) {
  const { t } = useI18n();
  const { openUrl } = useServices();
  return (
    <Card testID={`credit-${entry.id}`}>
      <View style={styles.entry}>
        <Text variant="title3" heading={3}>
          {t(entry.name)}
        </Text>
        <Text variant="body" color="textSecondary" selectable>
          {t(entry.body)}
        </Text>
        {entry.link ? (
          <View style={styles.link}>
            <Button
              variant="tertiary"
              label={t(entry.link.label)}
              onPress={() => {
                if (entry.link) void openUrl(entry.link.url);
              }}
              testID={`credit-${entry.id}-link`}
            />
          </View>
        ) : null}
      </View>
    </Card>
  );
}

/**
 * About and credits (reached from Profile): the fonts the app ships with and their licences,
 * the source of the Quran text and the translations. The list is shared with the console
 * (`creditGroups` in `@qc/ui`).
 */
export function CreditsScreen() {
  const { t } = useI18n();
  const nav = useNav();
  return (
    <ScreenFrame title={t('credits.title')} onBack={() => nav.back()} testID="credits-screen">
      <View style={styles.stack}>
        <Text variant="bodyLarge">{t('credits.intro')}</Text>
        {creditGroups.map((group) => (
          <Section key={group.id} title={t(group.heading)} testID={`credits-${group.id}`}>
            <View style={styles.entries}>
              {group.entries.map((entry) => (
                <Credit key={entry.id} entry={entry} />
              ))}
            </View>
          </Section>
        ))}
      </View>
    </ScreenFrame>
  );
}
