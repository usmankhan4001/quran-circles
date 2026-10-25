import { useEffect } from 'react';
import type { Locale } from '@qc/contracts';
import { SegmentedControl } from '@qc/ui';
import { useLocaleSync } from '../features/profile/hooks';
import { useI18n } from '../i18n/I18nProvider';
import { languages } from '../i18n/languages';
import { otherLocale, prefetchLanguage } from '../i18n/languageLoader';
import { usePreferences } from '../providers/hooks';
import { useToast } from '../providers/Toasts';

/**
 * English or Urdu. The words come first, so the switch happens in one go; without them (offline,
 * before the other language was ever downloaded) nothing changes and the person is told.
 */
export function LanguageSwitch({ testID = 'language-switch' }: { testID?: string }) {
  const { t, locale: shown } = useI18n();
  const prefs = usePreferences();
  const syncLocale = useLocaleSync();
  const toast = useToast();
  // The web downloads one language's words at a time: fetch the other one now.
  useEffect(() => prefetchLanguage(languages, otherLocale(shown)), [shown]);
  return (
    <SegmentedControl<Locale>
      accessibilityLabel={t('welcome.language')}
      value={prefs.locale}
      onChange={(locale) => {
        languages.load(locale).then(
          () => {
            void prefs.update({ locale });
            void syncLocale(locale);
          },
          () => toast.show(t('ui.offlineBody'), 'warning'),
        );
      }}
      options={[
        { value: 'en', label: t('profile.language.en') },
        { value: 'ur', label: t('profile.language.ur') },
      ]}
      testID={testID}
    />
  );
}
