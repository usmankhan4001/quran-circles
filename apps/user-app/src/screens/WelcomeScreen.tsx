import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, StarMark, Text, spacing, useTheme } from '@qc/ui';
import { Page } from '../components/Page';
import { LanguageSwitch } from '../components/LanguageSwitch';
import { useI18n } from '../i18n/I18nProvider';
import { useNav } from '../nav/NavProvider';
import { usePreferences } from '../providers/hooks';

const styles = StyleSheet.create({
  language: { width: 170, alignSelf: 'flex-end' },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.xl },
  logo: {
    width: 160,
    height: 160,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  words: { alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md },
  actions: { gap: spacing.md },
});

/**
 * The first screen: the big logo and every way in. Browsing needs no account, so "Browse circles"
 * is as visible as "Create an account". It is shown once; the choice is remembered.
 */
export function WelcomeScreen() {
  const { t } = useI18n();
  const nav = useNav();
  const prefs = usePreferences();
  const c = useTheme().colors;

  // Seen once, then never again on its own.
  const { welcomed, update } = prefs;
  useEffect(() => {
    if (!welcomed) void update({ welcomed: true });
  }, [welcomed, update]);

  return (
    <Page
      testID="welcome-screen"
      scroll
      footer={
        <View style={styles.actions}>
          <Button
            label={t('welcome.create')}
            icon="user"
            size="large"
            fullWidth
            onPress={() => nav.go({ name: 'signUp' })}
            testID="welcome-create"
          />
          <Button
            label={t('welcome.signIn')}
            icon="phone"
            variant="outline"
            size="large"
            fullWidth
            onPress={() => nav.go({ name: 'signIn' })}
            testID="welcome-sign-in"
          />
          <Button
            label={t('welcome.browse')}
            icon="map-trifold"
            variant="tertiary"
            size="large"
            fullWidth
            onPress={() => nav.replace({ name: 'home' })}
            testID="welcome-browse"
          />
          <Button
            label={t('welcome.features')}
            icon="info"
            variant="tertiary"
            fullWidth
            onPress={() => nav.go({ name: 'features' })}
            testID="welcome-features"
          />
          <Text variant="caption" color="textMuted" align="center">
            {t('welcome.browseNote')}
          </Text>
        </View>
      }
    >
      <View style={styles.language}>
        <LanguageSwitch />
      </View>
      <View style={styles.hero}>
        <View style={[styles.logo, { backgroundColor: c.accent }]} aria-hidden>
          <StarMark size={72} />
        </View>
        <View style={styles.words}>
          <Text variant="display" heading={1} align="center">
            {t('app.name')}
          </Text>
          <Text variant="body" color="textMuted" align="center">
            {t('welcome.tagline')}
          </Text>
        </View>
      </View>
    </Page>
  );
}
