import { Image, Platform, StyleSheet, View } from 'react-native';
import { Button, Card, Text, spacing } from '@qc/ui';
import { ScreenFrame } from '../../components/ScreenFrame';
import { useI18n } from '../../i18n/I18nProvider';
import type { TranslationKey } from '../../i18n/translate';
import { useNav } from '../../nav/NavProvider';
import { readEnv } from '../../platform/env';
import { useServices } from '../../providers/services';
import { PageLinks, PublicPage } from './PublicPage';
import { deleteAccountPage, privacyPage, supportPage, termsPage } from './pages';

export const PrivacyScreen = () => <PublicPage spec={privacyPage} />;
export const TermsScreen = () => <PublicPage spec={termsPage} />;
export const DeleteAccountScreen = () => <PublicPage spec={deleteAccountPage} />;
export const SupportScreen = () => <PublicPage spec={supportPage} />;

const FEATURES: { id: string; title: TranslationKey; body: TranslationKey }[] = [
  { id: 'find', title: 'store.feature.find.title', body: 'store.feature.find.body' },
  { id: 'know', title: 'store.feature.know.title', body: 'store.feature.know.body' },
  { id: 'join', title: 'store.feature.join.title', body: 'store.feature.join.body' },
  { id: 'read', title: 'store.feature.read.title', body: 'store.feature.read.body' },
  { id: 'prayer', title: 'store.feature.prayer.title', body: 'store.feature.prayer.body' },
  { id: 'journey', title: 'store.feature.journey.title', body: 'store.feature.journey.body' },
];

const styles = StyleSheet.create({
  page: { gap: spacing.xl },
  hero: { gap: spacing.md, alignItems: 'flex-start' },
  icon: { width: 96, height: 96, borderRadius: 22 },
  actions: { gap: spacing.sm, alignSelf: 'stretch' },
  features: { gap: spacing.md },
  feature: { gap: spacing.xs },
  section: { gap: spacing.md },
});

/**
 * The page the store listing links to (`/welcome`): what the app is, how to get it, what it
 * does, and the links Google Play asks for. `/` stays the app itself.
 */
export function WelcomeScreen() {
  const { t } = useI18n();
  const nav = useNav();
  const { openUrl } = useServices();
  return (
    <ScreenFrame title={t('store.title')} onBack={() => nav.back()} plain testID="public-welcome">
      <View style={styles.page}>
        <View style={styles.hero}>
          {Platform.OS === 'web' ? (
            <Image
              source={{ uri: '/icons/icon-192.png' }}
              style={styles.icon}
              accessibilityIgnoresInvertColors
              accessible={false}
            />
          ) : null}
          <Text variant="title2" heading={2}>
            {t('store.tagline')}
          </Text>
          <Text variant="bodyLarge" selectable>
            {t('store.lead')}
          </Text>
          <View style={styles.actions}>
            <Button
              variant="primary"
              fullWidth
              label={t('store.play.get')}
              onPress={() => void openUrl(readEnv().playStoreUrl)}
              testID="store-play"
            />
            <Button
              variant="secondary"
              fullWidth
              label={t('store.web.open')}
              onPress={() => nav.go({ name: 'home' })}
              testID="store-web"
            />
          </View>
          <Text variant="caption" color="textSecondary">
            {t('store.web.hint')}
          </Text>
        </View>
        <View style={styles.section} testID="store-features">
          <Text variant="title3" heading={2}>
            {t('store.features.heading')}
          </Text>
          <View style={styles.features}>
            {FEATURES.map((feature) => (
              <Card key={feature.id} testID={`feature-${feature.id}`}>
                <View style={styles.feature}>
                  <Text variant="title3" heading={3}>
                    {t(feature.title)}
                  </Text>
                  <Text variant="body" color="textSecondary">
                    {t(feature.body)}
                  </Text>
                </View>
              </Card>
            ))}
          </View>
        </View>
        <View style={styles.section}>
          <Text variant="title3" heading={2}>
            {t('store.free.heading')}
          </Text>
          <Text variant="body">{t('store.free.body')}</Text>
          <Text variant="body" color="textSecondary">
            {t('store.operator')}
          </Text>
        </View>
        <PageLinks current="welcome" />
      </View>
    </ScreenFrame>
  );
}
