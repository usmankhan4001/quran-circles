import { StyleSheet, View } from 'react-native';
import { Button, Icon, Text, radii, spacing, useTheme, type IconName } from '@qc/ui';
import { Page } from '../components/Page';
import { useI18n } from '../i18n/I18nProvider';
import { useNav } from '../nav/NavProvider';

const styles = StyleSheet.create({
  list: { gap: spacing.xl },
  item: { flexDirection: 'row', gap: spacing.lg, alignItems: 'flex-start' },
  badge: {
    width: 48,
    height: 48,
    borderRadius: radii.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  words: { flex: 1, gap: spacing.xs },
});

const FEATURES: readonly {
  key: 'find' | 'join' | 'remind' | 'quran' | 'journey';
  icon: IconName;
}[] = [
  { key: 'find', icon: 'map-pin' },
  { key: 'join', icon: 'check-circle' },
  { key: 'remind', icon: 'bell' },
  { key: 'quran', icon: 'book-open-text' },
  { key: 'journey', icon: 'bookmark' },
];

/** What the app does, in five plain lines. Reached from "What can I do here?" on Welcome. */
export function FeaturesScreen() {
  const { t } = useI18n();
  const nav = useNav();
  const c = useTheme().colors;
  return (
    <Page
      testID="features-screen"
      onBack={() => nav.back()}
      footer={
        <Button
          label={t('features.start')}
          size="large"
          fullWidth
          onPress={() => nav.replace({ name: 'home' })}
          testID="features-start"
        />
      }
    >
      <Text variant="display" heading={1}>
        {t('features.title')}
      </Text>
      <View style={styles.list}>
        {FEATURES.map((f) => (
          <View key={f.key} style={styles.item} testID={`feature-${f.key}`}>
            <View style={[styles.badge, { backgroundColor: c.accentSubtle }]} aria-hidden>
              <Icon name={f.icon} size={24} color={c.textOnAccentSubtle} />
            </View>
            <View style={styles.words}>
              <Text variant="title3" heading={2}>
                {t(`features.${f.key}.title`)}
              </Text>
              <Text variant="body" color="textMuted">
                {t(`features.${f.key}.body`)}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </Page>
  );
}
