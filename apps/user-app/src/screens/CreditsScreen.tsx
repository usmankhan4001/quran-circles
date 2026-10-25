import { Pressable, StyleSheet, View } from 'react-native';
import {
  Card,
  Icon,
  SectionHeader,
  StarMark,
  Text,
  creditGroups,
  minTouchTarget,
  spacing,
  useTheme,
  type CreditEntry,
} from '@qc/ui';
import { Page } from '../components/Page';
import { useI18n } from '../i18n/I18nProvider';
import { useNav } from '../nav/NavProvider';
import { useServices } from '../providers/services';

const styles = StyleSheet.create({
  stack: { gap: spacing.xl },
  intro: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  introText: { flex: 1 },
  group: { gap: spacing.xs },
  entries: { gap: spacing.md },
  entry: { gap: spacing.sm },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    minHeight: minTouchTarget,
  },
});

function Credit({ entry }: { entry: CreditEntry }) {
  const { t } = useI18n();
  const c = useTheme().colors;
  const { openUrl } = useServices();
  const link = entry.link;
  return (
    <Card padding="lg" testID={`credit-${entry.id}`}>
      <View style={styles.entry}>
        <Text variant="title3" heading={3}>
          {t(entry.name)}
        </Text>
        <Text variant="caption" color="textSecondary" selectable>
          {t(entry.body)}
        </Text>
        {link ? (
          <Pressable
            role="link"
            aria-label={t(link.label)}
            onPress={() => void openUrl(link.url)}
            testID={`credit-${entry.id}-link`}
            style={({ pressed }) => [styles.link, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Text variant="label" color="textAccent" decorative>
              {t(link.label)}
            </Text>
            <Icon name="arrow-up-right" size={16} color={c.textAccent} />
          </Pressable>
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
    <Page barTitle={t('credits.title')} onBack={() => nav.back()} testID="credits-screen">
      <View style={styles.stack}>
        <View style={styles.intro}>
          <StarMark size={44} />
          <View style={styles.introText}>
            <Text variant="bodyLarge">{t('credits.intro')}</Text>
          </View>
        </View>
        {creditGroups.map((group) => (
          <View key={group.id} style={styles.group} testID={`credits-${group.id}`}>
            <SectionHeader title={t(group.heading)} />
            <View style={styles.entries}>
              {group.entries.map((entry) => (
                <Credit key={entry.id} entry={entry} />
              ))}
            </View>
          </View>
        ))}
      </View>
    </Page>
  );
}
